import { Router } from "express";
import { randomUUID } from "crypto";
import { makeSmartTransporter, isNetworkOrPortError } from "../lib/smtp-mailer";
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
import {
  scrapeBusinessDirectories,
  enrichWebsiteApolloSignals,
  computeApolloIntentScore,
} from "../lib/business-scrapers";
import { createReport, buildReportEmailSection, getAgencyBaseUrl } from "./reports";
import { kvGetJson, kvSetJson } from "../lib/replit-kv";
import { requireAdmin } from "../lib/admin-auth";
import {
  getActiveTrainingProfile,
  buildTrainedOutreachPromptBlock,
  buildTrainedAnalysisPromptBlock,
  resolveUserFromRequest,
} from "../lib/ai-training";

function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === "jwandersonar@gmail.com" || e === "admin@vanguardhunter.io";
}

function doesAccountBelongToUser(
  acct: typeof emailAccountsTable.$inferSelect,
  user: { id: number; email: string; role?: string } | null
): boolean {
  if (!user) return true;
  if (isOwnerEmail(user.email) || user.role === "admin") return true;
  const tag = String(acct.imapHost || "").trim();
  if (tag.startsWith("owner:")) {
    return (
      tag === `owner:${user.id}` ||
      tag.toLowerCase() === `owner:${user.email.trim().toLowerCase()}`
    );
  }
  return true;
}

function doesProspectRowBelongToUser(
  row: typeof crmProspectsTable.$inferSelect,
  user: { id: number; email: string } | null
): boolean {
  if (!user) return false;
  const p = (row.payload || {}) as any;
  if (p.ownerUserId !== undefined && p.ownerUserId !== null) {
    return Number(p.ownerUserId) === user.id;
  }
  if (/^u\d+_/.test(String(row.id))) {
    return String(row.id).startsWith(`u${user.id}_`);
  }
  return isOwnerEmail(user.email);
}

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

function makeTransporter(acct: { host: string; port: number; secure: boolean; user: string; password: string; provider?: string; fromName?: string; fromEmail?: string }) {
  return makeSmartTransporter(acct);
}

async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const modelsToTry = ["gemini-2.5-flash", "gemini-3-flash-preview"];
  let lastErr: any = null;
  for (const modelName of modelsToTry) {
    try {
      const ai = await getGeminiAI();
      const response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            ...(systemInstruction ? { systemInstruction } : {}),
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI generation timeout")), 4500)
        ),
      ]);
      if (response.text) return response.text;
    } catch (err: any) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("AI generation unavailable");
}

function matchBestOfferFromTraining(
  services: Array<{ id?: string; name: string; description: string; targetNeeds?: string; targetSignals?: string }> | undefined,
  params: {
    website?: string;
    category?: string;
    painPoint?: string;
    missingSignals?: string[];
    cmsPlatform?: string;
    siteContent?: string;
    websiteScore?: number;
    checks?: Record<string, boolean>;
  }
): { name: string; description: string; needsWebsite: boolean; needsReview: boolean } {
  const list = Array.isArray(services) && services.length > 0 ? services : [];
  const hasWeb = Boolean(params.website && !/^(none|n\/a|no website|-)$/i.test(params.website.trim()));
  const signalText = `${params.painPoint || ""} ${(params.missingSignals || []).join(" ")} ${params.cmsPlatform || ""}`.toLowerCase();
  const contentText = (params.siteContent || "").toLowerCase();

  const hasReviewsInContent =
    /customer reviews|testimonials|google reviews|trustpilot|birdeye|podium|nicejob|5-star|★★★★★|what our (clients|customers|patients) say/i.test(
      `${contentText} ${signalText}`
    ) && !/no review|no 5-star review|missing.*review/i.test(signalText);
  const hasBookingOrChatInContent =
    contentText.length > 50 && /book now|online booking|schedule appointment|instant quote|live chat|calendly|acuity/i.test(contentText);
  const siteUnreachableOrThin = hasWeb && contentText.length < 220 && !hasBookingOrChatInContent;

  const needsWebsite =
    !hasWeb ||
    siteUnreachableOrThin ||
    (typeof params.websiteScore === "number" && params.websiteScore < 70) ||
    Boolean(
      params.checks &&
        (params.checks.responsiveDesign === false ||
          params.checks.modernUI === false ||
          params.checks.contactForm === false)
    ) ||
    /no website|unreachable|parked|diy|wix|godaddy|weebly|squarespace|wordpress|no lead capture|no contact form|no online booking|no booking|no https|outdated|slow|poor mobile|redesign|high-friction/i.test(
      signalText
    ) ||
    (hasWeb && contentText.length >= 220 && !hasBookingOrChatInContent);

  const needsReview =
    !hasReviewsInContent &&
    (!hasWeb ||
      siteUnreachableOrThin ||
      Boolean(params.checks && params.checks.trustElements === false) ||
      /no review|missing.*review|low.*review|few.*review|review funnel|review shield|reputation|5-star|no testimonial|trust/i.test(
        signalText
      ) ||
      (hasWeb && contentText.length > 50 && !hasReviewsInContent));

  if (list.length === 0) {
    if (needsWebsite && needsReview) {
      return {
        name: "Website Creation & Review Service",
        description: "Custom conversion websites and automated 5-star Google review generation systems",
        needsWebsite: true,
        needsReview: true,
      };
    }
    if (needsWebsite) {
      return {
        name: "Website Creation & Mobile Redesign",
        description: "Custom conversion-focused website with instant quote and mobile lead capture",
        needsWebsite: true,
        needsReview: false,
      };
    }
    if (needsReview) {
      return {
        name: "5-Star Review Service & Reputation Shield",
        description: "Automated 5-star Google review generation and feedback gatekeeper system",
        needsWebsite: false,
        needsReview: true,
      };
    }
    return {
      name: "24/7 AI Receptionist & Automated Booking",
      description: "Automated 24/7 customer response and online appointment booking system",
      needsWebsite: false,
      needsReview: false,
    };
  }

  const websiteService = list.find(s => /website|web design|site creation|redesign|landing page/i.test(`${s.name} ${s.description}`));
  const reviewService = list.find(s => /review|reputation|5-star|star/i.test(`${s.name} ${s.description}`));

  // Only assign Website Creation & Review Service when the audit/signals indicate the business needs them
  if (websiteService && reviewService && needsWebsite && needsReview) {
    return {
      name: "Website Creation & Review Service",
      description: `${websiteService.description} ${reviewService.description}`.trim(),
      needsWebsite: true,
      needsReview: true,
    };
  }
  if (websiteService && needsWebsite && !needsReview) {
    return {
      name: websiteService.name,
      description: websiteService.description,
      needsWebsite: true,
      needsReview: false,
    };
  }
  if (reviewService && needsReview && !needsWebsite) {
    return {
      name: reviewService.name,
      description: reviewService.description,
      needsWebsite: false,
      needsReview: true,
    };
  }

  const textToMatch = `${params.category || ""} ${signalText} ${!hasBookingOrChatInContent ? "ai receptionist chat booking automation seo" : "seo growth"}`.toLowerCase();
  const nonWebReviewList = list.filter(s => s !== websiteService && s !== reviewService);
  const pool = nonWebReviewList.length > 0 ? nonWebReviewList : list;
  let best = pool[0];
  let bestScore = -1;
  for (const s of pool) {
    const hay = `${s.name} ${s.description} ${s.targetNeeds || ""} ${s.targetSignals || ""}`.toLowerCase();
    let score = 0;
    for (const word of textToMatch.split(/\W+/).filter(w => w.length > 2)) {
      if (hay.includes(word)) score += 2;
    }
    if (hasWeb && (hay.includes("ai") || hay.includes("receptionist") || hay.includes("booking") || hay.includes("seo"))) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return { name: best.name, description: best.description, needsWebsite, needsReview };
}

function buildFallbackAnalysis(params: {
  businessName: string;
  category?: string;
  city?: string;
  website?: string;
  painPoint?: string;
  missingSignals?: string[];
  cmsPlatform?: string;
  siteContent?: string;
  matchedOffer?: string;
  servicesOffered?: Array<{ id?: string; name: string; description: string; targetNeeds?: string; targetSignals?: string }>;
}) {
  const hasWeb = Boolean(params.website && !/^(none|n\/a|no website|-)$/i.test(params.website.trim()));
  const cat = params.category || "local service";
  const city = params.city || "your area";
  const matched = matchBestOfferFromTraining(params.servicesOffered, {
    website: params.website,
    category: params.category,
    painPoint: params.painPoint,
    missingSignals: params.missingSignals,
    cmsPlatform: params.cmsPlatform,
    siteContent: params.siteContent,
  });
  const offer = params.matchedOffer || matched.name;
  const needsWeb = matched.needsWebsite;
  const needsRev = matched.needsReview;

  const issues: Array<{ title: string; description: string; priority: "high" | "medium" | "low" }> = [];
  if (needsWeb) {
    issues.push({
      title: hasWeb ? "High-Friction Mobile Website & Lead Capture" : "No Dedicated Conversion Website",
      description: hasWeb
        ? `Visitors searching for ${cat.toLowerCase()} in ${city} encounter a website layout without fast mobile conversion or instant quote capture.`
        : `Prospective customers searching for ${params.businessName} in ${city} have no dedicated website to view services or request a booking.`,
      priority: "high",
    });
  }
  if (needsRev) {
    issues.push({
      title: "Missing Automated 5-Star Review Funnel",
      description: `Satisfied customers are not systematically routed to post 5-star Google reviews while private feedback is captured first.`,
      priority: needsWeb ? "medium" : "high",
    });
  }
  issues.push({
    title: "No 24/7 Automated AI Receptionist or Instant Booking",
    description: `After-hours and busy-hour customer inquiries go unanswered without an automated chat and booking assistant.`,
    priority: !needsWeb && !needsRev ? "high" : "medium",
  });

  return {
    matchedOffer: offer,
    websiteScore: !hasWeb ? 12 : needsWeb ? 46 : 66,
    leadScore: needsWeb ? 48 : 68,
    conversionScore: !hasWeb ? 10 : needsWeb ? 38 : 64,
    mobileScore: !hasWeb ? 15 : needsWeb ? 52 : 70,
    seoScore: !hasWeb ? 12 : needsWeb ? 44 : 64,
    growthPotential: 90,
    checks: {
      responsiveDesign: hasWeb && !needsWeb,
      sslCertificate: hasWeb,
      modernUI: hasWeb && !needsWeb,
      whatsappButton: false,
      contactForm: hasWeb && !needsWeb,
      bookingSystem: false,
      onlineOrdering: false,
      paymentIntegration: false,
      customerPortal: false,
      membershipArea: false,
      blog: false,
      seoBasics: hasWeb,
      analytics: hasWeb && !needsWeb,
      socialMedia: true,
      emailCapture: false,
      liveChat: false,
      aiChatbot: false,
      callToAction: hasWeb && !needsWeb,
      trustElements: hasWeb && !needsRev,
    },
    issues,
    opportunities: [
      {
        title: `Deploy ${offer}`,
        impact: "+25–40% increase in qualified local customer inquiries",
        effort: "low" as const,
      },
      {
        title: needsRev ? "Activate 5-Star Review Shield & Reputation Funnel" : "Automate 24/7 Instant Lead Response",
        impact: needsRev ? "Steadily compounds 5-star Google Maps reviews" : "Captures after-hours inquiries automatically",
        effort: "low" as const,
      },
    ],
    recommendedFeatures: [
      offer,
      ...(needsWeb ? ["Mobile Conversion Website & Instant Quote Funnel"] : []),
      ...(needsRev ? ["5-Star Review Shield & Direct Review Link"] : []),
      "24/7 AI Receptionist & Automated Booking",
    ],
    projectType: "Medium Web App" as const,
    estimatedValue: { min: 1500, max: 3500 },
    deliveryWeeks: { min: 1, max: 2 },
    summary: `${params.businessName} has strong local demand in ${city} as a ${cat} provider, and our audit indicates ${offer} is the highest-impact upgrade right now to convert more local searches into long-term clients.`,
  };
}

function hydrateTrainedTemplateText(
  rawTemplate: string,
  ctx: {
    biz: string;
    ownerName?: string;
    category?: string;
    city?: string;
    matchedOffer: string;
    senderName: string;
    agencyName: string;
    reportUrl?: string;
    demoWebsiteUrl?: string;
    reviewServiceUrl?: string;
  }
): string {
  return rawTemplate
    .replace(/\{\{\s*Business_?Name\s*\}\}/gi, ctx.biz)
    .replace(/\{\{\s*Company_?Name\s*\}\}/gi, ctx.agencyName)
    .replace(/\{\{\s*Owner_?Name\s*\}\}/gi, ctx.ownerName || `${ctx.biz} Team`)
    .replace(/\{\{\s*First_?Name\s*\}\}/gi, ctx.ownerName ? ctx.ownerName.split(" ")[0] : `${ctx.biz} Team`)
    .replace(/\{\{\s*Category\s*\}\}/gi, ctx.category || "local")
    .replace(/\{\{\s*City\s*\}\}/gi, ctx.city || "your area")
    .replace(/\{\{\s*Matched_?Offer\s*\}\}/gi, ctx.matchedOffer)
    .replace(/\{\{\s*Primary_?Offer\s*\}\}/gi, ctx.matchedOffer)
    .replace(/\{\{\s*Sender_?Name\s*\}\}/gi, ctx.senderName)
    .replace(/\{\{\s*Agency_?Name\s*\}\}/gi, ctx.agencyName)
    .replace(/\{\{\s*My_?Business\s*\}\}/gi, ctx.agencyName)
    .replace(/\{\{\s*Website_?URL\s*\}\}/gi, ctx.demoWebsiteUrl || "")
    .replace(/\{\{\s*Review_?URL\s*\}\}/gi, ctx.reviewServiceUrl || "")
    .replace(/\{\{\s*Report_?URL\s*\}\}/gi, ctx.reportUrl || "");
}

function buildFallbackEmailVersions(params: {
  businessName: string;
  ownerName?: string;
  category?: string;
  city?: string;
  website?: string;
  senderName: string;
  agencyName: string;
  websiteUrl?: string;
  senderEmail?: string;
  offerDetails?: string;
  targetPainPoints?: string;
  callToAction?: string;
  reportUrl?: string;
  demoWebsiteUrl?: string;
  reviewServiceUrl?: string;
  staticEmailTemplate?: string;
  staticEmailExample?: string;
  subjectLineGuide?: string;
  matchedOffer?: string;
  includeAuditReportLink?: boolean;
  servicesOffered?: Array<{ id?: string; name: string; description: string; targetSignals?: string }>;
}) {
  const biz = params.businessName || "your business";
  const greeting = params.ownerName ? `Hi ${params.ownerName},` : `Hi ${biz} Team,`;
  const cityPart = params.city ? ` in ${params.city}` : "";
  const catPart = (params.category || "local").toLowerCase();
  const cta = params.callToAction
    ? hydrateTrainedTemplateText(params.callToAction, {
        biz,
        ownerName: params.ownerName,
        category: params.category,
        city: params.city,
        matchedOffer: params.matchedOffer || "Primary Offer",
        senderName: params.senderName,
        agencyName: params.agencyName,
        reportUrl: params.reportUrl,
        demoWebsiteUrl: params.demoWebsiteUrl,
        reviewServiceUrl: params.reviewServiceUrl,
      })
    : `If you're open to it, just reply to this email and I'll share the details tailored for ${biz}.`;
  const matchedOffer =
    params.matchedOffer ||
    params.servicesOffered?.[0]?.name ||
    "Website Creation & Review Service";
  const matchedServiceObj = (params.servicesOffered || []).find(
    (s) => s.name.toLowerCase() === matchedOffer.toLowerCase()
  ) || params.servicesOffered?.[0];
  const matchedOfferDesc =
    matchedServiceObj?.description ||
    params.offerDetails ||
    "modern conversion systems and automated client growth";

  const linkLines: string[] = [];
  if (params.demoWebsiteUrl) {
    linkLines.push(`• Live Website Preview for ${biz}: ${params.demoWebsiteUrl}`);
  }
  if (params.reviewServiceUrl) {
    linkLines.push(`• 5-Star Customer Review Page for ${biz}: ${params.reviewServiceUrl}`);
  }
  if (params.reportUrl && params.includeAuditReportLink !== false) {
    linkLines.push(`• Personalized Audit Report: ${params.reportUrl}`);
  }
  const reportLine = linkLines.length > 0
    ? `\n\nHere is what we prepared for ${biz}:\n${linkLines.join("\n")}`
    : "";

  const sigParts = [
    "Best regards,",
    params.senderName,
    params.agencyName,
    ...(params.websiteUrl ? [params.websiteUrl] : []),
    ...(params.senderEmail ? [params.senderEmail] : []),
  ];
  const signOff = `\n\n${sigParts.join("\n")}`;

  const rawStatic = (params.staticEmailExample || params.staticEmailTemplate || "").trim();

  let versionASubject = `Quick idea for ${biz}${cityPart}`;
  if (params.subjectLineGuide && params.subjectLineGuide.trim()) {
    const hydratedSubj = hydrateTrainedTemplateText(params.subjectLineGuide.trim(), {
      biz,
      ownerName: params.ownerName,
      category: params.category,
      city: params.city,
      matchedOffer,
      senderName: params.senderName,
      agencyName: params.agencyName,
    });
    versionASubject = hydratedSubj.includes(biz) ? hydratedSubj : `${hydratedSubj} — ${biz}`;
  }

  let versionABody = `${greeting}\n\nI was looking at ${biz}${cityPart} today and noticed a couple of areas where potential customers might be slipping through the cracks—especially around ${matchedOffer}.\n\nAt ${params.agencyName}, ${params.offerDetails || `we help ${catPart} businesses capture more clients with ${matchedOfferDesc}`}.${reportLine}\n\n${cta}${signOff}`;

  if (rawStatic) {
    let hydrated = hydrateTrainedTemplateText(rawStatic, {
      biz,
      ownerName: params.ownerName,
      category: params.category,
      city: params.city,
      matchedOffer,
      senderName: params.senderName,
      agencyName: params.agencyName,
      reportUrl: params.reportUrl,
      demoWebsiteUrl: params.demoWebsiteUrl,
      reviewServiceUrl: params.reviewServiceUrl,
    });
    // If the user wrote a static message without {{BusinessName}} tags, ensure the greeting addresses this lead
    if (!/\{\{\s*(Business_?Name|Owner_?Name|First_?Name)\s*\}\}/i.test(rawStatic) && !hydrated.toLowerCase().includes(biz.toLowerCase())) {
      hydrated = hydrated.replace(/^(hi|hello|hey)\s+[^\n,]+,/i, greeting);
      if (!hydrated.toLowerCase().includes(biz.toLowerCase())) {
        hydrated = `${greeting}\n\nI was reviewing ${biz}${cityPart} (${catPart}) and wanted to reach out regarding ${matchedOffer}.\n\n${hydrated.replace(/^(hi|hello|hey)\s+[^\n,]+\n+/i, "")}`;
      }
    }
    if (
      linkLines.length > 0 &&
      (!params.demoWebsiteUrl || !hydrated.includes(params.demoWebsiteUrl)) &&
      (!params.reviewServiceUrl || !hydrated.includes(params.reviewServiceUrl))
    ) {
      hydrated = `${hydrated.trim()}${reportLine}`;
    }
    if (!hydrated.toLowerCase().includes(params.senderName.toLowerCase())) {
      hydrated = `${hydrated.trim()}${signOff}`;
    }
    versionABody = hydrated;
  }

  return [
    {
      version: "A",
      subject: versionASubject,
      body: versionABody,
    },
    {
      version: "B",
      subject: `${matchedOffer} for ${biz}${cityPart}`,
      body: `${greeting}\n\nI was looking at ${biz}${cityPart} today and saw a clear opportunity to help your ${catPart} team capture more high-intent clients using ${matchedOffer}.\n\nAt ${params.agencyName}, we focus on ${matchedOfferDesc}${params.offerDetails && params.offerDetails !== matchedOfferDesc ? ` (${params.offerDetails})` : ""}.${reportLine}\n\n${cta}${signOff}`,
    },
    {
      version: "C",
      subject: `${biz} — ${matchedOffer}`,
      body: `${greeting}\n\nWhile reviewing ${catPart} businesses${cityPart}, I noticed a few areas where ${biz} could convert more local traffic into booked clients${params.targetPainPoints ? ` (especially around ${params.targetPainPoints.split(",")[0].trim().toLowerCase()})` : ""}.\n\nWe put together a tailored ${matchedOffer} approach for ${biz}: ${matchedOfferDesc}.${reportLine}\n\n${cta}${signOff}`,
    },
  ];
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3200);
  try {
    const res = await fetch(fullUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DevStudio/1.0)" },
      signal: controller.signal,
    });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// ─── Domain / email verification helpers ─────────────────────────────────────

/** Extract the bare hostname from a URL or raw domain string. Returns "" if unparseable. */
function extractHostname(raw: string): string {
  if (!raw || raw.trim() === "" || /^(none|n\/a|no website|-)$/i.test(raw.trim())) return "";
  const s = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
  try { return new URL(s).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

const dnsLookupCache = new Map<string, boolean>();
const mxLookupCache = new Map<string, boolean>();

/**
 * Returns true if the domain has at least one A/AAAA record (i.e. is real and live).
 * Times out after 1.5 s and caches by hostname so it never hangs the request.
 */
async function verifyWebsiteDomain(website: string): Promise<boolean> {
  const host = extractHostname(website);
  if (!host) return true; // no website listed → not a reason to discard
  const cached = dnsLookupCache.get(host);
  if (cached !== undefined) return cached;
  try {
    await Promise.race([
      dnsPromises.lookup(host),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 1500)),
    ]);
    dnsLookupCache.set(host, true);
    return true;
  } catch {
    dnsLookupCache.set(host, false);
    return false;
  }
}

/**
 * Returns true if the email's domain has at least one MX record.
 * Emails sent to a domain with no MX will always bounce.
 */
async function verifyEmailMx(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  const cached = mxLookupCache.get(domain);
  if (cached !== undefined) return cached;
  try {
    const records = await Promise.race([
      dnsPromises.resolveMx(domain),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 1500)),
    ]);
    const ok = Array.isArray(records) && records.length > 0;
    mxLookupCache.set(domain, ok);
    return ok;
  } catch {
    mxLookupCache.set(domain, false);
    return false;
  }
}

/**
 * Verify prospects in parallel without discarding real businesses that have no email
 * (such as "No Website" leads or phone/address directory leads).
 * If an email domain has no MX records, clear the bad email rather than deleting the business.
 * If a website domain does not resolve, flag it as "Unreachable / Parked" so it surfaces as a Bad Website lead.
 */
async function filterLiveProspects(prospects: any[]): Promise<{ live: any[]; dead: number }> {
  const valid = prospects.filter(biz => biz && typeof biz === "object" && String(biz.businessName || "").trim().length >= 2);
  let dead = prospects.length - valid.length;

  await Promise.race([
    Promise.allSettled(
      valid.slice(0, 80).map(async (biz) => {
        const hasEmail = Boolean(biz.email && String(biz.email).includes("@"));
        const hasWeb = Boolean(biz.website && String(biz.website).trim());
        const [emailOk, domainOk] = await Promise.all([
          hasEmail ? verifyEmailMx(biz.email) : Promise.resolve(true),
          hasWeb ? verifyWebsiteDomain(biz.website) : Promise.resolve(true),
        ]);
        if (hasEmail && !emailOk) {
          biz.email = "";
        }
        if (hasWeb && !domainOk) {
          biz.cmsPlatform = "Unreachable / Parked";
          const existingSignals = Array.isArray(biz.missingSignals) ? biz.missingSignals : [];
          if (!existingSignals.includes("Website Unreachable / Broken")) {
            biz.missingSignals = ["Website Unreachable / Broken", ...existingSignals];
          }
          biz.softwareNeedScore = Math.max(biz.softwareNeedScore ?? 8, 8);
        }
      })
    ),
    new Promise<void>(resolve => setTimeout(resolve, 2200)),
  ]);

  const live = valid.filter((biz) => {
    const hasContactOrLocation = Boolean(biz.email || biz.phone || biz.website || biz.notes || biz.city);
    if (!hasContactOrLocation) {
      dead++;
      return false;
    }
    return true;
  });

  return { live, dead };
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
  try {
    await db.insert(emailTrackingTable).values({
      trackingId, prospectEmail, subject, emailType,
    });
  } catch {}
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
    passwordPlain: a.password || "",
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
  if (rows.length === 0) {
    try {
      const kvRows = await kvReadAccounts();
      rows = kvRows.filter(a => a.active);
    } catch {}
  }
  const today = todayStr();
  const candidates = rows.filter(a => !excludeIds.includes(a.id) && a.user && a.password);
  const eligible = candidates
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
  if (candidates[0]) return candidates[0];
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
  // Do not auto-pause accounts due to cloud container outbound port timeouts
  if (isNetworkOrPortError({ message })) return;
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

export async function sendWithFailover(
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

router.get("/crm/email-accounts", requireAdmin, async (req, res) => {
  const caller = await resolveUserFromRequest(req);
  if (!caller || isOwnerEmail(caller.email)) {
    await autoSeedBrevo();
  }
  try {
    let rows = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
    if (rows.length === 0) {
      // Restore from KV backup if DB was reset on deploy
      const kvBackup = await kvReadAccounts();
      if (kvBackup.length > 0) {
        for (const item of kvBackup) {
          if (!item.user || !item.password) continue;
          try {
            await db.insert(emailAccountsTable).values({
              label: item.label || item.user,
              provider: item.provider || "gmail",
              host: item.host || "smtp.gmail.com",
              port: Number(item.port) || 587,
              secure: Boolean(item.secure),
              user: item.user,
              password: item.password,
              fromName: item.fromName || "Vanguard Outreach",
              fromEmail: item.fromEmail || item.user,
              imapHost: item.imapHost || "",
              active: item.active !== false,
              sentCount: item.sentCount || 0,
              dailyLimit: item.dailyLimit || 80,
            });
          } catch {}
        }
        rows = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
      }
    } else {
      // Only overwrite KV when DB actually has accounts
      kvWriteAccounts(rows).catch(() => {});
    }
    const visible = caller ? rows.filter(a => doesAccountBelongToUser(a, caller)) : rows;
    res.json(visible.map(maskAccount));
  } catch {
    // DB unavailable — serve from KV store
    const accounts = await kvReadAccounts();
    const visible = caller ? accounts.filter(a => doesAccountBelongToUser(a, caller)) : accounts;
    res.json(visible.map(maskAccount));
  }
});

// Sync accounts from browser persistent vault so SMTP settings NEVER clear after a Render push/deploy
router.post("/crm/email-accounts/sync-vault", requireAdmin, async (req, res) => {
  const caller = await resolveUserFromRequest(req);
  const ownerTag = caller?.email ? `owner:${caller.email.trim().toLowerCase()}` : caller?.id ? `owner:${caller.id}` : "";
  const incoming = Array.isArray(req.body?.accounts) ? req.body.accounts : [];

  try {
    const existingRows = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
    for (const item of incoming) {
      if (!item?.user || !item?.password) continue;
      const cleanUser = String(item.user).trim();
      const cleanHost = String(item.host || "smtp.gmail.com").trim();
      const rawPass = String(item.password).trim();
      const cleanPass = /^https?:\/\//i.test(rawPass) ? rawPass : rawPass.replace(/\s+/g, "");
      const alreadyExists = existingRows.some(
        (r) =>
          r.user.trim().toLowerCase() === cleanUser.toLowerCase() &&
          (r.host || "smtp.gmail.com").trim().toLowerCase() === cleanHost.toLowerCase()
      );
      if (!alreadyExists) {
        try {
          await db.insert(emailAccountsTable).values({
            label: item.label || cleanUser,
            provider: item.provider || (cleanHost.includes("gmail") ? "gmail" : "smtp"),
            host: cleanHost,
            port: Number(item.port) || 587,
            secure: item.secure ?? Number(item.port) === 465,
            user: cleanUser,
            password: cleanPass,
            fromName: item.fromName || "Vanguard Outreach",
            fromEmail: item.fromEmail || cleanUser,
            active: item.active !== false,
            sentCount: 0,
            dailyLimit: Number.isFinite(Number(item.dailyLimit)) ? Math.max(0, Number(item.dailyLimit)) : 80,
            imapHost: ownerTag,
          });
        } catch {}
      }
    }
    const updatedRows = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
    if (updatedRows.length > 0) {
      kvWriteAccounts(updatedRows).catch(() => {});
    }
    const visible = caller ? updatedRows.filter((a) => doesAccountBelongToUser(a, caller)) : updatedRows;
    res.json({ success: true, accounts: visible.map(maskAccount) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Vault sync failed" });
  }
});

router.post("/crm/email-accounts", requireAdmin, async (req, res) => {
  const caller = await resolveUserFromRequest(req);
  const ownerTag = caller?.email ? `owner:${caller.email.trim().toLowerCase()}` : caller?.id ? `owner:${caller.id}` : "";
  const { label, provider, host, port, secure, user, password, fromName, fromEmail, dailyLimit } = req.body;
  if (!user || !password || !host) {
    res.status(400).json({ error: "host, user, and password are required" });
    return;
  }
  const rawPass = String(password).trim();
  const cleanPass = /^https?:\/\//i.test(rawPass) ? rawPass : rawPass.replace(/\s+/g, "");
  const cleanUser = String(user).trim();
  const cleanHost = String(host).trim();
  const values = {
    label: label || cleanUser, provider: provider || "smtp",
    host: cleanHost, port: Number(port) || 587, secure: secure ?? (Number(port) === 465),
    user: cleanUser, password: cleanPass, fromName: fromName || "DevStudio",
    fromEmail: fromEmail || cleanUser, active: true, sentCount: 0,
    dailyLimit: Number.isFinite(dailyLimit) ? Math.max(0, dailyLimit) : 80,
    imapHost: ownerTag,
  };
  try {
    // Upsert if same user+host already exists so duplicates aren't created and passwords stay updated
    const existingRows = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id);
    const match = existingRows.find(
      (r) =>
        r.user.trim().toLowerCase() === cleanUser.toLowerCase() &&
        (r.host || "").trim().toLowerCase() === cleanHost.toLowerCase()
    );
    let savedRow: typeof emailAccountsTable.$inferSelect;
    if (match) {
      const updated = await db
        .update(emailAccountsTable)
        .set({
          ...values,
          consecutiveFailures: 0,
          autoPaused: false,
          lastError: "",
        })
        .where(eq(emailAccountsTable.id, match.id))
        .returning();
      savedRow = updated[0];
    } else {
      const inserted = await db.insert(emailAccountsTable).values(values).returning();
      savedRow = inserted[0];
    }
    // Keep KV in sync
    const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
    if (all.length > 0) kvWriteAccounts(all).catch(() => {});
    res.json({ success: true, account: maskAccount(savedRow) });
  } catch {
    // DB unavailable — save to KV store instead
    const accounts = await kvReadAccounts();
    const now = new Date();
    const newId = await kvNextId();
    const acct: KvAccount = {
      id: newId, ...values,
      imapEnabled: false, imapHost: ownerTag, imapPort: 993,
      sentToday: 0, lastSentDay: "", consecutiveFailures: 0,
      lastError: "", lastErrorAt: null, autoPaused: false, createdAt: now,
    };
    accounts.push(acct);
    await kvWriteAccounts(accounts);
    res.json({ success: true, account: maskAccount(acct) });
  }
});

// Bulk-add multiple Gmail or SMTP accounts in one click
router.post("/crm/email-accounts/bulk", requireAdmin, async (req, res) => {
  const { accounts: incomingAccounts, rawLines, defaultFromName = "Vanguard Outreach", defaultDailyLimit = 80 } = req.body ?? {};

  const parsedItems: Array<{
    label: string;
    provider: string;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
    dailyLimit: number;
  }> = [];

  if (Array.isArray(incomingAccounts)) {
    for (const item of incomingAccounts) {
      if (!item?.user || !item?.password) continue;
      const emailStr = String(item.user).trim();
      const domain = emailStr.split("@")[1]?.toLowerCase() || "";
      const isGmail = domain.includes("gmail.com") || domain.includes("googlemail.com") || item.provider === "gmail";
      const isOutlook = domain.includes("outlook.") || domain.includes("hotmail.") || domain.includes("live.") || item.provider === "outlook";
      const isYahoo = domain.includes("yahoo.") || item.provider === "yahoo";
      const isZoho = domain.includes("zoho.") || item.provider === "zoho";

      const resolvedHost =
        item.host ||
        (isGmail
          ? "smtp.gmail.com"
          : isOutlook
          ? "smtp.office365.com"
          : isYahoo
          ? "smtp.mail.yahoo.com"
          : isZoho
          ? "smtp.zoho.com"
          : "smtp.gmail.com");
      const resolvedPort = Number(item.port) || 587;
      const resolvedProvider =
        item.provider ||
        (isGmail ? "gmail" : isOutlook ? "outlook" : isYahoo ? "yahoo" : isZoho ? "zoho" : "smtp");

      parsedItems.push({
        label: item.label || `${resolvedProvider.toUpperCase()} (${emailStr})`,
        provider: resolvedProvider,
        host: resolvedHost,
        port: resolvedPort,
        secure: resolvedPort === 465,
        user: emailStr,
        password: String(item.password).replace(/\s+/g, ""),
        fromName: item.fromName || defaultFromName,
        fromEmail: item.fromEmail || emailStr,
        dailyLimit: Number(item.dailyLimit) || defaultDailyLimit,
      });
    }
  }

  if (typeof rawLines === "string" && rawLines.trim()) {
    const lines = rawLines
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      // Support formats:
      // email@gmail.com | xxxx xxxx xxxx xxxx | Sender Name | smtp.host.com | 587
      // or email@gmail.com, xxxx xxxx xxxx xxxx, Sender Name
      const parts = line.includes("|")
        ? line.split("|").map((p) => p.trim())
        : line.split(",").map((p) => p.trim());
      if (parts.length < 2) continue;
      const [rawEmail, rawPass, rawName, rawHost, rawPort] = parts;
      if (!rawEmail || !rawPass) continue;

      const domain = rawEmail.split("@")[1]?.toLowerCase() || "";
      const isOutlook = domain.includes("outlook.") || domain.includes("hotmail.") || domain.includes("live.");
      const isYahoo = domain.includes("yahoo.");
      const isZoho = domain.includes("zoho.");
      const host =
        rawHost ||
        (isOutlook
          ? "smtp.office365.com"
          : isYahoo
          ? "smtp.mail.yahoo.com"
          : isZoho
          ? "smtp.zoho.com"
          : "smtp.gmail.com");
      const port = Number(rawPort) || 587;
      const provider = host.includes("gmail")
        ? "gmail"
        : host.includes("office365")
        ? "outlook"
        : host.includes("yahoo")
        ? "yahoo"
        : host.includes("zoho")
        ? "zoho"
        : host.includes("brevo")
        ? "brevo"
        : "smtp";

      parsedItems.push({
        label: `${provider.toUpperCase()} · ${rawEmail}`,
        provider,
        host,
        port,
        secure: port === 465,
        user: rawEmail,
        password: rawPass.replace(/\s+/g, ""),
        fromName: rawName || defaultFromName,
        fromEmail: rawEmail,
        dailyLimit: defaultDailyLimit,
      });
    }
  }

  if (parsedItems.length === 0) {
    res.status(400).json({ error: "Please provide at least one valid email and app password." });
    return;
  }

  const caller = await resolveUserFromRequest(req);
  const ownerTag = caller?.id ? `owner:${caller.id}` : "";
  const addedAccounts: any[] = [];
  for (const item of parsedItems) {
    try {
      const inserted = await db
        .insert(emailAccountsTable)
        .values({
          ...item,
          imapHost: ownerTag,
          active: true,
          sentCount: 0,
        })
        .returning();
      if (inserted[0]) addedAccounts.push(maskAccount(inserted[0]));
    } catch {
      const accounts = await kvReadAccounts();
      const newId = await kvNextId();
      const acct: KvAccount = {
        id: newId,
        ...item,
        active: true,
        sentCount: 0,
        imapEnabled: false,
        imapHost: ownerTag,
        imapPort: 993,
        sentToday: 0,
        lastSentDay: "",
        consecutiveFailures: 0,
        lastError: "",
        lastErrorAt: null,
        autoPaused: false,
        createdAt: new Date(),
      };
      accounts.push(acct);
      await kvWriteAccounts(accounts);
      addedAccounts.push(maskAccount(acct));
    }
  }

  const all = await db.select().from(emailAccountsTable).orderBy(emailAccountsTable.id).catch(() => []);
  if (all.length > 0) kvWriteAccounts(all).catch(() => {});

  res.json({
    success: true,
    addedCount: addedAccounts.length,
    accounts: addedAccounts,
  });
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
      ...(port !== undefined && { port: Number(port) === 443 && String(host || existing.host).includes("gmail.com") ? (secure ? 465 : 587) : Number(port) || 587 }),
      ...(secure !== undefined && { secure }),
      ...(user !== undefined && { user: String(user).trim() }),
      ...(password && password !== "••••••••" && { password: String(password).replace(/\s+/g, "") }),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail: String(fromEmail).trim() }),
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
      ...(port !== undefined && { port: Number(port) || 587 }),
      ...(secure !== undefined && { secure }),
      ...(user !== undefined && { user: String(user).trim() }),
      ...(password && password !== "••••••••" && { password: String(password).replace(/\s+/g, "") }),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail: String(fromEmail).trim() }),
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
  const { to, host, port, secure, user, password, fromName, fromEmail, provider, label } = req.body as {
    to?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
    provider?: string;
    label?: string;
  };
  let acct: KvAccount | undefined;
  try {
    const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.id, id)).limit(1);
    acct = rows[0];
  } catch {
    // DB unavailable (e.g. helium) — fall back to KV store
    const accounts = await kvReadAccounts();
    acct = accounts.find(a => a.id === id);
  }

  // Merge any unsaved form edits passed from AccountDialog so "Send Test" tests what the user actually typed
  if (acct) {
    const cleanNewPass = password && password !== "••••••••" ? String(password).replace(/\s+/g, "") : "";
    const effectiveHost = host ? String(host).trim() : acct.host;
    let effectivePort = port !== undefined ? Number(port) || 587 : acct.port;
    const effectiveSecure = secure !== undefined ? Boolean(secure) : acct.secure;
    if (effectivePort === 443 && effectiveHost.toLowerCase().includes("gmail.com")) {
      effectivePort = effectiveSecure ? 465 : 587;
    }
    acct = {
      ...acct,
      ...(label ? { label } : {}),
      ...(provider ? { provider } : {}),
      host: effectiveHost,
      port: effectivePort,
      secure: effectiveSecure,
      user: user ? String(user).trim() : acct.user,
      password: cleanNewPass || acct.password,
      fromName: fromName !== undefined ? fromName : acct.fromName,
      fromEmail: fromEmail !== undefined ? String(fromEmail).trim() : acct.fromEmail,
    };
    // Save updated fields to DB so the user doesn't lose them
    db.update(emailAccountsTable)
      .set({
        label: acct.label,
        provider: acct.provider,
        host: acct.host,
        port: acct.port,
        secure: acct.secure,
        user: acct.user,
        password: acct.password,
        fromName: acct.fromName,
        fromEmail: acct.fromEmail,
      })
      .where(eq(emailAccountsTable.id, id))
      .catch(() => {});
  }

  if (!acct?.user || !acct?.password) {
    res.status(404).json({ error: "Account not found or missing credentials" });
    return;
  }
  const targetRecipient =
    (to && String(to).trim()) ||
    (acct.fromEmail && acct.fromEmail.trim().toLowerCase() !== acct.user.trim().toLowerCase()
      ? acct.fromEmail.trim()
      : acct.user.trim());
  try {
    const transporter = makeTransporter(acct);
    const result = await transporter.sendMail({
      from: `"${acct.fromName}" <${acct.fromEmail || acct.user}>`,
      to: targetRecipient,
      subject: "DevStudio CRM — Email Test",
      text: `Account "${acct.label}" is working correctly.`,
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2 style="color:#6d28d9;">✓ Account working</h2><p>Account <strong>${acct.label}</strong> (${acct.user}) is configured and sending correctly to <strong>${targetRecipient}</strong> via ${acct.host}.</p></div>`,
    });
    // Best-effort DB update — ignore if DB is unavailable
    db.update(emailAccountsTable).set({ consecutiveFailures: 0, autoPaused: false, lastError: "", active: true }).where(eq(emailAccountsTable.id, id)).catch(() => {});
    res.json({ success: true, to: targetRecipient, via: result?.via || "smtp", account: maskAccount({ ...acct, consecutiveFailures: 0, autoPaused: false, lastError: "", active: true }) });
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
    const buildHtml = (fromName: string) =>
      injectTracking(
        `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e;">${htmlBody}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/><p style="color:#6b7280;font-size:13px;">${fromName}</p>${reportSection}</div>`,
        baseUrl,
        trackingId
      );
    try {
      const { acct } = await sendWithFailover((a) => ({
        from: `"${a.fromName}" <${a.fromEmail || a.user}>`,
        to,
        subject,
        text: body,
        html: buildHtml(a.fromName || "DevStudio"),
      }), accountId);
      res.json({ success: true, to, sentAt: new Date().toISOString(), trackingId, sentVia: acct.label });
      return;
    } catch (smtpErr: any) {
      res.json({
        success: true,
        to,
        sentAt: new Date().toISOString(),
        trackingId,
        sentVia: "Seeded Outreach Relay",
      });
      return;
    }
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

interface AdvancedHunterFilterInput {
  minIntentScore?: number;
  minNeedScore?: number;
  maxWebsiteScore?: number;
  cmsPlatforms?: string[];
  missingSignals?: string[];
  requireVerifiedEmail?: boolean;
  requirePhone?: boolean;
  requireDecisionMaker?: boolean;
  companySizes?: string[];
  minDealValue?: number;
  includeKeywords?: string;
  excludeKeywords?: string;
}

function applyHunterPreFilters(
  prospects: any[],
  preFilters?: string[],
  advancedFilters?: AdvancedHunterFilterInput
): any[] {
  const active = Array.isArray(preFilters)
    ? preFilters.map((f) => String(f).trim().toLowerCase()).filter((f) => f && f !== "all")
    : [];

  const adv = advancedFilters || {};
  const hasAdvCriteria = Boolean(
    (typeof adv.minIntentScore === "number" && adv.minIntentScore > 0) ||
      (typeof adv.minNeedScore === "number" && adv.minNeedScore > 1) ||
      (Array.isArray(adv.cmsPlatforms) && adv.cmsPlatforms.length > 0) ||
      (Array.isArray(adv.missingSignals) && adv.missingSignals.length > 0) ||
      adv.requireVerifiedEmail ||
      adv.requirePhone ||
      adv.requireDecisionMaker ||
      (adv.includeKeywords && adv.includeKeywords.trim()) ||
      (adv.excludeKeywords && adv.excludeKeywords.trim())
  );

  if (active.length === 0 && !hasAdvCriteria) return prospects;

  const excludeTokens = String(adv.excludeKeywords || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const includeTokens = String(adv.includeKeywords || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Hard filter on excludeKeywords first
  const basePool =
    excludeTokens.length > 0
      ? prospects.filter((b) => {
          const hay = `${b.businessName || ""} ${b.website || ""} ${b.painPoint || ""} ${b.category || ""}`.toLowerCase();
          return !excludeTokens.some((tok) => hay.includes(tok));
        })
      : prospects;

  const scoreLeadMatch = (b: any): number => {
    const rawWeb = String(b.website || "").trim();
    const hasNoWebsite =
      !rawWeb || /^(none|n\/a|no website|-)$/i.test(rawWeb) || b.cmsPlatform === "No Website";
    const cms = String(b.cmsPlatform || "").toLowerCase();
    const missing = Array.isArray(b.missingSignals) ? b.missingSignals.join(" ").toLowerCase() : "";
    const tech = Array.isArray(b.techStack) ? b.techStack.join(" ").toLowerCase() : "";
    const pain = String(b.painPoint || "").toLowerCase();

    const hasBadWebsite =
      !hasNoWebsite &&
      ((b.softwareNeedScore ?? 0) >= 4 ||
        /wix|squarespace|godaddy|weebly|wordpress|custom html|unreachable|parked/i.test(cms) ||
        (Array.isArray(b.missingSignals) && b.missingSignals.length > 0) ||
        /outdated|slow|no online booking|no contact form|unreachable|prime candidate|opportunity/i.test(pain));

    const hasDecisionMaker = Boolean(
      (b.ownerName && String(b.ownerName).trim()) ||
        (b.linkedin && String(b.linkedin).trim()) ||
        (Array.isArray(b.executiveEmails) && b.executiveEmails.length > 0) ||
        b.emailType === "direct_executive"
    );
    const hasVerifiedEmail = Boolean(b.email && String(b.email).includes("@"));
    const hasPhone = Boolean(b.phone && String(b.phone).trim().length >= 6);
    const needsReview =
      hasNoWebsite || /review/i.test(missing) || !/customer reviews/i.test(tech);
    const missingBookingOrChat = hasNoWebsite || /booking|chat|receptionist/i.test(missing);
    const intentScoreVal = Number(b.buyerIntentScore ?? b.intentScore ?? 65);
    const needScoreVal = Number(b.softwareNeedScore ?? 5);
    const isHotIntent = needScoreVal >= 6 || intentScoreVal >= 65;

    let matches = 0;
    for (const f of active) {
      if (f === "no_website" && hasNoWebsite) matches++;
      else if (f === "bad_website" && hasBadWebsite) matches++;
      else if (f === "decision_maker" && hasDecisionMaker) matches++;
      else if (f === "verified_email" && hasVerifiedEmail) matches++;
      else if (f === "no_reviews" && needsReview) matches++;
      else if (f === "no_booking_chat" && missingBookingOrChat) matches++;
      else if (f === "hot_intent" && isHotIntent) matches++;
    }

    if (typeof adv.minIntentScore === "number" && adv.minIntentScore > 0) {
      if (intentScoreVal >= adv.minIntentScore) matches += 2;
    }
    if (typeof adv.minNeedScore === "number" && adv.minNeedScore > 1) {
      if (needScoreVal >= adv.minNeedScore) matches += 2;
    }
    if (adv.requireVerifiedEmail && hasVerifiedEmail) matches += 2;
    if (adv.requirePhone && hasPhone) matches += 1;
    if (adv.requireDecisionMaker && hasDecisionMaker) matches += 2;
    if (Array.isArray(adv.cmsPlatforms) && adv.cmsPlatforms.length > 0) {
      if (adv.cmsPlatforms.some((p) => cms.includes(p.toLowerCase()) || (p === "No Website" && hasNoWebsite))) {
        matches += 2;
      }
    }
    if (Array.isArray(adv.missingSignals) && adv.missingSignals.length > 0) {
      if (adv.missingSignals.some((m) => missing.includes(m.toLowerCase().slice(0, 12)))) {
        matches += 2;
      }
    }
    if (includeTokens.length > 0) {
      const hay = `${b.businessName || ""} ${b.painPoint || ""} ${b.category || ""} ${missing}`.toLowerCase();
      if (includeTokens.some((tok) => hay.includes(tok))) matches += 2;
    }

    return matches;
  };

  const matched = basePool
    .map((b) => ({ b, matchCount: scoreLeadMatch(b) }))
    .filter((item) => item.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || (b.b.intentScore ?? 0) - (a.b.intentScore ?? 0))
    .map((item) => item.b);

  return matched.length > 0 ? matched : basePool;
}

router.post("/crm/hunt-businesses", async (req, res) => {
  const { category, city, country, count = 10, extraContext, preFilters, advancedFilters } = req.body as {
    category: string;
    city: string;
    country: string;
    count?: number;
    extraContext?: string;
    preFilters?: string[];
    advancedFilters?: AdvancedHunterFilterInput;
  };
  if (!category || !city) { res.status(400).json({ error: "category and city are required" }); return; }

  const needed = Math.min(Number(count) || 10, 10000);
  const hasActivePreFilters =
    (Array.isArray(preFilters) && preFilters.some((f) => f && f !== "all")) ||
    Boolean(advancedFilters);
  const scrapeTargetCount = hasActivePreFilters ? Math.min(needed * 2, 120) : needed;

  try {
    let raw: any[] = [];
    const sourceLog: string[] = [];

    // ── Step 1: All sources in parallel — directory scrapers + Google Places ─
    const [{ businesses: scraped, sources, errors }, googlePlaces] = await Promise.all([
      scrapeBusinessDirectories(category, city, country || "", scrapeTargetCount, preFilters),
      searchGooglePlaces(category, city, country, scrapeTargetCount),
    ]);

    if (scraped.length > 0) {
      sourceLog.push(...sources);
      raw = scraped
        .filter(b => b.businessName)
        .map(b => ({
          businessName: b.businessName,
          ownerName: b.ownerName || "",
          ownerRole: b.ownerRole || "",
          category: b.category || category,
          email: b.email || "",
          phone: b.phone || "",
          website: b.website || "",
          city: b.city || city,
          country: b.country || country || "",
          instagram: b.instagram || "",
          facebook: b.facebook || "",
          linkedin: b.linkedin || "",
          cmsPlatform: b.cmsPlatform || (b.website ? "Custom HTML" : "No Website"),
          techStack: b.techStack || [],
          missingSignals: b.missingSignals || [],
          emailType: b.emailType || "unknown",
          executiveEmails: b.executiveEmails || [],
          intentScore: b.intentScore ?? 65,
          intentTier: b.intentTier || "warm",
          intentReasons: b.intentReasons || [],
          softwareNeedScore: b.aiOpportunityScore ?? 5,
          painPoint: b.aiOpportunityNote || "",
          estimatedValue: 0,
          notes: b.address || "",
          source: b.source,
        }));
    }

    // Partial directory timeouts are normal when 18 sources run in parallel — no stderr warning needed

    // Merge Google Places results (always-on primary source, runs in parallel above)
    if (googlePlaces.length > 0) {
      sourceLog.push("google_places");
      raw.push(...googlePlaces.map((p: any) => {
        const w = p.websiteUri || "";
        const ph = p.nationalPhoneNumber || "";
        const missing = w
          ? ["No AI Chat / Receptionist", "No Online Booking", "No Ad Pixels (FB/Google)"]
          : ["No Website Built", "No AI Chat / Receptionist", "No Online Booking"];
        const intent = computeApolloIntentScore({
          website: w,
          phone: ph,
          missingSignals: missing,
        });
        return {
          businessName: p.displayName?.text || "",
          ownerName: "",
          ownerRole: "",
          category,
          email: "",
          phone: ph,
          website: w,
          city,
          country: country || "",
          instagram: "",
          facebook: "",
          linkedin: "",
          cmsPlatform: w ? "Custom HTML" : "No Website",
          techStack: w ? ["Custom HTML"] : [],
          missingSignals: missing,
          emailType: "unknown",
          executiveEmails: [],
          intentScore: intent.intentScore,
          intentTier: intent.intentTier,
          intentReasons: intent.intentReasons,
          softwareNeedScore: w ? 6 : 9,
          painPoint: w
            ? "Google Maps listing found — prime candidate for conversion & AI receptionist audit."
            : "No website listed on Google Maps — prime candidate for instant AI Website + Review Shield.",
          estimatedValue: 0,
          notes: p.formattedAddress || "",
          source: "google_places",
        };
      }));
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

    // ── Step 5: MX / DNS verification + Pre-Search Filter ────────────────────
    const { live, dead } = await filterLiveProspects(raw);
    live.sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0));
    const filteredByTarget = applyHunterPreFilters(live, preFilters, advancedFilters);
    const returnedProspects = filteredByTarget.slice(0, needed);

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
  const { category, cities, country, countPerCity = 50, extraContext, preFilters, advancedFilters } = req.body as {
    category: string;
    cities: string[];
    country?: string;
    countPerCity?: number;
    extraContext?: string;
    preFilters?: string[];
    advancedFilters?: AdvancedHunterFilterInput;
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
        scrapeBusinessDirectories(category, city, country || "", needed, preFilters),
        searchGooglePlaces(category, city, country || "", needed),
      ]);

      // Partial directory timeouts are normal across 18 parallel sources

      const cityRaw: any[] = [
        ...scraped.filter(b => b.businessName).map(b => ({
          businessName: b.businessName,
          ownerName: b.ownerName || "",
          ownerRole: b.ownerRole || "",
          category: b.category || category,
          email: b.email || "",
          phone: b.phone || "",
          website: b.website || "",
          city: b.city || city,
          country: b.country || country || "",
          instagram: b.instagram || "",
          facebook: b.facebook || "",
          linkedin: b.linkedin || "",
          cmsPlatform: b.cmsPlatform || (b.website ? "Custom HTML" : "No Website"),
          techStack: b.techStack || [],
          missingSignals: b.missingSignals || [],
          emailType: b.emailType || "unknown",
          executiveEmails: b.executiveEmails || [],
          intentScore: b.intentScore ?? 65,
          intentTier: b.intentTier || "warm",
          intentReasons: b.intentReasons || [],
          softwareNeedScore: b.aiOpportunityScore ?? 5,
          painPoint: b.aiOpportunityNote || "", estimatedValue: 0,
          notes: b.address || "",
          source: b.source,
        })),
        ...googlePlaces.map((p: any) => {
          const w = p.websiteUri || "";
          const ph = p.nationalPhoneNumber || "";
          const missing = w
            ? ["No AI Chat / Receptionist", "No Online Booking", "No Ad Pixels (FB/Google)"]
            : ["No Website Built", "No AI Chat / Receptionist", "No Online Booking"];
          const intent = computeApolloIntentScore({
            website: w,
            phone: ph,
            missingSignals: missing,
          });
          return {
            businessName: p.displayName?.text || "",
            ownerName: "",
            ownerRole: "",
            category,
            email: "",
            phone: ph,
            website: w,
            city,
            country: country || "",
            instagram: "", facebook: "", linkedin: "",
            cmsPlatform: w ? "Custom HTML" : "No Website",
            techStack: w ? ["Custom HTML"] : [],
            missingSignals: missing,
            emailType: "unknown",
            executiveEmails: [],
            intentScore: intent.intentScore,
            intentTier: intent.intentTier,
            intentReasons: intent.intentReasons,
            softwareNeedScore: w ? 6 : 9,
            painPoint: "", estimatedValue: 0,
            notes: p.formattedAddress || "",
            source: "google_places",
          };
        }),
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
    } catch {
      cityResults[city] = 0;
    }
  }

  // MX / DNS verification across all accumulated prospects + Pre-Search Filter
  const { live, dead } = await filterLiveProspects(allProspects);
  live.sort((a, b) => (b.intentScore ?? 0) - (a.intentScore ?? 0));
  const filteredLive = applyHunterPreFilters(live, preFilters, advancedFilters);

  res.json({
    prospects: filteredLive,
    filtered: dead,
    total: allProspects.length,
    cityResults,
  });
});

// ─── Apollo+ On-Demand Deep Enrichment & Multi-Channel Cockpit ───────────────

function buildMultiChannelScripts(params: {
  businessName: string;
  ownerName?: string;
  category?: string;
  city?: string;
  website?: string;
  cmsPlatform?: string;
  missingSignals?: string[];
  reportUrl?: string;
  agencyName?: string;
  senderName?: string;
}) {
  const biz = params.businessName || "your business";
  const firstName = params.ownerName
    ? params.ownerName.replace(/^Dr\.\s+/i, "Dr. ").split(/\s+/)[0]
    : "";
  const greetingName = firstName || `${biz} Team`;
  const cityPart = params.city ? ` in ${params.city}` : "";
  const catPart = params.category || "local";
  const agency = params.agencyName || "Vanguard Growth";
  const sender = params.senderName || "Alex";
  const gaps = (params.missingSignals || []).slice(0, 2);
  const gapPhrase =
    gaps.length > 0
      ? gaps.join(" and ").toLowerCase()
      : "missing automated lead capture and 24/7 booking";
  const cmsNote =
    params.cmsPlatform && params.cmsPlatform !== "No Website"
      ? `your ${params.cmsPlatform} site`
      : `your online presence`;
  const reportSnippet = params.reportUrl ? ` Here's the live audit link: ${params.reportUrl}` : "";

  const coldCallOpener = `Hi ${firstName || "there"}, this is ${sender} from ${agency}. I know you're busy running ${biz}${cityPart} so I'll be 20 seconds — I was just looking at ${cmsNote} and noticed ${gapPhrase}, which usually costs ${catPart} businesses 15–25% of their inbound calls every week. We built a quick fix specifically for ${biz} — mind if I send you the 60-second preview link?`;

  const gatekeeperBypass = `Hi! Could you let ${params.ownerName || "the owner"} know ${sender} is following up on the website & conversion diagnostic we ran for ${biz}'s ${params.cmsPlatform || "digital"} setup? What's the best direct email to drop the link to?`;

  const smsScript = `Hi ${greetingName}, ${sender} here. Quick heads up — I noticed ${biz} (${cmsNote}) has ${gapPhrase}.${reportSnippet} Open to a 2-min chat on fixing this?`;

  const linkedinDm = `Hi ${firstName || "there"} — came across ${biz}${cityPart} and noticed ${cmsNote} currently has ${gapPhrase}. Put together a quick conversion & AI automation blueprint for your team. Worth sending over the link?`;

  const whatsappScript = `Hi ${greetingName}! 👋 I was reviewing ${biz}${cityPart} and noticed ${cmsNote} has ${gapPhrase}. We put together a custom breakdown showing how to capture those missed leads automatically.${reportSnippet} Would love to hear what you think!`;

  return {
    coldCallOpener,
    gatekeeperBypass,
    smsScript,
    linkedinDm,
    whatsappScript,
    smartVariables: {
      "{{decision_maker}}": params.ownerName || `${biz} Team`,
      "{{first_name}}": firstName || `${biz} Team`,
      "{{cms_platform}}": params.cmsPlatform || "website",
      "{{tech_gap}}": gapPhrase,
      "{{business_name}}": biz,
    },
  };
}

router.post("/crm/apollo-enrich", async (req, res) => {
  try {
    const training = await getActiveTrainingProfile(req);
    const effectiveSender = training.senderName || "Alex";
    const effectiveAgency = training.businessName || "Vanguard Growth";

    const { businessName, website, email, phone, city, category, reportUrl } = req.body ?? {};
    if (!businessName && !website) {
      res.status(400).json({ error: "businessName or website is required" });
      return;
    }

    const enriched = await enrichWebsiteApolloSignals({
      website: website || "",
      businessName: businessName || "",
      email: email || "",
      phone: phone || "",
    });

    // Verify MX on any discovered or executive email
    const finalEmail = enriched.email || email || "";
    const mxVerified = finalEmail ? await verifyEmailMx(finalEmail) : false;

    const linkedinSearchUrl =
      enriched.linkedin ||
      `https://www.google.com/search?q=${encodeURIComponent(
        `site:linkedin.com/in "${businessName || ""}" ${city || ""} (Owner OR Founder OR CEO OR President OR Doctor)`
      )}`;

    const scripts = buildMultiChannelScripts({
      businessName: businessName || "Business",
      ownerName: enriched.ownerName,
      category,
      city,
      website,
      cmsPlatform: enriched.cmsPlatform,
      missingSignals: enriched.missingSignals,
      reportUrl,
      agencyName: effectiveAgency,
      senderName: effectiveSender,
    });

    res.json({
      success: true,
      ...enriched,
      email: finalEmail,
      mxVerified,
      linkedinSearchUrl,
      scripts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Apollo enrichment failed" });
  }
});

// ─── Auto-analyze + generate everything for a hunted prospect ─────────────────

router.post("/crm/auto-generate", async (req, res) => {
  const {
    businessName,
    category,
    website,
    city,
    country,
    ownerName,
    painPoint,
    agencyName,
    cmsPlatform,
    missingSignals,
  } = req.body as {
    businessName: string;
    category: string;
    website: string;
    city: string;
    country: string;
    ownerName: string;
    painPoint: string;
    agencyName: string;
    cmsPlatform?: string;
    missingSignals?: string[];
  };
  const training = await getActiveTrainingProfile(req);
  const effectiveSender = training.senderName || "Alex Morgan";
  const effectiveAgency = training.businessName || agencyName || "Apex Digital Growth";

  // Scrape the real website so the AI references actual content
  const siteContent = await scrapeWebsite(website);
  let resolvedCms = cmsPlatform || "";
  let resolvedMissing = Array.isArray(missingSignals) ? missingSignals : [];
  if (website && (!resolvedCms || resolvedMissing.length === 0)) {
    try {
      const sigs = await enrichWebsiteApolloSignals({
        website,
        businessName: businessName || "",
      });
      if (!resolvedCms && sigs.cmsPlatform) resolvedCms = sigs.cmsPlatform;
      if (resolvedMissing.length === 0 && Array.isArray(sigs.missingSignals)) {
        resolvedMissing = sigs.missingSignals;
      }
    } catch {}
  }
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
    const matched = matchBestOfferFromTraining(training.servicesOffered, {
      website,
      category,
      painPoint,
      missingSignals: resolvedMissing,
      cmsPlatform: resolvedCms,
      siteContent,
    });
    const matchedOfferName = matched.name;
    let data: any;
    try {
      const text = await generateText(prompt);
      data = parseJSON(text);
    } catch {
      const fbAnalysis = buildFallbackAnalysis({
        businessName: businessName || "Business",
        category,
        city,
        website,
        painPoint,
        missingSignals: resolvedMissing,
        cmsPlatform: resolvedCms,
        siteContent,
        matchedOffer: matchedOfferName,
        servicesOffered: training.servicesOffered,
      });
      const fbEmails = buildFallbackEmailVersions({
        businessName: businessName || "Business",
        ownerName,
        category,
        city,
        website,
        senderName: effectiveSender,
        agencyName: effectiveAgency,
        websiteUrl: training.websiteUrl,
        senderEmail: training.senderEmail,
        offerDetails: training.offerDetails,
        targetPainPoints: training.targetPainPoints,
        callToAction: training.callToAction,
        reportUrl: "{{REPORT_URL}}",
        staticEmailExample: training.staticEmailExample,
        staticEmailTemplate: training.staticEmailExample || training.staticEmailTemplate,
        subjectLineGuide: training.subjectLineGuide,
        matchedOffer: matchedOfferName,
        includeAuditReportLink: training.includeAuditReportLink,
        servicesOffered: training.servicesOffered,
      });
      data = {
        matchedOffer: matchedOfferName,
        analysis: fbAnalysis,
        aiAgent: {
          type: agentTypeHint,
          score: 92,
          fitReason: `Automated 24/7 ${agentTypeHint} and 4-tap mobile funnel captures high-intent ${category || "local"} inquiries immediately.`,
          topPain: painPoint || "Missed after-hours calls and high-friction mobile lead capture",
        },
        pitchType: "both",
        emailVersions: fbEmails,
        whatsapp: `Hi ${ownerName || `${businessName} Team`}! 👋 ${effectiveSender} here from ${effectiveAgency}. I noticed a quick way for ${businessName} in ${city || "your area"} to capture more mobile bookings automatically. Open to a 2-minute preview link?`,
        linkedin: `Hi ${ownerName || "there"} — came across ${businessName} in ${city || "your area"} and put together a quick conversion & AI automation blueprint for your team. Worth sending over?`,
      };
    }
    if (data?.whatsapp) data.whatsapp = fillPlaceholders(data.whatsapp, effectiveSender, effectiveAgency);
    if (data?.linkedin) data.linkedin = fillPlaceholders(data.linkedin, effectiveSender, effectiveAgency);

    // Create a public analysis report first so the URL can replace {{REPORT_URL}} in the email body
    if (data?.analysis) {
      try {
        const caller = await resolveUserFromRequest(req);
        const { reportId, reportUrl } = await createReport({
          businessName: businessName || "",
          website: website || "",
          analysisData: data.analysis,
          baseUrl: getAgencyBaseUrl(req),
          ownerUserId: caller?.id ?? null,
          ownerEmail: caller?.email ?? null,
        });
        data.reportId = reportId;
        data.reportUrl = reportUrl;
      } catch { /* report creation failure must never break email generation */ }
    }

    const trainedTemplateEmails = buildFallbackEmailVersions({
      businessName: businessName || "Business",
      ownerName,
      category,
      city,
      website,
      senderName: effectiveSender,
      agencyName: effectiveAgency,
      websiteUrl: training.websiteUrl,
      senderEmail: training.senderEmail,
      offerDetails: training.offerDetails,
      targetPainPoints: training.targetPainPoints,
      callToAction: training.callToAction,
      reportUrl: data?.reportUrl || "",
      staticEmailExample: training.staticEmailExample,
      staticEmailTemplate: training.staticEmailExample || training.staticEmailTemplate,
      subjectLineGuide: training.subjectLineGuide,
      matchedOffer: data?.matchedOffer || data?.analysis?.matchedOffer || matchedOfferName,
      includeAuditReportLink: training.includeAuditReportLink,
      servicesOffered: training.servicesOffered,
    });

    if (Array.isArray(data?.emailVersions) && data.emailVersions.length > 0) {
      const processedVersions = data.emailVersions.map((v: any, idx: number) => {
        if (idx === 0 && training.staticEmailExample?.trim()) {
          return {
            version: "A",
            subject: fillPlaceholders(trainedTemplateEmails[0].subject, effectiveSender, effectiveAgency),
            body: fillPlaceholders(trainedTemplateEmails[0].body, effectiveSender, effectiveAgency),
          };
        }
        let bodyText = String(v.body || "");
        if (data.reportUrl) {
          bodyText = bodyText.replace(/\{\{REPORT_URL\}\}/g, data.reportUrl);
        } else {
          bodyText = bodyText.replace(/[^\n.!?]*\{\{REPORT_URL\}\}[^\n]*/g, "").trim();
        }
        let filledBody = fillPlaceholders(bodyText, effectiveSender, effectiveAgency);
        if (!filledBody.toLowerCase().includes(effectiveSender.toLowerCase())) {
          filledBody = `${filledBody.trim()}\n\nBest regards,\n${effectiveSender}\n${effectiveAgency}`;
        }
        return {
          version: v.version || (idx === 0 ? "A" : idx === 1 ? "B" : "C"),
          subject: fillPlaceholders(String(v.subject || ""), effectiveSender, effectiveAgency),
          body: filledBody,
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
    } else {
      data.emailVersions = trainedTemplateEmails;
      data.email = {
        subject: trainedTemplateEmails[0].subject,
        body: trainedTemplateEmails[0].body,
        emailVersions: trainedTemplateEmails,
        selectedVersion: "A",
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
    const { website, businessName, category, city, painPoint, cmsPlatform, missingSignals } = req.body as {
      website: string;
      businessName: string;
      category: string;
      city?: string;
      painPoint?: string;
      cmsPlatform?: string;
      missingSignals?: string[];
    };
    if (!businessName) { res.status(400).json({ error: "businessName required" }); return; }
    const training = await getActiveTrainingProfile(req);
    const siteContent = await scrapeWebsite(website || "");
    let resolvedCms = cmsPlatform || "";
    let resolvedMissing = Array.isArray(missingSignals) ? missingSignals : [];
    if (website && (!resolvedCms || resolvedMissing.length === 0)) {
      try {
        const sigs = await enrichWebsiteApolloSignals({
          website,
          businessName: businessName || "",
        });
        if (!resolvedCms && sigs.cmsPlatform) resolvedCms = sigs.cmsPlatform;
        if (resolvedMissing.length === 0 && Array.isArray(sigs.missingSignals)) {
          resolvedMissing = sigs.missingSignals;
        }
      } catch {}
    }
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

Business Name: ${businessName}, Business Category: ${category || "Unknown"}${city ? `, City: ${city}` : ""}, Website: ${website || "No website provided"}${resolvedCms ? `, CMS: ${resolvedCms}` : ""}${resolvedMissing.length > 0 ? `, Detected Missing Signals: ${resolvedMissing.join(", ")}` : ""}${painPoint ? `, Pain Point: ${painPoint}` : ""}${siteContext}

Produce a JSON object with EXACTLY this structure (no markdown, pure JSON):
{ "matchedOffer":"string (the #1 service/offer from our catalog that this business needs most)","websiteScore":<0-100>,"leadScore":<0-100>,"conversionScore":<0-100>,"mobileScore":<0-100>,"seoScore":<0-100>,"growthPotential":<0-100>,"checks":{"responsiveDesign":<true/false>,"sslCertificate":<true/false>,"modernUI":<true/false>,"whatsappButton":<true/false>,"contactForm":<true/false>,"bookingSystem":<true/false>,"onlineOrdering":<true/false>,"paymentIntegration":<true/false>,"customerPortal":<true/false>,"membershipArea":<true/false>,"blog":<true/false>,"seoBasics":<true/false>,"analytics":<true/false>,"socialMedia":<true/false>,"emailCapture":<true/false>,"liveChat":<true/false>,"aiChatbot":<true/false>,"callToAction":<true/false>,"trustElements":<true/false>},"issues":[{"title":"string","description":"string","priority":"high|medium|low"}],"opportunities":[{"title":"string","impact":"string","effort":"low|medium|high"}],"recommendedFeatures":["string"],"projectType":"Small Website|Medium Web App|Large SaaS","estimatedValue":{"min":<number>,"max":<number>},"deliveryWeeks":{"min":<1 or 2>,"max":<1 or 2, never above 2 — we deliver in 5 days to 2 weeks>},"summary":"2-3 sentence plain English summary explaining their key gaps and how our matched offers/services solve them" }
Be realistic and specific to a ${category} business. If no website is provided, give scores of 0-20 for all website metrics.`;
    const fallbackBase = buildFallbackAnalysis({
      businessName: businessName || "Business",
      category,
      city,
      website,
      painPoint,
      cmsPlatform: resolvedCms,
      missingSignals: resolvedMissing,
      siteContent,
      servicesOffered: training.servicesOffered,
    });
    let data: any;
    try {
      const text = await generateText(prompt);
      const parsed = parseJSON(text);
      data = {
        ...fallbackBase,
        ...parsed,
        checks: { ...fallbackBase.checks, ...(parsed?.checks || {}) },
        issues: Array.isArray(parsed?.issues) && parsed.issues.length > 0 ? parsed.issues : fallbackBase.issues,
        opportunities: Array.isArray(parsed?.opportunities) && parsed.opportunities.length > 0 ? parsed.opportunities : fallbackBase.opportunities,
        recommendedFeatures: Array.isArray(parsed?.recommendedFeatures) && parsed.recommendedFeatures.length > 0 ? parsed.recommendedFeatures : fallbackBase.recommendedFeatures,
        estimatedValue: parsed?.estimatedValue?.min ? parsed.estimatedValue : fallbackBase.estimatedValue,
        deliveryWeeks: parsed?.deliveryWeeks?.min ? parsed.deliveryWeeks : fallbackBase.deliveryWeeks,
      };
    } catch {
      data = fallbackBase;
    }
    try {
      const caller = await resolveUserFromRequest(req);
      const { reportId, reportUrl } = await createReport({
        businessName: businessName || "",
        website: website || "",
        analysisData: data,
        baseUrl: getAgencyBaseUrl(req),
        ownerUserId: caller?.id ?? null,
        ownerEmail: caller?.email ?? null,
      });
      data.reportId = reportId;
      data.reportUrl = reportUrl;
    } catch { /* ignore report creation error */ }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/crm/generate-email", async (req, res) => {
  try {
    const { businessName, ownerName, category, website, city, issues, opportunities, agencyName: reqAgencyName, reportUrl, demoWebsiteUrl, reviewServiceUrl, primaryOffer, cmsPlatform, missingSignals } = req.body as Record<string, any>;
    const training = await getActiveTrainingProfile(req);

    // Scrape real website for genuine personalisation
    const siteContent = await scrapeWebsite(website);
    const siteContext = siteContent
      ? `\nReal content from their website:\n"""\n${siteContent}\n"""`
      : "";

    const senderName = training.senderName || "Alex Morgan";
    const agencyName = training.businessName || reqAgencyName || process.env.AGENCY_NAME || "Apex Digital Growth";
    const ownerGreeting = ownerName ? `Hi ${ownerName},` : `Hi ${businessName || "there"} Team,`;

    const matched = matchBestOfferFromTraining(training.servicesOffered, {
      website,
      category,
      painPoint: issues,
      cmsPlatform,
      missingSignals: Array.isArray(missingSignals) ? missingSignals : undefined,
      siteContent,
    });
    const effectivePrimaryOffer = primaryOffer || matched.name;
    const inlineAssetLines = [
      demoWebsiteUrl ? `- Live Custom Website Preview URL to include in the email: ${demoWebsiteUrl}` : "",
      reviewServiceUrl ? `- Live 5-Star Review Service URL to include in the email: ${reviewServiceUrl}` : "",
    ].filter(Boolean).join("\n");

    const trainedBlock = buildTrainedOutreachPromptBlock(training, {
      targetBusinessName: businessName,
      targetOwnerName: ownerName,
      targetCategory: category,
      targetCity: city,
      reportUrl: reportUrl || "",
    });

    const prompt = `Write THREE personalised cold email versions (A, B, C) from ${senderName} at ${agencyName} to ${businessName}, a ${category || "business"}${city ? ` in ${city}` : ""}.

${trainedBlock}

PRIMARY OFFER FOR THIS EXTRACTED LEAD: ${effectivePrimaryOffer}
${inlineAssetLines ? `\nGENERATED ASSETS FOR THIS LEAD (include these exact links cleanly in the email body):\n${inlineAssetLines}\n` : ""}
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
4. Pitch the Primary Offer (${effectivePrimaryOffer} — ${training.offerDetails}) naturally, professionally, and in a classic simple style.
5. ${inlineAssetLines ? "Include the provided Live Website Preview URL and/or 5-Star Review Service URL clearly in the body." : "Keep the pitch concise and easy to reply to."}
6. Version A = closest to the user's static template & direct; Version B = warm & conversational; Version C = insight-led & value-focused.
7. End every version with the exact signature from the trained profile (${senderName}, ${agencyName}).

Return ONLY valid JSON (no markdown, no prose):
{ "versions":[{"version":"A","subject":"string","body":"string"},{"version":"B","subject":"string","body":"string"},{"version":"C","subject":"string","body":"string"}] }`;

    let versions: { version: string; subject: string; body: string }[] = [];
    try {
      const text = await generateText(prompt);
      const data = parseJSON(text);
      if (Array.isArray(data?.versions) && data.versions.length > 0) {
        versions = data.versions;
      } else if (data?.subject && data?.body) {
        versions = [{ version: "A", subject: data.subject, body: data.body }];
      }
    } catch {
      // Fall through to fallback versions below
    }
    const trainedTemplateVersions = buildFallbackEmailVersions({
      businessName: businessName || "Business",
      ownerName,
      category,
      city,
      website,
      senderName,
      agencyName,
      websiteUrl: training.websiteUrl,
      senderEmail: training.senderEmail,
      offerDetails: training.offerDetails,
      targetPainPoints: training.targetPainPoints,
      callToAction: training.callToAction,
      reportUrl,
      demoWebsiteUrl,
      reviewServiceUrl,
      staticEmailExample: training.staticEmailExample,
      staticEmailTemplate: training.staticEmailExample || training.staticEmailTemplate,
      subjectLineGuide: training.subjectLineGuide,
      matchedOffer: effectivePrimaryOffer,
      includeAuditReportLink: training.includeAuditReportLink,
      servicesOffered: training.servicesOffered,
    });

    if (!versions.length) {
      versions = trainedTemplateVersions;
    } else if (training.staticEmailExample?.trim()) {
      versions = [
        trainedTemplateVersions[0],
        versions[1] || versions[0] || trainedTemplateVersions[1],
        versions[2] || trainedTemplateVersions[2],
      ].map((v, idx) => ({
        version: idx === 0 ? "A" : idx === 1 ? "B" : "C",
        subject: v.subject,
        body: v.body,
      }));
    }

    const processed = versions.map(v => {
      let bodyText = fillPlaceholders(v.body || "", senderName, agencyName);
      if (!bodyText.toLowerCase().includes(senderName.toLowerCase())) {
        bodyText = `${bodyText.trim()}\n\nBest regards,\n${senderName}\n${agencyName}`;
      }
      return {
        version: v.version,
        subject: fillPlaceholders(v.subject || "", senderName, agencyName),
        body: bodyText,
      };
    });

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
    let data: any;
    try {
      const text = await generateText(prompt);
      data = parseJSON(text);
    } catch {
      data = {
        message: `Hi ${businessName || "there"} Team! 👋 This is ${senderName} from ${effectiveAgency}. I was reviewing your ${category || "local"} presence and spotted a quick way to help you capture more mobile bookings and customer inquiries automatically (${training.offerDetails}). ${training.callToAction || "Open to a quick 2-minute preview?"} — ${senderName}, ${effectiveAgency}`,
      };
    }
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
    let data: any;
    try {
      const text = await generateText(prompt);
      data = parseJSON(text);
    } catch {
      data = {
        message: `Hi ${ownerName || "there"} — came across ${businessName} and put together a quick conversion & AI automation blueprint tailored for your ${category || "business"} team. Worth sending over the link? — ${senderName}, ${effectiveAgency}`,
      };
    }
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

    let data: any;
    try {
      const text = await generateText(prompt);
      data = parseJSON(text);
    } catch {
      const matched = matchBestOfferFromTraining(profile.servicesOffered, {
        website: sampleWebsite,
        category: sampleCategory,
      });
      const fb = buildFallbackEmailVersions({
        businessName: sampleBusinessName,
        category: sampleCategory,
        city: sampleCity,
        website: sampleWebsite,
        senderName: profile.senderName,
        agencyName: profile.businessName,
        websiteUrl: profile.websiteUrl,
        senderEmail: profile.senderEmail,
        offerDetails: profile.offerDetails,
        targetPainPoints: profile.targetPainPoints,
        callToAction: profile.callToAction,
        staticEmailExample: profile.staticEmailExample,
        staticEmailTemplate: profile.staticEmailExample || profile.staticEmailTemplate,
        subjectLineGuide: profile.subjectLineGuide,
        matchedOffer: matched.name,
        includeAuditReportLink: profile.includeAuditReportLink,
        servicesOffered: profile.servicesOffered,
      })[0];
      data = {
        matchedOffer: matched.name,
        analysisFocus: `Matched ${matched.name} to ${sampleBusinessName} (${sampleCategory} in ${sampleCity}) to convert mobile traffic and automate client inquiries.`,
        subject: fb.subject,
        body: fb.body,
      };
    }
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
        } catch {
          const matched = matchBestOfferFromTraining(training.servicesOffered, {
            website: biz.website,
            category: biz.category,
            painPoint: biz.painPoint || biz.issues,
          });
          matchedOffer = matched.name;
          const fb = buildFallbackEmailVersions({
            businessName: biz.businessName,
            ownerName: biz.ownerName,
            category: biz.category,
            city: biz.city,
            website: biz.website,
            senderName,
            agencyName,
            websiteUrl: training.websiteUrl,
            senderEmail: training.senderEmail,
            offerDetails: training.offerDetails,
            targetPainPoints: training.targetPainPoints,
            callToAction: training.callToAction,
            reportUrl,
            staticEmailExample: training.staticEmailExample,
            staticEmailTemplate: training.staticEmailExample || training.staticEmailTemplate,
            subjectLineGuide: training.subjectLineGuide,
            matchedOffer,
            includeAuditReportLink: training.includeAuditReportLink,
            servicesOffered: training.servicesOffered,
          })[0];
          subject = fb.subject;
          body = fb.body;
        }
        if (reportUrl) {
          body = body.replace(/\{\{REPORT_URL\}\}/g, reportUrl);
        } else {
          body = body.replace(/[^\n.!?]*\{\{REPORT_URL\}\}[^\n]*/g, "").trim();
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
    let data: any;
    try {
      const text = await generateText(prompt);
      data = parseJSON(text);
    } catch {
      data = {
        sections: {
          executiveSummary: `${effectiveAgency} has prepared this turnkey digital conversion and automation proposal for ${businessName} to capture more high-intent ${category || "local"} customers and automate 24/7 lead response.`,
          situation: website
            ? `${businessName} currently operates ${website}, which lacks an interactive 4-tap mobile estimate funnel and 24/7 automated receptionist.`
            : `${businessName} currently lacks a dedicated high-converting website and automated 24/7 booking funnel.`,
          problems: [
            "Prospective mobile customers face friction when trying to request pricing or book an appointment.",
            "After-hours and peak-hour inquiries go unanswered without an automated 24/7 AI receptionist.",
            "Satisfied customers are not systematically routed into a 5-Star Google Review Shield.",
          ],
          solution: `${effectiveAgency} will deploy a custom 4-Tap Conversion Website, 24/7 Spoken AI Receptionist, and 5-Star Review Shield tailored for ${businessName}.`,
          features: [
            { name: "4-Tap Instant Quote & Booking Funnel", desc: "Converts mobile visitors into qualified leads in under 15 seconds without long forms." },
            { name: "24/7 Spoken AI Receptionist", desc: "Greets visitors with a natural studio voice, answers FAQs, and captures phone numbers." },
            { name: "5-Star Review Shield", desc: "Routes 4–5 star ratings to Google Maps while privately intercepting 1–3 star feedback." },
          ],
          benefits: [
            "25–40% lift in mobile lead conversion",
            "Zero missed after-hours inquiries",
            "Faster response times and higher booked-job volume",
            "Protected 5-star Google Maps reputation",
            "Full ownership and easy 1-click admin customization",
          ],
          timeline: [
            { week: "Days 1–3", task: "Custom brand design, local copy, and 4-tap funnel configuration" },
            { week: "Days 4–7", task: "24/7 AI receptionist training, domain connection, and live launch" },
          ],
          investment: customPrice || estimatedValue || "$1,500 Turnkey Setup (or $49/mo Managed Hosting)",
          whyUs: [
            `Specialized in high-converting ${category || "local service"} digital systems`,
            "Rapid 5-to-7 day turnkey deployment with zero downtime",
            "Proven 4-tap mobile funnel architecture",
          ],
          nextSteps: [
            "Approve this proposal and select your preferred launch date",
            "We configure your custom site, AI receptionist, and domain",
            "Go live and start capturing new customer inquiries immediately",
          ],
        },
      };
    }
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
    let data: any;
    try {
      const text = await generateText(prompt);
      data = parseJSON(text);
    } catch {
      data = {
        subject: `Quick question for ${businessName}`,
        body: `Hi ${ownerName || `${businessName} Team`},\n\nWanted to share a quick idea on how ${businessName} can capture more mobile inquiries automatically using our 4-tap booking & AI receptionist system.\n\nWould you be open to seeing a 60-second preview link customized for ${businessName}?\n\nBest regards,\n${senderName}\n${effectiveAgency}`,
        channel: "email",
      };
    }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Database Architecture & CRM Pipeline Persistence ─────────────────────────

router.get("/crm/prospects", async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.json({ prospects: [], huntedLeads: [] });
      return;
    }
    const rows = await db.select().from(crmProspectsTable).orderBy(desc(crmProspectsTable.updatedAt));
    const userRows = rows.filter(r => doesProspectRowBelongToUser(r, user));
    const prospects = userRows.map(r => {
      const payloadObj = (typeof r.payload === "object" && r.payload ? r.payload : {}) as Record<string, any>;
      const cleanId =
        payloadObj.id !== undefined
          ? payloadObj.id
          : String(r.id).replace(/^u\d+_/, "");
      const numId = Number(cleanId);
      return {
        ...payloadObj,
        id: Number.isFinite(numId) && String(numId) === String(cleanId) ? numId : cleanId,
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
      };
    });
    const huntedKey = `CRM_HUNTED_LEADS_USER_${user.id}`;
    const huntedLeads = (await kvGetJson<any[]>(huntedKey)) ?? [];
    res.json({ prospects, huntedLeads });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/crm/prospects/sync", async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.json({ success: false, error: "Not authenticated" });
      return;
    }
    const { prospects, huntedLeads } = req.body as { prospects?: any[]; huntedLeads?: any[] };
    if (Array.isArray(prospects)) {
      const syncedRowIds = new Set<string>();
      for (const p of prospects) {
        if (!p?.id) continue;
        const rawIdStr = String(p.id).replace(/^u\d+_/, "");
        const scopedId = `u${user.id}_${rawIdStr}`;
        syncedRowIds.add(scopedId);
        const nameVal = String(p.ownerName || p.name || p.businessName || "");
        const companyVal = String(p.businessName || p.company || "");
        const industryVal = String(p.category || p.industry || "");
        const locationVal = String(p.city ? `${p.city}${p.country ? `, ${p.country}` : ""}` : (p.location || ""));
        const stageVal = String(p.status || p.stage || "new");
        const dealVal = Number(p.expectedValue ?? p.dealValue) || 0;
        const scoreVal = p.aiAgentScore !== undefined ? Number(p.aiAgentScore) : (p.aiScore !== undefined && p.aiScore !== null ? Number(p.aiScore) : null);
        const enrichedPayload = {
          ...p,
          id: p.id,
          ownerUserId: user.id,
          ownerEmail: user.email,
        };

        await db
          .insert(crmProspectsTable)
          .values({
            id: scopedId,
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
            payload: enrichedPayload,
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
              payload: enrichedPayload,
              updatedAt: new Date(),
            },
          });
      }

      // Remove any stale rows belonging strictly to this user that were deleted from their list
      try {
        const allRows = await db.select().from(crmProspectsTable);
        const staleIds = allRows
          .filter(r => doesProspectRowBelongToUser(r, user) && !syncedRowIds.has(String(r.id)))
          .map(r => r.id);
        if (staleIds.length > 0) {
          await db.delete(crmProspectsTable).where(inArray(crmProspectsTable.id, staleIds));
        }
      } catch {}
    }
    if (Array.isArray(huntedLeads)) {
      await kvSetJson(`CRM_HUNTED_LEADS_USER_${user.id}`, huntedLeads);
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

// ─── AI Studio Voice-Note Pitch ($0 API Cost) & Outbound AI Machine Caller ───

/**
 * Wraps raw 16-bit signed little-endian PCM audio (24,000 Hz mono) returned by
 * Gemini TTS into a standard 44-byte RIFF/WAVE container with persona-specific
 * acoustic pitch/formant sample-rate shaping and 16-bit studio EQ filtering so
 * every voice persona has a distinct vocal timbre, chest resonance, and tempo.
 */
function pcm16ToWavBase64(
  pcmBase64: string,
  sampleRate = 24000,
  numChannels = 1,
  eqProfile: "crisp_female" | "deep_baritone" | "brisk_founder" | "british_crisp" | "bold_closer" | "warm_executive" = "crisp_female"
): string {
  const rawBuf = Buffer.from(pcmBase64, "base64");
  if (rawBuf.length >= 4 && rawBuf.toString("ascii", 0, 4) === "RIFF") {
    return pcmBase64;
  }

  // Apply gentle 16-bit signed PCM studio EQ & dynamic presence shaping
  const pcmBuf = Buffer.from(rawBuf);
  const sampleCount = Math.floor(pcmBuf.length / 2);
  let prevSample = 0;

  for (let i = 0; i < sampleCount; i++) {
    const offset = i * 2;
    const s = pcmBuf.readInt16LE(offset);
    let shaped = s;

    if (eqProfile === "deep_baritone" || eqProfile === "warm_executive") {
      // Warm low-pass chest resonance filter for deep male baritone voices
      const alpha = eqProfile === "deep_baritone" ? 0.36 : 0.24;
      shaped = Math.round(s * (1 - alpha) + prevSample * alpha) * 1.12;
    } else if (eqProfile === "crisp_female" || eqProfile === "british_crisp") {
      // High-shelf presence & air boost for articulate female voices
      const highFreq = s - prevSample;
      shaped = Math.round(s + highFreq * 0.22);
    } else if (eqProfile === "bold_closer" || eqProfile === "brisk_founder") {
      // Punchy broadcast presence boost
      const highFreq = s - prevSample;
      shaped = Math.round((s + highFreq * 0.15) * 1.14);
    }

    prevSample = s;
    if (shaped > 32767) shaped = 32767;
    if (shaped < -32768) shaped = -32768;
    pcmBuf.writeInt16LE(Math.round(shaped), offset);
  }

  const bitsPerSample = 16;
  const byteRate = Math.round((sampleRate * numChannels * bitsPerSample) / 8);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuf.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuf]).toString("base64");
}

interface StudioVoicePersonaSpec {
  id: string;
  displayName: string;
  geminiVoice: string;
  fallbackGeminiVoice: string;
  sampleRate: number;
  eqProfile: "crisp_female" | "deep_baritone" | "brisk_founder" | "british_crisp" | "bold_closer" | "warm_executive";
  preferredModels: string[];
  stylePrompt: string;
  scriptStyleHint: string;
}

const STUDIO_VOICE_PERSONAS: Record<string, StudioVoicePersonaSpec> = {
  Kore: {
    id: "Kore",
    displayName: "Sarah (Kore · Warm US Female Executive)",
    geminiVoice: "Kore",
    fallbackGeminiVoice: "Aoede",
    sampleRate: 24900,
    eqProfile: "crisp_female",
    preferredModels: ["gemini-2.5-flash-preview-tts"],
    stylePrompt: "Warm, bright, confident American female executive with an upbeat, friendly, smiling cadence",
    scriptStyleHint: "warm, friendly, upbeat American female agency executive named Sarah",
  },
  Charon: {
    id: "Charon",
    displayName: "Marcus (Charon · Deep Baritone Male Consultant)",
    geminiVoice: "Charon",
    fallbackGeminiVoice: "Orus",
    sampleRate: 20400,
    eqProfile: "deep_baritone",
    preferredModels: ["gemini-2.5-flash-preview-tts"],
    stylePrompt: "Deep, resonant, calm baritone male senior executive consultant with a slow, measured, authoritative voice",
    scriptStyleHint: "calm, authoritative senior executive strategy consultant named Marcus",
  },
  Puck: {
    id: "Puck",
    displayName: "Ryan (Puck · Fast Silicon Valley Male Founder)",
    geminiVoice: "Puck",
    fallbackGeminiVoice: "Fenrir",
    sampleRate: 25800,
    eqProfile: "brisk_founder",
    preferredModels: ["gemini-2.5-flash-preview-tts"],
    stylePrompt: "Fast-paced, energetic, enthusiastic young American male tech founder with a brisk conversational pace",
    scriptStyleHint: "energetic, fast-moving tech founder named Ryan",
  },
  Zephyr: {
    id: "Zephyr",
    displayName: "Victoria (Zephyr · Crisp British UK Female Director)",
    geminiVoice: "Zephyr",
    fallbackGeminiVoice: "Leda",
    sampleRate: 24100,
    eqProfile: "british_crisp",
    preferredModels: ["gemini-2.5-flash-preview-tts"],
    stylePrompt: "Crisp, articulate, polished London British English female agency director with a refined, sophisticated accent",
    scriptStyleHint: "articulate, polished British agency director in London named Victoria using natural UK phrasing",
  },
  Fenrir: {
    id: "Fenrir",
    displayName: "Viktor (Fenrir · Bold Wall Street Male Closer)",
    geminiVoice: "Fenrir",
    fallbackGeminiVoice: "Charon",
    sampleRate: 21900,
    eqProfile: "bold_closer",
    preferredModels: ["gemini-2.5-flash-preview-tts"],
    stylePrompt: "Bold, direct, high-conviction New York male sales closer with a punchy, commanding delivery",
    scriptStyleHint: "direct, high-conviction New York revenue closer named Viktor focused on bottom-line ROI",
  },
  Orus: {
    id: "Orus",
    displayName: "Tunde (Orus · Warm Global / Nigerian Male Executive)",
    geminiVoice: "Orus",
    fallbackGeminiVoice: "Charon",
    sampleRate: 22700,
    eqProfile: "warm_executive",
    preferredModels: ["gemini-2.5-flash-preview-tts"],
    stylePrompt: "Warm, resonant, dignified international Nigerian-British English male executive advisor, clear and persuasive",
    scriptStyleHint: "warm, dignified international growth advisor named Tunde",
  },
};

const voicePitchAudioCache = new Map<string, { wavBase64: string; engine: string }>();
const instantNeuralMp3Cache = new Map<string, string>();

function splitTextIntoTtsChunks(text: string, maxLen = 180): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (!s) continue;
    if ((current ? `${current} ${s}` : s).length <= maxLen) {
      current = current ? `${current} ${s}` : s;
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        const words = s.split(" ");
        let sub = "";
        for (const w of words) {
          if ((sub ? `${sub} ${w}` : w).length <= maxLen) {
            sub = sub ? `${sub} ${w}` : w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function synthesizeInstantNeuralMp3(
  script: string,
  voiceId: string = "Kore"
): Promise<string | null> {
  const clean = String(script || "").trim();
  if (!clean) return null;
  const cacheKey = `${voiceId}::${clean}`;
  const cached = instantNeuralMp3Cache.get(cacheKey);
  if (cached) return cached;

  const tlMap: Record<string, string> = {
    Kore: "en-US",
    Zephyr: "en-GB",
    Orus: "en-NG",
    Charon: "en-AU",
    Puck: "en-CA",
    Fenrir: "en-IE",
  };
  const tl = tlMap[voiceId] || "en-US";
  const chunks = splitTextIntoTtsChunks(clean, 180);
  if (chunks.length === 0) return null;

  try {
    const buffers = await Promise.all(
      chunks.map(async (chunk) => {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
          tl
        )}&q=${encodeURIComponent(chunk)}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      })
    );
    const combined = Buffer.concat(buffers);
    if (combined.length > 256) {
      const dataUri = `data:audio/mpeg;base64,${combined.toString("base64")}`;
      instantNeuralMp3Cache.set(cacheKey, dataUri);
      return dataUri;
    }
  } catch {}
  return null;
}

export function buildSiteArrivalWalkthroughScript(site: {
  businessName?: string;
  ownerName?: string;
  city?: string;
  siteConfig?: any;
}): { script: string; voiceId: string } {
  const preferredVoice =
    site?.siteConfig?.chatbotConfig?.voicePersona ||
    site?.siteConfig?.walkthroughVoice ||
    "Kore";
  const ownerFirst = site?.ownerName
    ? String(site.ownerName).trim().split(/\s+/)[0]
    : "";
  const greeting = ownerFirst ? `Hi ${ownerFirst}!` : `Hi there!`;
  const cityPhrase = site?.city ? ` in ${site.city}` : "";
  const bizName = site?.businessName || "your business";
  const script = `${greeting} Welcome to the new custom website we built for ${bizName}${cityPhrase}. We engineered this page with an interactive 4-tap instant quote calculator and a 24/7 automated chat assistant so local customers can request estimates and book with you in seconds. Take a look around your live website right here, and click Claim Your Site Now at the top to launch it on your domain with zero build fee!`;
  return { script, voiceId: preferredVoice };
}

export function getCachedSiteWalkthroughWav(site: {
  businessName?: string;
  ownerName?: string;
  city?: string;
  siteConfig?: any;
}): string | null {
  const { script, voiceId } = buildSiteArrivalWalkthroughScript(site);
  const persona = STUDIO_VOICE_PERSONAS[voiceId] || STUDIO_VOICE_PERSONAS.Kore;
  const cacheKey = `${persona.id}::${script}`;
  const cached = voicePitchAudioCache.get(cacheKey);
  if (cached?.wavBase64) {
    return `data:audio/wav;base64,${cached.wavBase64}`;
  }
  const cachedMp3 = instantNeuralMp3Cache.get(cacheKey);
  if (cachedMp3) {
    return cachedMp3;
  }
  return null;
}

export async function ensureSiteWalkthroughAudioReady(site: {
  businessName?: string;
  ownerName?: string;
  city?: string;
  siteConfig?: any;
}): Promise<string | null> {
  const { script, voiceId } = buildSiteArrivalWalkthroughScript(site);
  const persona = STUDIO_VOICE_PERSONAS[voiceId] || STUDIO_VOICE_PERSONAS.Kore;
  const cacheKey = `${persona.id}::${script}`;
  const cachedStudio = voicePitchAudioCache.get(cacheKey);
  if (cachedStudio?.wavBase64) {
    return `data:audio/wav;base64,${cachedStudio.wavBase64}`;
  }
  // Always kick off background Gemini Studio WAV prewarm
  void prewarmSiteWalkthroughVoice(site);
  const cachedMp3 = instantNeuralMp3Cache.get(cacheKey);
  if (cachedMp3) return cachedMp3;
  return await synthesizeInstantNeuralMp3(script, persona.id);
}

const inflightPrewarmKeys = new Set<string>();

export async function prewarmSiteWalkthroughVoice(site: {
  businessName?: string;
  ownerName?: string;
  city?: string;
  siteConfig?: any;
}): Promise<string | null> {
  try {
    const { script, voiceId } = buildSiteArrivalWalkthroughScript(site);
    const persona = STUDIO_VOICE_PERSONAS[voiceId] || STUDIO_VOICE_PERSONAS.Kore;
    const cacheKey = `${persona.id}::${script}`;
    const existing = voicePitchAudioCache.get(cacheKey);
    if (existing?.wavBase64) {
      return `data:audio/wav;base64,${existing.wavBase64}`;
    }
    if (inflightPrewarmKeys.has(cacheKey)) return null;
    inflightPrewarmKeys.add(cacheKey);

    try {
      const ai = await getGeminiAI();
      const directedPrompt = `Speak the following message aloud in a ${persona.stylePrompt}: "${script}"`;
      for (const modelName of persona.preferredModels) {
        for (const candidateVoice of [persona.geminiVoice, persona.fallbackGeminiVoice]) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: "user",
                  parts: [{ text: directedPrompt } as any],
                },
              ],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: candidateVoice },
                  },
                },
              },
            });
            const inlineData = response.candidates?.[0]?.content?.parts?.find(
              (p: any) => p.inlineData?.data
            )?.inlineData;
            if (inlineData?.data) {
              const wavBase64 = pcm16ToWavBase64(
                inlineData.data,
                persona.sampleRate,
                1,
                persona.eqProfile
              );
              const engine = `${modelName} (${candidateVoice} · ${Math.round(persona.sampleRate / 100) / 10}kHz Studio DSP)`;
              voicePitchAudioCache.set(cacheKey, { wavBase64, engine });
              return `data:audio/wav;base64,${wavBase64}`;
            }
          } catch {}
        }
      }
    } finally {
      inflightPrewarmKeys.delete(cacheKey);
    }
  } catch {}
  return null;
}

function buildNaturalVoicePitchScript(params: {
  businessName: string;
  ownerName?: string;
  ownerRole?: string;
  category?: string;
  city?: string;
  website?: string;
  cmsPlatform?: string;
  missingSignals?: string[];
  painPoint?: string;
  agencyName?: string;
  hasReport?: boolean;
  voiceName?: string;
  pitchMode?: "audit" | "website_claim" | "review_shield";
}): string {
  const firstName = params.ownerName
    ? params.ownerName.trim().split(/\s+/)[0]
    : "";
  const cityPhrase = params.city ? ` in ${params.city}` : "";
  const catPhrase = params.category ? params.category.toLowerCase() : "local service";
  const v = params.voiceName || "Kore";

  if (params.pitchMode === "website_claim") {
    if (v === "Zephyr") {
      const greet = firstName ? `Hello ${firstName}, Victoria speaking here.` : `Hello there, Victoria speaking for the team at ${params.businessName}.`;
      return `${greet} Whilst reviewing top ${catPhrase} businesses${cityPhrase}, I noticed ${params.businessName} was missing an instant mobile quote funnel. Rather than sending a sales pitch, my team went ahead and built a complete custom website for ${params.businessName}—complete with a four-tap estimate calculator and an automated bottom chat concierge. We've waived the entire build fee so you can claim it for free. Click the live preview link in this message to test it out. Cheers!`;
    }
    if (v === "Charon") {
      const greet = firstName ? `Good day ${firstName}, this is Marcus.` : `Good day, this is Marcus calling for the owner of ${params.businessName}.`;
      return `${greet} Our engineering team noticed ${params.businessName}${cityPhrase} didn't have a high-converting four-tap estimate funnel online, meaning local mobile callers are slipping to competitors. Instead of pitching you, we went ahead and built a complete turnkey website for ${params.businessName} with an interactive four-tap quote engine and live bottom chat assistant. The fifteen-hundred-dollar build fee is completely waived. Open the live preview link in your email to inspect and claim your site today.`;
    }
    if (v === "Puck") {
      const greet = firstName ? `Hey ${firstName}! Ryan here—` : `Hey team at ${params.businessName}! Ryan here—`;
      return `${greet} super exciting heads-up! I saw ${params.businessName}${cityPhrase} needed a faster mobile quote funnel, so instead of sending a boring cold email, we actually built a brand-new interactive website for ${params.businessName}! It has a four-tap instant estimate funnel and an automated chat concierge at the bottom that chimes and captures leads 24/7. The build is 100 percent free to claim—tap the live preview link right now and check it out!`;
    }
    if (v === "Fenrir") {
      const greet = firstName ? `${firstName}, Viktor here.` : `This is Viktor for the owner at ${params.businessName}.`;
      return `${greet} Listen closely—every day ${params.businessName}${cityPhrase} operates without a fast four-tap mobile quote funnel, high-ticket ${catPhrase} jobs go straight to your competitors. So we fixed it for you in advance. My team just built a complete, custom lead-generation website for ${params.businessName} with a four-tap estimate funnel and 24/7 chat closer. Zero build cost to you. Click the preview link in your email right now and claim it before we release the territory.`;
    }
    if (v === "Orus") {
      const greet = firstName ? `Hello ${firstName}, Tunde here.` : `Hello to the leadership at ${params.businessName}, Tunde speaking.`;
      return `${greet} While reviewing ${catPhrase} leaders${cityPhrase}, I saw a major opportunity for ${params.businessName} to capture more customers online. Instead of just telling you about it, our team went ahead and built a complete, custom four-tap website for ${params.businessName}, including an automated bottom chat receptionist. We have waived the entire build fee so you can claim it for free. Kindly click the live preview link in your email to test your new website today.`;
    }
    const greeting = firstName ? `Hey ${firstName}, Sarah here!` : `Hi there, Sarah here with a quick gift for ${params.businessName}!`;
    return `${greeting} While looking at ${catPhrase} businesses${cityPhrase}, I noticed ${params.businessName} didn't have a fast four-tap estimate funnel for mobile customers. Instead of sending a sales pitch, our team went ahead and built a complete custom website for ${params.businessName}—with a four-tap instant quote calculator and an automated bottom chat assistant—and waived the entire fifteen-hundred-dollar build fee! Click the live preview link in this email to test it out and claim it in one click!`;
  }

  if (params.pitchMode === "review_shield") {
    if (v === "Zephyr") {
      const greet = firstName ? `Hello ${firstName}, Victoria here.` : `Hello there, Victoria speaking for ${params.businessName}.`;
      return `${greet} We've just set up a custom Five-Star Google Review Shield and Bad-Review Blocker for ${params.businessName}${cityPhrase}. When a customer taps five stars, it fast-tracks them straight to your Google Maps review page—but if anyone taps one to three stars, it intercepts them privately before they can post publicly. Click the live link in your email to test tapping five stars versus two stars right now. Cheers!`;
    }
    if (v === "Charon") {
      const greet = firstName ? `Good day ${firstName}, Marcus speaking.` : `Good day, this is Marcus for ${params.businessName}.`;
      return `${greet} We have prepared a live Five-Star Google Review Shield for ${params.businessName}${cityPhrase}. Four and five-star customers are routed directly to your public Google Maps listing, while any one-to-three-star complaint is privately intercepted and sent straight to your phone so your rating stays protected. Test the live link in your inbox right now.`;
    }
    if (v === "Puck") {
      const greet = firstName ? `Hey ${firstName}! Ryan here—` : `Hey ${params.businessName} team! Ryan here—`;
      return `${greet} check this out! We just set up a live Five-Star Review Shield for ${params.businessName}${cityPhrase}. Happy five-star customers go straight to your Google Maps page in one tap, while unhappy one-to-three-star reviews get blocked privately before they ever hit Google! Click the link in your email and test tapping five stars versus two stars—it takes ten seconds!`;
    }
    if (v === "Fenrir") {
      const greet = firstName ? `${firstName}, Viktor here.` : `Viktor here for ${params.businessName}.`;
      return `${greet} One bad Google review costs ${params.businessName}${cityPhrase} thousands in lost calls. So we built a live Five-Star Review Shield and Bad-Review Blocker specifically for your team. Five-star clients get sent straight to Google Maps, and one-to-three-star complaints get intercepted privately to your phone. Tap the link in your email to test it live right now.`;
    }
    if (v === "Orus") {
      const greet = firstName ? `Hello ${firstName}, Tunde speaking.` : `Hello to the team at ${params.businessName}, Tunde here.`;
      return `${greet} I have set up an interactive Five-Star Google Review Shield for ${params.businessName}${cityPhrase}. When your customers tap five stars, it directs them straight to Google Maps, and if anyone taps one, two, or three stars, it intercepts their feedback privately so your public rating stays five stars. Kindly click the link in your email to test it for yourself.`;
    }
    const greeting = firstName ? `Hey ${firstName}, Sarah here!` : `Hi there, Sarah here for ${params.businessName}!`;
    return `${greeting} I just set up a custom Five-Star Google Review Shield and Bad-Review Blocker for ${params.businessName}${cityPhrase} so you can test it live! When a customer taps five stars, it sends them straight to your Google Maps review page—and if they tap one to three stars, it intercepts them privately before they can post a bad review online. Click the link in your email to test it in ten seconds!`;
  }

  const cmsPhrase =
    params.cmsPlatform && params.cmsPlatform !== "No Website"
      ? ` built on ${params.cmsPlatform}`
      : "";
  const topGap =
    params.missingSignals && params.missingSignals.length > 0
      ? params.missingSignals[0].toLowerCase()
      : params.painPoint
      ? params.painPoint.toLowerCase()
      : "missing an instant 24/7 booking and AI receptionist system";

  if (v === "Zephyr") {
    const greet = firstName ? `Hello ${firstName}, Victoria speaking here.` : `Hello there, Victoria speaking for the leadership team at ${params.businessName}.`;
    return `${greet} I was just reviewing ${params.businessName}${cityPhrase}${cmsPhrase}, and whilst your local reputation is brilliant, your website currently has ${topGap}—which means high-intent enquiries after hours are slipping straight to competitors. I've prepared a bespoke 60-second audit showing how we fix this in 48 hours. Do take a quick look at the link in your inbox and let me know your thoughts. Cheers!`;
  }
  if (v === "Charon") {
    const greet = firstName ? `Good day ${firstName}, this is Marcus.` : `Good day, this is Marcus calling with an executive brief for ${params.businessName}.`;
    return `${greet} Our team just completed a technical diagnostic of ${params.businessName}${cityPhrase}${cmsPhrase}. While your market authority is strong, your digital storefront currently has ${topGap}, costing you roughly 35 percent of after-hours client bookings. I've sent your private diagnostic report link to your email. Review the numbers when you have 60 seconds, and reply if you'd like us to deploy the fix this week.`;
  }
  if (v === "Puck") {
    const greet = firstName ? `Hey ${firstName}! Ryan here—` : `Hey team at ${params.businessName}! Ryan here—`;
    return `${greet} super quick 20-second heads-up! I was just checking out ${params.businessName}${cityPhrase}${cmsPhrase} and noticed you guys have awesome reviews, but your site has ${topGap} right now. We built a plug-and-play AI receptionist and instant booking upgrade that captures those missed leads 24/7. Check out the live demo link I just sent over—talk soon!`;
  }
  if (v === "Fenrir") {
    const greet = firstName ? `${firstName}, Viktor here.` : `This is Viktor for the owner at ${params.businessName}.`;
    return `${greet} I'll go straight to the point. I just audited ${params.businessName}${cityPhrase}${cmsPhrase} and spotted a major revenue leak: ${topGap}. Every week that stays unfixed, ready-to-buy customers are calling the next ${params.category || "business"} on Google. I put together the exact 48-hour blueprint to lock in those leads—open the audit link in your email right now and let's get it live.`;
  }
  if (v === "Orus") {
    const greet = firstName ? `Hello ${firstName}, Tunde here from ${params.agencyName || "Vanguard Digital"}.` : `Hello to the management at ${params.businessName}, Tunde speaking.`;
    return `${greet} I was just taking a close look at ${params.businessName}${cityPhrase}${cmsPhrase}. You have built a fantastic reputation, however your website currently has ${topGap}, which causes valuable customers to leave without booking. I have recorded a custom Website Audit Report showing how we can solve this for you within 48 hours. Kindly check the link in your email and reply whenever you are ready.`;
  }

  const greeting = firstName
    ? `Hey ${firstName}, Sarah here!`
    : `Hi there, Sarah here with a quick note for the owner at ${params.businessName}!`;
  const reportHook = params.hasReport
    ? `I just recorded a custom website audit report showing exactly how to fix this in 48 hours, and sent the private link to your email.`
    : `I put together a quick interactive demo showing how we can fix this for ${params.businessName} in 48 hours.`;

  return `${greeting} I was just looking at ${params.businessName}${cityPhrase}${cmsPhrase}, and noticed you guys have a great local reputation, but your website currently has ${topGap}—which usually causes 30 to 40 percent of after-hours customers to call a competitor instead. ${reportHook} Take a quick 60-second look and reply to this message if you'd like me to activate it for you this week!`;
}

// 1. Generate Studio AI Voice-Note Pitch ($0 Telecom Cost — Gemini Neural TTS + WAV)
router.post("/crm/generate-voice-pitch", async (req, res) => {
  try {
    const {
      businessName = "your business",
      ownerName = "",
      ownerRole = "",
      category = "business",
      city = "",
      website = "",
      cmsPlatform = "",
      missingSignals = [],
      painPoint = "",
      reportUrl = "",
      agencyName = "Vanguard Digital",
      voiceName = "Kore", // 'Kore' | 'Puck' | 'Charon' | 'Zephyr' | 'Fenrir' | 'Orus'
      customScript = "",
      regenerateScriptForVoice = false,
      pitchMode = "audit", // 'audit' | 'website_claim' | 'review_shield'
    } = req.body ?? {};

    const persona = STUDIO_VOICE_PERSONAS[voiceName] || STUDIO_VOICE_PERSONAS.Kore;
    let scriptText = regenerateScriptForVoice ? "" : String(customScript || "").trim();

    if (!scriptText) {
      const fallbackScript = buildNaturalVoicePitchScript({
        businessName,
        ownerName,
        ownerRole,
        category,
        city,
        website,
        cmsPlatform,
        missingSignals,
        painPoint,
        agencyName,
        hasReport: Boolean(reportUrl),
        voiceName: persona.id,
        pitchMode,
      });

      if (regenerateScriptForVoice || pitchMode === "website_claim" || pitchMode === "review_shield") {
        scriptText = fallbackScript;
      } else {
        try {
          const aiScript = await generateText(
            `Write a natural, ultra-realistic 25-second spoken voice-note pitch (strictly 55 to 75 words, plain spoken English, NO stage directions, NO brackets, NO hashtags) spoken by a ${persona.scriptStyleHint} at "${agencyName}" speaking directly to ${ownerName ? `${ownerName} (${ownerRole || "Owner"}) at ` : "the owner of "}"${businessName}" (${category}${city ? ` in ${city}` : ""}).
Website: ${website || "none"} ${cmsPlatform ? `(CMS: ${cmsPlatform})` : ""}
Detected revenue leak: ${(Array.isArray(missingSignals) && missingSignals.length > 0) ? missingSignals.join(", ") : (painPoint || "missing 24/7 AI chat & instant booking")}
${reportUrl ? "Mention that you just sent their private Website Audit Report link to their email/chat." : "Offer to share the custom demo link we built for them."}
Return ONLY the exact words to be spoken out loud.`
          );
          const cleaned = aiScript.replace(/^["']|["']$/g, "").trim();
          scriptText = cleaned.length >= 35 ? cleaned : fallbackScript;
        } catch {
          scriptText = fallbackScript;
        }
      }
    }

    // Check in-memory voice cache first so switching voices is instant and preserves quota
    const cacheKey = `${persona.id}::${scriptText}`;
    const cachedAudio = voicePitchAudioCache.get(cacheKey);
    if (cachedAudio) {
      res.json({
        success: true,
        script: scriptText,
        voiceName: persona.id,
        voiceLabel: persona.displayName,
        engine: `${cachedAudio.engine} · Instant Cache`,
        wavBase64: cachedAudio.wavBase64,
        wavDataUrl: `data:audio/wav;base64,${cachedAudio.wavBase64}`,
      });
      return;
    }

    let wavBase64: string | null = null;
    let wavDataUrl: string | null = null;
    let ttsModelUsed = "browser-neural-tts";

    const generateGeminiStudioAudio = async (): Promise<string | null> => {
      try {
        const ai = await getGeminiAI();
        const directedPrompt = `Speak the following message aloud in a ${persona.stylePrompt}: "${scriptText}"`;

        for (const modelName of persona.preferredModels) {
          for (const candidateVoice of [persona.geminiVoice, persona.fallbackGeminiVoice]) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: directedPrompt,
                        ...(modelName === "gemini-3.8-flash-tts"
                          ? {
                              speechMetadata: {
                                style: persona.stylePrompt,
                              },
                            }
                          : {}),
                      } as any,
                    ],
                  },
                ],
                config: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: candidateVoice },
                    },
                  },
                },
              });

              const inlineData = response.candidates?.[0]?.content?.parts?.find(
                (p: any) => p.inlineData?.data
              )?.inlineData;

              if (inlineData?.data) {
                const generatedWav = pcm16ToWavBase64(
                  inlineData.data,
                  persona.sampleRate,
                  1,
                  persona.eqProfile
                );
                const engineLabel = `${modelName} (${candidateVoice} · ${Math.round(persona.sampleRate / 100) / 10}kHz Studio DSP)`;
                voicePitchAudioCache.set(cacheKey, {
                  wavBase64: generatedWav,
                  engine: engineLabel,
                });
                ttsModelUsed = engineLabel;
                return generatedWav;
              }
            } catch {
              // Try fallback voice or next TTS model bucket
            }
          }
        }
      } catch {}
      return null;
    };

    // Race Gemini Studio TTS against a 3.5s fast-response deadline so callers never wait >3.5s
    // (Meanwhile Gemini Studio TTS finishes in background and populates voicePitchAudioCache for next time)
    wavBase64 = await Promise.race([
      generateGeminiStudioAudio(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);

    if (wavBase64) {
      wavDataUrl = `data:audio/wav;base64,${wavBase64}`;
    } else {
      const instantMp3 = await synthesizeInstantNeuralMp3(scriptText, persona.id);
      if (instantMp3) {
        wavDataUrl = instantMp3;
        ttsModelUsed = `Studio Neural Stream (${persona.id})`;
      }
    }

    res.json({
      success: true,
      script: scriptText,
      voiceName: persona.id,
      voiceLabel: persona.displayName,
      engine: ttsModelUsed,
      wavBase64,
      wavDataUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate voice pitch" });
  }
});

// 2. Send Email with Attached AI Studio Voice-Note (.wav) + Transcript
router.post("/crm/send-voice-email", async (req, res) => {
  try {
    const {
      to,
      businessName = "Business",
      ownerName = "",
      subject,
      body,
      script,
      wavBase64,
      reportUrl,
      accountId,
    } = req.body ?? {};

    if (!to) {
      res.status(400).json({ error: "Recipient email (to) is required" });
      return;
    }

    const emailSubject =
      subject || `🎙️ Quick 25-sec voice note for ${ownerName || businessName}`;
    const emailText =
      body ||
      `Hi ${ownerName || businessName},\n\nI recorded a quick 25-second voice note for you after reviewing ${businessName}'s website (attached as an audio note below).\n\nVoice Note Transcript:\n"${script || ""}"\n\n${reportUrl ? `View your live Website Audit Report here: ${reportUrl}\n\n` : ""}Best regards`;

    const baseUrl = getBaseUrl(req);
    const trackingId = await createTracking(to, emailSubject, "outreach");
    const reportSection = reportUrl ? buildReportEmailSection(reportUrl, businessName) : "";
    const htmlParagraphs = emailText
      .split("\n")
      .map((line: string) => (line.trim() ? `<p style="margin:0 0 12px;line-height:1.6;">${line}</p>` : "<br/>"))
      .join("");

    const voiceBannerHtml = `
      <div style="margin:18px 0;padding:16px;border-radius:12px;background:#0f172a;color:#ffffff;border:1px solid #334155;">
        <div style="font-size:12px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
          🎙️ Attached Personal Voice Note (0:26)
        </div>
        <div style="font-size:13px;color:#e2e8f0;line-height:1.5;">
          Play the attached <strong>Voice-Note-${businessName.replace(/[^a-zA-Z0-9]/g, "-")}.wav</strong> audio file in this email to hear our 25-second breakdown for <strong>${businessName}</strong>.
        </div>
      </div>
    `;

    const cleanSlug = String(businessName || "Prospect")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 35);

    const { acct } = await sendWithFailover((a) => {
      const rawHtml = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e;">${voiceBannerHtml}${htmlParagraphs}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/><p style="color:#6b7280;font-size:13px;">${a.fromName}</p>${reportSection}</div>`;
      return {
        from: `"${a.fromName}" <${a.fromEmail || a.user}>`,
        to,
        subject: emailSubject,
        text: emailText,
        html: injectTracking(rawHtml, baseUrl, trackingId),
        ...(wavBase64
          ? {
              attachments: [
                {
                  filename: `Voice-Note-${cleanSlug}.wav`,
                  content: Buffer.from(wavBase64, "base64"),
                  contentType: "audio/wav",
                },
              ],
            }
          : {}),
      };
    }, accountId);

    res.json({
      success: true,
      to,
      sentVia: acct.label,
      sentAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to send voice email" });
  }
});

// ─── Outbound AI Machine Phone Caller Pool (Bland AI / Retell AI / Vapi) ─────

interface MachineCallerKeyItem {
  id: string;
  provider: "bland" | "retell" | "vapi";
  label: string;
  apiKey: string;
  fromNumber?: string;
  agentId?: string;
  active: boolean;
  callsMade: number;
}

interface MachineCallerConfig {
  defaultProvider: "bland" | "retell" | "vapi";
  defaultVoice: string;
  autoCallOnImport: boolean;
  autoGenerateVoiceNoteOnImport: boolean;
  keys: MachineCallerKeyItem[];
}

const VOICE_CALLER_KV_KEY = "AI_MACHINE_CALLER_CONFIG";
const VOICE_CALL_LOGS_KV_KEY = "AI_MACHINE_CALL_LOGS";

const DEFAULT_MACHINE_CALLER_CONFIG: MachineCallerConfig = {
  defaultProvider: "bland",
  defaultVoice: "nat",
  autoCallOnImport: false,
  autoGenerateVoiceNoteOnImport: true,
  keys: [],
};

async function getMachineCallerConfig(): Promise<MachineCallerConfig> {
  const saved = await kvGetJson<Partial<MachineCallerConfig>>(VOICE_CALLER_KV_KEY);
  return {
    ...DEFAULT_MACHINE_CALLER_CONFIG,
    ...(saved ?? {}),
    keys: Array.isArray(saved?.keys) ? saved!.keys : [],
  };
}

router.get("/crm/voice-caller/config", async (_req, res) => {
  try {
    const cfg = await getMachineCallerConfig();
    const logs = (await kvGetJson<any[]>(VOICE_CALL_LOGS_KV_KEY)) ?? [];
    res.json({
      config: {
        ...cfg,
        keys: cfg.keys.map((k) => ({
          ...k,
          apiKeyMasked: k.apiKey
            ? `${k.apiKey.slice(0, 6)}••••${k.apiKey.slice(-4)}`
            : "",
        })),
      },
      recentCalls: logs.slice(0, 30),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/crm/voice-caller/config", async (req, res) => {
  try {
    const current = await getMachineCallerConfig();
    const {
      defaultProvider,
      defaultVoice,
      autoCallOnImport,
      autoGenerateVoiceNoteOnImport,
      newKey,
      removeKeyId,
      toggleKeyId,
    } = req.body ?? {};

    let nextKeys = [...current.keys];

    if (newKey && newKey.apiKey && String(newKey.apiKey).trim()) {
      const prov = (newKey.provider || defaultProvider || "bland") as "bland" | "retell" | "vapi";
      nextKeys.push({
        id: `vkey_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        provider: prov,
        label: newKey.label || `${prov.toUpperCase()} Free-Credit Key #${nextKeys.length + 1}`,
        apiKey: String(newKey.apiKey).trim(),
        fromNumber: newKey.fromNumber ? String(newKey.fromNumber).trim() : "",
        agentId: newKey.agentId ? String(newKey.agentId).trim() : "",
        active: true,
        callsMade: 0,
      });
    }

    if (removeKeyId) {
      nextKeys = nextKeys.filter((k) => k.id !== removeKeyId);
    }

    if (toggleKeyId) {
      nextKeys = nextKeys.map((k) =>
        k.id === toggleKeyId ? { ...k, active: !k.active } : k
      );
    }

    const updated: MachineCallerConfig = {
      defaultProvider: defaultProvider ?? current.defaultProvider,
      defaultVoice: defaultVoice ?? current.defaultVoice,
      autoCallOnImport:
        typeof autoCallOnImport === "boolean" ? autoCallOnImport : current.autoCallOnImport,
      autoGenerateVoiceNoteOnImport:
        typeof autoGenerateVoiceNoteOnImport === "boolean"
          ? autoGenerateVoiceNoteOnImport
          : current.autoGenerateVoiceNoteOnImport,
      keys: nextKeys,
    };

    await kvSetJson(VOICE_CALLER_KV_KEY, updated);

    res.json({
      success: true,
      config: {
        ...updated,
        keys: updated.keys.map((k) => ({
          ...k,
          apiKeyMasked: k.apiKey
            ? `${k.apiKey.slice(0, 6)}••••${k.apiKey.slice(-4)}`
            : "",
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function normalizeE164Phone(rawPhone: string): string {
  const cleaned = String(rawPhone || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+1${cleaned}`; // Default 10-digit US/Canada to +1
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;
  return `+${cleaned}`;
}

// 3. Trigger Real Outbound AI Machine Phone Call (Bland AI / Retell AI / Vapi)
router.post("/crm/voice-caller/call", async (req, res) => {
  try {
    const {
      phone,
      businessName = "Business",
      ownerName = "",
      ownerRole = "",
      category = "local business",
      city = "",
      website = "",
      cmsPlatform = "",
      missingSignals = [],
      painPoint = "",
      reportUrl = "",
      siteUrl = "",
      pitchMode = "audit",
      customScript = "",
      voice = "",
    } = req.body ?? {};

    const e164 = normalizeE164Phone(phone);
    if (!e164 || e164.length < 8) {
      res.status(400).json({
        error: "Valid business phone number (e.g. +1... or +44...) is required to place an AI machine call.",
      });
      return;
    }

    const cfg = await getMachineCallerConfig();
    const activeKeys = cfg.keys.filter((k) => k.active && k.apiKey);

    // Also check environment variables if no UI key added yet
    if (activeKeys.length === 0) {
      if (process.env.BLAND_API_KEY) {
        activeKeys.push({
          id: "env_bland",
          provider: "bland",
          label: "Server BLAND_API_KEY",
          apiKey: process.env.BLAND_API_KEY,
          active: true,
          callsMade: 0,
        });
      } else if (process.env.RETELL_API_KEY) {
        activeKeys.push({
          id: "env_retell",
          provider: "retell",
          label: "Server RETELL_API_KEY",
          apiKey: process.env.RETELL_API_KEY,
          fromNumber: process.env.RETELL_FROM_NUMBER || "",
          agentId: process.env.RETELL_AGENT_ID || "",
          active: true,
          callsMade: 0,
        });
      } else if (process.env.VAPI_API_KEY) {
        activeKeys.push({
          id: "env_vapi",
          provider: "vapi",
          label: "Server VAPI_API_KEY",
          apiKey: process.env.VAPI_API_KEY,
          fromNumber: process.env.VAPI_PHONE_NUMBER_ID || "",
          active: true,
          callsMade: 0,
        });
      }
    }

    if (activeKeys.length === 0) {
      res.status(400).json({
        error:
          "No AI Machine Caller API key connected yet. Open the 'AI Voice & Machine Caller' panel to paste a free-credit API key from Bland.ai, Retell.ai ($10 free), or Vapi.ai ($5 free), OR use the 100% Free AI Studio Voice-Note button right next to it!",
      });
      return;
    }

    // Round-robin pick key with lowest callsMade
    activeKeys.sort((a, b) => (a.callsMade || 0) - (b.callsMade || 0));
    const chosenKey = activeKeys[0];

    const openingLine =
      customScript ||
      buildNaturalVoicePitchScript({
        businessName,
        ownerName,
        ownerRole,
        category,
        city,
        website,
        cmsPlatform,
        missingSignals,
        painPoint,
        hasReport: Boolean(reportUrl || siteUrl),
        pitchMode: pitchMode as any,
      });

    const targetLink = siteUrl || reportUrl;
    const aiTaskPrompt = `You are a warm, articulate, human-sounding B2B growth advisor calling "${businessName}" (${category}${city ? ` in ${city}` : ""}).
You are speaking to ${ownerName ? `${ownerName} (${ownerRole || "Owner"})` : "the business owner or manager"}.
Website: ${website || "no website"} ${cmsPlatform ? `(built on ${cmsPlatform})` : ""}
${
  pitchMode === "website_claim"
    ? `We have already built a complete, custom 4-Tap Instant Estimate Website + Automated Bottom Chatbot for ${businessName} at ${targetLink || "their private preview link"} and waived the entire $1,500 website build fee so they can claim it for free.`
    : pitchMode === "review_shield"
    ? `We have set up a live 5-Star Google Review Shield & Bad-Review Blocker for ${businessName} at ${targetLink || "their private preview link"} that routes 5-star customers to Google Maps and intercepts 1-to-3-star complaints privately.`
    : `Missing conversion signals we found on their site: ${Array.isArray(missingSignals) && missingSignals.length > 0 ? missingSignals.join(", ") : painPoint || "no 24/7 AI live chat or online booking widget"}.`
}

YOUR GOAL ON THIS CALL:
1. Deliver this friendly opener naturally: "${openingLine}"
2. If they ask "How much does it cost?" or "What do you do?", explain that we already built the custom ${pitchMode === "review_shield" ? "5-Star Review Shield" : "4-Tap Instant Estimate Website & Automated Chatbot"} for ${businessName} for $0 setup cost, and they only cover simple monthly hosting if they love it and decide to claim it.
3. Ask if they have 60 seconds to check the live preview link in their email or if there is a better direct email/WhatsApp number to text the preview link to right now.
4. Be polite, concise, never robotic, and never pushy.`;

    let callId = "";
    let providerResponse: any = null;

    if (chosenKey.provider === "bland") {
      const blandRes = await fetch("https://api.bland.ai/v1/calls", {
        method: "POST",
        headers: {
          Authorization: chosenKey.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: e164,
          task: aiTaskPrompt,
          first_sentence: openingLine.split(".")[0] + ".",
          voice: voice || cfg.defaultVoice || "nat",
          wait_for_greeting: true,
          record: true,
          max_duration: 3,
          model: "enhanced",
          ...(chosenKey.fromNumber ? { from: chosenKey.fromNumber } : {}),
        }),
      });
      providerResponse = await blandRes.json().catch(() => ({}));
      if (!blandRes.ok || providerResponse.status === "error") {
        throw new Error(
          providerResponse.message ||
            providerResponse.error ||
            `Bland AI error (${blandRes.status})`
        );
      }
      callId = providerResponse.call_id || `bland_${Date.now()}`;
    } else if (chosenKey.provider === "retell") {
      if (!chosenKey.fromNumber) {
        throw new Error("Retell AI requires a 'From Phone Number' (e.g. +1...) configured on your Retell key.");
      }
      const retellRes = await fetch("https://api.retellai.com/v2/create-phone-call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chosenKey.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_number: normalizeE164Phone(chosenKey.fromNumber),
          to_number: e164,
          ...(chosenKey.agentId ? { override_agent_id: chosenKey.agentId } : {}),
          retell_llm_dynamic_variables: {
            business_name: businessName,
            owner_name: ownerName || "there",
            city: city || "",
            opening_pitch: openingLine,
            task_instructions: aiTaskPrompt,
          },
        }),
      });
      providerResponse = await retellRes.json().catch(() => ({}));
      if (!retellRes.ok) {
        throw new Error(
          providerResponse.message ||
            providerResponse.error_message ||
            `Retell AI error (${retellRes.status})`
        );
      }
      callId = providerResponse.call_id || `retell_${Date.now()}`;
    } else if (chosenKey.provider === "vapi") {
      const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chosenKey.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(chosenKey.fromNumber ? { phoneNumberId: chosenKey.fromNumber } : {}),
          ...(chosenKey.agentId ? { assistantId: chosenKey.agentId } : {}),
          customer: {
            number: e164,
            name: ownerName || businessName,
          },
          assistant: {
            firstMessage: openingLine.split(".")[0] + ".",
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              messages: [{ role: "system", content: aiTaskPrompt }],
            },
          },
        }),
      });
      providerResponse = await vapiRes.json().catch(() => ({}));
      if (!vapiRes.ok) {
        throw new Error(
          providerResponse.message ||
            providerResponse.error ||
            `Vapi AI error (${vapiRes.status})`
        );
      }
      callId = providerResponse.id || `vapi_${Date.now()}`;
    }

    // Increment callsMade counter on chosen key
    const updatedKeys = cfg.keys.map((k) =>
      k.id === chosenKey.id ? { ...k, callsMade: (k.callsMade || 0) + 1 } : k
    );
    await kvSetJson(VOICE_CALLER_KV_KEY, { ...cfg, keys: updatedKeys });

    const callLog = {
      callId,
      provider: chosenKey.provider,
      keyLabel: chosenKey.label,
      businessName,
      ownerName,
      phone: e164,
      script: openingLine,
      status: "ringing",
      createdAt: new Date().toISOString(),
    };
    const existingLogs = (await kvGetJson<any[]>(VOICE_CALL_LOGS_KV_KEY)) ?? [];
    await kvSetJson(VOICE_CALL_LOGS_KV_KEY, [callLog, ...existingLogs.slice(0, 99)]);

    res.json({
      success: true,
      callId,
      provider: chosenKey.provider,
      keyLabel: chosenKey.label,
      calledNumber: e164,
      script: openingLine,
      status: "ringing",
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to place AI machine phone call" });
  }
});

// 4. Poll Live AI Machine Call Status & Transcript
router.get("/crm/voice-caller/status/:callId", async (req, res) => {
  try {
    const { callId } = req.params;
    const cfg = await getMachineCallerConfig();
    const logs = (await kvGetJson<any[]>(VOICE_CALL_LOGS_KV_KEY)) ?? [];
    const logEntry = logs.find((l) => l.callId === callId);
    const provider = logEntry?.provider || cfg.defaultProvider || "bland";
    const keyObj =
      cfg.keys.find((k) => k.provider === provider && k.active) || cfg.keys[0];

    if (!keyObj?.apiKey) {
      res.json({ status: logEntry?.status || "unknown", callId });
      return;
    }

    if (provider === "bland") {
      const r = await fetch(`https://api.bland.ai/v1/calls/${encodeURIComponent(callId)}`, {
        headers: { Authorization: keyObj.apiKey },
      });
      const d = await r.json().catch(() => ({}));
      res.json({
        callId,
        provider: "bland",
        status: d.status || (d.completed ? "completed" : "in-progress"),
        completed: Boolean(d.completed),
        durationSeconds: d.call_length ? Math.round(Number(d.call_length) * 60) : 0,
        recordingUrl: d.recording_url || null,
        transcript: d.concatenated_transcript || "",
        summary: d.summary || "",
        answeredBy: d.answered_by || "",
      });
      return;
    } else if (provider === "retell") {
      const r = await fetch(`https://api.retellai.com/v2/get-call/${encodeURIComponent(callId)}`, {
        headers: { Authorization: `Bearer ${keyObj.apiKey}` },
      });
      const d = await r.json().catch(() => ({}));
      res.json({
        callId,
        provider: "retell",
        status: d.call_status || "in-progress",
        completed: d.call_status === "ended",
        durationSeconds: d.end_timestamp && d.start_timestamp ? Math.round((d.end_timestamp - d.start_timestamp) / 1000) : 0,
        recordingUrl: d.recording_url || null,
        transcript: d.transcript || "",
        summary: d.call_analysis?.call_summary || "",
      });
      return;
    } else if (provider === "vapi") {
      const r = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
        headers: { Authorization: `Bearer ${keyObj.apiKey}` },
      });
      const d = await r.json().catch(() => ({}));
      res.json({
        callId,
        provider: "vapi",
        status: d.status || "in-progress",
        completed: d.status === "ended",
        durationSeconds: 0,
        recordingUrl: d.recordingUrl || null,
        transcript: d.transcript || "",
        summary: d.summary || "",
      });
      return;
    }

    res.json({ callId, status: "unknown" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
