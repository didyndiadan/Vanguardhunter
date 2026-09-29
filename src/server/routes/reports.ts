import { Router } from "express";
import { randomBytes } from "crypto";
import { db, websiteReportsTable } from "../../db";
import { eq, sql, desc, and, or, isNull, isNotNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-auth";
import { resolveUserFromRequest } from "../lib/ai-training";

function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === "jwandersonar@gmail.com" || e === "admin@vanguardhunter.io";
}

function doesReportBelongToUser(
  row: typeof websiteReportsTable.$inferSelect,
  user: { id: number; email: string } | null
): boolean {
  if (!user) return false;
  const ad = (row.analysisData || {}) as any;
  if (ad._ownerUserId !== undefined && ad._ownerUserId !== null) {
    return Number(ad._ownerUserId) === user.id;
  }
  return isOwnerEmail(user.email);
}

// ─── HTML / URL sanitisation ──────────────────────────────────────────────────

/** Escape user-supplied strings before embedding in email HTML. */
function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Accept only http/https URLs; return "#" for anything else. */
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "#";
    return url;
  } catch { return "#"; }
}

const VALID_STATUSES = new Set(["active", "proposal_sent", "client_replied", "won"]);

const router = Router();

// ─── Shared helper (imported by automation.ts and crm-ai.ts) ──────────────────

/**
 * Returns the agency's public-facing base URL for report links.
 * Priority: AGENCY_URL env → request host → fallback.
 */
export function getAgencyBaseUrl(req?: { protocol: string; get: (h: string) => string | undefined }): string {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.AGENCY_URL) return process.env.AGENCY_URL.replace(/\/$/, "");
  if (req) {
    const host = req.get("host") || "";
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    return `${proto}://${host}`;
  }
  return "";
}

/**
 * Create a new public website report row in the DB.
 * Returns { reportId, reportUrl }.
 * Called by automation.ts and crm-ai.ts after analysis is complete.
 */
export async function createReport(params: {
  businessName: string;
  website: string;
  analysisData: any;
  baseUrl: string;
  ownerUserId?: number | null;
  ownerEmail?: string | null;
}): Promise<{ reportId: string; reportUrl: string }> {
  // 8-char uppercase hex looks like "8DJ4KPLA"
  const reportId = randomBytes(4).toString("hex").toUpperCase();
  const reportUrl = `${params.baseUrl}/report/${reportId}`;
  const enrichedData = {
    ...(params.analysisData && typeof params.analysisData === "object" ? params.analysisData : {}),
    ...(params.ownerUserId !== undefined ? { _ownerUserId: params.ownerUserId } : {}),
    ...(params.ownerEmail !== undefined ? { _ownerEmail: params.ownerEmail } : {}),
  };
  await db.insert(websiteReportsTable).values({
    reportId,
    businessName: params.businessName,
    website: params.website || "",
    analysisData: enrichedData,
    reportUrl,
  });
  return { reportId, reportUrl };
}

/**
 * Build the report-section HTML block appended to outreach emails.
 */
export function buildReportEmailSection(reportUrl: string, businessName: string): string {
  const safeName = escapeHtml(businessName);
  const safeHref = safeUrl(reportUrl);
  return `
<br/>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
<div style="background:#f5f3ff;border-left:4px solid #6d28d9;padding:16px 20px;border-radius:0 8px 8px 0;">
  <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#4c1d95;">&#128269; Free Website Analysis Report</p>
  <p style="margin:0 0 12px;font-size:13px;color:#374151;line-height:1.6;">
    We analyzed ${safeName}&#39;s website and put together a free personalised report with specific findings and recommendations.
  </p>
  <a href="${safeHref}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;">View Your Free Report &#8594;</a>
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
    If you&#39;d like us to implement any of these improvements, simply reply to this email.
  </p>
</div>`;
}

// ─── Public: view report (tracks view, no auth required) ─────────────────────

router.get("/reports/:reportId", async (req, res) => {
  const { reportId } = req.params;
  // Guard against mistakenly matching the "admin" sub-path
  if (reportId === "admin") { res.status(404).json({ error: "Not found" }); return; }
  try {
    const rows = await db.select().from(websiteReportsTable)
      .where(eq(websiteReportsTable.reportId, reportId)).limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    const report = rows[0];
    const now = new Date();
    // Track the view
    await db.update(websiteReportsTable).set({
      totalViews: sql`${websiteReportsTable.totalViews} + 1`,
      firstViewed: report.firstViewed ?? now,
      lastViewed: now,
    }).where(eq(websiteReportsTable.reportId, reportId));

    // Return only safe public fields
    res.json({
      reportId: report.reportId,
      businessName: report.businessName,
      website: report.website,
      analysisData: report.analysisData,
      reportUrl: report.reportUrl,
      createdAt: report.createdAt?.toISOString() ?? null,
      totalViews: report.totalViews + 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User / Admin: list reports for the caller ────────────────────────────────

router.get("/reports", async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req);
    const rows = await db.select().from(websiteReportsTable)
      .orderBy(desc(websiteReportsTable.createdAt))
      .limit(500);
    const filtered = user ? rows.filter(r => doesReportBelongToUser(r, user)) : [];
    res.json({
      reports: filtered.map(r => ({
        reportId: r.reportId,
        businessName: r.businessName,
        website: r.website,
        reportUrl: r.reportUrl,
        createdAt: r.createdAt?.toISOString() ?? null,
        firstViewed: r.firstViewed?.toISOString() ?? null,
        lastViewed: r.lastViewed?.toISOString() ?? null,
        totalViews: r.totalViews,
        proposalRequested: r.proposalRequested,
        status: r.status,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports/admin/all", requireAdmin, async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req);
    const rows = await db.select().from(websiteReportsTable)
      .orderBy(desc(websiteReportsTable.createdAt))
      .limit(500);
    const filtered = user ? rows.filter(r => doesReportBelongToUser(r, user)) : rows;
    res.json(filtered.map(r => ({
      reportId: r.reportId,
      businessName: r.businessName,
      website: r.website,
      reportUrl: r.reportUrl,
      createdAt: r.createdAt?.toISOString() ?? null,
      firstViewed: r.firstViewed?.toISOString() ?? null,
      lastViewed: r.lastViewed?.toISOString() ?? null,
      totalViews: r.totalViews,
      proposalRequested: r.proposalRequested,
      status: r.status,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: get pending notifications (viewed since last notified) ────────────

router.get("/reports/admin/notifications", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(websiteReportsTable)
      .where(
        and(
          isNotNull(websiteReportsTable.lastViewed),
          or(
            isNull(websiteReportsTable.lastNotifiedAt),
            sql`${websiteReportsTable.lastViewed} > ${websiteReportsTable.lastNotifiedAt}`
          )
        )
      )
      .orderBy(desc(websiteReportsTable.lastViewed))
      .limit(20);
    res.json(rows.map(r => ({
      reportId: r.reportId,
      businessName: r.businessName,
      lastViewed: r.lastViewed?.toISOString() ?? null,
      totalViews: r.totalViews,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: mark notifications as seen ───────────────────────────────────────

router.post("/reports/admin/mark-notified", requireAdmin, async (req, res) => {
  try {
    const { reportIds } = req.body as { reportIds?: string[] };
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      res.json({ success: true }); return;
    }
    await db.update(websiteReportsTable)
      .set({ lastNotifiedAt: new Date() })
      .where(inArray(websiteReportsTable.reportId, reportIds));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public/Admin: update report status or request proposal ──────────────────

router.patch("/reports/admin/:reportId", async (req, res) => {
  const { reportId } = req.params;
  const { status, proposalRequested } = req.body as { status?: string; proposalRequested?: boolean };
  if (status !== undefined && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` });
    return;
  }
  try {
    const updated = await db.update(websiteReportsTable).set({
      ...(status !== undefined && { status }),
      ...(proposalRequested !== undefined && { proposalRequested }),
    }).where(eq(websiteReportsTable.reportId, reportId)).returning();
    if (!updated.length) { res.status(404).json({ error: "Report not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/reports/admin/:reportId", requireAdmin, async (req, res) => {
  const { reportId } = req.params;
  try {
    await db.delete(websiteReportsTable).where(eq(websiteReportsTable.reportId, reportId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
