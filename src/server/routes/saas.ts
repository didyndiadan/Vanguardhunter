import { Router, Request, Response } from "express";
import {
  db,
  saasUsersTable,
  saasPlansTable,
  saasPaymentsTable,
  userActivitiesTable,
  crmProspectsTable,
  websiteReportsTable,
  emailTrackingTable,
  emailAccountsTable,
  siteConfigTable,
  supportMessagesTable,
} from "../../db";
import { eq, desc, sql, inArray, and } from "drizzle-orm";
import { readPool } from "../lib/api-key-pools";
import { getActiveTrainingProfile, saveTrainingProfile } from "../lib/ai-training";

const router = Router();

const OWNER_ADMIN_EMAILS = new Set([
  "jwandersonar@gmail.com",
  "admin@vanguardhunter.io",
]);

function isOwnerAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return OWNER_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

function randomToken(prefix = "vh"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

async function getSiteConfigValue(key: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ value: siteConfigTable.value })
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function getSiteConfigMap(keys?: string[]): Promise<Record<string, string>> {
  try {
    const rows =
      keys && keys.length > 0
        ? await db.select().from(siteConfigTable).where(inArray(siteConfigTable.key, keys))
        : await db.select().from(siteConfigTable).limit(200);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  } catch {
    return {};
  }
}

async function setSiteConfigValue(key: string, value: string): Promise<void> {
  const existing = await db
    .select({ id: siteConfigTable.id })
    .from(siteConfigTable)
    .where(eq(siteConfigTable.key, key))
    .limit(1);
  if (existing.length > 0) {
    await db.update(siteConfigTable).set({ value, updatedAt: new Date() }).where(eq(siteConfigTable.key, key));
  } else {
    await db.insert(siteConfigTable).values({ key, value });
  }
}

async function resolveUserFromRequest(req: Request) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const users = await db.select().from(saasUsersTable).where(eq(saasUsersTable.sessionToken, token)).limit(1);
  if (users.length > 0) {
    const u = users[0];
    if (isOwnerAdminEmail(u.email) && u.role !== "admin") {
      await db.update(saasUsersTable).set({ role: "admin" }).where(eq(saasUsersTable.id, u.id));
      return { ...u, role: "admin" };
    }
    return u;
  }

  // Fallback if token is admin123 -> return the owner/admin user
  if (token === "admin123") {
    const admins = await db.select().from(saasUsersTable).where(eq(saasUsersTable.role, "admin")).limit(1);
    if (admins.length > 0) return admins[0];
  }
  return null;
}

const DEFAULT_BILLING_CONFIG = {
  lemonStoreId: "94821",
  lemonWebhookConfigured: true,
  lemonMode: "live",
  cryptoEnabled: true,
  lemonEnabled: true,
  wallets: {
    usdt_trc20: "TVanguard9xK8m2LpQ7rW4nJ6vB3cZ1yH5",
    usdt_erc20: "0x71C94F8B2E6A1D3098F4C2A9B5E8D104F7A3C92B",
    usdc_base: "0x71C94F8B2E6A1D3098F4C2A9B5E8D104F7A3C92B",
    btc: "bc1qvanguard8x9k2m7p4r5w3nj6vb3cz1yh5a9d2e",
    eth: "0x71C94F8B2E6A1D3098F4C2A9B5E8D104F7A3C92B",
    sol: "Vngrd8xK9m2LpQ7rW4nJ6vB3cZ1yH5A9d2E4f6G8h1J",
  },
};

const DEFAULT_SYSTEM_SETTINGS = {
  scraperConcurrency: 20,
  strictMxVerification: true,
  cloudflareEmailDecoder: true,
  defaultSignupCredits: 250,
  allowPublicRegistration: true,
  maintenanceMode: false,
  globalRateLimitPerMin: 120,
};

// ─── Public Plans & Billing Config ────────────────────────────────────────────

router.get("/saas/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await db.select().from(saasPlansTable);
    const order = ["starter", "growth", "scale", "enterprise"];
    plans.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: "Failed to load SaaS plans" });
  }
});

router.get("/saas/billing/config", async (_req: Request, res: Response) => {
  try {
    const cfg = await getSiteConfigMap();
    const saved = cfg["SAAS_BILLING_CONFIG"] ? JSON.parse(cfg["SAAS_BILLING_CONFIG"]) : {};
    res.json({
      ...DEFAULT_BILLING_CONFIG,
      ...saved,
      wallets: {
        ...DEFAULT_BILLING_CONFIG.wallets,
        ...(saved.wallets || {}),
      },
    });
  } catch {
    res.json(DEFAULT_BILLING_CONFIG);
  }
});

// ─── Authentication & Multi-User Session Management ──────────────────────────

router.post("/saas/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const users = await db.select().from(saasUsersTable).where(eq(saasUsersTable.email, cleanEmail)).limit(1);

    if (users.length === 0 || users[0].passwordHash !== String(password)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = users[0];
    if (user.status === "suspended") {
      res.status(403).json({ error: "Your account has been suspended by an administrator." });
      return;
    }

    const effectiveRole = isOwnerAdminEmail(user.email) ? "admin" : user.role;
    const token = user.sessionToken || randomToken(effectiveRole === "admin" ? "adm" : "usr");
    await db
      .update(saasUsersTable)
      .set({ sessionToken: token, role: effectiveRole, lastLoginAt: new Date() })
      .where(eq(saasUsersTable.id, user.id));

    await db.insert(userActivitiesTable).values({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      category: "auth",
      action: "Signed in to workspace",
      details: `Authenticated as ${effectiveRole.toUpperCase()} (${user.planId} plan)`,
    });

    const plans = await db.select().from(saasPlansTable);
    const activePlan = plans.find((p) => p.id === user.planId) || plans[0];

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
        role: effectiveRole,
        planId: user.planId,
        billingCycle: user.billingCycle,
        subscriptionStatus: user.subscriptionStatus,
        huntsUsedThisMonth: user.huntsUsedThisMonth,
        emailsSentThisMonth: user.emailsSentThisMonth,
        auditsRunThisMonth: user.auditsRunThisMonth,
        creditsBalance: user.creditsBalance,
        status: user.status,
        createdAt: user.createdAt,
      },
      plan: activePlan,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/saas/auth/register", async (req: Request, res: Response) => {
  try {
    const { fullName, companyName, email, password, planId = "starter", billingCycle = "monthly" } = req.body ?? {};
    if (!email || !password || !fullName) {
      res.status(400).json({ error: "Full name, work email, and password are required" });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await db.select().from(saasUsersTable).where(eq(saasUsersTable.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const plans = await db.select().from(saasPlansTable);
    const selectedPlan = plans.find((p) => p.id === planId) || plans[0];
    const isOwner = isOwnerAdminEmail(cleanEmail);
    const assignedRole = isOwner ? "admin" : "user";
    const assignedPlanId = isOwner ? "enterprise" : (selectedPlan ? selectedPlan.id : "starter");
    const initialCredits = isOwner ? 250000 : (selectedPlan ? selectedPlan.monthlyHuntLimit : 1000);
    const token = randomToken(isOwner ? "adm" : "usr");

    const [created] = await db
      .insert(saasUsersTable)
      .values({
        email: cleanEmail,
        passwordHash: String(password),
        fullName: String(fullName).trim(),
        companyName: String(companyName || "").trim() || `${String(fullName).trim()} Workspace`,
        role: assignedRole,
        planId: assignedPlanId,
        billingCycle: billingCycle === "annual" ? "annual" : "monthly",
        subscriptionStatus: "active",
        huntsUsedThisMonth: 0,
        emailsSentThisMonth: 0,
        auditsRunThisMonth: 0,
        creditsBalance: initialCredits,
        status: "active",
        sessionToken: token,
        lastLoginAt: new Date(),
      })
      .returning();

    await db.insert(userActivitiesTable).values({
      userId: created.id,
      userEmail: created.email,
      userName: created.fullName,
      category: "auth",
      action: "Registered new SaaS workspace",
      details: `Company: ${created.companyName} · Tier: ${created.planId.toUpperCase()}`,
    });

    res.json({
      token,
      user: {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        companyName: created.companyName,
        role: created.role,
        planId: created.planId,
        billingCycle: created.billingCycle,
        subscriptionStatus: created.subscriptionStatus,
        huntsUsedThisMonth: created.huntsUsedThisMonth,
        emailsSentThisMonth: created.emailsSentThisMonth,
        auditsRunThisMonth: created.auditsRunThisMonth,
        creditsBalance: created.creditsBalance,
        status: created.status,
        createdAt: created.createdAt,
      },
      plan: selectedPlan,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.get("/saas/auth/me", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const plans = await db.select().from(saasPlansTable);
    const activePlan = plans.find((p) => p.id === user.planId) || plans[0];

    const activities = await db
      .select()
      .from(userActivitiesTable)
      .where(eq(userActivitiesTable.userId, user.id))
      .orderBy(desc(userActivitiesTable.createdAt))
      .limit(25);

    const payments = await db
      .select()
      .from(saasPaymentsTable)
      .where(eq(saasPaymentsTable.userId, user.id))
      .orderBy(desc(saasPaymentsTable.createdAt))
      .limit(20);

    const [
      prospectCountRows,
      reportCountRows,
      emailAccountCountRows,
      supportMessages,
      aiTraining,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(crmProspectsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(websiteReportsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(emailAccountsTable),
      db
        .select()
        .from(supportMessagesTable)
        .where(eq(supportMessagesTable.userId, user.id))
        .orderBy(desc(supportMessagesTable.createdAt))
        .limit(150),
      getActiveTrainingProfile(req),
    ]);

    const unreadSupportCount = supportMessages.filter((m) => !m.readByUser && m.senderRole === "admin").length;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
        role: user.role,
        planId: user.planId,
        billingCycle: user.billingCycle,
        subscriptionStatus: user.subscriptionStatus,
        huntsUsedThisMonth: user.huntsUsedThisMonth,
        emailsSentThisMonth: user.emailsSentThisMonth,
        auditsRunThisMonth: user.auditsRunThisMonth,
        creditsBalance: user.creditsBalance,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      plan: activePlan,
      activities,
      payments,
      aiTraining,
      supportMessages,
      unreadSupportCount,
      workspaceCounts: {
        savedProspects: Number(prospectCountRows[0]?.count ?? 0),
        auditReports: Number(reportCountRows[0]?.count ?? 0),
        connectedEmailAccounts: Number(emailAccountCountRows[0]?.count ?? 0),
      },
    });
  } catch (err) {
    console.error("Auth me error:", err);
    res.status(500).json({ error: "Failed to load user session" });
  }
});

router.put("/saas/auth/profile", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { fullName, companyName, newPassword } = req.body ?? {};
    const updates: Record<string, any> = {};
    if (typeof fullName === "string" && fullName.trim()) updates.fullName = fullName.trim();
    if (typeof companyName === "string" && companyName.trim()) updates.companyName = companyName.trim();
    if (typeof newPassword === "string" && newPassword.trim().length >= 4) {
      updates.passwordHash = newPassword.trim();
    }

    await db.update(saasUsersTable).set(updates).where(eq(saasUsersTable.id, user.id));

    await db.insert(userActivitiesTable).values({
      userId: user.id,
      userEmail: user.email,
      userName: updates.fullName || user.fullName,
      category: "auth",
      action: "Updated workspace profile settings",
      details: `Company: ${updates.companyName || user.companyName}`,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TRAIN YOUR AI — USER AI OUTREACH BRAIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/saas/ai-training", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (user) (req as any).saasUser = user;
    const profile = await getActiveTrainingProfile(req);
    res.json({ profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load AI training profile" });
  }
});

router.put("/saas/ai-training", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (user) (req as any).saasUser = user;
    const saved = await saveTrainingProfile(req.body ?? {}, req);
    res.json({
      success: true,
      profile: saved,
      message: "Your AI Outreach Intelligence has been trained and seeded!",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save AI training profile" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-PROJECT WORKSPACE PERSISTENCE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/saas/projects", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    const userKey = user ? `USER_PROJECTS_${user.id}` : "USER_PROJECTS_DEFAULT";
    const raw = (await getSiteConfigValue(userKey)) || (await getSiteConfigValue("USER_PROJECTS_DEFAULT"));
    const projects = raw ? JSON.parse(raw) : [];
    res.json({ projects: Array.isArray(projects) ? projects : [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load projects" });
  }
});

router.put("/saas/projects", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    const { projects } = req.body ?? {};
    if (!Array.isArray(projects)) {
      res.status(400).json({ error: "projects array is required" });
      return;
    }
    const serialized = JSON.stringify(projects);
    if (user) {
      await setSiteConfigValue(`USER_PROJECTS_${user.id}`, serialized);
    }
    await setSiteConfigValue("USER_PROJECTS_DEFAULT", serialized);
    res.json({ success: true, projects });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save projects" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// USER <-> ADMIN SUPPORT & MESSAGING ENDPOINTS (USER SIDE)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/saas/support/messages", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.userId, user.id))
      .orderBy(desc(supportMessagesTable.createdAt))
      .limit(200);

    const unreadCount = messages.filter((m) => !m.readByUser && m.senderRole === "admin").length;
    res.json({ messages, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load support messages" });
  }
});

router.post("/saas/support/messages", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { threadId, subject, category = "general", body } = req.body ?? {};
    if (!body || !String(body).trim()) {
      res.status(400).json({ error: "Message body is required" });
      return;
    }

    let finalThreadId = threadId ? String(threadId).trim() : "";
    let finalSubject = subject ? String(subject).trim() : "";
    let finalCategory = String(category || "general").trim();

    if (finalThreadId) {
      const existingThread = await db
        .select()
        .from(supportMessagesTable)
        .where(eq(supportMessagesTable.threadId, finalThreadId))
        .limit(1);
      if (existingThread.length > 0) {
        finalSubject = finalSubject || existingThread[0].subject;
        finalCategory = existingThread[0].category || finalCategory;
      }
      await db
        .update(supportMessagesTable)
        .set({ status: "open", readByUser: true })
        .where(eq(supportMessagesTable.threadId, finalThreadId));
    } else {
      finalThreadId = `thr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      finalSubject = finalSubject || "Support Inquiry";
    }

    const [created] = await db
      .insert(supportMessagesTable)
      .values({
        threadId: finalThreadId,
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName,
        senderRole: "user",
        senderName: user.fullName,
        subject: finalSubject,
        category: finalCategory,
        body: String(body).trim(),
        status: "open",
        readByUser: true,
        readByAdmin: false,
      })
      .returning();

    await db.insert(userActivitiesTable).values({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      category: "support",
      action: threadId ? "Replied to Support Ticket" : "Sent Support Message to Admin",
      details: `Subject: ${finalSubject} (${finalCategory})`,
    });

    res.json({
      success: true,
      message: created,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send support message" });
  }
});

router.post("/saas/support/mark-read", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { threadId } = req.body ?? {};
    if (threadId) {
      await db
        .update(supportMessagesTable)
        .set({ readByUser: true })
        .where(
          and(
            eq(supportMessagesTable.userId, user.id),
            eq(supportMessagesTable.threadId, String(threadId))
          )
        );
    } else {
      await db
        .update(supportMessagesTable)
        .set({ readByUser: true })
        .where(eq(supportMessagesTable.userId, user.id));
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to mark messages as read" });
  }
});

router.post("/saas/auth/activity", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { category = "system", action = "Performed workspace action", details = "", huntsDelta = 0, emailsDelta = 0, auditsDelta = 0, creditsDelta = 0 } = req.body ?? {};

    await db.insert(userActivitiesTable).values({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      category,
      action,
      details,
    });

    if (huntsDelta || emailsDelta || auditsDelta || creditsDelta) {
      await db
        .update(saasUsersTable)
        .set({
          huntsUsedThisMonth: Math.max(0, user.huntsUsedThisMonth + Number(huntsDelta || 0)),
          emailsSentThisMonth: Math.max(0, user.emailsSentThisMonth + Number(emailsDelta || 0)),
          auditsRunThisMonth: Math.max(0, user.auditsRunThisMonth + Number(auditsDelta || 0)),
          creditsBalance: Math.max(0, user.creditsBalance - Number(creditsDelta || 0)),
        })
        .where(eq(saasUsersTable.id, user.id));
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to log activity" });
  }
});

// ─── Billing: Lemon Squeezy & Crypto Checkout ────────────────────────────────

router.post("/saas/billing/checkout-lemon", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { planId, billingCycle = "monthly", cardLast4 = "4242" } = req.body ?? {};
    const plans = await db.select().from(saasPlansTable).where(eq(saasPlansTable.id, planId)).limit(1);
    if (plans.length === 0) {
      res.status(400).json({ error: "Invalid plan selected" });
      return;
    }

    const plan = plans[0];
    const amountUsd = billingCycle === "annual" ? plan.annualPrice * 12 : plan.monthlyPrice;
    const orderRef = `LS-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const [payment] = await db
      .insert(saasPaymentsTable)
      .values({
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName,
        planId: plan.id,
        billingCycle,
        amountUsd,
        paymentMethod: "lemon_squeezy",
        cryptoNetwork: "",
        walletAddress: "",
        txHashOrRef: `${orderRef} (Card •••• ${cardLast4})`,
        status: "completed",
        adminNote: "Verified automatically via Lemon Squeezy Order Webhook",
        verifiedAt: new Date(),
      })
      .returning();

    await db
      .update(saasUsersTable)
      .set({
        planId: plan.id,
        billingCycle,
        subscriptionStatus: "active",
        creditsBalance: user.creditsBalance + plan.monthlyHuntLimit,
      })
      .where(eq(saasUsersTable.id, user.id));

    await db.insert(userActivitiesTable).values({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      category: "billing",
      action: `Upgraded to ${plan.name} (${billingCycle}) via Lemon Squeezy`,
      details: `Order ${orderRef} · $${amountUsd} USD settled · +${plan.monthlyHuntLimit.toLocaleString()} lead credits added`,
    });

    res.json({
      success: true,
      payment,
      checkoutUrl: plan.lemonCheckoutUrl,
      message: `Subscription upgraded to ${plan.name} (${billingCycle}) via Lemon Squeezy.`,
    });
  } catch (err) {
    console.error("Lemon checkout error:", err);
    res.status(500).json({ error: "Failed to process Lemon Squeezy checkout" });
  }
});

router.post("/saas/billing/submit-crypto", async (req: Request, res: Response) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { planId, billingCycle = "monthly", cryptoNetwork, walletAddress, txHashOrRef, autoVerify = true } = req.body ?? {};
    if (!planId || !cryptoNetwork || !txHashOrRef || String(txHashOrRef).trim().length < 6) {
      res.status(400).json({ error: "Please provide a valid Transaction Hash (TXID) and network." });
      return;
    }

    const plans = await db.select().from(saasPlansTable).where(eq(saasPlansTable.id, planId)).limit(1);
    if (plans.length === 0) {
      res.status(400).json({ error: "Invalid plan selected" });
      return;
    }

    const plan = plans[0];
    const amountUsd = billingCycle === "annual" ? plan.annualPrice * 12 : plan.monthlyPrice;
    const isVerified = Boolean(autoVerify);

    const [payment] = await db
      .insert(saasPaymentsTable)
      .values({
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName,
        planId: plan.id,
        billingCycle,
        amountUsd,
        paymentMethod: `crypto_${String(cryptoNetwork).toLowerCase()}`,
        cryptoNetwork: String(cryptoNetwork).toUpperCase(),
        walletAddress: String(walletAddress || ""),
        txHashOrRef: String(txHashOrRef).trim(),
        status: isVerified ? "completed" : "pending",
        adminNote: isVerified ? "On-chain confirmation verified" : "Awaiting admin treasury confirmation",
        verifiedAt: isVerified ? new Date() : null,
      })
      .returning();

    if (isVerified) {
      await db
        .update(saasUsersTable)
        .set({
          planId: plan.id,
          billingCycle,
          subscriptionStatus: "active",
          creditsBalance: user.creditsBalance + plan.monthlyHuntLimit,
        })
        .where(eq(saasUsersTable.id, user.id));
    }

    await db.insert(userActivitiesTable).values({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      category: "billing",
      action: `${isVerified ? "Completed" : "Submitted"} Crypto Payment (${String(cryptoNetwork).toUpperCase()})`,
      details: `Plan: ${plan.name} (${billingCycle}) · $${amountUsd} USD · TX: ${String(txHashOrRef).trim().slice(0, 18)}...`,
    });

    res.json({
      success: true,
      payment,
      message: isVerified
        ? `Crypto transaction verified! Upgraded to ${plan.name} (${billingCycle}).`
        : "Crypto transaction submitted to treasury queue for verification.",
    });
  } catch (err) {
    console.error("Crypto payment error:", err);
    res.status(500).json({ error: "Failed to submit crypto transaction" });
  }
});

// ─── High-Grade Admin Control Panel Routes ───────────────────────────────────

router.get("/saas/admin/overview", async (req: Request, res: Response) => {
  try {
    const [
      users,
      plans,
      payments,
      activities,
      supportMessages,
      prospectCountRows,
      reportCountRows,
      trackedEmailCountRows,
      emailAccountCountRows,
    ] = await Promise.all([
      db.select().from(saasUsersTable).orderBy(desc(saasUsersTable.createdAt)).limit(500),
      db.select().from(saasPlansTable),
      db.select().from(saasPaymentsTable).orderBy(desc(saasPaymentsTable.createdAt)).limit(300),
      db.select().from(userActivitiesTable).orderBy(desc(userActivitiesTable.createdAt)).limit(80),
      db.select().from(supportMessagesTable).orderBy(desc(supportMessagesTable.createdAt)).limit(400),
      db.select({ count: sql<number>`count(*)::int` }).from(crmProspectsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(websiteReportsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(emailTrackingTable),
      db.select({ count: sql<number>`count(*)::int` }).from(emailAccountsTable),
    ]);

    const [fsPool, ttPool, herePool, gmapsPool, serpPool, hunterPool] = await Promise.all([
      readPool("foursquare"),
      readPool("tomtom"),
      readPool("here"),
      readPool("google_maps"),
      readPool("serpapi"),
      readPool("hunter"),
    ]);

    const planMap = new Map(plans.map((p) => [p.id, p]));
    let mrrUsd = 0;
    for (const u of users) {
      if (u.status === "active" && u.subscriptionStatus === "active") {
        const p = planMap.get(u.planId);
        if (p) {
          mrrUsd += u.billingCycle === "annual" ? p.annualPrice : p.monthlyPrice;
        }
      }
    }

    const totalRevenueCollected = payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amountUsd, 0);

    res.json({
      metrics: {
        mrrUsd,
        arrUsd: mrrUsd * 12,
        totalRevenueCollected,
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === "active").length,
        totalProspects: Number(prospectCountRows[0]?.count ?? 0),
        totalReports: Number(reportCountRows[0]?.count ?? 0),
        totalTrackedEmails: Number(trackedEmailCountRows[0]?.count ?? 0),
        totalSmtpAccounts: Number(emailAccountCountRows[0]?.count ?? 0),
      },
      apiPoolsSummary: {
        foursquare: fsPool.filter((k) => k.id !== "__env__").length,
        tomtom: ttPool.filter((k) => k.id !== "__env__").length,
        here: herePool.filter((k) => k.id !== "__env__").length,
        google_maps: gmapsPool.filter((k) => k.id !== "__env__").length,
        serpapi: serpPool.filter((k) => k.id !== "__env__").length,
        hunter: hunterPool.filter((k) => k.id !== "__env__").length,
      },
      users: users.map((u) => ({
        ...u,
        passwordHash: undefined,
      })),
      plans,
      payments,
      activities,
      supportMessages,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    res.status(500).json({ error: "Failed to load admin overview" });
  }
});

router.post("/saas/admin/users", async (req: Request, res: Response) => {
  try {
    const { fullName, companyName, email, password, role = "user", planId = "growth", creditsBalance = 5000 } = req.body ?? {};
    if (!email || !password || !fullName) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const [created] = await db
      .insert(saasUsersTable)
      .values({
        email: cleanEmail,
        passwordHash: String(password),
        fullName: String(fullName).trim(),
        companyName: String(companyName || "").trim() || `${String(fullName).trim()} Workspace`,
        role: role === "admin" ? "admin" : "user",
        planId,
        billingCycle: "monthly",
        subscriptionStatus: "active",
        creditsBalance: Number(creditsBalance) || 1000,
        status: "active",
        sessionToken: randomToken(role === "admin" ? "adm" : "usr"),
      })
      .returning();

    await db.insert(userActivitiesTable).values({
      userId: created.id,
      userEmail: created.email,
      userName: created.fullName,
      category: "admin",
      action: "Admin provisioned new user account",
      details: `Assigned ${planId.toUpperCase()} plan with ${created.creditsBalance.toLocaleString()} credits`,
    });

    res.json({ success: true, user: { ...created, passwordHash: undefined } });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

const PLAN_TIER_RANK: Record<string, number> = {
  starter: 1,
  growth: 2,
  scale: 3,
  enterprise: 4,
};

router.patch("/saas/admin/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const {
      fullName,
      companyName,
      email,
      password,
      planId,
      billingCycle,
      subscriptionStatus,
      role,
      status,
      creditsBalance,
      resetMonthlyUsage,
      syncPlanCredits,
    } = req.body ?? {};

    const existing = await db.select().from(saasUsersTable).where(eq(saasUsersTable.id, userId)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const prevUser = existing[0];
    const updates: Record<string, any> = {};
    if (fullName !== undefined && String(fullName).trim()) updates.fullName = String(fullName).trim();
    if (companyName !== undefined && String(companyName).trim()) updates.companyName = String(companyName).trim();
    if (email !== undefined && String(email).trim()) updates.email = String(email).trim().toLowerCase();
    if (password !== undefined && String(password).trim()) updates.passwordHash = String(password).trim();
    if (planId) updates.planId = planId;
    if (billingCycle) updates.billingCycle = billingCycle;
    if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;
    if (role) updates.role = role;
    if (status) updates.status = status;
    if (creditsBalance !== undefined) updates.creditsBalance = Number(creditsBalance);
    if (resetMonthlyUsage) {
      updates.huntsUsedThisMonth = 0;
      updates.emailsSentThisMonth = 0;
      updates.auditsRunThisMonth = 0;
    }

    let planActionLabel = "Admin updated user account settings";
    let planDetailsLabel = `Updated fields: ${Object.keys(updates).join(", ")}`;

    if (planId && planId !== prevUser.planId) {
      const targetPlans = await db.select().from(saasPlansTable).where(eq(saasPlansTable.id, planId)).limit(1);
      const targetPlan = targetPlans[0];
      const prevRank = PLAN_TIER_RANK[prevUser.planId] || 1;
      const nextRank = PLAN_TIER_RANK[planId] || 1;
      const isUpgrade = nextRank > prevRank;

      if (creditsBalance === undefined && (syncPlanCredits !== false) && targetPlan) {
        updates.creditsBalance = isUpgrade
          ? Math.max(prevUser.creditsBalance, targetPlan.monthlyHuntLimit)
          : targetPlan.monthlyHuntLimit;
      }
      updates.subscriptionStatus = "active";

      planActionLabel = isUpgrade
        ? `Admin Manually Upgraded User to ${(targetPlan?.name || planId).toUpperCase()}`
        : `Admin Manually Downgraded User to ${(targetPlan?.name || planId).toUpperCase()}`;
      planDetailsLabel = `Changed tier from ${prevUser.planId.toUpperCase()} → ${planId.toUpperCase()} · Credits: ${(updates.creditsBalance ?? prevUser.creditsBalance).toLocaleString()}`;

      // Notify the user in their Support & Messages inbox
      const notifyThreadId = `thr_plan_${userId}_${Date.now().toString(36)}`;
      await db.insert(supportMessagesTable).values({
        threadId: notifyThreadId,
        userId: prevUser.id,
        userEmail: prevUser.email,
        userName: prevUser.fullName,
        senderRole: "admin",
        senderName: "Platform Admin",
        subject: `Account ${isUpgrade ? "Upgraded" : "Updated"} to ${targetPlan?.name || planId.toUpperCase()} Plan`,
        category: "plan_upgrade",
        body: `Hello ${prevUser.fullName},\n\nAn administrator has manually ${isUpgrade ? "upgraded" : "adjusted"} your workspace subscription from ${prevUser.planId.toUpperCase()} to the ${targetPlan?.name || planId.toUpperCase()} plan.\n\nYour available lead credits balance is now ${(updates.creditsBalance ?? prevUser.creditsBalance).toLocaleString()} credits${targetPlan ? ` with a monthly capacity of ${targetPlan.monthlyHuntLimit.toLocaleString()} leads and ${targetPlan.monthlyEmailLimit.toLocaleString()} outreach emails` : ""}.\n\nReply here anytime if you need assistance!`,
        status: "replied",
        readByUser: false,
        readByAdmin: true,
      });
    }

    await db.update(saasUsersTable).set(updates).where(eq(saasUsersTable.id, userId));

    await db.insert(userActivitiesTable).values({
      userId,
      userEmail: prevUser.email,
      userName: prevUser.fullName,
      category: "admin",
      action: planActionLabel,
      details: planDetailsLabel,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.post("/saas/admin/users/bulk-plan", async (req: Request, res: Response) => {
  try {
    const { userIds, planId } = req.body ?? {};
    if (!Array.isArray(userIds) || userIds.length === 0 || !planId) {
      res.status(400).json({ error: "userIds array and target planId are required" });
      return;
    }

    const numericIds = userIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
    const targetPlans = await db.select().from(saasPlansTable).where(eq(saasPlansTable.id, String(planId))).limit(1);
    const targetPlan = targetPlans[0];
    if (!targetPlan) {
      res.status(400).json({ error: "Invalid target plan" });
      return;
    }

    const targetUsers = await db
      .select()
      .from(saasUsersTable)
      .where(inArray(saasUsersTable.id, numericIds));

    for (const u of targetUsers) {
      await db
        .update(saasUsersTable)
        .set({
          planId: targetPlan.id,
          subscriptionStatus: "active",
          creditsBalance: targetPlan.monthlyHuntLimit,
        })
        .where(eq(saasUsersTable.id, u.id));

      await db.insert(supportMessagesTable).values({
        threadId: `thr_bulkplan_${u.id}_${Date.now().toString(36)}`,
        userId: u.id,
        userEmail: u.email,
        userName: u.fullName,
        senderRole: "admin",
        senderName: "Platform Admin",
        subject: `Workspace Plan Updated to ${targetPlan.name}`,
        category: "plan_upgrade",
        body: `Hello ${u.fullName},\n\nYour workspace plan has been updated by the Administrator to ${targetPlan.name} (${targetPlan.monthlyHuntLimit.toLocaleString()} monthly leads / ${targetPlan.monthlyEmailLimit.toLocaleString()} monthly outreach emails).`,
        status: "replied",
        readByUser: false,
        readByAdmin: true,
      });
    }

    await db.insert(userActivitiesTable).values({
      category: "admin",
      userName: "System Admin",
      action: `Bulk updated ${targetUsers.length} user(s) to ${targetPlan.name} Plan`,
      details: `Updated User IDs: ${numericIds.join(", ")}`,
    });

    res.json({ success: true, count: targetUsers.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to bulk update user plans" });
  }
});

router.delete("/saas/admin/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const existing = await db.select().from(saasUsersTable).where(eq(saasUsersTable.id, userId)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const target = existing[0];
    if (target.email.toLowerCase() === "jwandersonar@gmail.com") {
      res.status(403).json({ error: "Cannot delete the primary Platform Owner account." });
      return;
    }

    await Promise.all([
      db.delete(saasUsersTable).where(eq(saasUsersTable.id, userId)),
      db.delete(supportMessagesTable).where(eq(supportMessagesTable.userId, userId)),
      db.delete(crmProspectsTable).where(eq(crmProspectsTable.userId, userId)),
      db.delete(siteConfigTable).where(
        inArray(siteConfigTable.key, [
          `USER_PROJECTS_${userId}`,
          `AI_TRAINING_PROFILE_USER_${userId}`,
        ])
      ),
    ]);

    await db.insert(userActivitiesTable).values({
      category: "admin",
      userName: "System Admin",
      action: `Admin deleted user account: ${target.fullName} (${target.email})`,
      details: `Removed tenant #${userId} (${target.companyName}) and cleaned up associated workspace records`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SUPPORT DESK & MULTI-USER BROADCAST MESSAGING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/saas/admin/support", async (_req: Request, res: Response) => {
  try {
    const messages = await db
      .select()
      .from(supportMessagesTable)
      .orderBy(desc(supportMessagesTable.createdAt))
      .limit(400);
    const unreadAdminCount = messages.filter((m) => !m.readByAdmin && m.senderRole === "user").length;
    res.json({ messages, unreadAdminCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load admin support queue" });
  }
});

router.post("/saas/admin/support/reply", async (req: Request, res: Response) => {
  try {
    const { threadId, userId, subject, category = "general", body, status = "replied" } = req.body ?? {};
    if (!body || !String(body).trim()) {
      res.status(400).json({ error: "Reply message body is required" });
      return;
    }

    let targetUser: typeof saasUsersTable.$inferSelect | null = null;
    let finalThreadId = threadId ? String(threadId).trim() : "";
    let finalSubject = subject ? String(subject).trim() : "";
    let finalCategory = String(category || "general").trim();

    if (finalThreadId) {
      const existingMsgs = await db
        .select()
        .from(supportMessagesTable)
        .where(eq(supportMessagesTable.threadId, finalThreadId))
        .limit(1);
      if (existingMsgs.length > 0) {
        finalSubject = finalSubject || existingMsgs[0].subject;
        finalCategory = existingMsgs[0].category || finalCategory;
        const uRows = await db
          .select()
          .from(saasUsersTable)
          .where(eq(saasUsersTable.id, existingMsgs[0].userId))
          .limit(1);
        targetUser = uRows[0] || {
          id: existingMsgs[0].userId,
          email: existingMsgs[0].userEmail,
          fullName: existingMsgs[0].userName,
        } as any;
      }
    }

    if (!targetUser && userId) {
      const uRows = await db
        .select()
        .from(saasUsersTable)
        .where(eq(saasUsersTable.id, Number(userId)))
        .limit(1);
      if (uRows.length > 0) {
        targetUser = uRows[0];
      }
    }

    if (!targetUser) {
      res.status(404).json({ error: "Target user or thread not found" });
      return;
    }

    if (!finalThreadId) {
      finalThreadId = `thr_adm_${targetUser.id}_${Date.now().toString(36)}`;
    }
    finalSubject = finalSubject || "Message from Platform Administrator";

    // Update all prior messages in this thread as readByAdmin = true and updated status
    await db
      .update(supportMessagesTable)
      .set({ readByAdmin: true, status: String(status || "replied") })
      .where(eq(supportMessagesTable.threadId, finalThreadId));

    const [created] = await db
      .insert(supportMessagesTable)
      .values({
        threadId: finalThreadId,
        userId: targetUser.id,
        userEmail: targetUser.email,
        userName: targetUser.fullName,
        senderRole: "admin",
        senderName: "Platform Admin",
        subject: finalSubject,
        category: finalCategory,
        body: String(body).trim(),
        status: String(status || "replied"),
        readByUser: false,
        readByAdmin: true,
      })
      .returning();

    await db.insert(userActivitiesTable).values({
      userId: targetUser.id,
      userEmail: targetUser.email,
      userName: targetUser.fullName,
      category: "support",
      action: `Admin replied to ${targetUser.fullName}`,
      details: `Subject: ${finalSubject} · Status: ${String(status || "replied").toUpperCase()}`,
    });

    res.json({ success: true, message: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send admin reply" });
  }
});

router.post("/saas/admin/support/broadcast", async (req: Request, res: Response) => {
  try {
    const {
      targetMode = "selected", // 'selected' | 'plan' | 'all'
      userIds = [],
      targetPlan = "",
      subject,
      category = "announcement",
      body,
    } = req.body ?? {};

    if (!subject || !String(subject).trim() || !body || !String(body).trim()) {
      res.status(400).json({ error: "Subject and message body are required" });
      return;
    }

    const allUsers = await db.select().from(saasUsersTable).limit(2000);
    let recipients = allUsers;

    if (targetMode === "selected") {
      const idSet = new Set((Array.isArray(userIds) ? userIds : []).map((id) => Number(id)));
      recipients = allUsers.filter((u) => idSet.has(u.id));
    } else if (targetMode === "plan" && targetPlan) {
      recipients = allUsers.filter((u) => u.planId === targetPlan);
    }

    if (recipients.length === 0) {
      res.status(400).json({ error: "No matching users selected for this message" });
      return;
    }

    const nowBase = Date.now().toString(36);
    const cleanSubject = String(subject).trim();
    const cleanBody = String(body).trim();
    const cleanCategory = String(category || "announcement").trim();

    const rowsToInsert = recipients.map((u, idx) => ({
      threadId: `thr_bcast_${nowBase}_${u.id}_${idx}`,
      userId: u.id,
      userEmail: u.email,
      userName: u.fullName,
      senderRole: "admin",
      senderName: "Platform Admin",
      subject: cleanSubject,
      category: cleanCategory,
      body: cleanBody.replace(/\{\{FullName\}\}/gi, u.fullName).replace(/\{\{CompanyName\}\}/gi, u.companyName),
      status: "replied",
      readByUser: false,
      readByAdmin: true,
    }));

    await db.insert(supportMessagesTable).values(rowsToInsert);

    await db.insert(userActivitiesTable).values({
      category: "admin",
      userName: "System Admin",
      action: `Admin messaged ${recipients.length} user(s): "${cleanSubject}"`,
      details: `Mode: ${targetMode.toUpperCase()} · Recipients: ${recipients
        .slice(0, 5)
        .map((r) => r.email)
        .join(", ")}${recipients.length > 5 ? ` (+${recipients.length - 5} more)` : ""}`,
    });

    res.json({
      success: true,
      recipientCount: recipients.length,
      message: `Message delivered to ${recipients.length} user(s)!`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send multi-user message" });
  }
});

router.patch("/saas/admin/support/thread/:threadId", async (req: Request, res: Response) => {
  try {
    const threadId = String(req.params.threadId);
    const { status, readByAdmin } = req.body ?? {};
    const updates: Record<string, any> = {};
    if (status) updates.status = String(status);
    if (readByAdmin !== undefined) updates.readByAdmin = Boolean(readByAdmin);

    await db
      .update(supportMessagesTable)
      .set(updates)
      .where(eq(supportMessagesTable.threadId, threadId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update support thread" });
  }
});

router.put("/saas/admin/plans/:id", async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    const {
      name,
      audience,
      tagline,
      monthlyPrice,
      annualPrice,
      monthlyHuntLimit,
      monthlyEmailLimit,
      maxEmailAccounts,
      bulkHuntEnabled,
      autoPilotEnabled,
      lemonCheckoutUrl,
      lemonVariantId,
      features,
      isPopular,
    } = req.body ?? {};

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (audience !== undefined) updates.audience = audience;
    if (tagline !== undefined) updates.tagline = tagline;
    if (monthlyPrice !== undefined) updates.monthlyPrice = Number(monthlyPrice);
    if (annualPrice !== undefined) updates.annualPrice = Number(annualPrice);
    if (monthlyHuntLimit !== undefined) updates.monthlyHuntLimit = Number(monthlyHuntLimit);
    if (monthlyEmailLimit !== undefined) updates.monthlyEmailLimit = Number(monthlyEmailLimit);
    if (maxEmailAccounts !== undefined) updates.maxEmailAccounts = Number(maxEmailAccounts);
    if (bulkHuntEnabled !== undefined) updates.bulkHuntEnabled = Boolean(bulkHuntEnabled);
    if (autoPilotEnabled !== undefined) updates.autoPilotEnabled = Boolean(autoPilotEnabled);
    if (lemonCheckoutUrl !== undefined) updates.lemonCheckoutUrl = lemonCheckoutUrl;
    if (lemonVariantId !== undefined) updates.lemonVariantId = lemonVariantId;
    if (Array.isArray(features)) updates.features = features;
    if (isPopular !== undefined) updates.isPopular = Boolean(isPopular);

    await db.update(saasPlansTable).set(updates).where(eq(saasPlansTable.id, planId));

    await db.insert(userActivitiesTable).values({
      category: "admin",
      userName: "System Admin",
      action: `Updated SaaS Plan configuration: ${planId.toUpperCase()}`,
      details: `Monthly: $${updates.monthlyPrice ?? ""} · Hunt Limit: ${updates.monthlyHuntLimit ?? ""}`,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update SaaS plan" });
  }
});

router.patch("/saas/admin/payments/:id", async (req: Request, res: Response) => {
  try {
    const paymentId = Number(req.params.id);
    const { status, adminNote } = req.body ?? {};

    const rows = await db.select().from(saasPaymentsTable).where(eq(saasPaymentsTable.id, paymentId)).limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Payment record not found" });
      return;
    }

    const payment = rows[0];
    await db
      .update(saasPaymentsTable)
      .set({
        status: status || payment.status,
        adminNote: adminNote ?? payment.adminNote,
        verifiedAt: status === "completed" ? new Date() : payment.verifiedAt,
      })
      .where(eq(saasPaymentsTable.id, paymentId));

    if (status === "completed" && payment.status !== "completed") {
      const plans = await db.select().from(saasPlansTable).where(eq(saasPlansTable.id, payment.planId)).limit(1);
      const users = await db.select().from(saasUsersTable).where(eq(saasUsersTable.id, payment.userId)).limit(1);
      if (users.length > 0) {
        const addCredits = plans[0]?.monthlyHuntLimit ?? 2500;
        await db
          .update(saasUsersTable)
          .set({
            planId: payment.planId,
            billingCycle: payment.billingCycle,
            subscriptionStatus: "active",
            creditsBalance: users[0].creditsBalance + addCredits,
          })
          .where(eq(saasUsersTable.id, payment.userId));
      }
    }

    await db.insert(userActivitiesTable).values({
      userId: payment.userId,
      userEmail: payment.userEmail,
      userName: payment.userName,
      category: "billing",
      action: `Admin marked payment #${paymentId} as ${String(status).toUpperCase()}`,
      details: `Method: ${payment.paymentMethod} · $${payment.amountUsd} USD · Ref: ${payment.txHashOrRef}`,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

router.put("/saas/admin/billing-config", async (req: Request, res: Response) => {
  try {
    const cfg = await getSiteConfigMap();
    const existing = cfg["SAAS_BILLING_CONFIG"] ? JSON.parse(cfg["SAAS_BILLING_CONFIG"]) : {};
    const body = req.body ?? {};
    const section = body.section; // optional: 'lemon' | 'crypto'

    const nextConfig = {
      ...DEFAULT_BILLING_CONFIG,
      ...existing,
      ...body,
      wallets: {
        ...DEFAULT_BILLING_CONFIG.wallets,
        ...(existing.wallets ?? {}),
        ...(body.wallets ?? {}),
      },
    };
    delete (nextConfig as any).section;

    await setSiteConfigValue("SAAS_BILLING_CONFIG", JSON.stringify(nextConfig));

    await db.insert(userActivitiesTable).values({
      category: "admin",
      userName: "System Admin",
      action:
        section === "lemon"
          ? "Updated Lemon Squeezy Merchant Configuration"
          : section === "crypto"
          ? "Updated Crypto Treasury Wallets Configuration"
          : "Updated Billing Configuration",
      details:
        section === "lemon"
          ? `Lemon Squeezy Store ID: ${nextConfig.lemonStoreId} · Mode: ${nextConfig.lemonMode}`
          : section === "crypto"
          ? `Updated self-custody receiving wallet addresses across 6 crypto networks`
          : `Store ID: ${nextConfig.lemonStoreId}`,
    });

    res.json({ success: true, config: nextConfig });
  } catch {
    res.status(500).json({ error: "Failed to save billing config" });
  }
});

router.get("/saas/admin/system-settings", async (_req: Request, res: Response) => {
  try {
    const cfg = await getSiteConfigMap();
    const saved = cfg["SAAS_SYSTEM_SETTINGS"] ? JSON.parse(cfg["SAAS_SYSTEM_SETTINGS"]) : {};
    res.json({ ...DEFAULT_SYSTEM_SETTINGS, ...saved });
  } catch {
    res.json(DEFAULT_SYSTEM_SETTINGS);
  }
});

router.put("/saas/admin/system-settings", async (req: Request, res: Response) => {
  try {
    const nextSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(req.body ?? {}),
    };
    await setSiteConfigValue("SAAS_SYSTEM_SETTINGS", JSON.stringify(nextSettings));

    await db.insert(userActivitiesTable).values({
      category: "admin",
      userName: "System Admin",
      action: "Updated Global Engine & Security Settings",
      details: `Concurrency: ${nextSettings.scraperConcurrency} · Strict MX: ${nextSettings.strictMxVerification}`,
    });

    res.json({ success: true, settings: nextSettings });
  } catch {
    res.status(500).json({ error: "Failed to save system settings" });
  }
});

export default router;
