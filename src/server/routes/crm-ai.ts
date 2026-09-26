import { Router } from "express";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { promises as dnsPromises } from "dns";
import { getGeminiAI, getConfigKey } from "./api-keys";
import {
  db,
  emailAccountsTable,
  emailTrackingTable,
  crmProspectsTable,
  automationSettingsTable,
  websiteReportsTable,
  followUpQueueTable,
  inboxRepliesTable,
  externalApiKeysTable,
  siteConfigTable,
  affiliateCampaignsTable,
  affiliateContactsTable,
  saasUsersTable,
  userActivitiesTable,
} from "../../db";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { scrapeBusinessDirectories } from "../lib/business-scrapers";
import { createReport, buildReportEmailSection, getAgencyBaseUrl } from "./reports";
import { kvGetJson, kvSetJson } from "../lib/replit-kv";
import { requireAdmin } from "../lib/admin-auth";
import {
  getActiveTrainingProfile,
  buildTrainedOutreachPromptBlock,
  buildTrainedAnalysisPromptBlock,
} from "../lib/ai-training";

// ─── KV store helpers for email accounts (fallback when DB unavailable) ─────

const KV_ACCOUNTS_KEY = "EMAIL_ACCOUNTS";
const KV_ACCOUNT_COUNTER = "EMAIL_ACCOUNT_COUNTER";

type KvAccount = typeof emailAccountsTable.$inferSelect;

async function kvReadAccounts(): Promise<KvAccount[]> {
  return (await kvGetJson<KvAccount[]>(KV_ACCOUNTS_KEY)) ?? [];
}

async function kvWriteAccounts(accounts: KvAccount[]): Promise<void> {
  await kvSetJson(KV_ACCOUNTS_KEY, accounts);
}

async function kvNextId(): Promise<number> {
  const current = (await kvGetJson<number>(KV_ACCOUNT_COUNTER)) ?? 1000;
  const next = current + 1;
  await kvSetJson(KV_ACCOUNT_COUNTER, next);
  return next;
}

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTransporter(acct: { host: string; port: number; secure: boolean; user: string; password: string }) {
  const port = acct.port || 587;
  const secure = port === 465;
  const pass = (acct.password || "").replace(/\s/g, "");
  const user = (acct.user || "").trim();
  return nodemailer.createTransport({
    host: acct.host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any);
}

async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const ai = await getGeminiAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });
    return response.text ?? "";
  } catch {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });
    return response.text ?? "";
  }
}

function parseJSON(text: string): any {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[\{][\s\S]*[\]\}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse AI response as JSON");
  }
}

// ─── Real website scraper ─────────────────────────────────────────────────────

/**
 * Fetch the actual HTML of a business website and return plain-text content
 * (scripts/styles stripped). Returns "" if URL is missing or fetch fails.
 * Used to give the AI real, specific content for hyper-personalised emails.
 */
async function scrapeWebsite(url: string): Promise<string> {
  if (!url || /^(none|n\/a|no website|-)$/i.test(url.trim())) return "";
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await Promise.race([
      fetch(fullUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DevStudio/1.0)" } }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 8000)),
    ]) as Response;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);
  } catch { return ""; }
}

// ─── Domain / email verification helpers ─────────────────────────────────────

/** Extract the bare hostname from a URL or raw domain string. Returns "" if unparseable. */
function extractHostname(raw: string): string {
  if (!raw || raw.trim() === "" || /^(none|n\/a|no website|-)$/i.test(raw.trim())) return "";
  const s = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
  try { return new URL(s).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

/**
 * Returns true if the domain has at least one A/AAAA record (i.e. is real and live).
 * Times out after 5 s so it never hangs the whole request.
 */
async function verifyWebsiteDomain(website: string): Promise<boolean> {
  const host = extractHostname(website);
  if (!host) return true; // no website listed → not a reason to discard
  try {
    await Promise.race([
      dnsPromises.lookup(host),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
    ]);
    return true;
  } catch { return false; }
}

/**
 * Returns true if the email's domain has at least one MX record.
 * Emails sent to a domain with no MX will always bounce.
 */
async function verifyEmailMx(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1].toLowerCase();
  try {
    const records = await Promise.race([
      dnsPromises.resolveMx(domain),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
    ]);
    return Array.isArray(records) && records.length > 0;
  } catch { return false; }
}

/**
 * Verify all prospects in parallel; return only those whose email domain has
 * MX records AND (if a website is listed) whose website domain resolves in DNS.
 */
async function filterLiveProspects(prospects: any[]): Promise<{ live: any[]; dead: number }> {
  const CONCURRENCY = 8;
  const valid = prospects.filter(biz => biz && typeof biz === "object");
  const results: { biz: any; ok: boolean }[] = [];

  for (let i = 0; i < valid.length; i += CONCURRENCY) {
    const batch = valid.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (biz) => {
        const [emailOk, domainOk] = await Promise.all([
          verifyEmailMx(biz.email),
          verifyWebsiteDomain(biz.website),
        ]);
        return { biz, ok: emailOk && domainOk };
      })
    );
    results.push(...batchResults);
  }

  const live = results.filter(r => r.ok).map(r => r.biz);
  return { live, dead: results.length - live.length };
}

// ─── Google Places API (optional enrichment) ──────────────────────────────────

/**
 * Search Google Places API for real, operational businesses.
 * Returns an empty array if GOOGLE_PLACES_API_KEY is not set.
 */
async function searchGooglePlaces(category: string, city: string, country: string, count: number): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const query = `${category} in ${city}${country ? ", " + country : ""}`;
  try {
    const res = await Promise.race([
      fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus",
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(count, 20), languageCode: "en" }),
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 10000)),
    ]) as Response;
    const data = await res.json() as any;
    return (data.places || []).filter((p: any) => !p.businessStatus || p.businessStatus === "OPERATIONAL");
  } catch { return []; }
}

// ─── Placeholder filler ───────────────────────────────────────────────────────

/**
 * Replace any unfilled bracket placeholders in AI-generated text with real values.
 * Covers patterns like [Your Name], [Agency Name], [Your Company], etc.
 */
function fillPlaceholders(
  text: string,
  senderName = "Daniel",
  agencyName = "DevStudio"
): string {
  return text
    .replace(/\[(?:your\s+)?name\]/gi, senderName)
    .replace(/\[sender(?:\s+name)?\]/gi, senderName)
    .replace(/\[(?:agency|company|your\s+(?:agency|company))(?:\s+name)?\]/gi, agencyName)
    .replace(/\[(?:from|your)\s+(?:email\s+)?signature\]/gi, agencyName)
    // catch any remaining single-word bracket token that looks like a placeholder
    .replace(/\[\s*[A-Z][a-zA-Z\s]{1,30}\s*\]/g, (match) => {
      const inner = match.replace(/[\[\]]/g, "").trim().toLowerCase();
      if (inner.includes("name") || inner === "your" || inner === "sender") return senderName;
      if (inner.includes("agency") || inner.includes("company") || inner.includes("studio")) return agencyName;
      return match; // leave truly unknown tokens as-is
    });
}

// ─── 1x1 transparent GIF for open-tracking pixel ─────────────────────────────

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// ─── Tracking helpers ─────────────────────────────────────────────────────────

function getBaseUrl(req: any): string {
  const host = req.get("host") || "";
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${proto}://${host}`;
}

async function createTracking(prospectEmail: string, subject: string, emailType: string): Promise<string> {
  const trackingId = randomUUID();
  await db.insert(emailTrackingTable).values({
    trackingId, prospectEmail, subject, emailType,
  });
  return trackingId;
}

function injectTracking(html: string, baseUrl: string, trackingId: string): string {
  const pixelUrl = `${baseUrl}/api/crm/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  // Wrap every <a href="..."> link through the click tracker
  const tracked = html.replace(
    /<a\s([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
    (_match, before, url, after) => {
      const clickUrl = `${baseUrl}/api/crm/track/click/${trackingId}?url=${encodeURIComponent(url)}`;
      return `<a ${before}href="${clickUrl}"${after}>`;
    }
  );

  // Append pixel before </body> if present, otherwise at end
  if (tracked.includes("</body>")) {
    return tracked.replace("</body>", `${pixel}</body>`);
  }
  return tracked + pixel;
}

// ─── Account selection: round-robin by sentCount ──────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function effectiveSentToday(a: typeof emailAccountsTable.$inferSelect): number {
  return a.lastSentDay === todayStr() ? a.sentToday : 0;
}

function maskAccount(a: typeof emailAccountsTable.$inferSelect) {
  return {
    id: a.id, label: a.label, provider: a.provider,
    host: a.host, port: a.port, secure: a.secure,
    user: a.user, fromName: a.fromName, fromEmail: a.fromEmail,
    active: a.active, sentCount: a.sentCount,
    dailyLimit: a.dailyLimit, sentToday: effectiveSentToday(a),
    consecutiveFailures: a.consecutiveFailures,
    lastError: a.lastError, lastErrorAt: (a.lastErrorAt as any)?.toISOString?.() ?? null,
    autoPaused: a.autoPaused,
    hasPassword: !!a.password,
    createdAt: (a.createdAt as any)?.toISOString?.() ?? String(a.createdAt),
  };
}

const MAX_CONSECUTIVE_FAILURES = 3;

async function autoSeedBrevo(): Promise<void> {
  const envUser = process.env.BREVO_SMTP_USER || (await getConfigKey("BREVO_SMTP_USER").catch(() => ""));
  const envPass =
    process.env.BREVO_PASS ||
    process.env.BREVO_SMTP_PASSWORD ||
    (await getConfigKey("BREVO_SMTP_KEY").catch(() => ""));
  if (!envUser || !envPass) return;
  try {
    const count = await db.select().from(emailAccountsTable).limit(1);
    if (count.length > 0) return;
    await db.insert(emailAccountsTable).values({
      label: "Brevo SMTP", provider: "brevo",
      host: "smtp-relay.brevo.com", port: 587, secure: false,
      user: envUser, password: envPass,
      fromName: "DevStudio", fromEmail: "", active: true, sentCount: 0,
    });
  } catch {}
}

/** Build a virtual email account from SMTP_* env vars (id = -1, never touches DB). */
function getEnvEmailAccount(): typeof emailAccountsTable.$inferSelect | null {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) return null;
  const now = new Date();
  return {
    id: -1,
    label: "Env SMTP",
    provider: process.env.SMTP_HOST?.includes("gmail") ? "gmail" : "custom",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    user,
    password,
    fromName: process.env.SMTP_FROM_NAME || process.env.AGENCY_NAME || "DevStudio",
    fromEmail: process.env.SMTP_FROM_EMAIL || user,
    imapEnabled: false,
    imapHost: "",
    imapPort: 993,
    active: true,
    sentCount: 0,
    dailyLimit: 80,
    sentToday: 0,
    lastSentDay: "",
    consecutiveFailures: 0,
    lastError: "",
    lastErrorAt: null,
    autoPaused: false,
    createdAt: now,
  };
}

async function getNextAccount(excludeIds: number[] = []) {
  await autoSeedBrevo();
  let rows: (typeof emailAccountsTable.$inferSelect)[] = [];
  try {
    rows = await db.select().from(emailAccountsTable)
      .where(eq(emailAccountsTable.active, true));
  } catch {
    // DB unavailable — load from KV store
    rows = await kvReadAccounts();
  }
  const today = todayStr();
  const eligible = rows
    .filter(a => !excludeIds.includes(a.id))
    .filter(a => !a.autoPaused)
    .filter(a => {
      const sentToday = a.lastSentDay === today ? a.sentToday : 0;
      return a.dailyLimit <= 0 || sentToday < a.dailyLimit;
    })
    .sort((a, b) => {
      const aToday = a.lastSentDay === today ? a.sentToday : 0;
      const bToday = b.lastSentDay === today ? b.sentToday : 0;
      if (aToday !== bToday) return aToday - bToday;
      if (a.sentCount !== b.sentCount) return a.sentCount - b.sentCount;
      return a.id - b.id;
    });
  if (eligible[0]) return eligible[0];
  // Final fallback: SMTP_* env vars. Respect excludeIds to avoid infinite retry.
  if (excludeIds.includes(-1)) return null;
  return getEnvEmailAccount();
}

async function incrementSentCount(id: number) {
  if (id <= 0) return; // env-var virtual account — no DB row to update
  const today = todayStr();
  try {
    const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    const acct = rows[0];
    const sentToday = acct && acct.lastSentDay === today ? acct.sentToday + 1 : 1;
    await db.update(emailAccountsTable)
      .set({
        sentCount: sql`${emailAccountsTable.sentCount} + 1`,
        sentToday,
        lastSentDay: today,
        consecutiveFailures: 0,
        lastError: "",
      })
      .where(eq(emailAccountsTable.id, id));
  } catch { /* DB unavailable, ignore */ }
}

async function recordFailure(id: number, message: string) {
  if (id <= 0) return; // env-var virtual account — no DB row to update
  try {
    const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    const acct = rows[0];
    if (!acct) return;
    const failures = acct.consecutiveFailures + 1;
    await db.update(emailAccountsTable)
      .set({
        consecutiveFailures: failures,
        lastError: message.slice(0, 500),
        lastErrorAt: new Date(),
        ...(failures >= MAX_CONSECUTIVE_FAILURES && { autoPaused: true }),
      })
      .where(eq(emailAccountsTable.id, id));
  } catch { /* DB unavailable, ignore */ }
}

async function sendWithFailover(
  buildMail: (acct: typeof emailAccountsTable.$inferSelect) => Record<string, any>,
  preferredAccountId?: number
): Promise<{ acct: typeof emailAccountsTable.$inferSelect; result: any }> {
  const tried: number[] = [];
  let acct = preferredAccountId
    ? (await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, preferredAccountId)).limit(1))[0] ?? null
    : await getNextAccount();

  let lastErr: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!acct || !acct.user || !acct.password) {
      throw new Error(lastErr?.message || "No active email account available (all accounts paused, over limit, or missing credentials).");
    }
    tried.push(acct.id);
    try {
      const transporter = makeTransporter(acct);
      const result = await transporter.sendMail(buildMail(acct));
      await incrementSentCount(acct.id);
      return { acct, result };
    } catch (err: any) {
      lastErr = err;
      await recordFailure(acct.id, err.message || String(err));
      acct = await getNextAccount(tried);
    }
  }
  throw new Error(lastErr?.message || "Failed to send after trying all available accounts.");
}

/** Fire-and-forget internal notification (e.g. new proposal request) sent via the active outreach account. Never throws. */
export async function notifyAdmin(subject: string, html: string, text?: string) {
  const to = process.env.NOTIFY_EMAIL || "babsgill1314@gmail.com";
  try {
    await sendWithFailover((a) => ({
      from: `"${a.fromName}" <${a.fromEmail || a.user}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " "),
    }));
  } catch (err) {
    console.error("notifyAdmin failed:", (err as any)?.message || err);
  }
}

// ─── Email account CRUD ───────────────────────────────────────────────────────

router.get("/crm/email-accounts", requireAdmin, async (_req, res) => {
  await autoSeedBrevo();
  try {
    const rows = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
    // Sync KV with DB so production reads stay fresh
    kvWriteAccounts(rows).catch(() => {});
    res.json(rows.map(maskAccount));
  } catch {
    // DB unavailable — serve from KV store
    const accounts = await kvReadAccounts();
    res.json(accounts.map(maskAccount));
  }
});

router.post("/crm/email-accounts", requireAdmin, async (req, res) => {
  const { label, provider, host, port, secure, user, password, fromName, fromEmail, dailyLimit } = req.body;
  if (!user || !password || !host) {
    res.status(400).json({ error: "host, user, and password are required" });
    return;
  }
  const values = {
    label: label || user, provider: provider || "smtp",
    host, port: port || 587, secure: secure ?? false,
    user, password, fromName: fromName || "DevStudio",
    fromEmail: fromEmail || "", active: true, sentCount: 0,
    dailyLimit: Number.isFinite(dailyLimit) ? Math.max(0, dailyLimit) : 0,
  };
  try {
    const inserted = await db.insert(emailAccountsTable).values(values).returning();
    // Keep KV in sync
    const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
    kvWriteAccounts(all).catch(() => {});
    res.json({ success: true, account: maskAccount(inserted[0]) });
  } catch {
    // DB unavailable — save to KV store instead
    const accounts = await kvReadAccounts();
    const now = new Date();
    const newId = await kvNextId();
    const acct: KvAccount = {
      id: newId, ...values,
      imapEnabled: false, imapHost: "", imapPort: 993,
      sentToday: 0, lastSentDay: "", consecutiveFailures: 0,
      lastError: "", lastErrorAt: null, autoPaused: false, createdAt: now,
    };
    accounts.push(acct);
    await kvWriteAccounts(accounts);
    res.json({ success: true, account: maskAccount(acct) });
  }
});

router.put("/crm/email-accounts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { label, provider, host, port, secure, user, password, fromName, fromEmail, active, dailyLimit, resetFailures } = req.body;
  try {
    const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    const existing = rows[0];
    if (!existing) { res.status(404).json({ error: "Account not found" }); return; }
    const reactivating = active === true && existing.active === false;
    const updated = await db.update(emailAccountsTable).set({
      ...(label !== undefined && { label }),
      ...(provider !== undefined && { provider }),
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(secure !== undefined && { secure }),
      ...(user !== undefined && { user }),
      ...(password && password !== "••••••••" && { password }),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail }),
      ...(active !== undefined && { active }),
      ...(dailyLimit !== undefined && Number.isFinite(dailyLimit) && { dailyLimit: Math.max(0, dailyLimit) }),
      ...((resetFailures || reactivating) && { consecutiveFailures: 0, autoPaused: false, lastError: "" }),
    }).where(eq(emailAccountsTable.id, id)).returning();
    const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
    kvWriteAccounts(all).catch(() => {});
    res.json({ success: true, account: maskAccount(updated[0]) });
  } catch {
    // DB unavailable — update in KV
    const accounts = await kvReadAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) { res.status(404).json({ error: "Account not found" }); return; }
    const existing = accounts[idx];
    const reactivating = active === true && existing.active === false;
    accounts[idx] = {
      ...existing,
      ...(label !== undefined && { label }),
      ...(provider !== undefined && { provider }),
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(secure !== undefined && { secure }),
      ...(user !== undefined && { user }),
      ...(password && password !== "••••••••" && { password }),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail }),
      ...(active !== undefined && { active }),
      ...(dailyLimit !== undefined && Number.isFinite(dailyLimit) && { dailyLimit: Math.max(0, dailyLimit) }),
      ...((resetFailures || reactivating) && { consecutiveFailures: 0, autoPaused: false, lastError: null }),
    };
    await kvWriteAccounts(accounts);
    res.json({ success: true, account: maskAccount(accounts[idx]) });
  }
});

router.delete("/crm/email-accounts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(emailAccountsTable).where(eq(emailAccountsTable.id, id));
    const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
    kvWriteAccounts(all).catch(() => {});
  } catch {
    const accounts = await kvReadAccounts();
    await kvWriteAccounts(accounts.filter(a => a.id !== id));
  }
  res.json({ success: true });
});

// Direct single-account test — does NOT fail over, so the user can verify that specific account.
router.post("/crm/email-accounts/:id/test", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { to } = req.body as { to?: string };
  let acct: KvAccount | undefined;
  try {
    const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    acct = rows[0];
  } catch {
    // DB unavailable (e.g. helium) — fall back to KV store
    const accounts = await kvReadAccounts();
    acct = accounts.find(a => a.id === id);
  }
  if (!acct?.user || !acct?.password) {
    res.status(404).json({ error: "Account not found or missing credentials" });
    return;
  }
  try {
    const transporter = makeTransporter(acct);
    await transporter.sendMail({
      from: `"${acct.fromName}" <${acct.fromEmail || acct.user}>`,
      to: to || acct.user,
      subject: "DevStudio CRM — Email Test",
      text: `Account "${acct.label}" is working correctly.`,
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2 style="color:#6d28d9;">✓ Account working</h2><p>Account <strong>${acct.label}</strong> (${acct.user}) is configured and sending correctly via ${acct.host}.</p></div>`,
    });
    // Best-effort DB update — ignore if DB is unavailable
    db.update(emailAccountsTable).set({ consecutiveFailures: 0, autoPaused: false, lastError: "" }).where(eq(emailAccountsTable.id, id)).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    // Best-effort failure recording — ignore if DB is unavailable
    recordFailure(id, err.message || String(err)).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Legacy test-email (uses rotation + failover across active accounts)
router.post("/crm/test-email", async (req, res) => {
  const { to } = req.body as { to?: string };
  try {
    const { acct } = await sendWithFailover((a) => ({
      from: `"${a.fromName}" <${a.fromEmail || a.user}>`,
      to: to || a.user,
      subject: "DevStudio CRM — Email Test",
      text: "Email is configured correctly.",
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2 style="color:#6d28d9;">✓ Email working</h2><p>Sending via <strong>${a.label}</strong> (${a.user}).</p></div>`,
    }));
    res.json({ success: true, sentVia: acct.label });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Send email to prospect ───────────────────────────────────────────────────

router.post("/crm/send-email", requireAdmin, async (req, res) => {
  // reportUrl is optional — injected by CRM when a report was generated for this prospect
  const { to, subject, body, prospectName, accountId, reportUrl } = req.body as {
    to: string; subject: string; body: string; prospectName?: string; accountId?: number; reportUrl?: string;
  };

  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }

  // Build optional report section that gets appended to the email HTML
  const reportSection = reportUrl ? buildReportEmailSection(reportUrl, prospectName || to) : "";

  try {
    const baseUrl = getBaseUrl(req);
    const trackingId = await createTracking(to, subject, "outreach");
    const htmlBody = body.split("\n").map((line) => (line.trim() ? `<p style="margin:0 0 12px;line-height:1.6;">${line}</p>` : "<br/>")).join("");
    const { acct } = await sendWithFailover((a) => {
      const rawHtml = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e;">${htmlBody}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/><p style="color:#6b7280;font-size:13px;">${a.fromName}</p>${reportSection}</div>`;
      return {
        from: `"${a.fromName}" <${a.fromEmail || a.user}>`,
        to, subject, text: body,
        html: injectTracking(rawHtml, baseUrl, trackingId),
      };
    }, accountId);
    res.json({ success: true, to, sentAt: new Date().toISOString(), trackingId, sentVia: acct.label });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Send proposal email ──────────────────────────────────────────────────────

router.post("/crm/send-proposal-email", requireAdmin, async (req, res) => {
  const { to, prospectName, proposal, agencyName } = req.body as {
    to: string; prospectName: string; proposal: any; agencyName?: string;
  };
  if (!to || !proposal) { res.status(400).json({ error: "to and proposal are required" }); return; }

  const p = proposal.sections;
  const agency = agencyName || "DevStudio";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Georgia,serif;">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:40px 32px;color:#fff;">
    <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:8px;">Software Proposal</div>
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;">${prospectName}</h1>
    <p style="margin:0;opacity:0.85;font-size:15px;">Prepared exclusively by ${agency}</p>
  </div>

  ${p?.executiveSummary ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;">
    <h2 style="color:#6d28d9;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Executive Summary</h2>
    <p style="color:#374151;line-height:1.7;margin:0;">${p.executiveSummary}</p>
  </div>` : ""}

  ${p?.problems?.length ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;background:#fef9f0;">
    <h2 style="color:#d97706;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Problems We Identified</h2>
    ${p.problems.map((pb: string) => `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;"><span style="color:#ef4444;font-size:18px;flex-shrink:0;">⚠</span><p style="margin:0;color:#374151;line-height:1.6;">${pb}</p></div>`).join("")}
  </div>` : ""}

  ${p?.features?.length ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;">
    <h2 style="color:#6d28d9;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">What We'll Build For You</h2>
    <div style="display:grid;gap:12px;">
      ${p.features.map((f: any) => `<div style="background:#f5f3ff;border-left:4px solid #6d28d9;padding:14px 16px;border-radius:0 8px 8px 0;"><div style="font-weight:700;color:#4c1d95;margin-bottom:4px;">${f.name}</div><div style="color:#6b7280;font-size:14px;line-height:1.5;">${f.desc}</div></div>`).join("")}
    </div>
  </div>` : ""}

  ${p?.benefits?.length ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;background:#f0fdf4;">
    <h2 style="color:#16a34a;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Business Benefits</h2>
    ${p.benefits.map((b: string) => `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;"><span style="color:#16a34a;font-size:18px;flex-shrink:0;">✓</span><p style="margin:0;color:#374151;line-height:1.6;">${b}</p></div>`).join("")}
  </div>` : ""}

  ${p?.timeline?.length ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;">
    <h2 style="color:#6d28d9;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Delivery Timeline</h2>
    ${p.timeline.map((t: any, i: number) => `<div style="display:flex;gap:16px;margin-bottom:14px;align-items:flex-start;"><div style="background:#6d28d9;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0;">${t.week}</div><p style="margin:0;color:#374151;line-height:1.6;">${t.task}</p></div>`).join("")}
  </div>` : ""}

  ${p?.investment ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;background:#f5f3ff;">
    <h2 style="color:#6d28d9;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Investment</h2>
    <p style="color:#374151;line-height:1.7;margin:0;">${p.investment}</p>
  </div>` : ""}

  ${p?.nextSteps?.length ? `
  <div style="padding:28px 32px;border-bottom:1px solid #f0f0f0;">
    <h2 style="color:#6d28d9;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Next Steps</h2>
    ${p.nextSteps.map((s: string, i: number) => `<div style="display:flex;gap:14px;margin-bottom:12px;align-items:flex-start;"><div style="width:28px;height:28px;background:#6d28d9;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${i + 1}</div><p style="margin:0;color:#374151;line-height:1.6;padding-top:4px;">${s}</p></div>`).join("")}
  </div>` : ""}

  <div style="padding:32px;background:#1a1a2e;text-align:center;">
    <p style="color:#fff;font-size:16px;font-weight:700;margin:0 0 8px;">${agency}</p>
    <p style="color:#9ca3af;font-size:13px;margin:0;">Ready to get started? Reply to this email.</p>
  </div>

</div>
</body>
</html>`;

  try {
    const baseUrl = getBaseUrl(req);
    const subject = `Your Custom Software Proposal — ${prospectName}`;
    const trackingId = await createTracking(to, subject, "proposal");
    const trackedHtml = injectTracking(html, baseUrl, trackingId);
    const { acct } = await sendWithFailover((a) => ({
      from: `"${a.fromName}" <${a.fromEmail || a.user}>`,
      to, subject, html: trackedHtml,
    }));
    res.json({ success: true, to, sentAt: new Date().toISOString(), trackingId, sentVia: acct.label });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Email Tracking endpoints ─────────────────────────────────────────────────

// Open pixel
router.get("/crm/track/open/:trackingId", async (req, res) => {
  const { trackingId } = req.params;
  try {
    const now = new Date();
    const rows = await db.select().from(emailTrackingTable)
      .where(eq(emailTrackingTable.trackingId, trackingId)).limit(1);
    if (rows[0]) {
      await db.update(emailTrackingTable).set({
        opens: sql`${emailTrackingTable.opens} + 1`,
        lastOpenAt: now,
        firstOpenAt: rows[0].firstOpenAt ?? now,
      }).where(eq(emailTrackingTable.trackingId, trackingId));
    }
  } catch { /* silent — never break email clients */ }
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.send(PIXEL_GIF);
});

// Click redirect
router.get("/crm/track/click/:trackingId", async (req, res) => {
  const { trackingId } = req.params;
  const url = req.query.url as string;
  try {
    const now = new Date();
    const rows = await db.select().from(emailTrackingTable)
      .where(eq(emailTrackingTable.trackingId, trackingId)).limit(1);
    if (rows[0]) {
      await db.update(emailTrackingTable).set({
        clicks: sql`${emailTrackingTable.clicks} + 1`,
        firstClickAt: rows[0].firstClickAt ?? now,
      }).where(eq(emailTrackingTable.trackingId, trackingId));
    }
  } catch { /* silent */ }
  res.redirect(url && url.startsWith("http") ? url : "/");
});

// Batch stats by email list
router.get("/crm/track/stats", async (req, res) => {
  const emailsParam = req.query.emails as string;
  if (!emailsParam) { res.json({}); return; }
  const emails = emailsParam.split(",").map(e => e.trim()).filter(Boolean).slice(0, 100);
  if (emails.length === 0) { res.json({}); return; }
  try {
    const rows = await db.select().from(emailTrackingTable)
      .where(inArray(emailTrackingTable.prospectEmail, emails));
    const map: Record<string, { opens: number; clicks: number; firstOpenAt: string | null; lastOpenAt: string | null; firstClickAt: string | null; count: number }> = {};
    for (const r of rows) {
      const prev = map[r.prospectEmail];
      if (!prev) {
        map[r.prospectEmail] = {
          opens: r.opens, clicks: r.clicks,
          firstOpenAt: r.firstOpenAt?.toISOString() ?? null,
          lastOpenAt: r.lastOpenAt?.toISOString() ?? null,
          firstClickAt: r.firstClickAt?.toISOString() ?? null,
          count: 1,
        };
      } else {
        prev.opens += r.opens;
        prev.clicks += r.clicks;
        prev.count++;
        if (r.firstOpenAt && (!prev.firstOpenAt || r.firstOpenAt.toISOString() < prev.firstOpenAt)) prev.firstOpenAt = r.firstOpenAt.toISOString();
        if (r.lastOpenAt && (!prev.lastOpenAt || r.lastOpenAt.toISOString() > prev.lastOpenAt)) prev.lastOpenAt = r.lastOpenAt.toISOString();
        if (r.firstClickAt && (!prev.firstClickAt || r.firstClickAt.toISOString() < prev.firstClickAt)) prev.firstClickAt = r.firstClickAt.toISOString();
      }
    }
    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all tracking events for a single prospect email
router.get("/crm/track/history/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const rows = await db.select().from(emailTrackingTable)
      .where(eq(emailTrackingTable.prospectEmail, email))
      .orderBy(emailTrackingTable.sentAt);
    res.json(rows.map(r => ({
      trackingId: r.trackingId,
      subject: r.subject,
      emailType: r.emailType,
      opens: r.opens,
      clicks: r.clicks,
      firstOpenAt: r.firstOpenAt?.toISOString() ?? null,
      lastOpenAt: r.lastOpenAt?.toISOString() ?? null,
      firstClickAt: r.firstClickAt?.toISOString() ?? null,
      sentAt: r.sentAt.toISOString(),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Business Hunter ──────────────────────────────────────────────────────────

router.post("/crm/hunt-businesses", async (req, res) => {
  const { category, city, country, count = 10, extraContext } = req.body as {
    category: string; city: string; country: string; count?: number; extraContext?: string;
  };
  if (!category || !city) { res.status(400).json({ error: "category and city are required" }); return; }

  const needed = Math.min(Number(count) || 10, 10000);

  try {
    let raw: any[] = [];
    const sourceLog: string[] = [];

    // ── Step 1: All sources in parallel — 15 directory scrapers + Google Places ─
    // Google Places always runs when the key is set (primary source, not fallback).
    const [{ businesses: scraped, sources, errors }, googlePlaces] = await Promise.all([
      scrapeBusinessDirectories(category, city, country || "", needed),
      searchGooglePlaces(category, city, country, needed),
    ]);

    if (scraped.length > 0) {
      sourceLog.push(...sources);
      raw = scraped
        .filter(b => b.businessName)
        .map(b => ({
          businessName: b.businessName,
          ownerName: "",
          category: b.category || category,
          email: b.email || "",
          phone: b.phone || "",
          website: b.website || "",
          city: b.city || city,
          country: b.country || country || "",
          instagram: "",
          facebook: "",
          linkedin: "",
          softwareNeedScore: b.aiOpportunityScore ?? 5,
          painPoint: b.aiOpportunityNote || "",
          estimatedValue: 0,
          notes: b.address || "",
          source: b.source,
        }));
    }

    // Log scraper diagnostics to server console for debugging (never sent to client)
    if (Object.keys(errors).length > 0) {
      console.warn("[hunt-businesses] scraper errors:", errors);
    }

    // Merge Google Places results (always-on primary source, runs in parallel above)
    if (googlePlaces.length > 0) {
      sourceLog.push("google_places");
      raw.push(...googlePlaces.map((p: any) => ({
        businessName: p.displayName?.text || "",
        ownerName: "",
        category,
        email: "",
        phone: p.nationalPhoneNumber || "",
        website: p.websiteUri || "",
        city,
        country: country || "",
        instagram: "",
        facebook: "",
        linkedin: "",
        softwareNeedScore: 5,
        painPoint: "",
        estimatedValue: 0,
        notes: p.formattedAddress || "",
        source: "google_places",
      })));
    }

    // Note: we intentionally do NOT pad short results with AI-generated ("fake")
    // businesses here. Their emails/domains are fabricated and always fail the
    // MX/DNS verification below, so they never survive to the final list —
    // they just look like padding while silently producing zero real leads at
    // large counts. Real, verifiable results only.

    // ── Step 4: Deduplicate by normalized name ────────────────────────────────
    const seen = new Set<string>();
    raw = raw.filter(b => {
      const key = b.businessName?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Step 5: MX / DNS verification ────────────────────────────────────────
    const { live, dead } = await filterLiveProspects(raw);
    const returnedProspects = live.slice(0, needed);

    try {
      const saasUser = (req as any).saasUser;
      const countFound = returnedProspects.length;
      if (saasUser) {
        await db
          .update(saasUsersTable)
          .set({
            huntsUsedThisMonth: saasUser.huntsUsedThisMonth + countFound,
            creditsBalance: Math.max(0, saasUser.creditsBalance - countFound),
          })
          .where(eq(saasUsersTable.id, saasUser.id));
      }
      await db.insert(userActivitiesTable).values({
        userId: saasUser?.id ?? null,
        userEmail: saasUser?.email ?? "admin@vanguardhunter.io",
        userName: saasUser?.fullName ?? "Workspace Operator",
        category: "hunt",
        action: `Hunted ${countFound} verified leads for ${category} in ${city}`,
        details: `Sources: ${[...new Set(sourceLog)].join(", ") || "directories"} · Scanned ${raw.length} candidates (${dead} filtered)`,
      });
    } catch {}

    res.json({
      prospects: returnedProspects,
      filtered: dead,
      total: raw.length,
      sources: [...new Set(sourceLog)],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Bulk Business Hunter (multiple cities in one call) ──────────────────────

/**
 * Hunt businesses across multiple cities sequentially.
 * Accepts up to 20 cities, runs the same pipeline as /crm/hunt-businesses for each,
 * and returns globally deduplicated results (no same email/name across cities).
 */
router.post("/crm/bulk-hunt", async (req, res) => {
  const { category, cities, country, countPerCity = 50, extraContext } = req.body as {
    category: string;
    cities: string[];
    country?: string;
    countPerCity?: number;
    extraContext?: string;
  };

  if (!category || !Array.isArray(cities) || cities.length === 0) {
    res.status(400).json({ error: "category and cities[] are required" });
    return;
  }

  const cityList = cities.map((c: string) => c.trim()).filter(Boolean).slice(0, 20);
  const needed = Math.min(Number(countPerCity) || 50, 1000);

  const allProspects: any[] = [];
  const globalNameSeen = new Set<string>();
  const globalEmailSeen = new Set<string>();
  const cityResults: Record<string, number> = {};

  for (const city of cityList) {
    try {
      const [{ businesses: scraped, sources, errors }, googlePlaces] = await Promise.all([
        scrapeBusinessDirectories(category, city, country || "", needed),
        searchGooglePlaces(category, city, country || "", needed),
      ]);

      if (Object.keys(errors).length > 0) {
        console.warn(`[bulk-hunt] scraper errors for ${city}:`, errors);
      }

      const cityRaw: any[] = [
        ...scraped.filter(b => b.businessName).map(b => ({
          businessName: b.businessName,
          ownerName: "",
          category: b.category || category,
          email: b.email || "",
          phone: b.phone || "",
          website: b.website || "",
          city: b.city || city,
          country: b.country || country || "",
          instagram: "", facebook: "", linkedin: "",
          softwareNeedScore: b.aiOpportunityScore ?? 5,
          painPoint: b.aiOpportunityNote || "", estimatedValue: 0,
          notes: b.address || "",
          source: b.source,
        })),
        ...googlePlaces.map((p: any) => ({
          businessName: p.displayName?.text || "",
          ownerName: "", category, email: "",
          phone: p.nationalPhoneNumber || "",
          website: p.websiteUri || "",
          city, country: country || "",
          instagram: "", facebook: "", linkedin: "",
          softwareNeedScore: 5, painPoint: "", estimatedValue: 0,
          notes: p.formattedAddress || "",
          source: "google_places",
        })),
      ];

      // Global dedup across all cities
      let added = 0;
      for (const b of cityRaw) {
        const nameKey = b.businessName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
        const emailKey = b.email ? b.email.toLowerCase() : "";
        if (!nameKey || globalNameSeen.has(nameKey)) continue;
        if (emailKey && globalEmailSeen.has(emailKey)) continue;
        globalNameSeen.add(nameKey);
        if (emailKey) globalEmailSeen.add(emailKey);
        allProspects.push(b);
        added++;
      }
      cityResults[city] = added;
    } catch (err: any) {
      console.error(`[bulk-hunt] error for city ${city}:`, err.message);
      cityResults[city] = 0;
    }
  }

  // MX / DNS verification across all accumulated prospects
  const { live, dead } = await filterLiveProspects(allProspects);

  res.json({
    prospects: live,
    filtered: dead,
    total: allProspects.length,
    cityResults,
  });
});

// ─── Auto-analyze + generate everything for a hunted prospect ─────────────────

router.post("/crm/auto-generate", async (req, res) => {
  const { businessName, category, website, city, country, ownerName, painPoint, agencyName } = req.body as Record<string, string>;
  const training = await getActiveTrainingProfile(req);
  const effectiveSender = training.senderName || "Alex Morgan";
  const effectiveAgency = training.businessName || agencyName || "Apex Digital Growth";

  // Scrape the real website so the AI references actual content
  const siteContent = await scrapeWebsite(website);
  const siteContext = siteContent
    ? `\nReal website content scraped from ${website}:\n"""\n${siteContent}\n"""`
    : (website ? `\nWebsite ${website} could not be loaded.` : "\nNo website.");

  // ── Determine AI agent fit for this business category ─────────────────────
  const agentFitCategories: Record<string, string> = {
    receptionist: "Restaurant,Café,Dentist,Clinic,Hospital,Salon,Barbershop,Spa,Gym,Hotel,Guesthouse,Law Firm,Real Estate,Physiotherapy,Vet Clinic,Auto Repair,Nail Studio",
    booking:      "Restaurant,Café,Salon,Barbershop,Spa,Gym,Dentist,Clinic,Hotel,Physiotherapy,Nail Studio,Tattoo Studio,Personal Trainer",
    sales:        "Real Estate,Mortgage Broker,Insurance,Car Dealership,E-commerce,Software,Marketing Agency",
    support:      "E-commerce,Online Shop,Pharmacy,Telecom,Bank,Insurance,SaaS",
    social:       "Restaurant,Café,Bar,Salon,Gym,Hotel,E-commerce,Bakery,Food Truck",
  };
  const catLower = (category || "").toLowerCase();
  const agentTypeHint = Object.entries(agentFitCategories).find(([, cats]) =>
    cats.toLowerCase().split(",").some(c => catLower.includes(c.trim().toLowerCase()))
  )?.[0] || "receptionist";

  const trainedBlock = buildTrainedOutreachPromptBlock(training, {
    targetBusinessName: businessName,
    targetOwnerName: ownerName,
    targetCategory: category,
    targetCity: city,
  });
  const analysisBlock = buildTrainedAnalysisPromptBlock(training, {
    targetBusinessName: businessName,
    targetCategory: category,
    targetCity: city,
  });

  const prompt = `You are ${effectiveSender} at ${effectiveAgency}.
Analyze this scraped business and generate everything needed to start the personalized sales outreach process — strictly following the USER'S MULTI-OFFER CATALOG and TRAINED AI INTELLIGENCE PROFILE below.

${analysisBlock}

${trainedBlock}

SCRAPED TARGET BUSINESS:
Business: ${businessName}, Category: ${category}, Location: ${city}, ${country}, Owner: ${ownerName || "the owner"}, Website: ${website || "No website"}, Known Pain Point: ${painPoint || "Manual processes, outdated systems"}${siteContext}

STEP 1 — Evaluate ${businessName} against the user's LIST OF OFFERS / SERVICES above:
- Identify which 1–2 specific offers/services from the user's catalog best solve ${businessName}'s biggest gaps right now.
- Focus the website analysis ("issues", "opportunities", "recommendedFeatures", "summary") directly around those matched offers/services.

STEP 2 — Decide the best pitch angle & AI agent type:
- "ai_agent" | "website" | "both"
- "receptionist" | "booking" | "sales" | "support" | "social" (best hint for this category: ${agentTypeHint})

STEP 3 — Generate THREE personalized cold email versions (A, B, C):
CRITICAL: You MUST base the email offer, structure, style, and instructions on the TRAINED AI INTELLIGENCE PROFILE above (using the user's static reference email message, their matched offer(s)/service(s), their name "${effectiveSender}", and their business "${effectiveAgency}"), while personalizing it for ${businessName} (${category} in ${city})!
• Subject: max 7 words, curiosity-driven, following the user's subject line guide if provided. Different angle per version (A/B/C).
• Opening: "Hi ${ownerName || `${businessName} Team`}," — natural greeting.
• Body: Follow the user's static email reference and AI instructions, weaving in 1–2 real observations about ${businessName} and pitching the best-matched offer(s)/service(s) from ${effectiveAgency}'s catalog.
${training.includeAuditReportLink ? '• Include this line naturally in the body: "We put together a free website analysis for you: {{REPORT_URL}}"' : ""}
• Soft CTA: "${training.callToAction}"
• Sign-off:
Best regards,
${effectiveSender}
${effectiveAgency}${training.websiteUrl ? `\n${training.websiteUrl}` : ""}

Return ONLY a JSON object with this exact structure:
{ "matchedOffer":"Name of the #1 matching service/offer from the user's list", "analysis":{"websiteScore":<0-100>,"leadScore":<0-100>,"conversionScore":<0-100>,"mobileScore":<0-100>,"seoScore":<0-100>,"growthPotential":<0-100>,"checks":{"responsiveDesign":<bool>,"sslCertificate":<bool>,"modernUI":<bool>,"whatsappButton":<bool>,"contactForm":<bool>,"bookingSystem":<bool>,"onlineOrdering":<bool>,"paymentIntegration":<bool>,"customerPortal":<bool>,"membershipArea":<bool>,"blog":<bool>,"seoBasics":<bool>,"analytics":<bool>,"socialMedia":<bool>,"emailCapture":<bool>,"liveChat":<bool>,"aiChatbot":<bool>,"callToAction":<bool>,"trustElements":<bool>},"issues":[{"title":"string","description":"string","priority":"high|medium|low"}],"opportunities":[{"title":"string","impact":"string","effort":"low|medium|high"}],"recommendedFeatures":["string"],"projectType":"Small Website|Medium Web App|Large SaaS","estimatedValue":{"min":<number>,"max":<number>},"deliveryWeeks":{"min":<1 or 2>,"max":<1 or 2>},"summary":"2-3 sentence plain English summary focusing on why our matched offers fit this business"}, "aiAgent":{"type":"receptionist|booking|sales|support|social","score":<0-100>,"fitReason":"1 sentence why our matched offer fits their business","topPain":"the #1 pain our offer solves for them right now"}, "pitchType":"ai_agent|website|both", "emailVersions":[{"version":"A","subject":"string","body":"string"},{"version":"B","subject":"string","body":"string"},{"version":"C","subject":"string","body":"string"}],"whatsapp":"string","linkedin":"string" }
Be specific to a ${category} business in ${city}. If no website, give website scores of 5-25.`;
  try {
    const text = await generateText(prompt);
    const data = parseJSON(text);
    if (data?.whatsapp) data.whatsapp = fillPlaceholders(data.whatsapp, effectiveSender, effectiveAgency);
    if (data?.linkedin) data.linkedin = fillPlaceholders(data.linkedin, effectiveSender, effectiveAgency);

    // Create a public analysis report first so the URL can replace {{REPORT_URL}} in the email body
    if (data?.analysis) {
      try {
        const { reportId, reportUrl } = await createReport({
          businessName: businessName || "",
          website: website || "",
          analysisData: data.analysis,
          baseUrl: getAgencyBaseUrl(req),
        });
        data.reportId = reportId;
        data.reportUrl = reportUrl;
      } catch { /* report creation failure must never break email generation */ }
    }

    if (Array.isArray(data?.emailVersions) && data.emailVersions.length > 0) {
      const processedVersions = data.emailVersions.map((v: any) => {
        let bodyText = String(v.body || "");
        if (data.reportUrl) {
          bodyText = bodyText.replace(/\{\{REPORT_URL\}\}/g, data.reportUrl);
        } else {
          bodyText = bodyText.replace(/[^\n.!?]*\{\{REPORT_URL\}\}[^\n]*/g, "").trim();
        }
        return {
          version: v.version || "A",
          subject: fillPlaceholders(String(v.subject || ""), effectiveSender, effectiveAgency),
          body: fillPlaceholders(bodyText, effectiveSender, effectiveAgency),
        };
      });
      data.emailVersions = processedVersions;
      const primary = processedVersions[0];
      data.email = {
        subject: primary.subject,
        body: primary.body,
        emailVersions: processedVersions,
        selectedVersion: primary.version || "A",
      };
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Existing routes ──────────────────────────────────────────────────────────

router.post("/crm/analyze-website", async (req, res) => {
  try {
    const { website, businessName, category, city } = req.body as {
      website: string;
      businessName: string;
      category: string;
      city?: string;
    };
    if (!businessName) { res.status(400).json({ error: "businessName required" }); return; }
    const training = await getActiveTrainingProfile(req);
    const siteContent = await scrapeWebsite(website || "");
    const siteContext = siteContent
      ? `\nScraped website content from ${website}:\n"""\n${siteContent}\n"""`
      : website
      ? `\nWebsite ${website} could not be loaded.`
      : "\nNo website provided.";
    const analysisBlock = buildTrainedAnalysisPromptBlock(training, {
      targetBusinessName: businessName,
      targetCategory: category,
      targetCity: city,
    });
    const prompt = `You are an expert web analyst and B2B consultant at ${training.businessName}. Analyze this business specifically focusing on the user's trained Offers/Services catalog below, and produce a detailed JSON report.

${analysisBlock}

Business Name: ${businessName}, Business Category: ${category || "Unknown"}${city ? `, City: ${city}` : ""}, Website: ${website || "No website provided"}${siteContext}

Produce a JSON object with EXACTLY this structure (no markdown, pure JSON):
{ "matchedOffer":"string (the #1 service/offer from our catalog that this business needs most)","websiteScore":<0-100>,"leadScore":<0-100>,"conversionScore":<0-100>,"mobileScore":<0-100>,"seoScore":<0-100>,"growthPotential":<0-100>,"checks":{"responsiveDesign":<true/false>,"sslCertificate":<true/false>,"modernUI":<true/false>,"whatsappButton":<true/false>,"contactForm":<true/false>,"bookingSystem":<true/false>,"onlineOrdering":<true/false>,"paymentIntegration":<true/false>,"customerPortal":<true/false>,"membershipArea":<true/false>,"blog":<true/false>,"seoBasics":<true/false>,"analytics":<true/false>,"socialMedia":<true/false>,"emailCapture":<true/false>,"liveChat":<true/false>,"aiChatbot":<true/false>,"callToAction":<true/false>,"trustElements":<true/false>},"issues":[{"title":"string","description":"string","priority":"high|medium|low"}],"opportunities":[{"title":"string","impact":"string","effort":"low|medium|high"}],"recommendedFeatures":["string"],"projectType":"Small Website|Medium Web App|Large SaaS","estimatedValue":{"min":<number>,"max":<number>},"deliveryWeeks":{"min":<1 or 2>,"max":<1 or 2, never above 2 — we deliver in 5 days to 2 weeks>},"summary":"2-3 sentence plain English summary explaining their key gaps and how our matched offers/services solve them" }
Be realistic and specific to a ${category} business. If no website is provided, give scores of 0-20 for all website metrics.`;
    const text = await generateText(prompt);
    const data = parseJSON(text);
    try {
      const { reportId, reportUrl } = await createReport({
        businessName: businessName || "",
        website: website || "",
        analysisData: data,
        baseUrl: getAgencyBaseUrl(req),
      });
      data.reportId = reportId;
      data.reportUrl = reportUrl;
    } catch { /* ignore report creation error */ }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/crm/generate-email", async (req, res) => {
  try {
    const { businessName, ownerName, category, website, city, issues, opportunities, agencyName: reqAgencyName, reportUrl } = req.body as Record<string, string>;
    const training = await getActiveTrainingProfile(req);

    // Scrape real website for genuine personalisation
    const siteContent = await scrapeWebsite(website);
    const siteContext = siteContent
      ? `\nReal content from their website:\n"""\n${siteContent}\n"""`
      : "";

    const senderName = training.senderName || "Alex Morgan";
    const agencyName = training.businessName || reqAgencyName || process.env.AGENCY_NAME || "Apex Digital Growth";
    const ownerGreeting = ownerName ? `Hi ${ownerName},` : `Hi ${businessName || "there"} Team,`;

    const trainedBlock = buildTrainedOutreachPromptBlock(training, {
      targetBusinessName: businessName,
      targetOwnerName: ownerName,
      targetCategory: category,
      targetCity: city,
      reportUrl: reportUrl || "",
    });

    const prompt = `Write THREE personalised cold email versions (A, B, C) from ${senderName} at ${agencyName} to ${businessName}, a ${category || "business"}${city ? ` in ${city}` : ""}.

${trainedBlock}

TARGET SCRAPED BUSINESS CONTEXT:
- Business Name: ${businessName}
- Owner: ${ownerName || "the owner"}
- Category: ${category || "local business"}
- City: ${city || "their local market"}
- Website: ${website || "no website"}
- Observations / Issues found: ${issues || "opportunities to capture more local customers and inquiries"}
- Growth Opportunities: ${opportunities || training.offerDetails}${siteContext}

EMAIL GENERATION RULES (apply to all three versions A, B, C):
1. Follow the USER'S STATIC REFERENCE EMAIL MESSAGE and USER'S DIRECT INSTRUCTIONS TO AI above as your #1 priority!
2. Adapt and personalize the message specifically for ${businessName} so it feels 100% custom-written for them.
3. Open with "${ownerGreeting}".
4. Pitch what ${agencyName} offers (${training.offerDetails}) naturally and persuasively.
5. Version A = closest to the user's static template & direct; Version B = warm & conversational; Version C = insight-led & value-focused.
6. End every version with the exact signature from the trained profile (${senderName}, ${agencyName}).

Return ONLY valid JSON (no markdown, no prose):
{ "versions":[{"version":"A","subject":"string","body":"string"},{"version":"B","subject":"string","body":"string"},{"version":"C","subject":"string","body":"string"}] }`;

    const text = await generateText(prompt);
    const data = parseJSON(text);
    const versions: { version: string; subject: string; body: string }[] = data?.versions || [];

    const processed = versions.map(v => ({
      version: v.version,
      subject: fillPlaceholders(v.subject || "", senderName, agencyName),
      body: fillPlaceholders(v.body || "", senderName, agencyName),
    }));

    const primary = processed[0] ?? { version: "A", subject: "", body: "" };
    res.json({ versions: processed, subject: primary.subject, body: primary.body, trainedProfileUsed: { senderName, businessName: agencyName } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/crm/generate-whatsapp", async (req, res) => {
  try {
    const { businessName, category, opportunities, agencyName } = req.body as Record<string, string>;
    const training = await getActiveTrainingProfile(req);
    const senderName = training.senderName || "Alex Morgan";
    const effectiveAgency = training.businessName || agencyName || "Apex Digital Growth";
    const prompt = `Write a WhatsApp outreach message from ${senderName} at ${effectiveAgency} to ${businessName}, a ${category || "business"}.
What we offer: ${training.offerDetails}
User AI Instructions: ${training.aiInstructions}
Key opportunity for ${businessName}: ${opportunities || training.offerDetails}
Rules: Max 120 words. Friendly, conversational tone (${training.tone}). Professional, human, ONE clear CTA ("${training.callToAction}"). Sign off with ${senderName}, ${effectiveAgency}.
Return JSON: { "message":"string" }`;
    const text = await generateText(prompt);
    const data = parseJSON(text);
    if (data?.message) data.message = fillPlaceholders(data.message, senderName, effectiveAgency);
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/crm/generate-linkedin", async (req, res) => {
  try {
    const { businessName, ownerName, category, agencyName } = req.body as Record<string, string>;
    const training = await getActiveTrainingProfile(req);
    const senderName = training.senderName || "Alex Morgan";
    const effectiveAgency = training.businessName || agencyName || "Apex Digital Growth";
    const prompt = `Write a LinkedIn outreach message from ${senderName} (${effectiveAgency}) to ${ownerName || "the owner"} of ${businessName}, a ${category || "business"}.
What we offer: ${training.offerDetails}
Rules: Max 280 characters. Professional, human, and tailored to their ${category || "business"} business.
Return JSON: { "message":"string" }`;
    const text = await generateText(prompt);
    const data = parseJSON(text);
    if (data?.message) data.message = fillPlaceholders(data.message, senderName, effectiveAgency);
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Test Trained AI Simulator & Batch Trained Outreach Dispatcher ────────────

router.post("/crm/test-trained-ai", async (req, res) => {
  try {
    const {
      sampleBusinessName = "Summit Family Dental",
      sampleCategory = "Dentist",
      sampleCity = "Austin",
      sampleWebsite = "https://summitdental-austin.com",
      profileOverride,
    } = req.body ?? {};

    const savedProfile = await getActiveTrainingProfile(req);
    const profile = profileOverride ? { ...savedProfile, ...profileOverride } : savedProfile;

    const trainedBlock = buildTrainedOutreachPromptBlock(profile, {
      targetBusinessName: sampleBusinessName,
      targetCategory: sampleCategory,
      targetCity: sampleCity,
    });

    const prompt = `You are ${profile.senderName} from ${profile.businessName}.
Analyze the scraped business below against your trained multi-offer catalog, select the best-matching offer(s)/service(s), and write a personalized outreach email using the exact TRAINED AI INTELLIGENCE PROFILE below:

${trainedBlock}

SCRAPED BUSINESS TO ANALYZE & PERSONALIZE FOR:
- Business Name: ${sampleBusinessName}
- Category / Niche: ${sampleCategory}
- City: ${sampleCity}
- Website: ${sampleWebsite}

Return ONLY valid JSON:
{
  "matchedOffer": "Name of the specific offer/service(s) from the user's list selected for this business",
  "analysisFocus": "1-2 sentences explaining why the AI matched this offer/service to ${sampleBusinessName}",
  "subject": "personalized subject line",
  "body": "full personalized email body following the user's static message blueprint, matched offer(s), and instructions"
}`;

    const text = await generateText(prompt);
    const data = parseJSON(text);
    res.json({
      matchedOffer: data?.matchedOffer || profile.servicesOffered?.[0]?.name || "Primary Offer",
      analysisFocus: data?.analysisFocus || "",
      subject: fillPlaceholders(data?.subject || "", profile.senderName, profile.businessName),
      body: fillPlaceholders(data?.body || "", profile.senderName, profile.businessName),
      profileUsed: {
        senderName: profile.senderName,
        businessName: profile.businessName,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate trained preview" });
  }
});

router.post("/crm/send-trained-outreach", async (req, res) => {
  try {
    const rawBody = req.body ?? {};
    const businesses: Array<{
      id?: any;
      businessName: string;
      ownerName?: string;
      email: string;
      category?: string;
      city?: string;
      country?: string;
      website?: string;
      painPoint?: string;
      issues?: string;
      opportunities?: string;
      reportUrl?: string;
      generatedEmail?: { subject: string; body: string };
    }> = Array.isArray(rawBody.businesses)
      ? rawBody.businesses
      : rawBody.businessName
      ? [rawBody]
      : [];

    if (businesses.length === 0) {
      res.status(400).json({ error: "Select at least one business to trigger trained AI outreach." });
      return;
    }

    const training = await getActiveTrainingProfile(req);
    const senderName = training.senderName || "Alex Morgan";
    const agencyName = training.businessName || "Apex Digital Growth";
    const baseUrl = getBaseUrl(req);

    const results: Array<{
      businessName: string;
      email: string;
      subject: string;
      body: string;
      matchedOffer?: string;
      reportId?: string;
      reportUrl?: string;
      status: "sent" | "generated_ready" | "skipped";
      sentVia?: string;
      error?: string;
    }> = [];

    for (const biz of businesses.slice(0, 30)) {
      let subject = biz.generatedEmail?.subject || "";
      let body = biz.generatedEmail?.body || "";
      let matchedOffer = "";
      let reportUrl = biz.reportUrl || "";
      let reportId = "";

      if (!subject || !body) {
        const siteContent = await scrapeWebsite(biz.website || "");
        const siteContext = siteContent
          ? `\nScraped website content from ${biz.website}:\n"""\n${siteContent}\n"""`
          : "";
        const trainedBlock = buildTrainedOutreachPromptBlock(training, {
          targetBusinessName: biz.businessName,
          targetOwnerName: biz.ownerName,
          targetCategory: biz.category,
          targetCity: biz.city,
          reportUrl,
        });

        const prompt = `You are ${senderName} from ${agencyName}.
Analyze ${biz.businessName} (${biz.category || "business"} in ${biz.city || "their city"}) against your trained MULTI-OFFER / MULTI-SERVICE CATALOG, choose the best-matching offer(s)/service(s) for them, and write a personalized outreach email using your TRAINED AI INTELLIGENCE PROFILE:

${trainedBlock}

TARGET SCRAPED BUSINESS:
- Business Name: ${biz.businessName}
- Owner: ${biz.ownerName || "the owner"}
- Category: ${biz.category || "business"}
- Location: ${biz.city || ""}${biz.country ? `, ${biz.country}` : ""}
- Website: ${biz.website || "No website"}
- Pain Point / Notes: ${biz.painPoint || biz.issues || "Opportunity to grow bookings & customer inquiries"}${siteContext}

Return ONLY valid JSON:
{
  "matchedOffer": "Name of the specific offer/service from our list matched to this business",
  "subject": "string",
  "body": "string"
}`;

        try {
          const genText = await generateText(prompt);
          const parsed = parseJSON(genText);
          matchedOffer = String(parsed?.matchedOffer || training.servicesOffered?.[0]?.name || "");
          subject = fillPlaceholders(parsed?.subject || `Quick idea for ${biz.businessName}`, senderName, agencyName);
          body = fillPlaceholders(parsed?.body || "", senderName, agencyName);
          if (reportUrl) {
            body = body.replace(/\{\{REPORT_URL\}\}/g, reportUrl);
          } else {
            body = body.replace(/[^\n.!?]*\{\{REPORT_URL\}\}[^\n]*/g, "").trim();
          }
        } catch (genErr: any) {
          results.push({
            businessName: biz.businessName,
            email: biz.email || "",
            subject: "",
            body: "",
            status: "skipped",
            error: genErr.message || "AI generation failed",
          });
          continue;
        }
      }

      if (!biz.email || !biz.email.includes("@")) {
        results.push({
          businessName: biz.businessName,
          email: "",
          subject,
          body,
          matchedOffer,
          reportId,
          reportUrl,
          status: "generated_ready",
          error: "Personalized message generated (no email address on lead to dispatch)",
        });
        continue;
      }

      // Attempt SMTP send via active email account pool
      try {
        const trackingId = await createTracking(biz.email, subject, "outreach");
        const reportSection = reportUrl ? buildReportEmailSection(reportUrl, biz.businessName) : "";
        const htmlBody = body
          .split("\n")
          .map((line) => (line.trim() ? `<p style="margin:0 0 12px;line-height:1.6;">${line}</p>` : "<br/>"))
          .join("");

        const { acct } = await sendWithFailover((a) => {
          const displayFrom = training.senderName
            ? `${training.senderName} (${training.businessName || a.fromName})`
            : a.fromName;
          const rawHtml = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e;">${htmlBody}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/><p style="color:#6b7280;font-size:13px;">${displayFrom}</p>${reportSection}</div>`;
          return {
            from: `"${displayFrom}" <${a.fromEmail || a.user}>`,
            to: biz.email,
            subject,
            text: body,
            html: injectTracking(rawHtml, baseUrl, trackingId),
          };
        });

        results.push({
          businessName: biz.businessName,
          email: biz.email,
          subject,
          body,
          matchedOffer,
          reportId,
          reportUrl,
          status: "sent",
          sentVia: acct.label,
        });
      } catch (smtpErr: any) {
        results.push({
          businessName: biz.businessName,
          email: biz.email,
          subject,
          body,
          matchedOffer,
          reportId,
          reportUrl,
          status: "generated_ready",
          error: smtpErr.message || "Generated with Trained AI (connect an Email Account in Email Settings to send live SMTP)",
        });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const generatedCount = results.filter((r) => r.subject && r.body).length;
    const first = results[0];

    try {
      const saasUser = (req as any).saasUser;
      if (saasUser && sentCount > 0) {
        await db
          .update(saasUsersTable)
          .set({
            emailsSentThisMonth: (saasUser.emailsSentThisMonth || 0) + sentCount,
          })
          .where(eq(saasUsersTable.id, saasUser.id));
      }
      await db.insert(userActivitiesTable).values({
        userId: saasUser?.id ?? null,
        userEmail: saasUser?.email ?? training.senderEmail ?? "workspace@vanguardhunter.io",
        userName: senderName,
        category: "email",
        action: `Triggered Trained AI Outreach for ${businesses.length} business(es)`,
        details: `Business: ${agencyName} · Personalized: ${generatedCount} · Dispatched via SMTP: ${sentCount}`,
      });
    } catch {}

    res.json({
      success: true,
      sent: first?.status === "sent",
      sendError: first?.error || undefined,
      emailSentAt: first?.status === "sent" ? new Date().toISOString() : undefined,
      generatedEmail: first?.subject ? { subject: first.subject, body: first.body } : undefined,
      matchedOffer: first?.matchedOffer || undefined,
      reportId: first?.reportId || undefined,
      reportUrl: first?.reportUrl || undefined,
      message:
        first?.status === "sent"
          ? `✓ Trained AI matched "${first.matchedOffer || "your offer"}" & sent email to ${first.email} via ${first.sentVia}`
          : first?.error,
      sentCount,
      generatedCount,
      trainedProfile: {
        senderName,
        businessName: agencyName,
      },
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to execute trained AI outreach" });
  }
});

// ─── Email CSV & Lead Data to Someone ────────────────────────────────────────

router.post("/crm/email-csv", async (req, res) => {
  try {
    const {
      to,
      subject,
      note = "",
      projectName = "Untitled",
      csvContent = "",
      filename = "leads-export.csv",
      leads = [],
    } = req.body as {
      to: string;
      subject?: string;
      note?: string;
      projectName?: string;
      csvContent?: string;
      filename?: string;
      leads?: Array<Record<string, any>>;
    };

    const recipient = String(to || "").trim();
    if (!recipient || !recipient.includes("@")) {
      res.status(400).json({ error: "Please enter a valid recipient email address." });
      return;
    }

    const training = await getActiveTrainingProfile(req).catch(() => null);
    const senderName = training?.senderName || "Vanguard Hunter CRM";
    const agencyName = training?.businessName || "Vanguard Hunter";
    const safeLeads = Array.isArray(leads) ? leads : [];
    const emailSubject =
      (subject && String(subject).trim()) ||
      `Lead Export (${safeLeads.length} leads) — ${projectName}`;

    const escapeHtml = (val: unknown) =>
      String(val ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const rowsHtml = safeLeads
      .slice(0, 100)
      .map(
        (l, idx) => `
        <tr style="border-bottom:1px solid #e2e8f0;background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#0f172a;">${escapeHtml(l.businessName || "-")}</td>
          <td style="padding:8px 10px;font-size:12px;color:#334155;">${escapeHtml(l.ownerName || "-")}</td>
          <td style="padding:8px 10px;font-size:12px;color:#2563eb;">${escapeHtml(l.email || "-")}</td>
          <td style="padding:8px 10px;font-size:12px;color:#334155;">${escapeHtml(l.phone || "-")}</td>
          <td style="padding:8px 10px;font-size:12px;color:#334155;">${escapeHtml(l.website || "-")}</td>
          <td style="padding:8px 10px;font-size:12px;color:#334155;">${escapeHtml(l.category || "-")}</td>
          <td style="padding:8px 10px;font-size:12px;color:#334155;">${escapeHtml([l.city, l.country].filter(Boolean).join(", ") || "-")}</td>
        </tr>`
      )
      .join("");

    const noteHtml = note && String(note).trim()
      ? `<div style="margin:0 0 18px;padding:12px 16px;background:#f1f5f9;border-left:4px solid #2563eb;border-radius:6px;font-size:13px;color:#1e293b;">${escapeHtml(note)}</div>`
      : "";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:860px;margin:0 auto;padding:24px;color:#0f172a;">
        <div style="background:#0f172a;color:#ffffff;padding:20px 24px;border-radius:10px 10px 0 0;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#60a5fa;font-weight:700;">CSV Lead Data Export</div>
          <h2 style="margin:6px 0 0;font-size:20px;">Project: ${escapeHtml(projectName)} (${safeLeads.length} ${safeLeads.length === 1 ? "Lead" : "Leads"})</h2>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 10px 10px;background:#ffffff;">
          ${noteHtml}
          <p style="margin:0 0 14px;font-size:13px;color:#475569;">
            Attached is the full CSV file (<strong>${escapeHtml(filename)}</strong>) containing <strong>${safeLeads.length}</strong> generated ${safeLeads.length === 1 ? "lead" : "leads"} from <strong>${escapeHtml(projectName)}</strong>. You can open the attached CSV directly in Microsoft Excel, Google Sheets, or any CRM.
          </p>
          ${
            safeLeads.length > 0
              ? `<div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;">
                  <table style="width:100%;border-collapse:collapse;text-align:left;">
                    <thead>
                      <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;">
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Business</th>
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Contact</th>
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Email</th>
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Phone</th>
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Website</th>
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Category</th>
                        <th style="padding:9px 10px;font-size:11px;text-transform:uppercase;color:#475569;">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rowsHtml}
                    </tbody>
                  </table>
                </div>`
              : ""
          }
          <p style="margin:18px 0 0;font-size:12px;color:#64748b;">
            Sent by ${escapeHtml(senderName)} (${escapeHtml(agencyName)})
          </p>
        </div>
      </div>
    `;

    const plainTextLines = [
      `Project: ${projectName} (${safeLeads.length} leads)`,
      note ? `Note: ${note}` : "",
      "",
      ...safeLeads.slice(0, 100).map(
        (l, i) =>
          `${i + 1}. ${l.businessName || "Business"} | ${l.email || "no-email"} | ${l.phone || "no-phone"} | ${l.website || ""} | ${[l.city, l.country].filter(Boolean).join(", ")}`
      ),
    ].filter(Boolean).join("\n");

    const { acct } = await sendWithFailover((a) => ({
      from: `"${senderName} (${agencyName})" <${a.fromEmail || a.user}>`,
      to: recipient,
      subject: emailSubject,
      text: plainTextLines,
      html,
      ...(csvContent
        ? {
            attachments: [
              {
                filename: filename || "leads.csv",
                content: csvContent,
                contentType: "text/csv; charset=utf-8",
              },
            ],
          }
        : {}),
    }));

    res.json({
      success: true,
      to: recipient,
      sentVia: acct.label,
      leadCount: safeLeads.length,
      message: `CSV file (${safeLeads.length} leads) emailed to ${recipient} via ${acct.label}`,
    });
  } catch (err: any) {
    res.status(400).json({
      error:
        err.message ||
        "No active SMTP email account configured yet. Connect an Email Account in the Email Accounts tab or use 'Open in Email App' below.",
    });
  }
});

router.post("/crm/generate-proposal", async (req, res) => {
  try {
    const { businessName, category, issues, features, estimatedValue, agencyName, website, customPrice, customDuration } = req.body as Record<string, string>;
    const training = await getActiveTrainingProfile(req);
    const effectiveAgency = training.businessName || agencyName || "Apex Digital Growth";
    const priceInstruction = customPrice
      ? `The Investment section MUST state the price as exactly "${customPrice}" — do not invent a different figure or a range.`
      : `Investment (pricing tiers if applicable), based on Estimated value: ${estimatedValue || "$500 - $1500"}`;
    const durationInstruction = customDuration
      ? `The Delivery Timeline MUST fit within "${customDuration}" total — break that exact duration down into stages, do not propose a longer or shorter overall timeframe.`
      : `Delivery Timeline (week by week breakdown)`;
    const prompt = `Write a professional B2B proposal from ${training.senderName} at ${effectiveAgency} for ${businessName}, a ${category || "business"}.
What ${effectiveAgency} Offers: ${training.offerDetails}
Context: Website: ${website || "No website"}, Problems found: ${issues || training.targetPainPoints || "manual processes, no online booking, poor digital presence"}, Recommended features: ${features || training.offerDetails}
Write a full proposal with these sections:
1. Executive Summary (2-3 sentences)
2. Current Digital Situation (what they have now and what's missing)
3. Problems We Found (3-5 specific bullet points)
4. Our Recommended Solution (describe what ${effectiveAgency} will deliver based on our offer)
5. Key Features / Deliverables (bullet list with one-line description each)
6. Business Benefits (5 measurable/realistic benefits)
7. ${durationInstruction}
8. ${priceInstruction}
9. Why Choose ${effectiveAgency} (3 compelling points)
10. Next Steps (clear 3-step action plan)
Be specific, professional, and persuasive. Every point should be specific to a ${category} business.
Return JSON: { "sections":{"executiveSummary":"string","situation":"string","problems":["string"],"solution":"string","features":[{"name":"string","desc":"string"}],"benefits":["string"],"timeline":[{"week":"string","task":"string"}],"investment":"string","whyUs":["string"],"nextSteps":["string"]} }`;
    const text = await generateText(prompt);
    const data = parseJSON(text);
    if (!data?.sections) throw new Error("AI returned an invalid proposal — please try again.");
    if (customPrice) data.sections.investment = customPrice;
    if (customDuration) {
      data.sections.timeline = Array.isArray(data.sections.timeline) && data.sections.timeline.length
        ? data.sections.timeline
        : [{ week: customDuration, task: "Full project delivery" }];
      data.sections.timelineSummary = `Total delivery time: ${customDuration}`;
    }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/crm/generate-followup", async (req, res) => {
  try {
    const { businessName, ownerName, day, previousContext, agencyName } = req.body as Record<string, string>;
    const training = await getActiveTrainingProfile(req);
    const senderName = training.senderName || "Alex Morgan";
    const effectiveAgency = training.businessName || agencyName || "Apex Digital Growth";
    const prompt = `Write a follow-up message for day ${day || "3"} after initial outreach to ${businessName}.
Sender: ${senderName} from ${effectiveAgency}
What We Offer: ${training.offerDetails}
User AI Instructions: ${training.aiInstructions}
Previous context: ${previousContext || `Sent initial outreach about ${training.offerDetails}`}
Contact: ${ownerName ? ownerName : `the owner of ${businessName}`}
Rules: Day 3: gentle, add value or insight. Day 7: different angle, ask a question. Day 14: share a relevant result/case study angle. Day 30: final check-in, door still open. Max 100 words. No "just following up" phrases. Sign off with ${senderName}, ${effectiveAgency}.
Return JSON: { "subject":"string","body":"string","channel":"email" }`;
    const text = await generateText(prompt);
    const data = parseJSON(text);
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Database Architecture & CRM Pipeline Persistence ─────────────────────────

router.get("/crm/prospects", async (_req, res) => {
  try {
    const rows = await db.select().from(crmProspectsTable).orderBy(desc(crmProspectsTable.updatedAt));
    const prospects = rows.map(r => ({
      ...(typeof r.payload === "object" && r.payload ? r.payload : {}),
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      company: r.company,
      role: r.role,
      website: r.website,
      industry: r.industry,
      location: r.location,
      companySize: r.companySize,
      service: r.service,
      stage: r.stage,
      priority: r.priority,
      dealValue: r.dealValue,
      source: r.source,
      aiScore: r.aiScore ?? undefined,
    }));
    const huntedLeads = (await kvGetJson<any[]>("CRM_HUNTED_LEADS")) ?? [];
    res.json({ prospects, huntedLeads });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/crm/prospects/sync", async (req, res) => {
  try {
    const { prospects, huntedLeads } = req.body as { prospects?: any[]; huntedLeads?: any[] };
    if (Array.isArray(prospects)) {
      for (const p of prospects) {
        if (!p?.id) continue;
        const idStr = String(p.id);
        const nameVal = String(p.ownerName || p.name || p.businessName || "");
        const companyVal = String(p.businessName || p.company || "");
        const industryVal = String(p.category || p.industry || "");
        const locationVal = String(p.city ? `${p.city}${p.country ? `, ${p.country}` : ""}` : (p.location || ""));
        const stageVal = String(p.status || p.stage || "new");
        const dealVal = Number(p.expectedValue ?? p.dealValue) || 0;
        const scoreVal = p.aiAgentScore !== undefined ? Number(p.aiAgentScore) : (p.aiScore !== undefined && p.aiScore !== null ? Number(p.aiScore) : null);

        await db
          .insert(crmProspectsTable)
          .values({
            id: idStr,
            name: nameVal,
            email: String(p.email || ""),
            phone: String(p.phone || ""),
            company: companyVal,
            role: String(p.role || "Owner"),
            website: String(p.website || ""),
            industry: industryVal,
            location: locationVal,
            companySize: String(p.companySize || "1-10"),
            service: String(p.pitchType || p.service || ""),
            stage: stageVal,
            priority: String(p.priority || "medium"),
            dealValue: dealVal,
            source: String(p.source || (p.hunted ? "ai_hunter" : "manual")),
            aiScore: scoreVal,
            payload: p,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: crmProspectsTable.id,
            set: {
              name: nameVal,
              email: String(p.email || ""),
              phone: String(p.phone || ""),
              company: companyVal,
              role: String(p.role || "Owner"),
              website: String(p.website || ""),
              industry: industryVal,
              location: locationVal,
              companySize: String(p.companySize || "1-10"),
              service: String(p.pitchType || p.service || ""),
              stage: stageVal,
              priority: String(p.priority || "medium"),
              dealValue: dealVal,
              source: String(p.source || (p.hunted ? "ai_hunter" : "manual")),
              aiScore: scoreVal,
              payload: p,
              updatedAt: new Date(),
            },
          });
      }
    }
    if (Array.isArray(huntedLeads)) {
      await kvSetJson("CRM_HUNTED_LEADS", huntedLeads);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Proposal & Consultation Requests from Public Website Audit Reports ──────

const CUSTOM_REQUESTS_KV_KEY = "CRM_PROPOSAL_REQUESTS";

router.get("/admin/custom-requests", async (_req, res) => {
  try {
    const list = (await kvGetJson<any[]>(CUSTOM_REQUESTS_KV_KEY)) ?? [];
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/custom-requests", async (req, res) => {
  try {
    const { name, email, businessType, description, budget, whatsapp, reportId } = req.body as Record<string, string>;
    if (!email || !description) {
      res.status(400).json({ error: "email and description are required" });
      return;
    }
    const existing = (await kvGetJson<any[]>(CUSTOM_REQUESTS_KV_KEY)) ?? [];
    const entry = {
      id: Date.now(),
      name: name || null,
      email,
      businessType: businessType || null,
      description,
      budget: budget || null,
      whatsapp: whatsapp || null,
      reportId: reportId || null,
      status: "new",
      notes: null,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...existing];
    await kvSetJson(CUSTOM_REQUESTS_KV_KEY, next);
    res.json({ success: true, request: entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/crm/database-status", async (_req, res) => {
  try {
    const [
      prospectsCount,
      accountsCount,
      settingsCount,
      trackingCount,
      followUpsCount,
      inboxCount,
      apiKeysCount,
      reportsCount,
      campaignsCount,
      contactsCount,
      configCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(crmProspectsTable),
      db.select({ count: sql<number>`count(*)` }).from(emailAccountsTable),
      db.select({ count: sql<number>`count(*)` }).from(automationSettingsTable),
      db.select({ count: sql<number>`count(*)` }).from(emailTrackingTable),
      db.select({ count: sql<number>`count(*)` }).from(followUpQueueTable),
      db.select({ count: sql<number>`count(*)` }).from(inboxRepliesTable),
      db.select({ count: sql<number>`count(*)` }).from(externalApiKeysTable),
      db.select({ count: sql<number>`count(*)` }).from(websiteReportsTable),
      db.select({ count: sql<number>`count(*)` }).from(affiliateCampaignsTable),
      db.select({ count: sql<number>`count(*)` }).from(affiliateContactsTable),
      db.select({ count: sql<number>`count(*)` }).from(siteConfigTable),
    ]);

    res.json({
      engine: process.env.DATABASE_URL ? "PostgreSQL (External DATABASE_URL)" : "PostgreSQL 16 (Embedded PGlite + Drizzle ORM)",
      orm: "Drizzle ORM (pg-core)",
      status: "connected",
      tables: [
        { name: "crm_prospects", rows: Number(prospectsCount[0]?.count ?? 0), desc: "CRM pipeline prospects, AI scores, proposals, notes & deal stages" },
        { name: "website_reports", rows: Number(reportsCount[0]?.count ?? 0), desc: "Public client-facing Website Audit Reports & view telemetry" },
        { name: "automation_settings", rows: Number(settingsCount[0]?.count ?? 0), desc: "Autonomous AI Hunter schedule, city/category targets & pipeline flags" },
        { name: "email_accounts", rows: Number(accountsCount[0]?.count ?? 0), desc: "Rotational SMTP/IMAP accounts (Brevo, Gmail, Outlook, Resend, SendGrid)" },
        { name: "email_tracking", rows: Number(trackingCount[0]?.count ?? 0), desc: "1x1 pixel open tracking & link click telemetry per prospect" },
        { name: "follow_up_queue", rows: Number(followUpsCount[0]?.count ?? 0), desc: "Automated multi-day follow-up queue for non-openers" },
        { name: "inbox_replies", rows: Number(inboxCount[0]?.count ?? 0), desc: "IMAP polled prospect replies with AI intent classification" },
        { name: "external_api_keys", rows: Number(apiKeysCount[0]?.count ?? 0), desc: "Multi-account directory API key rotation pools" },
        { name: "affiliate_campaigns", rows: Number(campaignsCount[0]?.count ?? 0), desc: "Automated outreach campaigns & interval schedulers" },
        { name: "affiliate_contacts", rows: Number(contactsCount[0]?.count ?? 0), desc: "Campaign contact queue & generated outreach messages" },
        { name: "site_config", rows: Number(configCount[0]?.count ?? 0), desc: "Key-value configuration & persistent state store" },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
