import { Router } from "express";
import { promises as dnsPromises } from "dns";
import { ImapFlow } from "imapflow";
import { db, emailAccountsTable, automationSettingsTable, emailTrackingTable, followUpQueueTable, inboxRepliesTable } from "../../db";
import { eq, and, lte, isNull, desc } from "drizzle-orm";
import { getGeminiAI } from "./api-keys";
import { sendMail as brevoSendMail, brevoTransporter } from "../lib/brevo-mailer";
import { makeSmartTransporter, resolveIpv4Host } from "../lib/smtp-mailer";
import { requireAdmin } from "../lib/admin-auth";
import { scrapeBusinessDirectories } from "../lib/business-scrapers";
import { createReport, buildReportEmailSection, getAgencyBaseUrl } from "./reports";
import { kvGetJson, kvSetJson } from "../lib/replit-kv";
import { getActiveTrainingProfile, buildTrainedOutreachPromptBlock } from "../lib/ai-training";

// ─── KV fallback helpers for email accounts (used when DB is unreachable) ──────
const KV_ACCOUNTS_KEY = "EMAIL_ACCOUNTS";
const KV_NEXT_ID_KEY  = "EMAIL_ACCOUNT_COUNTER"; // must match crm-ai.ts to avoid ID collisions
type KvAccount = typeof emailAccountsTable.$inferSelect;

async function kvReadAccounts(): Promise<KvAccount[]> {
  return (await kvGetJson<KvAccount[]>(KV_ACCOUNTS_KEY)) ?? [];
}
async function kvWriteAccounts(accounts: KvAccount[]): Promise<void> {
  await kvSetJson(KV_ACCOUNTS_KEY, accounts);
}
async function kvNextId(): Promise<number> {
  const cur = (await kvGetJson<number>(KV_NEXT_ID_KEY)) ?? 1000;
  await kvSetJson(KV_NEXT_ID_KEY, cur + 1);
  return cur + 1;
}
function kvMaskPassword(a: KvAccount) {
  return { ...a, password: "••••••••" };
}

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTransporter(acct: { host: string; port: number; secure: boolean; user: string; password: string; provider?: string; fromName?: string; fromEmail?: string }) {
  return makeSmartTransporter(acct);
}

async function generateText(prompt: string): Promise<string> {
  const ai = await getGeminiAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });
    return response.text ?? "";
  } catch {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });
    return response.text ?? "";
  }
}

function parseJSON(text: string): any {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/[\[\{][\s\S]*[\]\}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse AI response as JSON");
  }
}

// ─── Real website scraper ─────────────────────────────────────────────────────

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

function extractHostname(raw: string): string {
  if (!raw || raw.trim() === "" || /^(none|n\/a|no website|-)$/i.test(raw.trim())) return "";
  const s = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
  try { return new URL(s).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

async function verifyWebsiteDomain(website: string): Promise<boolean> {
  const host = extractHostname(website);
  if (!host) return true;
  try {
    await Promise.race([
      dnsPromises.lookup(host),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
    ]);
    return true;
  } catch { return false; }
}

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

async function filterLiveProspects(prospects: any[]): Promise<any[]> {
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
  return results.filter(r => r.ok).map(r => r.biz);
}

// ─── Placeholder filler ───────────────────────────────────────────────────────

function fillPlaceholders(
  text: string,
  senderName = "Daniel",
  agencyName = "DevStudio",
  agencyWebsite = "",
  agencyEmail = ""
): string {
  return text
    // Curly-brace style used in AI-generated templates
    .replace(/\{\{AgencyName\}\}/gi, agencyName)
    .replace(/\{\{SenderName\}\}/gi, senderName)
    .replace(/\{\{Website\}\}/gi, agencyWebsite)
    .replace(/\{\{AgencyEmail\}\}/gi, agencyEmail)
    // Square-bracket style (legacy)
    .replace(/\[(?:your\s+)?name\]/gi, senderName)
    .replace(/\[sender(?:\s+name)?\]/gi, senderName)
    .replace(/\[(?:agency|company|your\s+(?:agency|company))(?:\s+name)?\]/gi, agencyName)
    .replace(/\[(?:from|your)\s+(?:email\s+)?signature\]/gi, agencyName)
    .replace(/\[\s*[A-Z][a-zA-Z\s]{1,30}\s*\]/g, (match) => {
      const inner = match.replace(/[\[\]]/g, "").trim().toLowerCase();
      if (inner.includes("name") || inner === "your" || inner === "sender") return senderName;
      if (inner.includes("agency") || inner.includes("company") || inner.includes("studio")) return agencyName;
      return match;
    });
}

/** Build a personalised sender signature from account data. */
function buildSignature(fromName: string, agencyName: string, agencyWebsite: string, fromEmail: string): string {
  const lines = [`Best regards,`, fromName || agencyName];
  if (agencyName && agencyName !== fromName) lines.push(agencyName);
  if (agencyWebsite) lines.push(agencyWebsite);
  if (fromEmail) lines.push(fromEmail);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────

function maskPassword(acct: any) {
  return { ...acct, password: acct.password ? "••••••••" : "" };
}

async function getOrCreateSettings(): Promise<typeof automationSettingsTable.$inferSelect> {
  const rows = await db.select().from(automationSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const inserted = await db.insert(automationSettingsTable).values({}).returning();
  return inserted[0];
}

// ─── Email Accounts ───────────────────────────────────────────────────────────

router.get("/automation/email-accounts", requireAdmin, async (_req, res) => {
  try {
    const accounts = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
    // Keep KV in sync so production reads stay fresh
    kvWriteAccounts(accounts).catch(() => {});
    res.json(accounts.map(maskPassword));
  } catch {
    // DB unavailable — serve from KV
    const accounts = await kvReadAccounts();
    res.json(accounts.map(kvMaskPassword));
  }
});

function cleanPassword(password: string): string {
  return (password || "").replace(/\s/g, "");
}

function validateCredentials(provider: string, cleanedPassword: string, user: string): string | null {
  if (
    provider === "gmail" &&
    cleanedPassword.length !== 16 &&
    !cleanedPassword.startsWith("https://script.google.com/")
  ) {
    return `Gmail requires a 16-character App Password (or a Google Apps Script HTTPS Bridge URL). You provided ${cleanedPassword.length} characters. Generate one at myaccount.google.com/apppasswords.`;
  }
  if (provider === "sendgrid" && user.trim().toLowerCase() !== "apikey") {
    return `SendGrid requires the username to be exactly "apikey", not your email address.`;
  }
  if (provider === "resend" && user.trim().toLowerCase() !== "resend" && !cleanedPassword.startsWith("re_")) {
    return `Resend requires the username to be "resend" or an API key starting with "re_".`;
  }
  return null;
}

router.post("/automation/email-accounts", requireAdmin, async (req, res) => {
  const { label, provider, host, port, secure, user, password, fromName, fromEmail, imapEnabled, imapHost, imapPort } = req.body;
  if (!user) { res.status(400).json({ error: "user (email address) is required" }); return; }
  if (!password || !password.trim()) { res.status(400).json({ error: "Password / API key is required" }); return; }
  const cleanedPassword = cleanPassword(password);
  const validationError = validateCredentials(provider || "smtp", cleanedPassword, user);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  const values = {
    label: label || user,
    provider: provider || "smtp",
    host: host || "smtp.gmail.com",
    port: port || 587,
    secure: secure ?? false,
    user: user.trim(),
    password: cleanedPassword,
    fromName: fromName || "DevStudio",
    fromEmail: fromEmail || "",
    imapEnabled: imapEnabled ?? false,
    imapHost: imapHost || "imap.gmail.com",
    imapPort: imapPort || 993,
    active: true,
  };
  try {
    const inserted = await db.insert(emailAccountsTable).values(values).returning();
    // Keep KV in sync
    const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
    kvWriteAccounts(all).catch(() => {});
    res.json(maskPassword(inserted[0]));
  } catch {
    // DB unavailable — save to KV
    const accounts = await kvReadAccounts();
    const now = new Date();
    const newId = await kvNextId();
    const acct: KvAccount = {
      id: newId, ...values,
      sentCount: 0, dailyLimit: 80, sentToday: 0,
      lastSentDay: "", consecutiveFailures: 0, lastError: "",
      lastErrorAt: null, autoPaused: false, createdAt: now,
    };
    accounts.push(acct);
    await kvWriteAccounts(accounts);
    res.json(kvMaskPassword(acct));
  }
});

router.put("/automation/email-accounts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { label, provider, host, port, secure, user, password, fromName, fromEmail, imapEnabled, imapHost, imapPort, active } = req.body;
  try {
    const existing = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    if (!existing.length) { res.status(404).json({ error: "Account not found" }); return; }
    const effectiveProvider = provider !== undefined ? provider : existing[0].provider;
    const effectiveUser = user !== undefined ? user : existing[0].user;
    if (password && password !== "••••••••") {
      const cleanedPassword = cleanPassword(password);
      const validationError = validateCredentials(effectiveProvider, cleanedPassword, effectiveUser);
      if (validationError) { res.status(400).json({ error: validationError }); return; }
    }
    const updated = await db.update(emailAccountsTable).set({
      ...(label !== undefined && { label }),
      ...(provider !== undefined && { provider }),
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(secure !== undefined && { secure }),
      ...(user !== undefined && { user }),
      ...(password && password !== "••••••••" ? { password: cleanPassword(password) } : {}),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail }),
      ...(imapEnabled !== undefined && { imapEnabled }),
      ...(imapHost !== undefined && { imapHost }),
      ...(imapPort !== undefined && { imapPort }),
      ...(active !== undefined && { active }),
    }).where(eq(emailAccountsTable.id, id)).returning();
    const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
    kvWriteAccounts(all).catch(() => {});
    res.json(maskPassword(updated[0]));
  } catch (e: any) {
    if (e?.message?.includes("not found")) { res.status(404).json({ error: "Account not found" }); return; }
    // DB unavailable — update in KV
    const accounts = await kvReadAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) { res.status(404).json({ error: "Account not found" }); return; }
    accounts[idx] = {
      ...accounts[idx],
      ...(label !== undefined && { label }),
      ...(provider !== undefined && { provider }),
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(secure !== undefined && { secure }),
      ...(user !== undefined && { user }),
      ...(password && password !== "••••••••" ? { password: cleanPassword(password) } : {}),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail }),
      ...(imapEnabled !== undefined && { imapEnabled }),
      ...(imapHost !== undefined && { imapHost: imapHost ?? "" }),
      ...(imapPort !== undefined && { imapPort: imapPort ?? 993 }),
      ...(active !== undefined && { active }),
    };
    await kvWriteAccounts(accounts);
    res.json(kvMaskPassword(accounts[idx]));
  }
});

router.delete("/automation/email-accounts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
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

router.post("/automation/email-accounts/:id/test", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  let acct: KvAccount | undefined;
  try {
    const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    acct = rows[0];
  } catch {
    // DB unavailable — look up from KV
    const accounts = await kvReadAccounts();
    acct = accounts.find(a => a.id === id);
  }
  if (!acct) { res.status(404).json({ error: "Account not found" }); return; }
  if (!acct.user || !acct.password) { res.status(400).json({ error: "Account has no credentials saved" }); return; }
  try {
    const transporter = makeTransporter(acct);
    await transporter.verify();
    await transporter.sendMail({
      from: `"${acct.fromName}" <${acct.fromEmail || acct.user}>`,
      to: req.body.to || acct.user,
      subject: "DevStudio — Email Account Test",
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2 style="color:#6d28d9;">✓ ${acct.label || acct.user} is working</h2><p>This account is correctly configured for automated outreach.</p></div>`,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Brevo fallback test (uses server-level Brevo credentials) ────────────────

router.post("/automation/brevo-test", async (req, res) => {
  const to = req.body.to;
  if (!to) { res.status(400).json({ error: "Missing 'to' email address" }); return; }
  try {
    await brevoTransporter.verify();
    await brevoTransporter.sendMail({
      from: `"DevStudio" <${process.env.BREVO_SMTP_USER}>`,
      to,
      subject: "DevStudio — Brevo SMTP Test",
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2 style="color:#6d28d9;">✓ Brevo SMTP is working</h2><p>Your outreach emails will be sent via Brevo (smtp-relay.brevo.com:587).</p><p style="color:#6b7280;font-size:13px;">Sent at: ${new Date().toISOString()}</p></div>`,
    });
    res.json({ success: true, message: "Test email sent via Brevo" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Automation Settings ──────────────────────────────────────────────────────

router.get("/automation/settings", async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.put("/automation/settings", async (req, res) => {
  const current = await getOrCreateSettings();
  const {
    autoHuntEnabled, huntCategory, huntCity, huntCountry, huntCount,
    huntExtraContext, huntIntervalHours, autoScore, autoEmail,
    emailDelayMinutes, autoReply,
  } = req.body;

  const updated = await db.update(automationSettingsTable).set({
    ...(autoHuntEnabled !== undefined && { autoHuntEnabled }),
    ...(huntCategory !== undefined && { huntCategory }),
    ...(huntCity !== undefined && { huntCity }),
    ...(huntCountry !== undefined && { huntCountry }),
    ...(huntCount !== undefined && { huntCount }),
    ...(huntExtraContext !== undefined && { huntExtraContext }),
    ...(huntIntervalHours !== undefined && { huntIntervalHours }),
    ...(autoScore !== undefined && { autoScore }),
    ...(autoEmail !== undefined && { autoEmail }),
    ...(emailDelayMinutes !== undefined && { emailDelayMinutes }),
    ...(autoReply !== undefined && { autoReply }),
    ...(req.body.followUpEnabled !== undefined && { followUpEnabled: req.body.followUpEnabled }),
    ...(req.body.followUpDays !== undefined && { followUpDays: req.body.followUpDays }),
    updatedAt: new Date(),
    // recalculate nextRunAt if interval changed
    ...(autoHuntEnabled === true ? {
      nextRunAt: new Date(Date.now() + ((huntIntervalHours ?? current.huntIntervalHours) * 60 * 60 * 1000)),
    } : {}),
    ...(autoHuntEnabled === false ? { nextRunAt: null } : {}),
  }).where(eq(automationSettingsTable.id, current.id)).returning();
  res.json(updated[0]);
});

// ─── Data-source key status ──────────────────────────────────────────────────
// Reads live pool counts from DB — keys are managed in the CRM admin UI.
// Deprecated path kept for backward compat; /api/api-pools/status is canonical.

import { readPool } from "../lib/api-key-pools";

router.get("/automation/datasource-status", async (_req, res) => {
  try {
    const [fsPool, ttPool, herePool] = await Promise.all([
      readPool("foursquare"),
      readPool("tomtom"),
      readPool("here"),
    ]);
    const baseYield = 10;
    const active = (pool: Awaited<ReturnType<typeof readPool>>) => pool.length > 0;
    const count  = (pool: Awaited<ReturnType<typeof readPool>>) =>
      Math.max(pool.filter(k => k.id !== "__env__").length, active(pool) ? 1 : 0);

    const estimatedYieldPerCity =
      baseYield +
      (active(fsPool)   ? 50  * count(fsPool)   : 0) +
      (active(ttPool)   ? 100 * count(ttPool)    : 0) +
      (active(herePool) ? 100 * count(herePool)  : 0);

    res.json({
      foursquare: active(fsPool),
      tomtom:     active(ttPool),
      here:       active(herePool),
      gemini:     !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      estimatedYieldPerCity,
    });
  } catch {
    res.json({ foursquare: false, tomtom: false, here: false, gemini: false, estimatedYieldPerCity: 10 });
  }
});

// ─── Automation Status (live run info) ───────────────────────────────────────

router.get("/automation/status", async (_req, res) => {
  const settings = await getOrCreateSettings();
  const accounts = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.active, true));
  res.json({
    enabled: settings.autoHuntEnabled,
    lastRunAt: settings.lastRunAt,
    nextRunAt: settings.nextRunAt,
    activeAccounts: accounts.length,
    stats: settings.runStats,
  });
});

// ─── Manual trigger ───────────────────────────────────────────────────────────

router.post("/automation/run-now", async (req, res) => {
  // Kick off without awaiting — respond immediately
  res.json({ success: true, message: "Automation run started" });
  runAutomationCycle().catch(() => {});
});

// ─── Core automation engine ───────────────────────────────────────────────────

export async function runAutomationCycle(overrides?: {
  category?: string; city?: string; country?: string; count?: number; extraContext?: string;
}) {
  const settings = await getOrCreateSettings();
  const prevStats: Record<string, any> =
    settings.runStats && typeof settings.runStats === "object" ? (settings.runStats as any) : {};

  // Support comma- or newline-separated rotation queues for both cities and categories
  const rawCityInput = overrides?.city ?? settings.huntCity ?? "";
  const rawCategoryInput = overrides?.category ?? settings.huntCategory ?? "business";

  const cityQueue = rawCityInput
    .split(/[\n,]+/)
    .map(c => c.trim())
    .filter(Boolean);
  const categoryQueue = rawCategoryInput
    .split(/[\n,]+/)
    .map(c => c.trim())
    .filter(Boolean);

  if (cityQueue.length === 0) return;

  const rotationIndex = typeof prevStats.rotationIndex === "number" ? prevStats.rotationIndex : 0;
  const activeCity = cityQueue[rotationIndex % cityQueue.length];
  const activeCategory =
    categoryQueue.length > 0
      ? categoryQueue[Math.floor(rotationIndex / Math.max(1, cityQueue.length)) % categoryQueue.length]
      : "business";
  const nextCity = cityQueue[(rotationIndex + 1) % cityQueue.length];

  const cfg = {
    category: activeCategory,
    city: activeCity,
    country: overrides?.country ?? settings.huntCountry,
    count: overrides?.count ?? settings.huntCount,
    extraContext: overrides?.extraContext ?? settings.huntExtraContext,
  };

  // Load previously emailed addresses so we never double-email a prospect across rotation cycles
  const previouslyEmailed = new Set<string>(
    Array.isArray(prevStats.emailedHistory)
      ? prevStats.emailedHistory.map((e: string) => String(e).toLowerCase())
      : []
  );
  try {
    const existingQueue = await db.select().from(followUpQueueTable);
    for (const row of existingQueue) {
      if (row.prospectEmail) previouslyEmailed.add(row.prospectEmail.toLowerCase());
    }
  } catch { /* ignore if DB unavailable */ }

  const runStats: Record<string, any> = {
    hunted: 0,
    scored: 0,
    emailed: 0,
    followUps: 0,
    skippedDuplicates: 0,
    errors: 0,
    rotationIndex: rotationIndex + 1,
    activeTargetCity: activeCity,
    activeTargetCategory: activeCategory,
    nextTargetCity: nextCity,
    cityQueueSize: cityQueue.length,
    categoryQueueSize: categoryQueue.length,
  };

  // 0. Process pending follow-ups first (non-openers past their follow-up date)
  if (settings.followUpEnabled) {
    try {
      const dueDate = new Date(Date.now() - (settings.followUpDays ?? 4) * 24 * 60 * 60 * 1000);
      const pending = await db.select().from(followUpQueueTable)
        .where(and(eq(followUpQueueTable.status, "pending"), lte(followUpQueueTable.firstSentAt, dueDate)));

      const followUpAccounts = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.active, true));
      let fuAcctIdx = 0;

      for (const item of pending) {
        // Skip if the original was opened — check tracking table
        const opened = await db.select().from(emailTrackingTable)
          .where(and(eq(emailTrackingTable.prospectEmail, item.prospectEmail)));
        const wasOpened = opened.some(t => t.opens > 0);
        if (wasOpened) {
          await db.update(followUpQueueTable).set({ status: "skipped" }).where(eq(followUpQueueTable.id, item.id));
          continue;
        }

        const fuAcct = followUpAccounts.length > 0 ? followUpAccounts[fuAcctIdx % followUpAccounts.length] : null;
        const fuSenderName = fuAcct?.fromName || process.env.AGENCY_NAME || "Daniel";
        const fuAgencyName = process.env.AGENCY_NAME || "DevStudio";
        const fuAgencyWebsite = getAgencyBaseUrl();
        const fuAgencyEmail = fuAcct?.fromEmail || fuAcct?.user || "";
        const fuSignature = buildSignature(fuSenderName, fuAgencyName, fuAgencyWebsite, fuAgencyEmail);

        const followUpBody = `Hi ${item.businessName} Team,\n\nI sent you a note a few days ago — just wanted to make sure it didn't get buried.\n\nWe put together a free website report for ${item.businessName} with some specific observations. It's still available if you'd like to take a look.\n\nNo pressure at all — if the timing isn't right, just ignore this. But if any of it sounds relevant, feel free to reply and I'll answer any questions over email.\n\n${fuSignature}`;
        const followUpSubject = `Re: ${item.originalSubject}`;
        const html = followUpBody.split("\n").map(l => l.trim() ? `<p style="margin:0 0 12px;line-height:1.7;font-size:15px;">${l}</p>` : "<br/>").join("");

        try {
          if (followUpAccounts.length > 0) {
            const acct = followUpAccounts[fuAcctIdx % followUpAccounts.length];
            fuAcctIdx++;
            const transporter = makeTransporter(acct);
            await transporter.sendMail({
              from: `"${acct.fromName}" <${acct.fromEmail || acct.user}>`,
              to: item.prospectEmail,
              subject: followUpSubject,
              text: followUpBody,
              html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px 32px;color:#1a1a2e;background:#ffffff;">${html}</div>`,
            });
          } else {
            await brevoSendMail({ to: item.prospectEmail, subject: followUpSubject, text: followUpBody, html });
          }
          await db.update(followUpQueueTable).set({ status: "sent", followUpSentAt: new Date() }).where(eq(followUpQueueTable.id, item.id));
          runStats.followUps++;
          if (settings.emailDelayMinutes > 0) {
            await new Promise(r => setTimeout(r, settings.emailDelayMinutes * 60 * 1000));
          }
        } catch { runStats.errors++; }
      }
    } catch { /* follow-up errors don't block main cycle */ }
  }

  // 1. Hunt businesses — use real directory scrapers (same pipeline as the manual hunter)
  // We intentionally do NOT use AI to generate fake businesses here: AI-invented
  // emails look plausible but have no real MX records and are filtered to zero by
  // the DNS verification step below. Real scrapers return verifiable contacts.
  let businesses: any[] = [];
  try {
    // Cap at 200 per cycle — each prospect triggers website scraping + AI calls,
    // so very large values create long-running cycles that time out mid-way.
    const needed = Math.min(Math.max(cfg.count ?? 50, 1), 200);
    const { businesses: scraped } = await scrapeBusinessDirectories(
      cfg.category || "business",
      cfg.city,
      cfg.country || "",
      needed
    );

    businesses = scraped
      .filter(b => b.businessName)
      .map(b => ({
        businessName: b.businessName,
        ownerName: "",
        category: b.category || cfg.category,
        email: b.email || "",
        phone: b.phone || "",
        website: b.website || "",
        city: b.city || cfg.city,
        country: b.country || cfg.country || "",
        instagram: "",
        facebook: "",
        linkedin: "",
        softwareNeedScore: b.aiOpportunityScore ?? 5,
        painPoint: b.aiOpportunityNote || "",
        estimatedValue: 0,
        notes: b.address || "",
        source: b.source,
      }));

    runStats.hunted = businesses.length;

    // Filter: discard businesses whose email domain has no MX records or whose
    // website domain doesn't resolve in DNS. Uses batched concurrency (8) to
    // avoid saturating Node's libuv threadpool and timing out valid leads.
    businesses = await filterLiveProspects(businesses);
    runStats.filtered = (runStats.hunted as number) - businesses.length;

    // Deduplicate against previously emailed prospects so recurring 24/7 hunts never spam the same lead
    const beforeDedup = businesses.length;
    businesses = businesses.filter(b => {
      if (!b.email) return true;
      return !previouslyEmailed.has(String(b.email).toLowerCase());
    });
    runStats.skippedDuplicates = beforeDedup - businesses.length;
  } catch { runStats.errors++; }

  // 2. Auto-score + generate email content for each, then send
  let accounts: (typeof emailAccountsTable.$inferSelect)[] = [];
  try {
    accounts = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.active, true));
  } catch { /* DB unavailable */ }
  // KV store fallback — accounts saved via admin when DB was unreachable
  if (accounts.length === 0) {
    try {
      const { kvGetJson } = await import("../lib/replit-kv");
      const kvAccounts = await kvGetJson<(typeof emailAccountsTable.$inferSelect)[]>("EMAIL_ACCOUNTS");
      if (kvAccounts && kvAccounts.length > 0) {
        accounts = kvAccounts.filter(a => a.active && !a.autoPaused);
      }
    } catch { /* ignore */ }
  }
  // Final fallback: env-var SMTP account
  if (accounts.length === 0) {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    if (smtpUser && smtpPass) {
      const now = new Date();
      accounts = [{
        id: -1,
        label: "Env SMTP",
        provider: (process.env.SMTP_HOST || "smtp.gmail.com").includes("gmail") ? "gmail" : "custom",
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        user: smtpUser,
        password: smtpPass,
        fromName: process.env.SMTP_FROM_NAME || process.env.AGENCY_NAME || "DevStudio",
        fromEmail: process.env.SMTP_FROM_EMAIL || smtpUser,
        imapEnabled: false, imapHost: "", imapPort: 993,
        active: true, sentCount: 0, dailyLimit: 80, sentToday: 0,
        lastSentDay: "", consecutiveFailures: 0, lastError: "",
        lastErrorAt: null, autoPaused: false, createdAt: now,
      }];
    }
  }
  let accountIndex = 0;

  // Store prospects as JSON in runStats for display
  const prospectsSummary: any[] = [];
  const training = await getActiveTrainingProfile();

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i];
    let analysis: any = null;
    let emailContent: { subject: string; body: string } | null = null;
    let rawEmailVersion: { version?: string; subject: string; body: string } | null = null;

    // Scrape the website once per prospect — reused by both the scoring block and
    // the fallback email block below to avoid fetching the same URL twice.
    const siteContent = (settings.autoScore || settings.autoEmail)
      ? await scrapeWebsite(biz.website)
      : "";
    const siteContext = siteContent
      ? `\nReal website content scraped from ${biz.website}:\n"""\n${siteContent}\n"""`
      : (biz.website ? `\nWebsite ${biz.website} could not be scraped.` : "\nNo website.");

    const senderAcct = accounts.length > 0 ? accounts[accountIndex % accounts.length] : null;
    const senderName = training.senderName || senderAcct?.fromName || process.env.AGENCY_NAME || "Alex Morgan";
    const agencyName = training.businessName || process.env.AGENCY_NAME || "Apex Digital Growth";
    const agencyEmail = training.senderEmail || senderAcct?.fromEmail || senderAcct?.user || "";
    const agencyWebsite = training.websiteUrl || getAgencyBaseUrl();
    const ownerGreeting = biz.ownerName ? `Hi ${biz.ownerName},` : `Hi ${biz.businessName || "there"} Team,`;
    const trainedBlock = buildTrainedOutreachPromptBlock(training, {
      targetBusinessName: biz.businessName,
      targetOwnerName: biz.ownerName,
      targetCategory: biz.category,
      targetCity: biz.city,
    });

    if (settings.autoScore) {
      try {
        const autoPrompt = `You are ${senderName} at ${agencyName}.
Analyze this ${biz.category || "local"} business and return a JSON object with a full analysis and THREE personalised cold email versions (A, B, C) strictly following the TRAINED AI INTELLIGENCE PROFILE below:

${trainedBlock}

BUSINESS DETAILS:
- Name: ${biz.businessName}
- Owner: ${biz.ownerName || "unknown"}
- Location: ${biz.city}${biz.country ? ", " + biz.country : ""}
- Website: ${biz.website || "No website"}
- Known pain point: ${biz.painPoint || "not specified"}
${siteContext}

EMAIL STRUCTURE — all three versions must follow the user's static reference email message, what ${agencyName} offers, and the user's AI instructions:
1. SUBJECT LINE: Max 7 words, curiosity-driven, different angle per version (A/B/C).
2. OPENING: "${ownerGreeting}"
3. PERSONALISED BODY: Adapt the user's static email template and offer (${training.offerDetails}) for ${biz.businessName}, referencing 1–2 real findings from their business/website.
${training.includeAuditReportLink ? '4. REPORT LINK: Include naturally in the body: "We put together a free personalised website report for you — you can view it here: {{REPORT_URL}}"' : ""}
5. SOFT CTA: "${training.callToAction}"
6. SIGNATURE:
   Best regards,
   ${senderName}
   ${agencyName}${agencyWebsite ? "\n   " + agencyWebsite : ""}${agencyEmail ? "\n   " + agencyEmail : ""}

Return ONLY valid JSON (no markdown, no prose):
{ "analysis": { "websiteScore":<0-100>,"leadScore":<0-100>,"conversionScore":<0-100>,"mobileScore":<0-100>,"seoScore":<0-100>,"growthPotential":<0-100>,"summary":"string","projectType":"string","estimatedValue":{"min":<n>,"max":<n>},"deliveryWeeks":{"min":<1 or 2>,"max":<1 or 2>},"recommendedFeatures":["string"],"issues":[{"title":"string","description":"string","priority":"high|medium|low"}],"opportunities":[{"title":"string","impact":"string","effort":"low|medium|high"}],"checks":{"responsiveDesign":false,"sslCertificate":false,"modernUI":false,"whatsappButton":false,"contactForm":false,"bookingSystem":false,"onlineOrdering":false,"paymentIntegration":false,"customerPortal":false,"membershipArea":false,"blog":false,"seoBasics":false,"analytics":false,"socialMedia":false,"emailCapture":false,"liveChat":false,"aiChatbot":false,"callToAction":false,"trustElements":false}}, "emailVersions":[{"version":"A","subject":"string","body":"string"},{"version":"B","subject":"string","body":"string"},{"version":"C","subject":"string","body":"string"}] }`;
        const genText = await generateText(autoPrompt);
        const genData = parseJSON(genText);
        analysis = genData.analysis;
        // Rotate A/B/C by prospect index so every batch sends different versions
        const versions: { version?: string; subject: string; body: string }[] = genData.emailVersions || [];
        rawEmailVersion = versions[i % 3] ?? versions[0] ?? (genData.email ? genData.email : null);
        runStats.scored++;
      } catch { runStats.errors++; }
    }

    // Create report first so the URL can be embedded in the email body text.
    // This is additive — a failure here never blocks the email send.
    let reportUrl = "";
    let reportSectionHtml = "";
    if (analysis) {
      try {
        const result = await createReport({
          businessName: biz.businessName,
          website: biz.website || "",
          analysisData: analysis,
          baseUrl: getAgencyBaseUrl(),
        });
        reportUrl = result.reportUrl;
        reportSectionHtml = buildReportEmailSection(reportUrl, biz.businessName);
      } catch { /* report creation never blocks the email send */ }
    }

    // Resolve the {{REPORT_URL}} placeholder the AI wrote in the body.
    // If report creation failed (reportUrl is blank), strip the entire report line so the
    // email doesn't contain a broken/empty link — the HTML report section will also be absent.
    if (rawEmailVersion) {
      let body = rawEmailVersion.body || "";
      if (reportUrl) {
        body = body.replace(/\{\{REPORT_URL\}\}/g, reportUrl);
      } else {
        // Remove any sentence containing the placeholder so the email reads naturally
        body = body
          .replace(/[^\n.!?]*\{\{REPORT_URL\}\}[^\n]*/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
      emailContent = {
        subject: fillPlaceholders(rawEmailVersion.subject || "", senderName, agencyName, agencyWebsite, agencyEmail),
        body: fillPlaceholders(body, senderName, agencyName, agencyWebsite, agencyEmail),
      };
    }

    // If autoScore is off (or the scoring prompt failed), generate a lightweight
    // email so autoEmail can still function.
    if (!emailContent && settings.autoEmail && biz.email) {
      try {
        const signatureBlock = buildSignature(senderName, agencyName, agencyWebsite, agencyEmail);
        const reportLine = reportUrl
          ? `We put together a free personalised website report for you — you can view it here: ${reportUrl}`
          : "";
        const emailOnlyPrompt = `Write THREE personalised cold email versions (A, B, C) from ${senderName} at ${agencyName} to ${biz.businessName}, a ${biz.category || "business"} in ${biz.city}.${biz.painPoint ? `\nKnown pain point: ${biz.painPoint}` : ""}${siteContext}

${trainedBlock}

EMAIL STRUCTURE — follow the user's static reference email message, offer, and instructions above for all three versions:
1. SUBJECT LINE: Max 7 words, curiosity-driven, no clickbait.
2. OPENING: "${ownerGreeting}"
3. BODY: Personalize the user's static message and offer (${training.offerDetails}) for ${biz.businessName} in ${biz.city}.
${reportLine ? `4. REPORT LINK: Include this line: "${reportLine}"` : ""}
5. SOFT CTA: "${training.callToAction}"
6. SIGNATURE: End with:\n${signatureBlock}

Return ONLY valid JSON: { "emailVersions":[{"version":"A","subject":"string","body":"string"},{"version":"B","subject":"string","body":"string"},{"version":"C","subject":"string","body":"string"}] }`;
        const emailText = await generateText(emailOnlyPrompt);
        const emailData = parseJSON(emailText);
        const fallbackVersions: { version?: string; subject: string; body: string }[] = emailData?.emailVersions || [];
        const fallback = fallbackVersions[i % 3] ?? fallbackVersions[0];
        if (fallback?.subject && fallback?.body) {
          emailContent = {
            subject: fillPlaceholders(fallback.subject, senderName, agencyName, agencyWebsite, agencyEmail),
            body: fillPlaceholders(fallback.body, senderName, agencyName, agencyWebsite, agencyEmail),
          };
        } else if (emailData?.subject && emailData?.body) {
          // backward compat if AI returns old single-version format
          emailContent = {
            subject: fillPlaceholders(emailData.subject, senderName, agencyName, agencyWebsite, agencyEmail),
            body: fillPlaceholders(emailData.body, senderName, agencyName, agencyWebsite, agencyEmail),
          };
        }
      } catch { runStats.errors++; }
    }

    prospectsSummary.push({
      businessName: biz.businessName,
      email: biz.email,
      website: biz.website || "",
      category: biz.category || cfg.category,
      city: biz.city,
      score: biz.softwareNeedScore,
      scored: !!analysis,
      reportUrl: reportUrl || "",
      emailed: false,
    });

    // 3. Send email — use DB accounts if available, otherwise fall back to Brevo
    const canSend = settings.autoEmail && biz.email && emailContent;
    if (canSend) {
      /** Convert plain-text body to minimal HTML paragraphs. */
      const bodyHtml = emailContent!.body
        .split("\n")
        .map(l => l.trim() ? `<p style="margin:0 0 12px;line-height:1.7;font-size:15px;">${l}</p>` : "<br/>")
        .join("");

      /** Signature block shown in HTML at the bottom of the body. */
      const buildSigHtml = (name: string, website: string, email: string) => {
        const lines = [name];
        if (website) lines.push(`<a href="${website}" style="color:#6d28d9;text-decoration:none;">${website}</a>`);
        if (email) lines.push(`<a href="mailto:${email}" style="color:#6d28d9;text-decoration:none;">${email}</a>`);
        return `<p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">${lines.join("<br/>")}</p>`;
      };

      try {
        if (accounts.length > 0) {
          const acct = accounts[accountIndex % accounts.length];
          accountIndex++;
          const acctWebsite = agencyWebsite;
          const acctEmail = acct.fromEmail || acct.user || "";
          const sigHtml = buildSigHtml(acct.fromName || agencyName, acctWebsite, acctEmail);
          const transporter = makeTransporter(acct);
          await transporter.sendMail({
            from: `"${acct.fromName}" <${acct.fromEmail || acct.user}>`,
            to: biz.email,
            subject: emailContent!.subject,
            text: emailContent!.body,
            html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px 32px;color:#1a1a2e;background:#ffffff;">${bodyHtml}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>${sigHtml}${reportSectionHtml}</div>`,
          });
        } else {
          // Brevo fallback — uses server-level credentials from env or DB
          const sigHtml = buildSigHtml(agencyName, agencyWebsite, agencyEmail);
          await brevoSendMail({
            to: biz.email,
            subject: emailContent!.subject,
            text: emailContent!.body,
            html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px 32px;color:#1a1a2e;background:#ffffff;">${bodyHtml}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>${sigHtml}${reportSectionHtml}</div>`,
          });
        }
        runStats.emailed++;
        prospectsSummary[prospectsSummary.length - 1].emailed = true;
        if (biz.email) {
          previouslyEmailed.add(String(biz.email).toLowerCase());
        }

        // Queue a follow-up if enabled
        if (settings.followUpEnabled && biz.email) {
          await db.insert(followUpQueueTable).values({
            prospectEmail: biz.email,
            businessName: biz.businessName,
            originalSubject: emailContent!.subject,
            originalBody: emailContent!.body,
            followUpDays: settings.followUpDays ?? 4,
            accountId: (() => { const id = accounts.length > 0 ? accounts[(accountIndex - 1) % accounts.length].id : null; return id && id > 0 ? id : null; })(),
            status: "pending",
          }).onConflictDoNothing();
        }

        // Delay before next email with natural human jitter (+15s to +45s) to protect inbox reputation
        if (i < businesses.length - 1 && settings.emailDelayMinutes > 0) {
          const jitterMs = Math.floor(15000 + Math.random() * 30000);
          await new Promise(r => setTimeout(r, settings.emailDelayMinutes * 60 * 1000 + jitterMs));
        }
      } catch { runStats.errors++; }
    }
  }

  // Update settings with run stats + timestamps
  const now = new Date();
  const nextRun = settings.autoHuntEnabled
    ? new Date(now.getTime() + settings.huntIntervalHours * 60 * 60 * 1000)
    : null;

  const emailedHistory = Array.from(previouslyEmailed).slice(-500);

  await db.update(automationSettingsTable).set({
    lastRunAt: now,
    nextRunAt: nextRun,
    runStats: {
      ...runStats,
      emailedHistory,
      lastProspects: prospectsSummary.slice(0, 25),
      lastRunAt: now.toISOString(),
    },
  }).where(eq(automationSettingsTable.id, settings.id));
}

// ─── IMAP reply checker ───────────────────────────────────────────────────────

/** Read recent (last 7 days) messages from an IMAP inbox. */
async function readImapMessages(acct: {
  user: string; password: string; imapHost: string; imapPort: number; id: number;
}): Promise<Array<{ messageId: string; from: string; subject: string; text: string; date: Date }>> {
  const rawImapHost =
    acct.imapHost && !acct.imapHost.startsWith("owner:") ? acct.imapHost : "imap.gmail.com";
  const ipv4ImapHost = await resolveIpv4Host(rawImapHost);
  const client = new ImapFlow({
    host: ipv4ImapHost,
    port: acct.imapPort || 993,
    secure: true,
    servername: rawImapHost,
    auth: { user: acct.user.trim(), pass: (acct.password || "").replace(/\s/g, "") },
    logger: false,
    tls: { rejectUnauthorized: false, servername: rawImapHost },
  } as any);

  const out: Array<{ messageId: string; from: string; subject: string; text: string; date: Date }> = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const uids = await client.search({ since });
      const uidList = Array.isArray(uids) ? uids : [];
      if (uidList.length > 0) {
        const subset = uidList.slice(-50); // cap at 50 per account
        for await (const msg of client.fetch(subset as any, {
          envelope: true,
          bodyParts: ["TEXT", "1"],
        } as any)) {
          const fromAddr = (msg as any).envelope?.from?.[0]?.address || "";
          const subject = (msg as any).envelope?.subject || "";
          const msgId = (msg as any).envelope?.messageId || `${acct.id}-${(msg as any).uid}`;
          const date: Date = (msg as any).envelope?.date || new Date();
          let text = "";
          if ((msg as any).bodyParts) {
            for (const [, buf] of (msg as any).bodyParts) {
              if (Buffer.isBuffer(buf)) text += buf.toString("utf-8");
            }
          }
          // Strip quoted replies (lines starting with ">") and email headers
          text = text
            .replace(/\r\n/g, "\n")
            .split("\n")
            .filter(l => !l.trim().startsWith(">") && !/^On .* wrote:$/i.test(l.trim()))
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 2000);
          out.push({ messageId: msgId, from: fromAddr, subject, text, date });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch {
    try { await client.logout(); } catch {}
  }

  return out;
}

/** AI: classify a reply and write an appropriate response. */
async function classifyAndRespond(
  text: string, businessName: string
): Promise<{ classification: string; response: string }> {
  const prompt = `You received this reply to a cold outreach email sent to ${businessName}.
Reply: """${text.slice(0, 600)}"""

Classify it as exactly one of:
- "interested" — positive interest, questions, wants to know more (but did NOT explicitly ask for a phone/video call)
- "call_requested" — explicitly asked for a phone call, video call, or said "let's hop on a call / talk / chat"
- "not_interested" — declined, unsubscribe, not relevant
- "objection" — has a concern or pushback that needs addressing

Write a short reply email (max 80 words, no filler, no "I hope this finds you well"):
- interested → warmly acknowledge, ask one follow-up question about their biggest challenge so you can tailor a proposal
- call_requested → gently explain you prefer email for now (faster to share details & examples), ask them to describe their main challenge so you can send something tailored — keep it warm, not dismissive
- not_interested → wish them well briefly, no pressure
- objection → address their concern directly, invite them to share more

Sign off: "${process.env.AGENCY_NAME || "DevStudio"}". Sound human.
Return ONLY JSON: { "classification": "...", "response": "..." }`;

  try {
    const ai = await getGeminiAI();
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 512 },
    });
    const raw = (result.text ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(raw);
  } catch {
    return { classification: "other", response: "" };
  }
}

router.post("/automation/check-replies", async (_req, res) => {
  try {
    const accounts = await db
      .select()
      .from(emailAccountsTable)
      .where(and(eq(emailAccountsTable.active, true), eq(emailAccountsTable.imapEnabled, true)));

    if (accounts.length === 0) {
      res.json({
        checked: 0,
        replied: 0,
        newReplies: [],
        message: "No email accounts have IMAP enabled. Go to Automation → Email Accounts, enable IMAP and fill in the IMAP host/port.",
      });
      return;
    }

    const settings = await getOrCreateSettings();
    let totalChecked = 0;
    let totalAutoReplied = 0;
    const newReplies: any[] = [];

    for (const acct of accounts) {
      const messages = await readImapMessages(acct);

      for (const msg of messages) {
        // Skip messages sent by us (sent-from addresses)
        if (acct.user && msg.from.toLowerCase() === acct.user.toLowerCase()) continue;
        if (acct.fromEmail && msg.from.toLowerCase() === acct.fromEmail.toLowerCase()) continue;
        if (!msg.text.trim()) continue;

        // Look up the business name from the follow-up queue
        const [knownLead] = await db
          .select({ businessName: followUpQueueTable.businessName })
          .from(followUpQueueTable)
          .where(eq(followUpQueueTable.prospectEmail, msg.from))
          .limit(1);
        const businessName = knownLead?.businessName || msg.from;

        // Atomically claim this message by inserting first (pending classification).
        // If another concurrent run already inserted it, the unique constraint fires and
        // onConflictDoNothing returns zero rows — we skip to avoid duplicate auto-replies.
        const inserted = await db
          .insert(inboxRepliesTable)
          .values({
            messageId: msg.messageId,
            accountId: acct.id,
            prospectEmail: msg.from,
            businessName,
            subject: msg.subject,
            bodyText: msg.text,
            classification: "pending",
            receivedAt: msg.date,
          })
          .onConflictDoNothing()
          .returning({ id: inboxRepliesTable.id });
        if (!inserted.length) continue; // already handled by another run

        totalChecked++;

        // AI classify + draft response
        const { classification, response } = await classifyAndRespond(msg.text, businessName);

        // Auto-send the reply if autoReply is enabled and AI produced a response
        let aiRepliedAt: Date | null = null;
        if (settings.autoReply && response) {
          try {
            const transporter = makeTransporter(acct);
            await transporter.sendMail({
              from: `"${acct.fromName}" <${acct.fromEmail || acct.user}>`,
              to: msg.from,
              subject: `Re: ${msg.subject}`,
              text: response,
              html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e;">${response
                .split("\n")
                .map(l => (l.trim() ? `<p style="margin:0 0 12px;line-height:1.6;">${l}</p>` : "<br/>"))
                .join("")}</div>`,
            });
            aiRepliedAt = new Date();
            totalAutoReplied++;
          } catch {}
        }

        // Update the row with classification results now that we've sent the reply
        await db
          .update(inboxRepliesTable)
          .set({ classification, aiResponse: response, aiRepliedAt })
          .where(eq(inboxRepliesTable.id, inserted[0].id));

        newReplies.push({ from: msg.from, businessName, classification, subject: msg.subject, autoReplied: !!aiRepliedAt });
      }
    }

    res.json({
      checked: totalChecked,
      replied: totalAutoReplied,
      newReplies,
      message: `Checked ${accounts.length} account(s). Found ${totalChecked} new reply(ies), auto-replied to ${totalAutoReplied}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** List stored inbox replies (newest first). */
router.get("/automation/replies", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db
      .select()
      .from(inboxRepliesTable)
      .orderBy(desc(inboxRepliesTable.receivedAt))
      .limit(limit);
    res.json(rows.map(r => ({
      ...r,
      receivedAt: r.receivedAt.toISOString(),
      aiRepliedAt: r.aiRepliedAt?.toISOString() ?? null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Mark a reply as read. */
router.patch("/automation/replies/:id/read", async (req, res) => {
  try {
    await db
      .update(inboxRepliesTable)
      .set({ read: true })
      .where(eq(inboxRepliesTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Daily email account health check ────────────────────────────────────────

async function runHealthCheck() {
  const accounts = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.active, true));
  for (const acct of accounts) {
    if (!acct.user || !acct.password) continue;
    try {
      const transporter = makeTransporter(acct);
      await transporter.verify();
      await db.update(emailAccountsTable).set({
        lastError: "",
        lastErrorAt: null,
        consecutiveFailures: 0,
      }).where(eq(emailAccountsTable.id, acct.id));
    } catch (err: any) {
      await db.update(emailAccountsTable).set({
        lastError: err.message || "Verification failed",
        lastErrorAt: new Date(),
        consecutiveFailures: (acct.consecutiveFailures || 0) + 1,
      }).where(eq(emailAccountsTable.id, acct.id));
    }
  }
}

router.post("/automation/health-check", async (_req, res) => {
  try {
    await runHealthCheck();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Scheduler (runs in-process) ─────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

async function scheduleNext() {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  const settings = await getOrCreateSettings().catch(() => null);
  if (!settings?.autoHuntEnabled || !settings.huntCity) return;
  const now = Date.now();
  const nextRun = settings.nextRunAt ? new Date(settings.nextRunAt).getTime() : now;
  const delay = Math.max(nextRun - now, 60_000); // at least 1 minute
  schedulerTimer = setTimeout(async () => {
    await runAutomationCycle().catch(() => {});
    scheduleNext();
  }, delay);
}

export function startScheduler() {
  scheduleNext().catch(() => {});
  // Re-check every 5 minutes in case settings changed
  setInterval(() => scheduleNext().catch(() => {}), 5 * 60 * 1000);

  // Run an initial account health check shortly after boot, then every 24h
  setTimeout(() => runHealthCheck().catch(() => {}), 30_000);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(() => runHealthCheck().catch(() => {}), 24 * 60 * 60 * 1000);
}

export default router;
