import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  SaasUser,
  SaasPlan,
  SaasPayment,
  UserActivity,
  SupportMessage,
  adminFetch,
  getCachedSaasUser,
  isUserAdmin,
  setSaasSession,
} from "@/lib/saas-auth";
import {
  Shield,
  KeyRound,
  Users,
  Layers,
  CreditCard,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  X,
  ArrowUpRight,
  ArrowLeft,
  Globe,
  Crosshair,
  LayoutDashboard,
  Menu,
  Pencil,
  Lock,
  Wallet,
  Mail,
  MessageSquare,
  Send,
  ArrowUpCircle,
  ArrowDownCircle,
  Sparkles,
} from "lucide-react";
import OwnerWebsiteBuilderPanel from "@/components/OwnerWebsiteBuilderPanel";
import MultiSmtpManagerPanel from "@/components/MultiSmtpManagerPanel";
import AdminApolloVoiceCockpit from "@/components/AdminApolloVoiceCockpit";

type AdminTab =
  | "overview"
  | "apollo-voice"
  | "website-builder"
  | "smtp"
  | "multipools"
  | "users"
  | "support"
  | "plans"
  | "lemonsqueezy"
  | "crypto"
  | "activities";

interface PoolKeyItem {
  id: string;
  label: string;
  masked: string;
  addedAt: string;
}

const DEFAULT_FALLBACK_PLANS: SaasPlan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "For solo consultants & boutique studios",
    tagline: "Single-market B2B lead discovery, live website audits, and automated outreach.",
    monthlyPrice: 49,
    annualPrice: 39,
    monthlyHuntLimit: 1000,
    monthlyEmailLimit: 3000,
    maxEmailAccounts: 2,
    bulkHuntEnabled: false,
    autoPilotEnabled: false,
    lemonCheckoutUrl: "https://store.lemonsqueezy.com/checkout/buy/starter-tier",
    lemonVariantId: "ls_var_starter_49",
    features: [
      "1,000 verified B2B leads / month",
      "Automated business discovery engine",
      "Real-time DNS & mail server verification",
      "2 rotational sender email accounts",
      "3,000 automated outreach emails / month",
      "Interactive client Website Audit Reports",
    ],
    isPopular: false,
    active: true,
  },
  {
    id: "growth",
    name: "Growth",
    audience: "For scaling digital agencies & outbound teams",
    tagline: "Multi-city bulk lead hunting, 10 rotational inboxes, and 24/7 autonomous outreach.",
    monthlyPrice: 149,
    annualPrice: 119,
    monthlyHuntLimit: 5000,
    monthlyEmailLimit: 15000,
    maxEmailAccounts: 10,
    bulkHuntEnabled: true,
    autoPilotEnabled: true,
    lemonCheckoutUrl: "https://store.lemonsqueezy.com/checkout/buy/growth-tier",
    lemonVariantId: "ls_var_growth_149",
    features: [
      "5,000 verified B2B leads / month",
      "20-City Bulk Hunter unlocked",
      "High-speed priority discovery cluster",
      "10 rotational sender email accounts",
      "15,000 outreach emails + smart follow-ups",
      "24/7 Autopilot Scheduler & Inbox classification",
    ],
    isPopular: true,
    active: true,
  },
  {
    id: "scale",
    name: "Agency Scale",
    audience: "For high-volume lead gen agencies & B2B syndicates",
    tagline: "High-concurrency multi-market extraction, 35 rotational inboxes, and white-label reports.",
    monthlyPrice: 349,
    annualPrice: 279,
    monthlyHuntLimit: 25000,
    monthlyEmailLimit: 75000,
    maxEmailAccounts: 35,
    bulkHuntEnabled: true,
    autoPilotEnabled: true,
    lemonCheckoutUrl: "https://store.lemonsqueezy.com/checkout/buy/scale-tier",
    lemonVariantId: "ls_var_scale_349",
    features: [
      "25,000 verified B2B leads / month",
      "Unlimited 20-City Bulk Hunter campaigns",
      "Dedicated high-throughput extraction workers",
      "35 rotational sender email accounts",
      "75,000 outreach emails + multi-touch sequences",
      "Custom branded Website Audit Reports",
    ],
    isPopular: false,
    active: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "For global revenue organizations & enterprise sales",
    tagline: "Uncapped multi-region pipelines, 100 rotational inboxes, and dedicated infrastructure.",
    monthlyPrice: 799,
    annualPrice: 649,
    monthlyHuntLimit: 100000,
    monthlyEmailLimit: 300000,
    maxEmailAccounts: 100,
    bulkHuntEnabled: true,
    autoPilotEnabled: true,
    lemonCheckoutUrl: "https://store.lemonsqueezy.com/checkout/buy/enterprise-tier",
    lemonVariantId: "ls_var_enterprise_799",
    features: [
      "100,000+ verified B2B leads / month",
      "Dedicated extraction cluster & custom regions",
      "100 rotational sender email accounts",
      "300,000 outreach emails / month",
      "Full CRM webhook & custom domain integration",
      "Priority SLA & dedicated revenue architect",
    ],
    isPopular: false,
    active: true,
  },
];

const MULTIPOOL_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini AI Multipool",
    quota: "Rotational LLM Scoring, Cold Emails, Website Audits & Reply AI",
    placeholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "google_maps",
    name: "Google Maps Places API Multipool",
    quota: "Places Text Search v1 · High-precision local business phone & website extraction",
    placeholder: "AIzaSy...",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "foursquare",
    name: "Foursquare Places v3 Multipool",
    quota: "1,000 free calls/day per key · Round-robin multi-account rotation",
    placeholder: "fsq3...",
    docsUrl: "https://foursquare.com/developers",
  },
  {
    id: "tomtom",
    name: "TomTom Search v2 POI Multipool",
    quota: "2,500 free requests/day per key · Global ISO-2 POI discovery",
    placeholder: "tt_key_...",
    docsUrl: "https://developer.tomtom.com",
  },
  {
    id: "here",
    name: "HERE Discover v1 API Multipool",
    quota: "1,000 free calls/day per key · Parallel geospatial offset blocks",
    placeholder: "here_api_...",
    docsUrl: "https://developer.here.com",
  },
  {
    id: "serpapi",
    name: "SerpAPI Google Local Multipool",
    quota: "Rotational SERP Local Pack & GMB extraction",
    placeholder: "serp_...",
    docsUrl: "https://serpapi.com",
  },
  {
    id: "hunter",
    name: "Hunter.io Domain Email Multipool",
    quota: "Rotational B2B decision-maker email enrichment",
    placeholder: "hntr_...",
    docsUrl: "https://hunter.io",
  },
];

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Admin Owner Access Gate state
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean>(() => {
    if (localStorage.getItem("vh_logged_out") === "true") return false;
    const cached = getCachedSaasUser();
    if (isUserAdmin(cached)) return true;
    if (localStorage.getItem("vh_admin_unlocked") === "true") return true;
    return false;
  });
  const [gateEmail, setGateEmail] = useState("jwandersonar@gmail.com");
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateBusy, setGateBusy] = useState(false);

  // Overview state
  const [metrics, setMetrics] = useState({
    mrrUsd: 0,
    arrUsd: 0,
    totalRevenueCollected: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalProspects: 0,
    totalReports: 0,
    totalTrackedEmails: 0,
    totalSmtpAccounts: 0,
  });
  const [users, setUsers] = useState<SaasUser[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>(DEFAULT_FALLBACK_PLANS);
  const [payments, setPayments] = useState<SaasPayment[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);

  // Multi-user selection, bulk plan change, delete confirmation & messaging state
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkTargetPlanId, setBulkTargetPlanId] = useState<string>("growth");
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);

  // Admin Support & Multi-User Broadcast state
  const [activeAdminThreadId, setActiveAdminThreadId] = useState<string | null>(null);
  const [supportFilter, setSupportFilter] = useState<"all" | "open" | "replied" | "resolved">("all");
  const [adminReplyBody, setAdminReplyBody] = useState<string>("");
  const [adminReplyStatus, setAdminReplyStatus] = useState<"replied" | "resolved">("replied");
  const [adminReplyBusy, setAdminReplyBusy] = useState<boolean>(false);

  // Multi-User Broadcast / Targeted Message Composer state
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<"selected" | "plan" | "all">("selected");
  const [broadcastPlanFilter, setBroadcastPlanFilter] = useState<string>("growth");
  const [broadcastSubject, setBroadcastSubject] = useState<string>("");
  const [broadcastCategory, setBroadcastCategory] = useState<string>("announcement");
  const [broadcastBody, setBroadcastBody] = useState<string>("");
  const [broadcastBusy, setBroadcastBusy] = useState<boolean>(false);

  // Multipool API state
  const [poolStatus, setPoolStatus] = useState<any>({});
  const [geminiPool, setGeminiPool] = useState<{ viaIntegration: boolean; keys: PoolKeyItem[] }>({
    viaIntegration: false,
    keys: [],
  });
  const [providerPools, setProviderPools] = useState<Record<string, PoolKeyItem[]>>({});
  const [newKeyInput, setNewKeyInput] = useState<Record<string, string>>({});
  const [newLabelInput, setNewLabelInput] = useState<Record<string, string>>({});

  // Editing existing key in a multipool
  const [editingPoolKey, setEditingPoolKey] = useState<{
    providerId: string;
    keyId: string;
    label: string;
    apiKey: string;
  } | null>(null);

  // Single transactional API keys state
  const [singleKeys, setSingleKeys] = useState<Record<string, { masked: string; set: boolean }>>({});
  const [singleKeyEdits, setSingleKeyEdits] = useState<Record<string, string>>({});

  // User Provisioning & Editing state
  const [newUserForm, setNewUserForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
    role: "user",
    planId: "growth",
    creditsBalance: 5000,
  });
  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState<{
    id: number;
    fullName: string;
    companyName: string;
    email: string;
    password: string;
    role: "admin" | "user";
    planId: string;
    billingCycle: "monthly" | "annual";
    status: string;
    creditsBalance: number;
  } | null>(null);

  // Billing Config state
  const [billingConfig, setBillingConfig] = useState({
    lemonStoreId: "94821",
    lemonMode: "live",
    lemonWebhookConfigured: true,
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
  });

  // System Settings state
  const [systemSettings, setSystemSettings] = useState({
    scraperConcurrency: 20,
    strictMxVerification: true,
    cloudflareEmailDecoder: true,
    defaultSignupCredits: 250,
    allowPublicRegistration: true,
    maintenanceMode: false,
    globalRateLimitPerMin: 120,
    apolloEnrichmentEnabled: true,
    apolloDecisionMaker: true,
    apolloTechStackSignals: true,
    apolloBuyerIntentScore: true,
    apolloSmartFilters: true,
    apolloMultiChannelCockpit: true,
    apolloVoiceNoteEnabled: true,
    apolloMachineCallerEnabled: true,
    apolloAccessMode: "all_plans" as "all_plans" | "growth_and_above" | "owner_only",
  });

  // Activity filter
  const [activityFilter, setActivityFilter] = useState<string>("all");

  const showToast = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4500);
  };

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, poolStatusRes, geminiRes, singleKeysRes, billingCfgRes, sysSettingsRes] = await Promise.all([
        adminFetch("/api/saas/admin/overview").catch(() => null),
        adminFetch("/api/api-pools/status").catch(() => ({})),
        adminFetch("/api/admin/gemini-keys").catch(() => ({ viaIntegration: true, keys: [] })),
        adminFetch("/api/admin/api-keys").catch(() => ({})),
        fetch("/api/saas/billing/config").then((r) => r.json()).catch(() => null),
        adminFetch("/api/saas/admin/system-settings").catch(() => null),
      ]);

      if (overviewRes) {
        if (overviewRes.metrics) setMetrics(overviewRes.metrics);
        if (Array.isArray(overviewRes.users)) setUsers(overviewRes.users);
        if (Array.isArray(overviewRes.plans) && overviewRes.plans.length > 0) {
          const order = ["starter", "growth", "scale", "enterprise"];
          const sorted = [...overviewRes.plans].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
          setPlans(sorted);
        }
        if (Array.isArray(overviewRes.payments)) setPayments(overviewRes.payments);
        if (Array.isArray(overviewRes.activities)) setActivities(overviewRes.activities);
        if (Array.isArray(overviewRes.supportMessages)) setSupportMessages(overviewRes.supportMessages);
      }

      setPoolStatus(poolStatusRes || {});
      setGeminiPool(geminiRes || { viaIntegration: false, keys: [] });
      setSingleKeys(singleKeysRes || {});
      if (billingCfgRes) {
        setBillingConfig((prev) => ({
          ...prev,
          ...billingCfgRes,
          wallets: {
            ...prev.wallets,
            ...(billingCfgRes.wallets || {}),
          },
        }));
      }
      if (sysSettingsRes) setSystemSettings((prev) => ({ ...prev, ...sysSettingsRes }));

      // Load individual provider pools
      const provList = ["google_maps", "foursquare", "tomtom", "here", "serpapi", "hunter"];
      const loadedPools: Record<string, PoolKeyItem[]> = {};
      await Promise.all(
        provList.map(async (p) => {
          try {
            const d = await adminFetch(`/api/api-pools/${p}`);
            loadedPools[p] = d.keys || [];
          } catch {
            loadedPools[p] = [];
          }
        })
      );
      setProviderPools(loadedPools);
    } catch (err: any) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorizedAdmin) {
      loadAllAdminData();
    }
  }, [isAuthorizedAdmin, loadAllAdminData]);

  const handleAdminGateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError("");
    setGateBusy(true);
    try {
      // Allow owner master password or standard admin login
      if (gatePassword === "admin123") {
        const res = await fetch("/api/saas/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "admin@vanguardhunter.io", password: "admin123" }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
          setSaasSession(data.token, data.user);
          localStorage.setItem("vh_admin_token", data.token);
          localStorage.setItem("vh_admin_unlocked", "true");
          setIsAuthorizedAdmin(true);
          return;
        }
      }

      const res = await fetch("/api/saas/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gateEmail, password: gatePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid admin credentials");
      if (!isUserAdmin(data.user)) {
        throw new Error("Access denied: This account does not have Administrator privileges.");
      }

      setSaasSession(data.token, data.user);
      localStorage.setItem("vh_admin_token", data.token);
      localStorage.setItem("vh_admin_unlocked", "true");
      setIsAuthorizedAdmin(true);
    } catch (err: any) {
      setGateError(err.message || "Admin authentication failed");
    } finally {
      setGateBusy(false);
    }
  };

  const handleOwnerInstantUnlock = async () => {
    setGateBusy(true);
    setGateError("");
    try {
      const res = await fetch("/api/saas/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@vanguardhunter.io", password: "admin123" }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setSaasSession(data.token, data.user);
        localStorage.setItem("vh_admin_token", data.token);
      } else {
        localStorage.setItem("vh_admin_token", "admin123");
      }
      localStorage.setItem("vh_admin_unlocked", "true");
      setIsAuthorizedAdmin(true);
    } catch {
      localStorage.setItem("vh_admin_token", "admin123");
      localStorage.setItem("vh_admin_unlocked", "true");
      setIsAuthorizedAdmin(true);
    } finally {
      setGateBusy(false);
    }
  };

  // ─── Multipool Key Handlers ─────────────────────────────────────────────────

  const handleAddPoolKey = async (providerId: string) => {
    const apiKey = (newKeyInput[providerId] || "").trim();
    const label = (newLabelInput[providerId] || "").trim();
    if (!apiKey) {
      showToast("error", "Please enter a valid API key before adding to the rotational pool.");
      return;
    }

    try {
      if (providerId === "gemini") {
        await adminFetch("/api/admin/gemini-keys", {
          method: "POST",
          body: JSON.stringify({ apiKey, label }),
        });
      } else {
        await adminFetch(`/api/api-pools/${providerId}`, {
          method: "POST",
          body: JSON.stringify({ apiKey, label }),
        });
      }
      setNewKeyInput((prev) => ({ ...prev, [providerId]: "" }));
      setNewLabelInput((prev) => ({ ...prev, [providerId]: "" }));
      showToast("success", `Added rotational key to ${providerId.toUpperCase()} multipool.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to add API key");
    }
  };

  const handleSaveEditedPoolKey = async () => {
    if (!editingPoolKey) return;
    const { providerId, keyId, label, apiKey } = editingPoolKey;
    try {
      if (providerId === "gemini") {
        await adminFetch(`/api/admin/gemini-keys/${keyId}`, {
          method: "PUT",
          body: JSON.stringify({ label, apiKey: apiKey || undefined }),
        });
      } else {
        await adminFetch(`/api/api-pools/${providerId}/${keyId}`, {
          method: "PUT",
          body: JSON.stringify({ label, apiKey: apiKey || undefined }),
        });
      }
      setEditingPoolKey(null);
      showToast("success", `Updated key in ${providerId.toUpperCase()} multipool.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update API key");
    }
  };

  const handleDeletePoolKey = async (providerId: string, keyId: string) => {
    try {
      if (providerId === "gemini") {
        await adminFetch(`/api/admin/gemini-keys/${keyId}`, { method: "DELETE" });
      } else {
        await adminFetch(`/api/api-pools/${providerId}/${keyId}`, { method: "DELETE" });
      }
      showToast("success", `Removed key from ${providerId.toUpperCase()} multipool.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to remove key");
    }
  };

  const handleSaveSingleKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify(singleKeyEdits),
      });
      setSingleKeyEdits({});
      showToast("success", "Saved Global Brevo SMTP Relay credentials.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save SMTP keys");
    }
  };

  // ─── User Management Handlers ───────────────────────────────────────────────

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch("/api/saas/admin/users", {
        method: "POST",
        body: JSON.stringify(newUserForm),
      });
      setNewUserForm({
        fullName: "",
        companyName: "",
        email: "",
        password: "",
        role: "user",
        planId: "growth",
        creditsBalance: 5000,
      });
      showToast("success", "Provisioned new SaaS user workspace.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async (userId: number, updates: Record<string, any>) => {
    try {
      await adminFetch(`/api/saas/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      showToast("success", "Updated user workspace settings.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update user");
    }
  };

  const handleSaveEditingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await adminFetch(`/api/saas/admin/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editingUser.fullName,
          companyName: editingUser.companyName,
          email: editingUser.email,
          password: editingUser.password || undefined,
          role: editingUser.role,
          planId: editingUser.planId,
          billingCycle: editingUser.billingCycle,
          status: editingUser.status,
          creditsBalance: Number(editingUser.creditsBalance),
        }),
      });
      setEditingUser(null);
      showToast("success", "Saved user account changes.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update user");
    }
  };

  const PLAN_ORDER = ["starter", "growth", "scale", "enterprise"];

  const handleManualUpgradeUser = async (u: SaasUser) => {
    const currIdx = PLAN_ORDER.indexOf(u.planId);
    const nextPlanId = currIdx >= 0 && currIdx < PLAN_ORDER.length - 1 ? PLAN_ORDER[currIdx + 1] : "enterprise";
    if (nextPlanId === u.planId) {
      showToast("success", `${u.fullName} is already on the highest tier (Enterprise).`);
      return;
    }
    try {
      await adminFetch(`/api/saas/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ planId: nextPlanId, syncPlanCredits: true }),
      });
      showToast("success", `Manually upgraded ${u.fullName} from ${u.planId.toUpperCase()} → ${nextPlanId.toUpperCase()}!`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to upgrade user");
    }
  };

  const handleManualDowngradeUser = async (u: SaasUser) => {
    const currIdx = PLAN_ORDER.indexOf(u.planId);
    const prevPlanId = currIdx > 0 ? PLAN_ORDER[currIdx - 1] : "starter";
    if (prevPlanId === u.planId) {
      showToast("success", `${u.fullName} is already on the lowest tier (Starter).`);
      return;
    }
    try {
      await adminFetch(`/api/saas/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ planId: prevPlanId, syncPlanCredits: true }),
      });
      showToast("success", `Manually downgraded ${u.fullName} from ${u.planId.toUpperCase()} → ${prevPlanId.toUpperCase()}.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to downgrade user");
    }
  };

  const handleBulkChangePlan = async () => {
    if (selectedUserIds.length === 0) {
      showToast("error", "Select at least one user first.");
      return;
    }
    try {
      const res = await adminFetch("/api/saas/admin/users/bulk-plan", {
        method: "POST",
        body: JSON.stringify({ userIds: selectedUserIds, planId: bulkTargetPlanId }),
      });
      showToast("success", `Updated ${res.count || selectedUserIds.length} user(s) to ${bulkTargetPlanId.toUpperCase()} plan.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to bulk update plans");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await adminFetch(`/api/saas/admin/users/${userId}`, { method: "DELETE" });
      setDeleteConfirmUserId(null);
      setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
      showToast("success", "Permanently deleted user account and cleaned up workspace records.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete user");
    }
  };

  const toggleSelectUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllFilteredUsers = () => {
    const visibleIds = filteredUsers.map((u) => u.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleOpenMessageComposerForUsers = (userIdsToMessage: number[], mode: "selected" | "all" = "selected") => {
    setSelectedUserIds(userIdsToMessage);
    setBroadcastTargetMode(mode);
    handleSelectTab("support");
  };

  // Group supportMessages into threads for Admin Support Desk
  const adminSupportThreads = React.useMemo(() => {
    const map = new Map<
      string,
      {
        threadId: string;
        userId: number;
        userName: string;
        userEmail: string;
        subject: string;
        category: string;
        status: string;
        lastMessageAt: string;
        hasUnreadFromUser: boolean;
        messages: SupportMessage[];
      }
    >();

    const chronological = [...supportMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const msg of chronological) {
      const existing = map.get(msg.threadId);
      if (!existing) {
        map.set(msg.threadId, {
          threadId: msg.threadId,
          userId: msg.userId,
          userName: msg.userName || msg.userEmail,
          userEmail: msg.userEmail,
          subject: msg.subject || "Support Inquiry",
          category: msg.category || "general",
          status: msg.status || "open",
          lastMessageAt: msg.createdAt,
          hasUnreadFromUser: !msg.readByAdmin && msg.senderRole === "user",
          messages: [msg],
        });
      } else {
        existing.messages.push(msg);
        existing.status = msg.status || existing.status;
        existing.lastMessageAt = msg.createdAt;
        if (!msg.readByAdmin && msg.senderRole === "user") {
          existing.hasUnreadFromUser = true;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [supportMessages]);

  const unreadAdminSupportCount = adminSupportThreads.filter((t) => t.hasUnreadFromUser).length;

  const filteredSupportThreads = adminSupportThreads.filter((t) => {
    if (supportFilter === "all") return true;
    return t.status === supportFilter;
  });

  const activeAdminThread =
    adminSupportThreads.find((t) => t.threadId === activeAdminThreadId) ||
    filteredSupportThreads[0] ||
    null;

  const handleSelectAdminThread = async (threadId: string) => {
    setActiveAdminThreadId(threadId);
    const thr = adminSupportThreads.find((t) => t.threadId === threadId);
    if (thr?.hasUnreadFromUser) {
      setSupportMessages((prev) =>
        prev.map((m) => (m.threadId === threadId ? { ...m, readByAdmin: true } : m))
      );
      try {
        await adminFetch(`/api/saas/admin/support/thread/${encodeURIComponent(threadId)}`, {
          method: "PATCH",
          body: JSON.stringify({ readByAdmin: true }),
        });
      } catch {}
    }
  };

  const handleAdminReplySupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdminThread || !adminReplyBody.trim()) return;
    setAdminReplyBusy(true);
    try {
      await adminFetch("/api/saas/admin/support/reply", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeAdminThread.threadId,
          userId: activeAdminThread.userId,
          subject: activeAdminThread.subject,
          category: activeAdminThread.category,
          body: adminReplyBody.trim(),
          status: adminReplyStatus,
        }),
      });
      setAdminReplyBody("");
      showToast("success", `Sent response to ${activeAdminThread.userName} (${activeAdminThread.userEmail})!`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to send admin response");
    } finally {
      setAdminReplyBusy(false);
    }
  };

  const handleUpdateThreadStatus = async (threadId: string, status: "open" | "replied" | "resolved") => {
    try {
      await adminFetch(`/api/saas/admin/support/thread/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, readByAdmin: true }),
      });
      showToast("success", `Marked support thread as ${status.toUpperCase()}.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update thread status");
    }
  };

  const handleBroadcastMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      showToast("error", "Please enter both a Subject and Message body.");
      return;
    }
    if (broadcastTargetMode === "selected" && selectedUserIds.length === 0) {
      showToast("error", "Please select at least one user recipient below.");
      return;
    }
    setBroadcastBusy(true);
    try {
      const res = await adminFetch("/api/saas/admin/support/broadcast", {
        method: "POST",
        body: JSON.stringify({
          targetMode: broadcastTargetMode,
          userIds: selectedUserIds,
          targetPlan: broadcastPlanFilter,
          subject: broadcastSubject.trim(),
          category: broadcastCategory,
          body: broadcastBody.trim(),
        }),
      });
      setBroadcastSubject("");
      setBroadcastBody("");
      showToast("success", res.message || `Delivered message to ${res.recipientCount} user(s)!`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to dispatch message to users");
    } finally {
      setBroadcastBusy(false);
    }
  };

  // ─── Plan Update Handler ────────────────────────────────────────────────────

  const handleSavePlan = async (plan: SaasPlan) => {
    try {
      await adminFetch(`/api/saas/admin/plans/${plan.id}`, {
        method: "PUT",
        body: JSON.stringify(plan),
      });
      showToast("success", `Saved ${plan.name} plan pricing, quotas & features.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update plan");
    }
  };

  // ─── Payment & Billing Handlers ─────────────────────────────────────────────

  const handleVerifyPayment = async (paymentId: number, status: "completed" | "rejected") => {
    try {
      await adminFetch(`/api/saas/admin/payments/${paymentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          adminNote: status === "completed" ? "Approved & settled by Admin Treasury" : "Rejected by Admin Treasury",
        }),
      });
      showToast("success", `Payment #${paymentId} marked as ${status.toUpperCase()}.`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update payment");
    }
  };

  const handleSaveLemonConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lemonKeyPayload: Record<string, string> = {};
      if (singleKeyEdits["LEMONSQUEEZY_API_KEY"]?.trim()) {
        lemonKeyPayload["LEMONSQUEEZY_API_KEY"] = singleKeyEdits["LEMONSQUEEZY_API_KEY"].trim();
      }
      if (singleKeyEdits["LEMONSQUEEZY_STORE_ID"]?.trim()) {
        lemonKeyPayload["LEMONSQUEEZY_STORE_ID"] = singleKeyEdits["LEMONSQUEEZY_STORE_ID"].trim();
      }
      if (Object.keys(lemonKeyPayload).length > 0) {
        await adminFetch("/api/admin/api-keys", {
          method: "POST",
          body: JSON.stringify(lemonKeyPayload),
        });
        setSingleKeyEdits((prev) => {
          const next = { ...prev };
          delete next["LEMONSQUEEZY_API_KEY"];
          delete next["LEMONSQUEEZY_STORE_ID"];
          return next;
        });
      }

      await adminFetch("/api/saas/admin/billing-config", {
        method: "PUT",
        body: JSON.stringify({
          section: "lemon",
          lemonStoreId: billingConfig.lemonStoreId,
          lemonMode: billingConfig.lemonMode,
          lemonWebhookConfigured: billingConfig.lemonWebhookConfigured,
          lemonEnabled: billingConfig.lemonEnabled,
        }),
      });
      showToast("success", "Saved Lemon Squeezy merchant & API configuration.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save Lemon Squeezy configuration");
    }
  };

  const handleSaveCryptoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch("/api/saas/admin/billing-config", {
        method: "PUT",
        body: JSON.stringify({
          section: "crypto",
          cryptoEnabled: billingConfig.cryptoEnabled,
          wallets: billingConfig.wallets,
        }),
      });
      showToast("success", "Saved Crypto Treasury receiving wallet addresses across all 6 networks.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save Crypto Treasury configuration");
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch("/api/saas/admin/system-settings", {
        method: "PUT",
        body: JSON.stringify(systemSettings),
      });
      showToast("success", "Updated global engine & Intelligence parameters.");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save system settings");
    }
  };

  const handleToggleApolloModule = async (patch: Partial<typeof systemSettings>, label: string) => {
    const next = { ...systemSettings, ...patch };
    setSystemSettings(next);
    try {
      await adminFetch("/api/saas/admin/system-settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      showToast("success", `Saved Module Setting: ${label}`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to save module toggle");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.companyName.toLowerCase().includes(q)
    );
  });

  const filteredActivities = activities.filter((a) =>
    activityFilter === "all" ? true : a.category === activityFilter
  );

  const handleGoBack = () => {
    if (editingUser) {
      setEditingUser(null);
      return;
    }
    if (activeTab !== "overview") {
      setActiveTab("overview");
      return;
    }
    setLocation("/landing");
  };

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Owner-Only Access Gate (if logged in as a regular non-admin user) ──────
  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Owner Restricted</span>
            </span>
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold text-white">Executive Admin Control Plane</h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              This console is restricted exclusively to the platform owner. Regular subscriber accounts do not have visibility or access to system administration.
            </p>
          </div>

          {gateError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
              {gateError}
            </div>
          )}

          <form onSubmit={handleAdminGateLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Owner Admin Email</label>
              <input
                type="email"
                required
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                placeholder="jwandersonar@gmail.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Admin Password / Master Key</label>
              <input
                type="password"
                required
                value={gatePassword}
                onChange={(e) => setGatePassword(e.target.value)}
                placeholder="Enter your password or admin123"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={gateBusy}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {gateBusy ? "Verifying Owner Credentials..." : "Unlock Admin Control Plane"}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleOwnerInstantUnlock}
              disabled={gateBusy}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              Instant Owner Console Unlock (jwandersonar@gmail.com) →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div>
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => setLocation("/landing")}
            className="font-display text-lg font-bold tracking-tight text-white cursor-pointer"
          >
            Vanguard Admin
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <button
            type="button"
            onClick={() => setLocation("/landing")}
            className="w-full mb-4 flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Landing Page</span>
          </button>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400">Owner Control Plane</span>
              <span className="text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                ROOT
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">jwandersonar@gmail.com</div>
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Est. Yield / City</span>
              <span className="font-mono-num font-semibold text-emerald-400">
                {poolStatus?.estimatedYieldPerCity || 125} leads
              </span>
            </div>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-1.5">
            System Modules (Click to Edit)
          </div>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => handleSelectTab("overview")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">1. Executive Telemetry</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("apollo-voice")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "apollo-voice"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30"
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Crosshair className="w-4 h-4 shrink-0" />
                <span className="truncate">🎙️ AI Caller</span>
              </span>
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-950 text-emerald-400 shrink-0">
                NEW
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("website-builder")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "website-builder"
                  ? "bg-amber-400 text-slate-950 font-bold"
                  : "text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span className="truncate">AI Website Builder</span>
              </span>
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-950 text-amber-400 shrink-0">
                Owner
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("multipools")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "multipools"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span className="truncate">2. Multipool API Keys</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("users")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "users"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="truncate">3. Users & Quotas ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("support")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "support"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="flex items-center gap-3 truncate">
                <MessageSquare className="w-4 h-4 shrink-0 text-blue-400" />
                <span className="truncate">4. Support & Messaging</span>
              </span>
              {unreadAdminSupportCount > 0 ? (
                <span className="font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 shrink-0">
                  {unreadAdminSupportCount}
                </span>
              ) : (
                <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                  {adminSupportThreads.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("plans")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "plans"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="truncate">5. SaaS Plans & Pricing</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("lemonsqueezy")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "lemonsqueezy"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span className="truncate">6. Lemon Squeezy</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("crypto")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "crypto"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span className="truncate">7. Crypto Treasury</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("activities")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "activities"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span className="truncate">8. Activity & Engine</span>
            </button>
          </nav>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setLocation("/crm");
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Crosshair className="w-4 h-4 text-blue-400" />
                <span>Launch Hunter CRM</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setLocation("/dashboard");
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>User Dashboard</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setLocation("/landing");
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Globe className="w-4 h-4" />
                <span>Public Landing Page</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
        Vanguard Revenue Systems · Owner Console
      </div>
    </>
  );

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row">
      {/* Left Admin Sidebar (visible on md+ screens >= 768px so it never hides on laptop/preview panes) */}
      <aside className="hidden md:flex w-[255px] shrink-0 bg-slate-950 text-slate-200 border-r border-slate-800 flex-col justify-between md:sticky md:top-0 md:h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Admin Sidebar Drawer (< 768px) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs md:hidden flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[265px] max-w-[85vw] h-full overflow-y-auto bg-slate-950 text-slate-200 border-r border-slate-800 flex flex-col justify-between shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Bar Contract with Mobile Drawer Toggle & Explicit Back Button */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Open admin menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 truncate">
              <span className="hidden sm:inline">Owner Admin</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="text-slate-900 font-semibold capitalize truncate">{activeTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectTab("apollo-voice")}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>🎙️ AI Caller</span>
            </button>
            <button
              type="button"
              onClick={loadAllAdminData}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab("smtp")}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Multi-SMTP &amp; Gmails</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab("multipools")}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
            >
              Edit API Keys
            </button>
          </div>
        </header>

        {/* Horizontal Quick-Navigation Tab Strip (Always accessible on mobile and tablet) */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "overview", label: "1. Overview" },
              { id: "apollo-voice", label: "🎙️ AI Voice/Caller (NEW)" },
              { id: "website-builder", label: "✨ AI Website Builder (Owner Only)" },
              { id: "smtp", label: "📧 Multi-SMTP & Gmails" },
              { id: "multipools", label: "2. API Multipools" },
              { id: "users", label: "3. Users & Quotas" },
              {
                id: "support",
                label:
                  unreadAdminSupportCount > 0
                    ? `4. Support & Msg (${unreadAdminSupportCount} New)`
                    : "4. Support & Msg",
              },
              { id: "plans", label: "5. SaaS Plans" },
              { id: "lemonsqueezy", label: "6. Lemon Squeezy" },
              { id: "crypto", label: "7. Crypto Treasury" },
              { id: "activities", label: "8. Engine & Logs" },
            ] as { id: AdminTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:text-slate-950"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 max-w-[1240px] w-full mx-auto space-y-6 overflow-x-hidden">
          {notice && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-sm ${
                notice.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} className="cursor-pointer shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MODULE: APOLLO+ B2B INTELLIGENCE, $0 AI VOICE STUDIO & OUTBOUND MACHINE CALLER */}
          {activeTab === "apollo-voice" && (
            <AdminApolloVoiceCockpit
              systemSettings={systemSettings}
              onToggleModule={handleToggleApolloModule}
              onLaunchCrm={() => setLocation("/crm")}
            />
          )}

          {/* MODULE: OWNER-ONLY AI AUTO-WEBSITE BUILDER */}
          {activeTab === "website-builder" && <OwnerWebsiteBuilderPanel />}

          {/* MODULE: MULTI-SMTP & MULTIPLE GMAILS ROTATIONAL POOL + APP PASSWORD GUIDE */}
          {activeTab === "smtp" && (
            <MultiSmtpManagerPanel
              mode="admin"
              onAccountsChanged={(count) =>
                setMetrics((prev) => ({ ...prev, totalSmtpAccounts: count }))
              }
            />
          )}

          {/* MODULE 1: EXECUTIVE TELEMETRY OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Monthly Recurring Revenue (MRR)</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    ${metrics.mrrUsd.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-mono-num">
                    ARR Run Rate: ${metrics.arrUsd.toLocaleString()}/yr
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Active SaaS Workspaces</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {metrics.activeUsers} <span className="text-xs font-normal text-slate-400">/ {metrics.totalUsers} total</span>
                  </div>
                  <div className="text-xs text-emerald-700 font-medium mt-2">
                    Settled Revenue: ${metrics.totalRevenueCollected.toLocaleString()}
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Verified CRM Leads & Audits</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {metrics.totalProspects.toLocaleString()} leads
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-mono-num">
                    {metrics.totalReports} Website Audit Reports live
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Multipool Yield Capacity</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {poolStatus?.estimatedYieldPerCity || 125} leads/city
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    18 Scrapers + Rotational API Pools
                  </div>
                </div>
              </div>

              {/* Quick Edit Shortcuts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectTab("smtp")}
                  className="p-4 bg-emerald-50/60 hover:bg-emerald-50 rounded-xl border border-emerald-300 hover:border-emerald-600 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
                    <span>Multi-SMTP &amp; Gmails</span>
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Connect multiple Gmails (with App Password guide) &amp; wire all sending activities
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("multipools")}
                  className="p-4 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-600 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-blue-700 flex items-center justify-between">
                    <span>Edit API Multipools</span>
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Add, edit, or remove Gemini, Google Maps, Foursquare, TomTom & HERE keys
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("users")}
                  className="p-4 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-600 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-blue-700 flex items-center justify-between">
                    <span>Edit Users & Quotas</span>
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Create accounts, edit user plans, grant credits, or suspend workspaces
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("plans")}
                  className="p-4 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-600 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-blue-700 flex items-center justify-between">
                    <span>Edit SaaS Plans & Pricing</span>
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Customize monthly/annual prices, lead limits, inbox caps & tier features
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("lemonsqueezy")}
                  className="p-4 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-600 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-blue-700 flex items-center justify-between">
                    <span>Edit Lemon Squeezy</span>
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Configure Store ID, API key, checkout links & card subscription orders
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("crypto")}
                  className="p-4 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-600 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-blue-700 flex items-center justify-between">
                    <span>Edit Crypto Treasury</span>
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Edit USDT, USDC, BTC, ETH & SOL receiving wallets & approve on-chain TXs
                  </p>
                </button>
              </div>

              {/* Apollo+ Intelligence Modules & Master Kill-Switch Control Center */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-950">
                        B2B Intelligence Modules &amp; Master Kill-Switches
                      </h2>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          systemSettings.apolloEnrichmentEnabled
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-300"
                        }`}
                      >
                        {systemSettings.apolloEnrichmentEnabled ? "ACTIVE IN CRM" : "DISABLED BY ADMIN"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Toggle any capability ON or OFF in 1 click. Turning a module OFF immediately hides it from the Lead Hunter &amp; CRM without affecting your core system.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSelectTab("apollo-voice")}
                      className="px-3.5 py-1.5 text-xs font-extrabold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
                    >
                      🎙️ Open Live AI Voice &amp; Machine Caller Studio →
                    </button>

                    <select
                      value={systemSettings.apolloAccessMode || "all_plans"}
                      onChange={(e) =>
                        handleToggleApolloModule(
                          { apolloAccessMode: e.target.value as any },
                          `Plan Access (${e.target.value})`
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
                    >
                      <option value="all_plans">Available to All Plans (Starter+)</option>
                      <option value="growth_and_above">Growth ($149) &amp; Scale ($349) Only</option>
                      <option value="owner_only">Owner Admin Only</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleApolloModule(
                          { apolloEnrichmentEnabled: !systemSettings.apolloEnrichmentEnabled },
                          systemSettings.apolloEnrichmentEnabled ? "All Modules OFF" : "All Modules ON"
                        )
                      }
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        systemSettings.apolloEnrichmentEnabled
                          ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {systemSettings.apolloEnrichmentEnabled ? "Disable All Modules" : "Enable All Modules"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    {
                      key: "apolloDecisionMaker" as const,
                      title: "1. Decision-Maker & LinkedIn",
                      desc: "Extracts Owner/Doctor/CEO name, role, executive email & 1-click LinkedIn X-Ray lookup.",
                    },
                    {
                      key: "apolloTechStackSignals" as const,
                      title: "2. Tech-Stack & Pixel Scanner",
                      desc: "Detects WordPress, Shopify, Wix, Meta Pixel, GA4 & missing AI chat/booking widgets.",
                    },
                    {
                      key: "apolloBuyerIntentScore" as const,
                      title: "3. Buyer Intent Score (0–100)",
                      desc: "Ranks leads into Hot Buyers (80+), Warm (55–79), and Cold with revenue-leak reasons.",
                    },
                    {
                      key: "apolloSmartFilters" as const,
                      title: "4. Smart Signal Filter Bar",
                      desc: "1-click filter buttons in Hunter & CRM for Hot Buyers, Missing Pixels, No Chat & Owner Found.",
                    },
                    {
                      key: "apolloMultiChannelCockpit" as const,
                      title: "5. Multi-Channel & Call Scripts",
                      desc: "30-sec Cold Call Opener, Gatekeeper Bypass, SMS, LinkedIn DM & {{tech_gap}} variables.",
                    },
                    {
                      key: "apolloVoiceNoteEnabled" as const,
                      title: "6. 🎙️ Free AI Voice-Note Pitch ($0 API)",
                      desc: "Generates studio human AI voice-note pitches (.wav) for WhatsApp, Email & Audit Reports using built-in neural voices.",
                    },
                    {
                      key: "apolloMachineCallerEnabled" as const,
                      title: "7. 📞 Outbound AI Machine Caller",
                      desc: "Automated outbound AI phone caller pool (Bland AI / Retell AI / Vapi) that rings business phones and speaks for you.",
                    },
                  ].map((mod) => {
                    const isOn = Boolean(systemSettings.apolloEnrichmentEnabled && systemSettings[mod.key]);
                    return (
                      <div
                        key={mod.key}
                        className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                          isOn
                            ? "border-blue-200 bg-blue-50/30"
                            : "border-slate-200 bg-slate-50 opacity-75"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-950">{mod.title}</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleApolloModule(
                                  {
                                    apolloEnrichmentEnabled: true,
                                    [mod.key]: !systemSettings[mod.key],
                                  },
                                  `${mod.title}: ${!systemSettings[mod.key] ? "ON" : "OFF"}`
                                )
                              }
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer shrink-0 ${
                                isOn
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {isOn ? "ON" : "OFF"}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{mod.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multipool Cluster Status Summary Bar */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-950">
                      Rotational API Multipool Health (Gemini, Google Maps, Foursquare, TomTom, HERE)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click any provider below to add, edit, or rotate keys in its multipool
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab("multipools")}
                    className="text-xs font-semibold text-blue-700 hover:underline self-start sm:self-auto cursor-pointer"
                  >
                    Open Full API Key Editor →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {MULTIPOOL_PROVIDERS.map((prov) => {
                    const count =
                      prov.id === "gemini"
                        ? geminiPool.keys.length + (geminiPool.viaIntegration ? 1 : 0)
                        : (providerPools[prov.id]?.length || 0);
                    return (
                      <button
                        type="button"
                        key={prov.id}
                        onClick={() => handleSelectTab("multipools")}
                        className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-600 text-left transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-950 truncate">{prov.id.toUpperCase()}</div>
                        <div className="font-mono-num text-lg font-bold text-blue-700 mt-1">{count} keys</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {count > 0 ? "Active Rotation" : "Click to Add"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Three-Column Recent Lemon Squeezy, Recent Crypto Treasury & Global User Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-950">Lemon Squeezy Settlements</h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab("lemonsqueezy")}
                      className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Open Lemon Squeezy
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {payments.filter((p) => p.paymentMethod === "lemon_squeezy").slice(0, 5).length === 0 ? (
                      <div className="p-5 text-xs text-slate-500 text-center">No Lemon Squeezy settlements yet.</div>
                    ) : (
                      payments
                        .filter((p) => p.paymentMethod === "lemon_squeezy")
                        .slice(0, 5)
                        .map((p) => (
                          <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {p.userName || p.userEmail} · <span className="uppercase">{p.planId}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono-num truncate">
                                {p.txHashOrRef}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono-num font-bold text-slate-950">${p.amountUsd}</div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  p.status === "completed" ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {p.status.toUpperCase()}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-950">Crypto Treasury Settlements</h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab("crypto")}
                      className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Open Crypto Treasury
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {payments.filter((p) => p.paymentMethod !== "lemon_squeezy").slice(0, 5).length === 0 ? (
                      <div className="p-5 text-xs text-slate-500 text-center">No Crypto settlements yet.</div>
                    ) : (
                      payments
                        .filter((p) => p.paymentMethod !== "lemon_squeezy")
                        .slice(0, 5)
                        .map((p) => (
                          <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {p.userName || p.userEmail} · <span className="uppercase">{p.planId}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono-num truncate">
                                {p.cryptoNetwork || p.paymentMethod} · {p.txHashOrRef}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono-num font-bold text-slate-950">${p.amountUsd}</div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  p.status === "completed" ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {p.status.toUpperCase()}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-950">Live Multi-User Activity Stream</h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab("activities")}
                      className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Full Audit Log
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {activities.slice(0, 5).map((act) => (
                      <div key={act.id} className="px-5 py-3.5 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {act.userName || act.userEmail}: {act.action}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{act.details}</div>
                        </div>
                        <div className="text-[11px] font-mono-num text-slate-400 shrink-0">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: MULTIPOOL API CLUSTER CONTROLLER (WITH INLINE EDIT + ADD + DELETE) */}
          {activeTab === "multipools" && (
            <div className="space-y-6">
              <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200">
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                  Multipool Rotational API Key Controller
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                  Add, edit, or remove unlimited API keys for Google Gemini AI, Google Maps Places, Foursquare v3, TomTom Search v2, HERE Discover, SerpAPI, and Hunter.io. Keys rotate round-robin automatically across all tenant hunts.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {MULTIPOOL_PROVIDERS.map((prov) => {
                  const keys: PoolKeyItem[] =
                    prov.id === "gemini" ? geminiPool.keys : providerPools[prov.id] || [];
                  const hasEnv =
                    prov.id === "gemini"
                      ? geminiPool.viaIntegration
                      : Boolean(poolStatus?.[prov.id]?.envFallback);

                  return (
                    <div key={prov.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-bold text-slate-950">{prov.name}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{prov.quota}</p>
                          </div>
                          <span className="font-mono-num text-xs font-semibold text-blue-700 shrink-0">
                            {keys.length} pool keys
                          </span>
                        </div>

                        {/* Existing keys in pool */}
                        <div className="mt-4 mb-5 space-y-2">
                          {hasEnv && (
                            <div className="px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-emerald-900 truncate">
                                Platform Environment Key Active
                              </span>
                              <span className="font-mono-num text-[11px] text-emerald-700 font-semibold shrink-0">
                                IN ROTATION
                              </span>
                            </div>
                          )}

                          {keys.length === 0 ? (
                            <div className="px-3.5 py-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                              No custom rotational keys in pool yet. Add keys below to expand capacity.
                            </div>
                          ) : (
                            keys.map((item) => {
                              const isEditingThis =
                                editingPoolKey?.providerId === prov.id && editingPoolKey?.keyId === item.id;

                              if (isEditingThis) {
                                return (
                                  <div
                                    key={item.id}
                                    className="p-3 rounded-lg bg-blue-50/60 border border-blue-300 space-y-2.5 text-xs"
                                  >
                                    <div className="font-semibold text-blue-950">Edit Rotational Key</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={editingPoolKey.label}
                                        onChange={(e) =>
                                          setEditingPoolKey({ ...editingPoolKey, label: e.target.value })
                                        }
                                        placeholder="Node Label"
                                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                                      />
                                      <input
                                        type="text"
                                        value={editingPoolKey.apiKey}
                                        onChange={(e) =>
                                          setEditingPoolKey({ ...editingPoolKey, apiKey: e.target.value })
                                        }
                                        placeholder="New API Key (leave blank to keep current)"
                                        className="px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-300 rounded-md"
                                      />
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingPoolKey(null)}
                                        className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSaveEditedPoolKey}
                                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
                                      >
                                        Save Key Changes
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={item.id}
                                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-semibold text-slate-900 truncate">{item.label}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono-num text-slate-600 truncate">{item.masked}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingPoolKey({
                                          providerId: prov.id,
                                          keyId: item.id,
                                          label: item.label,
                                          apiKey: "",
                                        })
                                      }
                                      className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePoolKey(prov.id, item.id)}
                                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                      title="Remove key from pool"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Add Key to Pool Form */}
                      <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={newLabelInput[prov.id] || ""}
                          onChange={(e) =>
                            setNewLabelInput((prev) => ({ ...prev, [prov.id]: e.target.value }))
                          }
                          placeholder="Label (e.g. Node #1)"
                          className="sm:col-span-4 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={newKeyInput[prov.id] || ""}
                          onChange={(e) =>
                            setNewKeyInput((prev) => ({ ...prev, [prov.id]: e.target.value }))
                          }
                          placeholder={`Paste ${prov.placeholder} key`}
                          className="sm:col-span-5 px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddPoolKey(prov.id)}
                          className="sm:col-span-3 py-2 px-3 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Key</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Global Transactional SMTP Relay Credentials (Brevo) — Separated from Payment Gateways */}
              <form onSubmit={handleSaveSingleKeys} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Global Transactional SMTP Relay Credentials (Brevo)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure system-wide Brevo SMTP relay fallback credentials for outreach and CSV email dispatch
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg self-start sm:self-auto cursor-pointer"
                  >
                    Save SMTP Relay Keys
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {["BREVO_SMTP_USER", "BREVO_SMTP_KEY"].map((k) => (
                    <div key={k}>
                      <label className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>{k}</span>
                        <span className="font-mono-num text-slate-400">
                          {singleKeys[k]?.set ? singleKeys[k].masked : "Not set"}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={singleKeyEdits[k] || ""}
                        onChange={(e) => setSingleKeyEdits((prev) => ({ ...prev, [k]: e.target.value }))}
                        placeholder={singleKeys[k]?.set ? "Enter new value to overwrite" : "Paste SMTP credential..."}
                        className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </form>

              {/* Multi-SMTP & Multiple Gmails Rotational Manager + App Password Setup Guide */}
              <MultiSmtpManagerPanel
                mode="admin"
                onAccountsChanged={(count) =>
                  setMetrics((prev) => ({ ...prev, totalSmtpAccounts: count }))
                }
              />
            </div>
          )}

          {/* MODULE 3: MULTI-TENANT USER & QUOTA MANAGEMENT (WITH FULL USER EDITOR) */}
          {activeTab === "users" && (
            <div className="space-y-6">
              {/* Full User Edit Modal / Panel when a user is selected for editing */}
              {editingUser && (
                <form
                  onSubmit={handleSaveEditingUser}
                  className="bg-white rounded-xl border-2 border-blue-600 p-5 sm:p-6 space-y-4 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <div className="text-xs font-semibold text-blue-700">Editing SaaS Tenant Account</div>
                      <h3 className="font-display text-lg font-bold text-slate-950">
                        {editingUser.fullName} ({editingUser.email})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={editingUser.fullName}
                        onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Company / Agency</label>
                      <input
                        type="text"
                        required
                        value={editingUser.companyName}
                        onChange={(e) => setEditingUser({ ...editingUser, companyName: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                      <input
                        type="email"
                        required
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Reset Password (optional)
                      </label>
                      <input
                        type="text"
                        value={editingUser.password}
                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                        placeholder="Leave blank to keep current"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Subscription Plan</label>
                      <select
                        value={editingUser.planId}
                        onChange={(e) => setEditingUser({ ...editingUser, planId: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="starter">Starter ($49)</option>
                        <option value="growth">Growth ($149)</option>
                        <option value="scale">Agency Scale ($349)</option>
                        <option value="enterprise">Enterprise ($799)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Lead Credits Balance</label>
                      <input
                        type="number"
                        value={editingUser.creditsBalance}
                        onChange={(e) =>
                          setEditingUser({ ...editingUser, creditsBalance: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">System Role</label>
                      <select
                        value={editingUser.role}
                        onChange={(e) =>
                          setEditingUser({ ...editingUser, role: e.target.value as "admin" | "user" })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="user">User (Standard Subscriber)</option>
                        <option value="admin">Admin (Owner Console Access)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Account Status</label>
                      <select
                        value={editingUser.status}
                        onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                    >
                      Save User Changes
                    </button>
                  </div>
                </form>
              )}

              {/* Provision New User Form */}
              <form onSubmit={handleCreateUser} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950">Provision New SaaS Tenant Account</h2>
                  <p className="text-xs text-slate-500">
                    Create a workspace for a client or agency team and assign their initial plan and credit balance
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <input
                    type="text"
                    required
                    value={newUserForm.fullName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                    placeholder="Full Name"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={newUserForm.companyName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, companyName: e.target.value })}
                    placeholder="Company / Agency"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="email"
                    required
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    placeholder="Work Email"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    placeholder="Initial Password"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <select
                    value={newUserForm.planId}
                    onChange={(e) => setNewUserForm({ ...newUserForm, planId: e.target.value })}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="starter">Starter ($49)</option>
                    <option value="growth">Growth ($149)</option>
                    <option value="scale">Agency Scale ($349)</option>
                    <option value="enterprise">Enterprise ($799)</option>
                  </select>
                  <button
                    type="submit"
                    className="py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    + Create User
                  </button>
                </div>
              </form>

              {/* Users Table with Multi-Select, Manual Upgrade/Downgrade, Message & Delete */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      Registered SaaS Tenants ({filteredUsers.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Manually Upgrade ↑, Downgrade ↓, Message, Edit, or Delete any user—or select multiple users for bulk actions.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenMessageComposerForUsers(
                          selectedUserIds.length > 0 ? selectedUserIds : filteredUsers.map((u) => u.id),
                          selectedUserIds.length > 0 ? "selected" : "all"
                        )
                      }
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {selectedUserIds.length > 0
                          ? `Message Selected (${selectedUserIds.length})`
                          : "Message Multiple / All Users"}
                      </span>
                    </button>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name, company, or email..."
                      className="px-3.5 py-1.5 text-xs border border-slate-300 rounded-lg w-full sm:w-60"
                    />
                  </div>
                </div>

                {/* Bulk Selection Action Bar */}
                {selectedUserIds.length > 0 && (
                  <div className="px-5 sm:px-6 py-3 bg-blue-50/90 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                      <span>{selectedUserIds.length} user(s) selected</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenMessageComposerForUsers(selectedUserIds, "selected")}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Message to {selectedUserIds.length} Selected User(s)</span>
                      </button>

                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                        <span className="text-[11px] font-semibold text-slate-600">Bulk Set Plan:</span>
                        <select
                          value={bulkTargetPlanId}
                          onChange={(e) => setBulkTargetPlanId(e.target.value)}
                          className="text-xs font-bold text-blue-800 bg-transparent focus:outline-none"
                        >
                          <option value="starter">Starter ($49)</option>
                          <option value="growth">Growth ($149)</option>
                          <option value="scale">Agency Scale ($349)</option>
                          <option value="enterprise">Enterprise ($799)</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkChangePlan}
                          className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-white text-[11px] font-semibold rounded cursor-pointer"
                        >
                          Apply Plan
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[920px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/60">
                        <th className="py-3 pl-5 pr-2 w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredUsers.length > 0 &&
                              filteredUsers.every((u) => selectedUserIds.includes(u.id))
                            }
                            onChange={toggleSelectAllFilteredUsers}
                            aria-label="Select all users"
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Tenant / Agency</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Plan & Manual Upgrade / Downgrade</th>
                        <th className="py-3 px-3">Monthly Usage</th>
                        <th className="py-3 px-3 text-right">Lead Credits</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-5 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredUsers.map((u) => {
                        const isChecked = selectedUserIds.includes(u.id);
                        const isConfirmingDelete = deleteConfirmUserId === u.id;
                        return (
                          <tr key={u.id} className={`hover:bg-slate-50 ${isChecked ? "bg-blue-50/30" : ""}`}>
                            <td className="py-3.5 pl-5 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectUser(u.id)}
                                aria-label={`Select ${u.fullName}`}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-950">{u.fullName}</span>
                                {u.status === "pending_verification" ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                                    ⏳ Pending Email Link
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                                    ✓ Verified
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {u.companyName} · {u.email}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                                className="px-2 py-1 text-xs border border-slate-200 rounded bg-white font-medium"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={u.planId}
                                  onChange={(e) =>
                                    handleUpdateUser(u.id, { planId: e.target.value, syncPlanCredits: true })
                                  }
                                  className="px-2 py-1 text-xs border border-slate-200 rounded bg-white font-semibold text-blue-700"
                                >
                                  <option value="starter">Starter ($49)</option>
                                  <option value="growth">Growth ($149)</option>
                                  <option value="scale">Agency Scale ($349)</option>
                                  <option value="enterprise">Enterprise ($799)</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleManualUpgradeUser(u)}
                                  disabled={u.planId === "enterprise"}
                                  title="Manually Upgrade User to next plan tier"
                                  className="px-2 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-800 border border-emerald-200 rounded inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <ArrowUpCircle className="w-3 h-3" />
                                  <span>Upgrade</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleManualDowngradeUser(u)}
                                  disabled={u.planId === "starter"}
                                  title="Manually Downgrade User to lower plan tier"
                                  className="px-2 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 border border-amber-200 rounded inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <ArrowDownCircle className="w-3 h-3" />
                                  <span>Downgrade</span>
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 font-mono-num text-slate-600 whitespace-nowrap">
                              {u.huntsUsedThisMonth} hunts · {u.emailsSentThisMonth} emails
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono-num font-semibold text-slate-950 whitespace-nowrap">
                              {u.creditsBalance.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {u.status === "pending_verification" ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-amber-700 text-[11px]">PENDING LINK</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateUser(u.id, { status: "active" })}
                                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Verify Now
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`font-semibold ${
                                    u.status === "active" ? "text-emerald-700" : "text-red-700"
                                  }`}
                                >
                                  {u.status.toUpperCase()}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenMessageComposerForUsers([u.id], "selected")}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded inline-flex items-center gap-1 cursor-pointer"
                                title="Send message to this user"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Message</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingUser({
                                    id: u.id,
                                    fullName: u.fullName,
                                    companyName: u.companyName,
                                    email: u.email,
                                    password: "",
                                    role: u.role,
                                    planId: u.planId,
                                    billingCycle: u.billingCycle || "monthly",
                                    status: u.status,
                                    creditsBalance: u.creditsBalance,
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateUser(u.id, { creditsBalance: u.creditsBalance + 2500 })
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded cursor-pointer"
                              >
                                +2.5k Credits
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateUser(u.id, {
                                    status: u.status === "active" ? "suspended" : "active",
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded cursor-pointer"
                              >
                                {u.status === "active" ? "Suspend" : "Activate"}
                              </button>

                              {isConfirmingDelete ? (
                                <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmUserId(null)}
                                    className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmUserId(u.id)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded inline-flex items-center gap-1 cursor-pointer"
                                  title="Delete user account"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 3B: ADMIN SUPPORT DESK & MULTI-USER BROADCAST MESSAGING */}
          {activeTab === "support" && (
            <div className="space-y-6">
              {/* Multi-SMTP Wiring Status Bar for Admin Messaging */}
              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-emerald-950">
                  <span className="font-bold">✓ Wired to Multi-SMTP &amp; Gmail Rotational Pool:</span>{" "}
                  Messages sent below are delivered to the user&apos;s workspace inbox AND automatically dispatched via your active Gmail / SMTP rotation pool.
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectTab("smtp")}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  Configure Multi-SMTP &amp; Gmails →
                </button>
              </div>

              {/* Multi-User / Selected Users Broadcast Composer */}
              <form
                onSubmit={handleBroadcastMessage}
                className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                      <Send className="w-3.5 h-3.5" />
                      <span>Multi-User & Targeted Tenant Messaging</span>
                    </div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                      Message Selected Users, Plan Segments, or All Users
                    </h2>
                    <p className="text-xs text-slate-500">
                      Send announcements, billing notices, or direct messages to specific selected users or across your entire user base. Supports <code className="font-mono-num bg-slate-100 px-1 rounded">{"{{FullName}}"}</code> and <code className="font-mono-num bg-slate-100 px-1 rounded">{"{{CompanyName}}"}</code> tags.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={broadcastBusy}
                    className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {broadcastBusy
                        ? "Sending..."
                        : broadcastTargetMode === "all"
                        ? `Send to All Users (${users.length})`
                        : broadcastTargetMode === "plan"
                        ? `Send to ${broadcastPlanFilter.toUpperCase()} Users`
                        : `Send to Selected Users (${selectedUserIds.length})`}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recipient Target Mode
                    </label>
                    <select
                      value={broadcastTargetMode}
                      onChange={(e) => setBroadcastTargetMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      <option value="selected">Selected Users ({selectedUserIds.length} chosen)</option>
                      <option value="plan">Users on a Specific Plan Tier</option>
                      <option value="all">All Registered Users ({users.length} total)</option>
                    </select>
                  </div>

                  {broadcastTargetMode === "plan" ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Target Plan Tier
                      </label>
                      <select
                        value={broadcastPlanFilter}
                        onChange={(e) => setBroadcastPlanFilter(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="starter">Starter Tier Users</option>
                        <option value="growth">Growth Tier Users</option>
                        <option value="scale">Agency Scale Tier Users</option>
                        <option value="enterprise">Enterprise Tier Users</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Message Category
                      </label>
                      <select
                        value={broadcastCategory}
                        onChange={(e) => setBroadcastCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="announcement">Platform Announcement / Update</option>
                        <option value="plan_upgrade">Plan Upgrade / Special Offer</option>
                        <option value="billing">Billing & Account Notice</option>
                        <option value="general">Direct Admin Support Message</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Message Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={broadcastSubject}
                      onChange={(e) => setBroadcastSubject(e.target.value)}
                      placeholder="e.g. Important update regarding your workspace quota"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Interactive User Checkboxes when targetMode === 'selected' */}
                {broadcastTargetMode === "selected" && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Select Users to Receive This Message ({selectedUserIds.length} selected)
                      </span>
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedUserIds(users.map((u) => u.id))}
                          className="font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          Select All ({users.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedUserIds([])}
                          className="font-semibold text-slate-500 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pt-1">
                      {users.map((u) => {
                        const checked = selectedUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              checked
                                ? "bg-blue-50 border-blue-400 text-slate-950"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectUser(u.id)}
                              className="cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">{u.fullName}</div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {u.email} · <span className="uppercase font-bold text-blue-700">{u.planId}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message Body *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    placeholder="Hi {{FullName}}, we wanted to reach out regarding {{CompanyName}}..."
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg leading-relaxed"
                  />
                </div>
              </form>

              {/* Two-Column User Support Queue & Admin Response Console */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: All User Support Threads */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 sm:px-5 py-4 border-b border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">
                          User Support & Message Threads ({filteredSupportThreads.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Click any user conversation to read and respond
                        </p>
                      </div>
                      {unreadAdminSupportCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          {unreadAdminSupportCount} Unread
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(["all", "open", "replied", "resolved"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSupportFilter(st)}
                          className={`flex-1 py-1 text-[11px] font-semibold rounded capitalize cursor-pointer ${
                            supportFilter === st ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredSupportThreads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No support threads match this filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
                      {filteredSupportThreads.map((thr) => {
                        const isSelected = activeAdminThread?.threadId === thr.threadId;
                        const lastMsg = thr.messages[thr.messages.length - 1];
                        return (
                          <button
                            key={thr.threadId}
                            type="button"
                            onClick={() => handleSelectAdminThread(thr.threadId)}
                            className={`w-full text-left p-4 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/80" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-950 truncate">
                                  {thr.userName}{" "}
                                  <span className="font-normal text-slate-500">({thr.userEmail})</span>
                                </div>
                                <div className="text-xs font-semibold text-blue-800 truncate mt-0.5">
                                  {thr.subject}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {thr.hasUnreadFromUser && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                    NEW
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    thr.status === "open"
                                      ? "bg-amber-100 text-amber-800"
                                      : thr.status === "replied"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {thr.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                              <span className="font-semibold">
                                {lastMsg?.senderRole === "admin" ? "You (Admin): " : "User: "}
                              </span>
                              {lastMsg?.body}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                              <span className="uppercase font-semibold">{thr.category}</span>
                              <span>{new Date(thr.lastMessageAt).toLocaleString()}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Column: Active User Thread & Admin Response Box */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                  {!activeAdminThread ? (
                    <div className="p-10 text-center text-xs text-slate-500">
                      Select a user conversation on the left to view messages and respond.
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const threadUser = users.find((u) => u.id === activeAdminThread.userId);
                        return (
                          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-950">
                                  {activeAdminThread.userName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  ({activeAdminThread.userEmail})
                                </span>
                                {threadUser && (
                                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                                    Plan: {threadUser.planId}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-slate-950 mt-1">
                                {activeAdminThread.subject}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {threadUser && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleManualUpgradeUser(threadUser)}
                                    disabled={threadUser.planId === "enterprise"}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <ArrowUpCircle className="w-3 h-3" />
                                    <span>Upgrade User</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleManualDowngradeUser(threadUser)}
                                    disabled={threadUser.planId === "starter"}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 disabled:opacity-40 text-amber-900 rounded inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <ArrowDownCircle className="w-3 h-3" />
                                    <span>Downgrade</span>
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateThreadStatus(
                                    activeAdminThread.threadId,
                                    activeAdminThread.status === "resolved" ? "open" : "resolved"
                                  )
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded cursor-pointer"
                              >
                                {activeAdminThread.status === "resolved" ? "Reopen Thread" : "Mark Resolved"}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="p-5 space-y-4 max-h-[430px] overflow-y-auto bg-slate-50/30">
                        {activeAdminThread.messages.map((msg) => {
                          const isAdmin = msg.senderRole === "admin";
                          return (
                            <div
                              key={msg.id}
                              className={`p-4 rounded-xl border ${
                                isAdmin
                                  ? "bg-blue-50/70 border-blue-200 ml-0 sm:ml-6"
                                  : "bg-white border-slate-200 ml-0 sm:mr-6"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                  className={`text-xs font-bold ${
                                    isAdmin ? "text-blue-800" : "text-slate-950"
                                  }`}
                                >
                                  {isAdmin
                                    ? `🛡️ ${msg.senderName || "Platform Admin"} (You)`
                                    : `👤 ${msg.senderName || activeAdminThread.userName}`}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono-num">
                                  {new Date(msg.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {msg.body}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <form
                        onSubmit={handleAdminReplySupport}
                        className="p-4 border-t border-slate-200 bg-white space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            Respond to {activeAdminThread.userName}
                          </label>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">Status on send:</span>
                            <select
                              value={adminReplyStatus}
                              onChange={(e) => setAdminReplyStatus(e.target.value as any)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white font-semibold"
                            >
                              <option value="replied">Mark as Replied</option>
                              <option value="resolved">Mark as Resolved</option>
                            </select>
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          required
                          value={adminReplyBody}
                          onChange={(e) => setAdminReplyBody(e.target.value)}
                          placeholder={`Write your admin response to ${activeAdminThread.userName}...`}
                          className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
                        />

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={adminReplyBusy}
                            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{adminReplyBusy ? "Sending Response..." : "Send Admin Response"}</span>
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 4: SAAS PLANS & QUOTA ARCHITECT (FULL EDITING OF ALL FIELDS & FEATURES) */}
          {activeTab === "plans" && (
            <div className="space-y-6">
              <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                    SaaS Plans, Quotas & Pricing Architect
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Edit plan names, target audiences, monthly/annual pricing, lead hunting limits, rotational inbox caps, and feature bullets. Changes sync live to the Landing Page and User Dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectTab("lemonsqueezy")}
                  className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  Configure Lemon Squeezy Links →
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {plans.map((plan, idx) => (
                  <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2">
                      <div>
                        <span className="text-[11px] font-mono-num uppercase text-blue-700 font-semibold">
                          Tier ID: {plan.id}
                        </span>
                        <h3 className="font-display text-lg font-bold text-slate-950">{plan.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSavePlan(plan)}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save {plan.name} Plan</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Plan Display Name</label>
                        <input
                          type="text"
                          value={plan.name}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, name: e.target.value };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Target Audience Subtitle</label>
                        <input
                          type="text"
                          value={plan.audience}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, audience: e.target.value };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Monthly Price ($)</label>
                        <input
                          type="number"
                          value={plan.monthlyPrice}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, monthlyPrice: Number(e.target.value) };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Annual Price ($/mo)</label>
                        <input
                          type="number"
                          value={plan.annualPrice}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, annualPrice: Number(e.target.value) };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Leads / Month</label>
                        <input
                          type="number"
                          value={plan.monthlyHuntLimit}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, monthlyHuntLimit: Number(e.target.value) };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Emails / Month</label>
                        <input
                          type="number"
                          value={plan.monthlyEmailLimit}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, monthlyEmailLimit: Number(e.target.value) };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Inboxes</label>
                        <input
                          type="number"
                          value={plan.maxEmailAccounts}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, maxEmailAccounts: Number(e.target.value) };
                            setPlans(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Plan Features (One bullet point per line)
                      </label>
                      <textarea
                        rows={4}
                        value={(Array.isArray(plan.features) ? plan.features : []).join("\n")}
                        onChange={(e) => {
                          const next = [...plans];
                          next[idx] = {
                            ...plan,
                            features: e.target.value.split("\n").filter((line) => line.trim().length > 0),
                          };
                          setPlans(next);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.bulkHuntEnabled}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, bulkHuntEnabled: e.target.checked };
                            setPlans(next);
                          }}
                        />
                        <span>20-City Bulk Hunter</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.autoPilotEnabled}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, autoPilotEnabled: e.target.checked };
                            setPlans(next);
                          }}
                        />
                        <span>24/7 Autopilot Scheduler</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.isPopular}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, isPopular: e.target.checked };
                            setPlans(next);
                          }}
                        />
                        <span>Highlight as "Most Selected"</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE 5: LEMON SQUEEZY MERCHANT & SUBSCRIPTION BILLING (DEDICATED & SEPARATE) */}
          {activeTab === "lemonsqueezy" && (
            <div className="space-y-6">
              <form onSubmit={handleSaveLemonConfig} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Dedicated Card & Subscription Merchant</span>
                    </div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                      Lemon Squeezy Merchant & API Configuration
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configure your Lemon Squeezy Store ID, API Key, checkout mode, and webhook status independently from Crypto Treasury.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap self-start sm:self-auto cursor-pointer"
                  >
                    Save Lemon Squeezy Config
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Lemon Squeezy Store ID</label>
                    <input
                      type="text"
                      value={billingConfig.lemonStoreId}
                      onChange={(e) => setBillingConfig({ ...billingConfig, lemonStoreId: e.target.value })}
                      placeholder="e.g. 94821"
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Environment Mode</label>
                    <select
                      value={billingConfig.lemonMode || "live"}
                      onChange={(e) => setBillingConfig({ ...billingConfig, lemonMode: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="live">Live Production Mode</option>
                      <option value="test">Test / Sandbox Mode</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>LEMONSQUEEZY_API_KEY</span>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        {singleKeys["LEMONSQUEEZY_API_KEY"]?.set ? singleKeys["LEMONSQUEEZY_API_KEY"].masked : "Not set"}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={singleKeyEdits["LEMONSQUEEZY_API_KEY"] || ""}
                      onChange={(e) =>
                        setSingleKeyEdits((prev) => ({ ...prev, LEMONSQUEEZY_API_KEY: e.target.value }))
                      }
                      placeholder={
                        singleKeys["LEMONSQUEEZY_API_KEY"]?.set
                          ? "Enter new API key to overwrite"
                          : "Paste Lemon Squeezy API key..."
                      }
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>LEMONSQUEEZY_STORE_ID (Env/DB)</span>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        {singleKeys["LEMONSQUEEZY_STORE_ID"]?.set ? singleKeys["LEMONSQUEEZY_STORE_ID"].masked : "Synced"}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={singleKeyEdits["LEMONSQUEEZY_STORE_ID"] || ""}
                      onChange={(e) =>
                        setSingleKeyEdits((prev) => ({ ...prev, LEMONSQUEEZY_STORE_ID: e.target.value }))
                      }
                      placeholder="Optional override Store ID..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingConfig.lemonEnabled !== false}
                      onChange={(e) => setBillingConfig({ ...billingConfig, lemonEnabled: e.target.checked })}
                    />
                    <span className="font-medium text-slate-800">
                      Enable Lemon Squeezy Checkout on User Dashboard
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(billingConfig.lemonWebhookConfigured)}
                      onChange={(e) =>
                        setBillingConfig({ ...billingConfig, lemonWebhookConfigured: e.target.checked })
                      }
                    />
                    <span className="font-medium text-slate-800">
                      Order Webhook Listener Active (Auto-Upgrade Subscriptions)
                    </span>
                  </label>
                </div>
              </form>

              {/* Per-Plan Lemon Squeezy Variant IDs & Checkout URLs */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Per-Plan Lemon Squeezy Variant IDs & Hosted Checkout URLs
                  </h3>
                  <p className="text-xs text-slate-500">
                    Map each SaaS subscription tier to its Lemon Squeezy Variant ID and Hosted Checkout link
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((plan, idx) => (
                    <div key={plan.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono-num uppercase text-blue-700 font-bold">
                            {plan.id}
                          </span>
                          <h4 className="text-sm font-bold text-slate-950">
                            {plan.name} (${plan.monthlyPrice}/mo)
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSavePlan(plan)}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save {plan.name} Link</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Variant ID</label>
                          <input
                            type="text"
                            value={plan.lemonVariantId}
                            onChange={(e) => {
                              const next = [...plans];
                              next[idx] = { ...plan, lemonVariantId: e.target.value };
                              setPlans(next);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Hosted Checkout URL
                          </label>
                          <input
                            type="text"
                            value={plan.lemonCheckoutUrl}
                            onChange={(e) => {
                              const next = [...plans];
                              next[idx] = { ...plan, lemonCheckoutUrl: e.target.value };
                              setPlans(next);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dedicated Lemon Squeezy Settlements Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-950">
                    Lemon Squeezy Subscription & Card Settlements (
                    {payments.filter((p) => p.paymentMethod === "lemon_squeezy").length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Audit card orders and subscription upgrades processed through Lemon Squeezy
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[780px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/60">
                        <th className="py-3 px-5">ID & Date</th>
                        <th className="py-3 px-3">Tenant</th>
                        <th className="py-3 px-3">Plan & Cycle</th>
                        <th className="py-3 px-3">Gateway</th>
                        <th className="py-3 px-3">Lemon Squeezy Order Ref</th>
                        <th className="py-3 px-3 text-right">Amount</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {payments.filter((p) => p.paymentMethod === "lemon_squeezy").length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No Lemon Squeezy card transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        payments
                          .filter((p) => p.paymentMethod === "lemon_squeezy")
                          .map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-3.5 px-5 font-mono-num text-slate-500 whitespace-nowrap">
                                #{p.id} · {new Date(p.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3.5 px-3">
                                <div className="font-semibold text-slate-900">{p.userName || "Tenant"}</div>
                                <div className="text-[11px] text-slate-500">{p.userEmail}</div>
                              </td>
                              <td className="py-3.5 px-3 font-semibold uppercase text-slate-900 whitespace-nowrap">
                                {p.planId} ({p.billingCycle})
                              </td>
                              <td className="py-3.5 px-3 text-blue-700 font-semibold whitespace-nowrap">
                                Lemon Squeezy
                              </td>
                              <td className="py-3.5 px-3 font-mono-num text-slate-600 max-w-[200px] truncate">
                                {p.txHashOrRef}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono-num font-bold text-slate-950 whitespace-nowrap">
                                ${p.amountUsd}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
                                    p.status === "completed"
                                      ? "text-emerald-700"
                                      : p.status === "pending"
                                      ? "text-amber-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {p.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                                {p.status !== "completed" && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPayment(p.id, "completed")}
                                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                                  >
                                    Approve & Credit
                                  </button>
                                )}
                                {p.status !== "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPayment(p.id, "rejected")}
                                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 rounded cursor-pointer"
                                  >
                                    Refund / Reject
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 6: CRYPTO TREASURY & ON-CHAIN SETTLEMENTS (DEDICATED & SEPARATE) */}
          {activeTab === "crypto" && (
            <div className="space-y-6">
              <form onSubmit={handleSaveCryptoConfig} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Direct Self-Custody Web3 Treasury</span>
                    </div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                      Cryptocurrency Treasury Receiving Wallets (6 Networks)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configure your direct receiving wallet addresses for USDT, USDC, Bitcoin, Ethereum, and Solana independently from Lemon Squeezy.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap self-start sm:self-auto cursor-pointer"
                  >
                    Save Crypto Treasury Wallets
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      1. USDT (TRON / TRC-20) Wallet Address
                    </label>
                    <input
                      type="text"
                      value={billingConfig.wallets?.usdt_trc20 || ""}
                      onChange={(e) =>
                        setBillingConfig({
                          ...billingConfig,
                          wallets: { ...billingConfig.wallets, usdt_trc20: e.target.value },
                        })
                      }
                      placeholder="T..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      2. USDT (Ethereum / ERC-20) Wallet Address
                    </label>
                    <input
                      type="text"
                      value={billingConfig.wallets?.usdt_erc20 || ""}
                      onChange={(e) =>
                        setBillingConfig({
                          ...billingConfig,
                          wallets: { ...billingConfig.wallets, usdt_erc20: e.target.value },
                        })
                      }
                      placeholder="0x..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      3. USDC (Base / Polygon L2) Wallet Address
                    </label>
                    <input
                      type="text"
                      value={billingConfig.wallets?.usdc_base || ""}
                      onChange={(e) =>
                        setBillingConfig({
                          ...billingConfig,
                          wallets: { ...billingConfig.wallets, usdc_base: e.target.value },
                        })
                      }
                      placeholder="0x..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      4. Bitcoin (Native SegWit BTC) Wallet Address
                    </label>
                    <input
                      type="text"
                      value={billingConfig.wallets?.btc || ""}
                      onChange={(e) =>
                        setBillingConfig({
                          ...billingConfig,
                          wallets: { ...billingConfig.wallets, btc: e.target.value },
                        })
                      }
                      placeholder="bc1q..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      5. Ethereum (Native ETH / ERC-20) Wallet Address
                    </label>
                    <input
                      type="text"
                      value={billingConfig.wallets?.eth || ""}
                      onChange={(e) =>
                        setBillingConfig({
                          ...billingConfig,
                          wallets: { ...billingConfig.wallets, eth: e.target.value },
                        })
                      }
                      placeholder="0x..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      6. Solana (SOL / USDC-SPL) Wallet Address
                    </label>
                    <input
                      type="text"
                      value={billingConfig.wallets?.sol || ""}
                      onChange={(e) =>
                        setBillingConfig({
                          ...billingConfig,
                          wallets: { ...billingConfig.wallets, sol: e.target.value },
                        })
                      }
                      placeholder="Solana base58 address..."
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingConfig.cryptoEnabled !== false}
                      onChange={(e) => setBillingConfig({ ...billingConfig, cryptoEnabled: e.target.checked })}
                    />
                    <span className="font-medium text-slate-800">
                      Enable Direct Cryptocurrency Checkout (USDT / USDC / BTC / ETH / SOL) on User Dashboard
                    </span>
                  </label>
                </div>
              </form>

              {/* Dedicated Crypto On-Chain Settlement Queue */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-950">
                    On-Chain Crypto Settlement & Verification Queue (
                    {payments.filter((p) => p.paymentMethod !== "lemon_squeezy").length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify on-chain cryptocurrency TX hashes (USDT, USDC, BTC, ETH, SOL) and credit subscriber workspaces
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[780px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/60">
                        <th className="py-3 px-5">ID & Date</th>
                        <th className="py-3 px-3">Tenant</th>
                        <th className="py-3 px-3">Plan & Cycle</th>
                        <th className="py-3 px-3">Crypto Network</th>
                        <th className="py-3 px-3">On-Chain TX Hash (TXID)</th>
                        <th className="py-3 px-3 text-right">Amount</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-5 text-right">Treasury Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {payments.filter((p) => p.paymentMethod !== "lemon_squeezy").length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No cryptocurrency transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        payments
                          .filter((p) => p.paymentMethod !== "lemon_squeezy")
                          .map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-3.5 px-5 font-mono-num text-slate-500 whitespace-nowrap">
                                #{p.id} · {new Date(p.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3.5 px-3">
                                <div className="font-semibold text-slate-900">{p.userName || "Tenant"}</div>
                                <div className="text-[11px] text-slate-500">{p.userEmail}</div>
                              </td>
                              <td className="py-3.5 px-3 font-semibold uppercase text-slate-900 whitespace-nowrap">
                                {p.planId} ({p.billingCycle})
                              </td>
                              <td className="py-3.5 px-3 font-semibold text-emerald-800 whitespace-nowrap">
                                {p.cryptoNetwork || p.paymentMethod.replace("crypto_", "").toUpperCase()}
                              </td>
                              <td className="py-3.5 px-3 font-mono-num text-slate-600 max-w-[200px] truncate">
                                {p.txHashOrRef}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono-num font-bold text-slate-950 whitespace-nowrap">
                                ${p.amountUsd}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
                                    p.status === "completed"
                                      ? "text-emerald-700"
                                      : p.status === "pending"
                                      ? "text-amber-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {p.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                                {p.status !== "completed" && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPayment(p.id, "completed")}
                                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                                  >
                                    Approve & Credit
                                  </button>
                                )}
                                {p.status !== "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPayment(p.id, "rejected")}
                                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 rounded cursor-pointer"
                                  >
                                    Reject TX
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 6: USER ACTIVITY STREAM & ENGINE CONTROLS */}
          {activeTab === "activities" && (
            <div className="space-y-6">
              <form onSubmit={handleSaveSystemSettings} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-950">
                      Global Scraper Engine & Deliverability Governor
                    </h2>
                    <p className="text-xs text-slate-500">
                      Control worker concurrency, strict DNS/MX verification, email decoding, and default tenant signup credits
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg self-start sm:self-auto cursor-pointer"
                  >
                    Save Engine Settings
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Parallel Website Scraper Concurrency
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={systemSettings.scraperConcurrency}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, scraperConcurrency: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Default Free Trial Signup Credits
                    </label>
                    <input
                      type="number"
                      value={systemSettings.defaultSignupCredits}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, defaultSignupCredits: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Global API Rate Limit (req/min)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.globalRateLimitPerMin}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, globalRateLimitPerMin: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemSettings.strictMxVerification}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, strictMxVerification: e.target.checked })
                      }
                    />
                    <span>Enforce Strict DNS MX Verification (Reject Unverified Domains)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemSettings.cloudflareEmailDecoder}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, cloudflareEmailDecoder: e.target.checked })
                      }
                    />
                    <span>Enable Cloudflare Hex Email De-Obfuscation</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemSettings.allowPublicRegistration}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, allowPublicRegistration: e.target.checked })
                      }
                    />
                    <span>Allow Public Self-Serve SaaS Registration</span>
                  </label>
                </div>
              </form>

              {/* Global User Activity Stream */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      Real-Time Multi-Tenant User Activity Log ({filteredActivities.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Every lead hunt, audit report, authentication, and payment event across all tenants
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    {["all", "hunt", "billing", "auth", "admin"].map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setActivityFilter(cat)}
                        className={`px-3 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                          activityFilter === cat ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-200">
                  {filteredActivities.map((act) => (
                    <div
                      key={act.id}
                      className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-slate-950">{act.userName || act.userEmail || "System"}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-800">{act.action}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[11px] uppercase text-blue-700 font-semibold">{act.category}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 break-words">{act.details}</div>
                      </div>
                      <div className="font-mono-num text-[11px] sm:text-xs text-slate-400 whitespace-nowrap shrink-0">
                        {new Date(act.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
