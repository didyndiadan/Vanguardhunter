import type { Request } from "express";
import { db, siteConfigTable, saasUsersTable, userActivitiesTable } from "../../db";
import { eq } from "drizzle-orm";
import { kvGetJson, kvSetJson } from "./replit-kv";

export interface TrainedServiceOffer {
  id: string;
  name: string;
  description: string;
  targetSignals: string;
}

export interface AiTrainingProfile {
  userId?: number | null;
  senderName: string;
  businessName: string;
  websiteUrl: string;
  senderEmail: string;
  servicesOffered: TrainedServiceOffer[];
  offerDetails: string;
  targetPainPoints: string;
  staticEmailExample: string;
  subjectLineGuide: string;
  aiInstructions: string;
  tone: "conversational" | "direct" | "friendly" | "analytical";
  callToAction: string;
  includeAuditReportLink: boolean;
  isTrained: boolean;
  updatedAt: string;
}

const KV_ACTIVE_KEY = "AI_TRAINING_PROFILE_ACTIVE";

function userConfigKey(userId: number): string {
  return `AI_TRAINING_PROFILE_USER_${userId}`;
}

export const DEFAULT_SERVICES_OFFERED: TrainedServiceOffer[] = [
  {
    id: "offer_1",
    name: "High-Converting Website Design & Redesign",
    description:
      "Modern, mobile-first website design with fast load speeds, clear service pages, and instant quote/contact capture.",
    targetSignals:
      "Pitch when the business has no website, an outdated/slow website, poor mobile layout, or weak conversion flow.",
  },
  {
    id: "offer_2",
    name: "24/7 AI Receptionist & Automated Booking System",
    description:
      "AI voice and chat receptionist that answers missed calls, replies to customer inquiries 24/7, and books appointments automatically.",
    targetSignals:
      "Pitch when the business relies on phone calls or appointments, lacks online booking/live chat, or misses after-hours leads.",
  },
  {
    id: "offer_3",
    name: "Local SEO & Google Maps Lead Generation",
    description:
      "Google Business Profile and local search optimization to rank in the top local spots and bring steady monthly customers.",
    targetSignals:
      "Pitch when the business has low local search visibility, weak SEO fundamentals, or strong local competitors.",
  },
];

export function getDefaultTrainingProfile(user?: {
  id?: number;
  fullName?: string;
  companyName?: string;
  email?: string;
} | null): AiTrainingProfile {
  const senderName = user?.fullName?.trim() || "Alex Morgan";
  const businessName = user?.companyName?.trim() || "Apex Digital Growth";
  const senderEmail = user?.email?.trim() || "";

  return {
    userId: user?.id ?? null,
    senderName,
    businessName,
    websiteUrl: "",
    senderEmail,
    servicesOffered: DEFAULT_SERVICES_OFFERED,
    offerDetails:
      "We help local and B2B businesses capture more high-intent customers through modern conversion-focused websites, 24/7 AI receptionists & automated online booking systems, and local SEO growth.",
    targetPainPoints:
      "Outdated or slow website, missing online booking or instant quote forms, unanswered customer calls/messages, and losing local search traffic to competitors.",
    staticEmailExample: `Hi {{BusinessName}} Team,

I was looking at {{BusinessName}} in {{City}} today and noticed a couple of quick areas where potential customers might be slipping through the cracks—especially around {{MatchedOffer}}.

At ${businessName}, we help ${"{{Category}}"} businesses turn more of their local traffic into booked clients without adding extra admin work for your team.

If you're open to it, I'd love to share 2–3 specific ideas tailored to {{BusinessName}}. Just reply to this email and I'll send them right over.

Best regards,
${senderName}
${businessName}`,
    subjectLineGuide: "Quick idea for {{BusinessName}} in {{City}}",
    aiInstructions:
      "Analyze each scraped business (their website, category, and pain points) against the list of multiple Offers/Services I provide. Select the 1–2 offers from my list that best solve their biggest gap, focus the analysis and email pitch on those matching offers, follow my static email message structure, keep it under 160 words, and sign off with my name and business name.",
    tone: "conversational",
    callToAction: "If this sounds relevant, just reply to this email and I'll share the details.",
    includeAuditReportLink: true,
    isTrained: false,
    updatedAt: new Date().toISOString(),
  };
}

async function readSiteConfigJson<T>(key: string): Promise<T | null> {
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, key))
      .limit(1);
    if (rows[0]?.value) {
      return JSON.parse(rows[0].value) as T;
    }
  } catch {
    // fallback to KV
  }
  return await kvGetJson<T>(key);
}

async function writeSiteConfigJson<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  try {
    await db
      .insert(siteConfigTable)
      .values({ key, value: serialized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteConfigTable.key,
        set: { value: serialized, updatedAt: new Date() },
      });
  } catch {
    // ignore DB error
  }
  await kvSetJson(key, value).catch(() => {});
}

export async function resolveUserFromRequest(req?: Request): Promise<{
  id: number;
  fullName: string;
  companyName: string;
  email: string;
} | null> {
  if (!req) return null;
  if ((req as any).saasUser) {
    return (req as any).saasUser;
  }
  const auth = req.headers?.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const rows = await db
      .select()
      .from(saasUsersTable)
      .where(eq(saasUsersTable.sessionToken, token))
      .limit(1);
    if (rows[0]) {
      (req as any).saasUser = rows[0];
      return rows[0];
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getActiveTrainingProfile(req?: Request): Promise<AiTrainingProfile> {
  const user = await resolveUserFromRequest(req);
  if (user?.id) {
    const userProfile = await readSiteConfigJson<AiTrainingProfile>(userConfigKey(user.id));
    if (userProfile) {
      return {
        ...getDefaultTrainingProfile(user),
        ...userProfile,
        userId: user.id,
      };
    }
  }

  const activeGlobal = await readSiteConfigJson<AiTrainingProfile>(KV_ACTIVE_KEY);
  if (activeGlobal) {
    return {
      ...getDefaultTrainingProfile(user),
      ...activeGlobal,
      ...(user?.id ? { userId: user.id } : {}),
    };
  }

  return getDefaultTrainingProfile(user);
}

export async function saveTrainingProfile(
  input: Partial<AiTrainingProfile>,
  req?: Request
): Promise<AiTrainingProfile> {
  const user = await resolveUserFromRequest(req);
  const existing = await getActiveTrainingProfile(req);

  const normalizedServices: TrainedServiceOffer[] = Array.isArray(input.servicesOffered)
    ? input.servicesOffered
        .map((s, idx) => ({
          id: String(s?.id || `offer_${idx + 1}`).trim(),
          name: String(s?.name || "").trim(),
          description: String(s?.description || "").trim(),
          targetSignals: String(s?.targetSignals || "").trim(),
        }))
        .filter((s) => s.name.length > 0 || s.description.length > 0)
    : Array.isArray(existing.servicesOffered) && existing.servicesOffered.length > 0
    ? existing.servicesOffered
    : DEFAULT_SERVICES_OFFERED;

  const synthesizedOfferSummary =
    (input.offerDetails ?? "").trim() ||
    (normalizedServices.length > 0
      ? normalizedServices
          .map((s, idx) => `${idx + 1}. ${s.name}: ${s.description}`)
          .join(" | ")
      : existing.offerDetails);

  const merged: AiTrainingProfile = {
    userId: user?.id ?? existing.userId ?? null,
    senderName: (input.senderName ?? existing.senderName ?? user?.fullName ?? "Sender").trim(),
    businessName: (input.businessName ?? existing.businessName ?? user?.companyName ?? "Our Business").trim(),
    websiteUrl: (input.websiteUrl ?? existing.websiteUrl ?? "").trim(),
    senderEmail: (input.senderEmail ?? existing.senderEmail ?? user?.email ?? "").trim(),
    servicesOffered: normalizedServices.length > 0 ? normalizedServices : DEFAULT_SERVICES_OFFERED,
    offerDetails: synthesizedOfferSummary,
    targetPainPoints: (input.targetPainPoints ?? existing.targetPainPoints ?? "").trim(),
    staticEmailExample: (input.staticEmailExample ?? existing.staticEmailExample ?? "").trim(),
    subjectLineGuide: (input.subjectLineGuide ?? existing.subjectLineGuide ?? "").trim(),
    aiInstructions: (input.aiInstructions ?? existing.aiInstructions ?? "").trim(),
    tone: (input.tone as AiTrainingProfile["tone"]) || existing.tone || "conversational",
    callToAction: (input.callToAction ?? existing.callToAction ?? "If this sounds relevant, just reply to this email.").trim(),
    includeAuditReportLink:
      input.includeAuditReportLink !== undefined
        ? Boolean(input.includeAuditReportLink)
        : existing.includeAuditReportLink,
    isTrained: true,
    updatedAt: new Date().toISOString(),
  };

  if (user?.id) {
    await writeSiteConfigJson(userConfigKey(user.id), merged);
  }
  await writeSiteConfigJson(KV_ACTIVE_KEY, merged);

  try {
    await db.insert(userActivitiesTable).values({
      userId: user?.id ?? null,
      userEmail: user?.email ?? (merged.senderEmail || "workspace@vanguardhunter.io"),
      userName: merged.senderName || user?.fullName || "Workspace User",
      category: "email",
      action: `Trained AI Outreach Intelligence for ${merged.businessName} (${merged.servicesOffered.length} offers/services)`,
      details: `Sender: ${merged.senderName} · Services: ${merged.servicesOffered.map((s) => s.name).join(", ")} · Tone: ${merged.tone}`,
    });
  } catch {
    // non-fatal
  }

  return merged;
}

export function formatServicesCatalog(profile: AiTrainingProfile): string {
  const list =
    Array.isArray(profile.servicesOffered) && profile.servicesOffered.length > 0
      ? profile.servicesOffered
      : DEFAULT_SERVICES_OFFERED;
  return list
    .map(
      (s, i) =>
        `   [OFFER #${i + 1}] "${s.name}"\n      • What We Deliver: ${s.description || profile.offerDetails}\n      • When AI Should Select & Pitch This Offer: ${s.targetSignals || "Match when the business has a gap in this area"}`
    )
    .join("\n\n");
}

/**
 * Builds the AI Website & Business Analysis prompt block so the AI focuses its
 * audit, detected issues, growth opportunities, and recommended features specifically
 * around the user's listed multiple offers/services.
 */
export function buildTrainedAnalysisPromptBlock(
  profile: AiTrainingProfile,
  opts?: {
    targetBusinessName?: string;
    targetCategory?: string;
    targetCity?: string;
  }
): string {
  const bName = opts?.targetBusinessName || "the business";
  const cat = opts?.targetCategory || "local business";
  const city = opts?.targetCity || "their city";
  const catalogText = formatServicesCatalog(profile);

  return `
═══════════════════════════════════════════════════════════════════════════════
USER'S MULTI-OFFER / MULTI-SERVICE CATALOG (FOCUS ANALYSIS ON THESE SERVICES)
═══════════════════════════════════════════════════════════════════════════════
Agency / Company: ${profile.businessName} (Sender: ${profile.senderName})
Overall Value Proposition: ${profile.offerDetails}
${profile.targetPainPoints ? `Target Pain Points We Look For: ${profile.targetPainPoints}` : ""}

LIST OF OFFERS / SERVICES WE PROVIDE:
${catalogText}

INTELLIGENT MULTI-OFFER ANALYSIS DIRECTIVE:
1. Evaluate ${bName} (${cat}${city ? ` in ${city}` : ""}) specifically through the lens of the offers/services listed above.
2. Identify which 1 or 2 offers from our catalog best solve ${bName}'s biggest gaps right now.
3. Focus your "issues", "opportunities", "recommendedFeatures", and "summary" directly on the problems that our matching offers/services solve, so our analysis report naturally sets up our email pitch!
═══════════════════════════════════════════════════════════════════════════════
`.trim();
}

/**
 * Builds the authoritative AI training prompt block that seeds the user's
 * business identity, multi-offer catalog, static reference email template, and custom AI instructions
 * into every AI generation call (cold emails, auto-generate, WhatsApp, LinkedIn, follow-ups, automation).
 */
export function buildTrainedOutreachPromptBlock(
  profile: AiTrainingProfile,
  opts?: {
    targetBusinessName?: string;
    targetOwnerName?: string;
    targetCategory?: string;
    targetCity?: string;
    reportUrl?: string;
  }
): string {
  const bName = opts?.targetBusinessName || "the business";
  const oName = opts?.targetOwnerName || "";
  const cat = opts?.targetCategory || "local business";
  const city = opts?.targetCity || "their city";
  const catalogText = formatServicesCatalog(profile);

  // Replace template variables inside the user's static example so the AI sees how it maps
  const hydratedExample = (profile.staticEmailExample || "")
    .replace(/\{\{\s*BusinessName\s*\}\}/gi, bName)
    .replace(/\{\{\s*OwnerName\s*\}\}/gi, oName || `${bName} Team`)
    .replace(/\{\{\s*Category\s*\}\}/gi, cat)
    .replace(/\{\{\s*City\s*\}\}/gi, city)
    .replace(/\{\{\s*SenderName\s*\}\}/gi, profile.senderName)
    .replace(/\{\{\s*AgencyName\s*\}\}/gi, profile.businessName)
    .replace(/\{\{\s*CompanyName\s*\}\}/gi, profile.businessName)
    .replace(/\{\{\s*MatchedOffer\s*\}\}/gi, "[INSERT THE BEST-MATCHING OFFER/SERVICE FROM OUR LIST BELOW FOR THIS BUSINESS]");

  const hydratedSubject = (profile.subjectLineGuide || "")
    .replace(/\{\{\s*BusinessName\s*\}\}/gi, bName)
    .replace(/\{\{\s*City\s*\}\}/gi, city)
    .replace(/\{\{\s*Category\s*\}\}/gi, cat);

  const signatureLines = [
    "Best regards,",
    profile.senderName,
    profile.businessName,
    ...(profile.websiteUrl ? [profile.websiteUrl] : []),
    ...(profile.senderEmail ? [profile.senderEmail] : []),
  ].join("\n");

  const reportDirective =
    profile.includeAuditReportLink && opts?.reportUrl !== undefined
      ? opts.reportUrl
        ? `• Include this report link naturally in the body: "We put together a free personalised report for you: ${opts.reportUrl}"`
        : `• Include this placeholder line naturally in the body: "We put together a free personalised analysis for you: {{REPORT_URL}}"`
      : `• Do NOT force a website report link unless it fits naturally.`;

  return `
═══════════════════════════════════════════════════════════════════════════════
TRAINED AI INTELLIGENCE PROFILE (MULTI-OFFER & PERSONALIZED OUTREACH BRAIN)
═══════════════════════════════════════════════════════════════════════════════
1. SENDER IDENTITY:
   - Your Name (Sender): ${profile.senderName}
   - Your Business / Company Name: ${profile.businessName}
   ${profile.websiteUrl ? `- Your Website / Link: ${profile.websiteUrl}` : ""}
   ${profile.senderEmail ? `- Your Contact Email: ${profile.senderEmail}` : ""}

2. MULTIPLE OFFERS / SERVICES WE PROVIDE (INTELLIGENT OFFER SELECTION):
   Overall Offer Summary: "${profile.offerDetails}"
   ${profile.targetPainPoints ? `Target Problems We Solve: ${profile.targetPainPoints}` : ""}

   SPECIFIC OFFERS / SERVICES CATALOG:
${catalogText}

   MULTI-OFFER MATCHING RULE:
   - Inspect ${bName} (${cat} in ${city}), their website status, and their pain points.
   - Intelligently choose the 1–2 MOST RELEVANT offers/services from the catalog above for ${bName} (or weave our complementary offers together if multiple apply).
   - Focus the email pitch specifically on that best-matched offer so the message feels laser-targeted to what ${bName} actually needs!

3. USER'S STATIC REFERENCE EMAIL MESSAGE (HOW THE USER WANTS THE MESSAGE TO LOOK):
   Use the following static message from the user as your primary blueprint for structure, flow, voice, and offer positioning, while dynamically personalizing it for ${bName} (${cat} in ${city}) and inserting the best-matched offer:
   """
   ${hydratedExample}
   """

4. USER'S DIRECT INSTRUCTIONS TO AI ("WHAT TO DO"):
   """
   ${profile.aiInstructions}
   """

5. TONE, SUBJECT, CTA & SIGN-OFF RULES:
   - Preferred Tone: ${profile.tone}
   ${hydratedSubject ? `- Subject Line Style / Guide: "${hydratedSubject}"` : ""}
   - Call To Action (CTA): "${profile.callToAction}"
   ${reportDirective}
   - Every email MUST end with this exact signature:
${signatureLines}
═══════════════════════════════════════════════════════════════════════════════
`.trim();
}
