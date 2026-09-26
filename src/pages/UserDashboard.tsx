import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  SaasUser,
  SaasPlan,
  SaasPayment,
  UserActivity,
  SupportMessage,
  saasFetch,
  setSaasSession,
  clearSaasSession,
  isUserAdmin,
} from "@/lib/saas-auth";
import { ExportLeadsBar } from "@/components/ProjectWorkspaceBar";
import {
  LeadProject,
  ExportableLead,
  DEFAULT_PROJECT_ID,
  loadProjects,
  saveProjects,
  syncProjectsFromServer,
  setActiveProjectId,
  loadProjectHuntedResults,
} from "@/lib/projects";
import {
  LayoutDashboard,
  Crosshair,
  CreditCard,
  Settings,
  ShieldAlert,
  ArrowUpRight,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Globe,
  Activity,
  Menu,
  X,
  Sparkles,
  FolderKanban,
  Plus,
  Trash2,
  MessageSquare,
  Send,
  Bell,
} from "lucide-react";

type DashboardTab = "overview" | "projects" | "support" | "billing" | "activities" | "settings";

interface BillingConfig {
  lemonStoreId: string;
  lemonWebhookConfigured: boolean;
  lemonMode: string;
  cryptoEnabled: boolean;
  lemonEnabled: boolean;
  wallets: Record<string, string>;
}

const CRYPTO_NETWORKS = [
  { id: "usdt_trc20", label: "USDT (TRON / TRC-20)", ticker: "USDT-TRC20", feeNote: "~$1 network fee · Instant confirmation" },
  { id: "usdt_erc20", label: "USDT (Ethereum / ERC-20)", ticker: "USDT-ERC20", feeNote: "ERC-20 standard treasury" },
  { id: "usdc_base", label: "USDC (Base / Polygon L2)", ticker: "USDC-BASE", feeNote: "Zero-fee L2 settlement" },
  { id: "btc", label: "Bitcoin (Native SegWit BTC)", ticker: "BTC", feeNote: "1 block confirmation" },
  { id: "eth", label: "Ethereum (Native ETH)", ticker: "ETH", feeNote: "12 block confirmations" },
  { id: "sol", label: "Solana (Native SOL / USDC)", ticker: "SOL", feeNote: "Sub-second finality" },
];

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState<SaasUser | null>(null);
  const [activePlan, setActivePlan] = useState<SaasPlan | null>(null);
  const [allPlans, setAllPlans] = useState<SaasPlan[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [payments, setPayments] = useState<SaasPayment[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportCategory, setSupportCategory] = useState<
    "general" | "billing" | "technical" | "plan_upgrade"
  >("general");
  const [supportBody, setSupportBody] = useState("");
  const [threadReplyBody, setThreadReplyBody] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportNotice, setSupportNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [workspaceCounts, setWorkspaceCounts] = useState({
    savedProspects: 0,
    auditReports: 0,
    connectedEmailAccounts: 0,
  });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [projects, setProjects] = useState<LeadProject[]>(loadProjects);
  const [savedProspectsList, setSavedProspectsList] = useState<ExportableLead[]>(() => {
    try {
      const raw = localStorage.getItem("ds_crm_prospects");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [newProjName, setNewProjName] = useState("");
  const [showNewProjForm, setShowNewProjForm] = useState(false);

  // Billing & Checkout state
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [checkoutPlan, setCheckoutPlan] = useState<SaasPlan | null>(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState<"lemon" | "crypto">("lemon");
  const [selectedCryptoNet, setSelectedCryptoNet] = useState<string>("usdt_trc20");
  const [cryptoTxHash, setCryptoTxHash] = useState("");
  const [cardLast4, setCardLast4] = useState("4242");
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  // Quick Hunt launcher state
  const [quickCategory, setQuickCategory] = useState("Dentist");
  const [quickCity, setQuickCity] = useState("Austin");
  const [quickCountry, setQuickCountry] = useState("USA");

  // Profile Settings state
  const [profileName, setProfileName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

  // Activity filter state
  const [activityFilter, setActivityFilter] = useState<string>("all");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [meData, plansData, cfgData, reportsData] = await Promise.all([
        saasFetch("/api/saas/auth/me"),
        fetch("/api/saas/plans").then((r) => r.json()),
        fetch("/api/saas/billing/config").then((r) => r.json()),
        saasFetch("/api/reports").catch(() => ({ reports: [] })),
      ]);

      if (meData.user) {
        setUser(meData.user);
        setProfileName(meData.user.fullName);
        setProfileCompany(meData.user.companyName);
        localStorage.setItem("vh_saas_user", JSON.stringify(meData.user));
      }
      if (meData.plan) setActivePlan(meData.plan);
      if (Array.isArray(meData.activities)) setActivities(meData.activities);
      if (Array.isArray(meData.payments)) setPayments(meData.payments);
      if (Array.isArray(meData.supportMessages)) {
        setSupportMessages(meData.supportMessages);
        const unread = meData.supportMessages.filter(
          (m: SupportMessage) => !m.readByUser && m.senderRole === "admin"
        ).length;
        setUnreadSupportCount(unread);
      }
      if (meData.workspaceCounts) setWorkspaceCounts(meData.workspaceCounts);
      if (Array.isArray(plansData.plans)) setAllPlans(plansData.plans);
      if (cfgData) setBillingConfig(cfgData);
      if (Array.isArray(reportsData)) {
        setRecentReports(reportsData.slice(0, 6));
      } else if (Array.isArray(reportsData?.reports)) {
        setRecentReports(reportsData.reports.slice(0, 6));
      }
    } catch (err) {
      console.error("Failed to load user dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as DashboardTab | null;
    if (
      tabParam &&
      ["overview", "projects", "support", "billing", "activities", "settings"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
    loadDashboard();
    syncProjectsFromServer().then((merged) => {
      if (merged.length > 0) setProjects(merged);
    });
    try {
      const raw = localStorage.getItem("ds_crm_prospects");
      if (raw) setSavedProspectsList(JSON.parse(raw));
    } catch {}
  }, [loadDashboard]);

  const getProjectLeads = useCallback(
    (projectId: string): ExportableLead[] => {
      const defaultProjId = projects[0]?.id || DEFAULT_PROJECT_ID;
      const projObj = projects.find((p) => p.id === projectId);
      const imported = savedProspectsList
        .filter((p) => (p.projectId || defaultProjId) === projectId)
        .map((p) => ({ ...p, projectName: projObj?.name || "Project" }));
      const huntedOnly = loadProjectHuntedResults<any>(projectId)
        .filter((h) => !h.imported)
        .map((h) => ({ ...h, projectId, projectName: projObj?.name || "Project" }));
      return [...imported, ...huntedOnly];
    },
    [projects, savedProspectsList]
  );

  const handleCreateDashboardProject = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newProjName.trim() || "Untitled";
    const now = new Date().toISOString();
    const created: LeadProject = {
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      description: "",
      targetCategory: "",
      targetCity: "",
      targetCountry: "",
      createdAt: now,
      updatedAt: now,
    };
    const next = [...projects, created];
    setProjects(next);
    saveProjects(next);
    setActiveProjectId(created.id);
    setNewProjName("");
    setShowNewProjForm(false);
  };

  const handleOpenProjectInCRM = (projectId: string) => {
    setActiveProjectId(projectId);
    setLocation(`/crm?project=${encodeURIComponent(projectId)}`);
  };

  const handleDeleteDashboardProject = (projectId: string) => {
    if (projects.length <= 1) return;
    const next = projects.filter((p) => p.id !== projectId);
    setProjects(next);
    saveProjects(next);
  };

  const handleGoBack = () => {
    if (checkoutPlan) {
      setCheckoutPlan(null);
      return;
    }
    if (activeTab !== "overview") {
      setActiveTab("overview");
      return;
    }
    setLocation("/landing");
  };

  const handleSelectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Group support messages into threads ordered by most recent message
  const supportThreads = React.useMemo(() => {
    const map = new Map<
      string,
      {
        threadId: string;
        subject: string;
        category: string;
        status: string;
        lastMessageAt: string;
        hasUnreadAdminReply: boolean;
        messages: SupportMessage[];
      }
    >();

    // Sort oldest -> newest inside each thread
    const chronological = [...supportMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const msg of chronological) {
      const existing = map.get(msg.threadId);
      if (!existing) {
        map.set(msg.threadId, {
          threadId: msg.threadId,
          subject: msg.subject || "Support Conversation",
          category: msg.category || "general",
          status: msg.status || "open",
          lastMessageAt: msg.createdAt,
          hasUnreadAdminReply: !msg.readByUser && msg.senderRole === "admin",
          messages: [msg],
        });
      } else {
        existing.messages.push(msg);
        existing.status = msg.status || existing.status;
        existing.lastMessageAt = msg.createdAt;
        if (!msg.readByUser && msg.senderRole === "admin") {
          existing.hasUnreadAdminReply = true;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [supportMessages]);

  const activeSupportThread =
    supportThreads.find((t) => t.threadId === selectedThreadId) || supportThreads[0] || null;

  const handleOpenSupportThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    const hasUnread = supportMessages.some(
      (m) => m.threadId === threadId && !m.readByUser && m.senderRole === "admin"
    );
    if (hasUnread) {
      setSupportMessages((prev) =>
        prev.map((m) => (m.threadId === threadId ? { ...m, readByUser: true } : m))
      );
      setUnreadSupportCount((prev) => Math.max(0, prev - 1));
      try {
        await saasFetch("/api/saas/support/mark-read", {
          method: "POST",
          body: JSON.stringify({ threadId }),
        });
      } catch {}
    }
  };

  const handleSendNewSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportBody.trim()) return;
    setSupportSending(true);
    setSupportNotice(null);
    try {
      const res = await saasFetch("/api/saas/support/messages", {
        method: "POST",
        body: JSON.stringify({
          subject: supportSubject.trim(),
          category: supportCategory,
          body: supportBody.trim(),
        }),
      });
      setSupportSubject("");
      setSupportBody("");
      setSupportNotice({
        type: "success",
        text: "Your message has been sent to the Platform Admin! You will see their response right here.",
      });
      await loadDashboard();
      if (res.message?.threadId) {
        setSelectedThreadId(res.message.threadId);
      }
    } catch (err: any) {
      setSupportNotice({
        type: "error",
        text: err.message || "Failed to send support message",
      });
    } finally {
      setSupportSending(false);
    }
  };

  const handleSendThreadReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupportThread || !threadReplyBody.trim()) return;
    setSupportSending(true);
    setSupportNotice(null);
    try {
      await saasFetch("/api/saas/support/messages", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeSupportThread.threadId,
          subject: activeSupportThread.subject,
          category: activeSupportThread.category,
          body: threadReplyBody.trim(),
        }),
      });
      setThreadReplyBody("");
      setSupportNotice({
        type: "success",
        text: "Reply sent to Admin!",
      });
      await loadDashboard();
    } catch (err: any) {
      setSupportNotice({
        type: "error",
        text: err.message || "Failed to send reply",
      });
    } finally {
      setSupportSending(false);
    }
  };

  const handleLemonCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;
    setCheckoutBusy(true);
    setCheckoutStatus(null);
    try {
      const res = await saasFetch("/api/saas/billing/checkout-lemon", {
        method: "POST",
        body: JSON.stringify({
          planId: checkoutPlan.id,
          billingCycle,
          cardLast4,
        }),
      });
      setCheckoutStatus({ type: "success", text: res.message || "Subscription upgraded via Lemon Squeezy!" });
      await loadDashboard();
      setTimeout(() => setCheckoutPlan(null), 1600);
    } catch (err: any) {
      setCheckoutStatus({ type: "error", text: err.message || "Lemon Squeezy checkout failed" });
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleCryptoCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;
    setCheckoutBusy(true);
    setCheckoutStatus(null);
    try {
      const walletAddr = billingConfig?.wallets?.[selectedCryptoNet] || "";
      const res = await saasFetch("/api/saas/billing/submit-crypto", {
        method: "POST",
        body: JSON.stringify({
          planId: checkoutPlan.id,
          billingCycle,
          cryptoNetwork: selectedCryptoNet,
          walletAddress: walletAddr,
          txHashOrRef: cryptoTxHash,
          autoVerify: true,
        }),
      });
      setCheckoutStatus({ type: "success", text: res.message || "Crypto payment verified!" });
      setCryptoTxHash("");
      await loadDashboard();
      setTimeout(() => setCheckoutPlan(null), 1600);
    } catch (err: any) {
      setCheckoutStatus({ type: "error", text: err.message || "Crypto submission failed" });
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice("");
    try {
      await saasFetch("/api/saas/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: profileName,
          companyName: profileCompany,
          newPassword: profilePassword || undefined,
        }),
      });
      setProfilePassword("");
      setProfileNotice("Workspace profile saved.");
      await loadDashboard();
    } catch (err: any) {
      setProfileNotice(err.message || "Failed to update profile");
    }
  };

  const handleSwitchDemoRole = async (email: string, pass: string) => {
    try {
      const res = await fetch("/api/saas/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setSaasSession(data.token, data.user);
        setMobileMenuOpen(false);
        await loadDashboard();
      }
    } catch {}
  };

  const huntLimit = activePlan?.monthlyHuntLimit || 1000;
  const emailLimit = activePlan?.monthlyEmailLimit || 3000;
  const huntsPct = Math.min(100, Math.round(((user?.huntsUsedThisMonth || 0) / huntLimit) * 100));
  const emailsPct = Math.min(100, Math.round(((user?.emailsSentThisMonth || 0) / emailLimit) * 100));

  const filteredActivities = activities.filter((a) =>
    activityFilter === "all" ? true : a.category === activityFilter
  );

  const sidebarContent = (
    <>
      <div>
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => setLocation("/landing")}
            className="font-display text-lg font-bold tracking-tight text-white cursor-pointer"
          >
            Vanguard Hunter
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
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
            <div className="text-xs font-semibold text-white truncate">
              {user?.companyName || "Apex Digital Growth"}
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              {user?.email || "founder@apexagency.io"}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Active Tier</span>
              <span className="font-semibold text-blue-400 uppercase">{activePlan?.name || user?.planId || "Growth"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Lead Credits</span>
              <span className="font-mono-num font-semibold text-emerald-400">
                {(user?.creditsBalance ?? 4815).toLocaleString()}
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => handleSelectTab("overview")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Workspace Overview</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("projects")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "projects"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <FolderKanban className="w-4 h-4 text-emerald-400" />
                <span>Projects & Lead Exports</span>
              </span>
              <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {projects.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setLocation("/crm");
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Crosshair className="w-4 h-4 text-blue-400" />
                <span>AI Lead Hunter & CRM</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
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
              <span className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Support & Admin Inbox</span>
              </span>
              {unreadSupportCount > 0 ? (
                <span className="font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                  {unreadSupportCount} new
                </span>
              ) : (
                <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {supportThreads.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("billing")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "billing"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Plans, Crypto & Billing</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("activities")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "activities"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Activity Audit Log</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("settings")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "settings"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Workspace Settings</span>
            </button>
          </nav>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-1">
            {isUserAdmin(user) && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLocation("/admin");
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Admin Control Plane</span>
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setLocation("/landing");
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              <span>Public SaaS Landing Page</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => {
            clearSaasSession();
            setLocation("/landing");
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar ($260px Workspace Canvas) */}
      <aside className="hidden lg:flex w-[260px] shrink-0 bg-slate-950 text-slate-200 border-r border-slate-800 flex-col justify-between">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[270px] max-w-[85vw] h-full overflow-y-auto bg-slate-950 text-slate-200 border-r border-slate-800 flex flex-col justify-between shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Bar Contract for SaaS Dashboard with Mobile Drawer Toggle & Explicit Back Button */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 sm:h-16 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Open workspace menu"
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
              <span className="hidden sm:inline">Workspace</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="text-slate-900 font-semibold capitalize truncate">{activeTab}</span>
              <span className="hidden md:inline" aria-hidden="true">·</span>
              <span className="hidden md:inline truncate">{user?.fullName || "Elena Vance"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("support")}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Support</span>
              {unreadSupportCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  {unreadSupportCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <span className="sm:hidden">Billing</span>
              <span className="hidden sm:inline">Upgrade Plan / Crypto Top-Up</span>
            </button>
            <button
              type="button"
              onClick={() => setLocation("/crm")}
              className="px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap cursor-pointer"
            >
              + Hunt Leads
            </button>
          </div>
        </header>

        {/* Mobile Quick-Navigation Tab Strip (prevents side-navigation scatter on phones) */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "projects", label: `📁 Projects (${projects.length})` },
              {
                id: "support",
                label: unreadSupportCount > 0 ? `💬 Support (${unreadSupportCount} New)` : "💬 Support & Inbox",
              },
              { id: "billing", label: "Plans & Crypto" },
              { id: "activities", label: "Activity Log" },
              { id: "settings", label: "Settings" },
            ] as { id: DashboardTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:text-slate-950"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLocation("/crm")}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap bg-blue-50 text-blue-700 cursor-pointer"
          >
            CRM Hunter →
          </button>
          {isUserAdmin(user) && (
            <button
              type="button"
              onClick={() => setLocation("/admin")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap bg-amber-50 text-amber-800 cursor-pointer"
            >
              Admin →
            </button>
          )}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1240px] w-full mx-auto space-y-6 sm:space-y-8 overflow-x-hidden">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Top Metric Strip (Single-Elevation, Tabular Numerals) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Available Lead Credits</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {(user?.creditsBalance ?? 4815).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    <span>Plan: {activePlan?.name || "Growth"}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-emerald-700 font-medium">Active</span>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Leads Hunted This Month</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {(user?.huntsUsedThisMonth ?? 185).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400">/ {huntLimit.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${huntsPct}%` }} />
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Outreach Emails Dispatched</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {(user?.emailsSentThisMonth ?? 640).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400">/ {emailLimit.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${emailsPct}%` }} />
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Client Website Audit Reports</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {workspaceCounts.auditReports || user?.auditsRunThisMonth || 38}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    <span>Rotational Inboxes: {workspaceCounts.connectedEmailAccounts}</span>
                    <span aria-hidden="true"> / </span>
                    <span>{activePlan?.maxEmailAccounts || 10} max</span>
                  </div>
                </div>
              </div>

              {/* Quick Lead Hunt Launcher Bar */}
              <div className="p-4 sm:p-6 bg-white rounded-xl border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-slate-950">
                      Quick-Launch Autonomous B2B Lead Hunt
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Discover active businesses in any target market with automated contact and domain verification.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/crm")}
                    className="text-xs font-semibold text-blue-700 hover:underline self-start lg:self-auto cursor-pointer"
                  >
                    Open Full AI Hunter & Sequence Pipeline →
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    localStorage.setItem(
                      "vh_quick_hunt",
                      JSON.stringify({ category: quickCategory, city: quickCity, country: quickCountry })
                    );
                    setLocation("/crm");
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
                >
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Business Niche / Category</label>
                    <input
                      type="text"
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value)}
                      placeholder="e.g. Dentist, MedSpa, Solar"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Target City</label>
                    <input
                      type="text"
                      value={quickCity}
                      onChange={(e) => setQuickCity(e.target.value)}
                      placeholder="e.g. Austin"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Country</label>
                    <input
                      type="text"
                      value={quickCountry}
                      onChange={(e) => setQuickCountry(e.target.value)}
                      placeholder="e.g. USA"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 px-4 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors h-[38px] whitespace-nowrap cursor-pointer"
                    >
                      Hunt Verified Leads Now →
                    </button>
                  </div>
                </form>
              </div>

              {/* Workspace Projects & Lead Export Summary Card on Overview */}
              <div className="p-4 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-blue-600" />
                      <h2 className="font-display text-base sm:text-lg font-bold text-slate-950">
                        Your Active Projects & Lead Exports
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Organize your lead generation into separate projects, switch between campaigns anytime, and export generated leads to CSV or JSON.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewProjForm(true);
                        setActiveTab("projects");
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Project</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("projects")}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                    >
                      Manage All ({projects.length}) →
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {projects.map((proj) => {
                    const projLeads = getProjectLeads(proj.id);
                    return (
                      <div
                        key={proj.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-950 truncate">{proj.name}</h3>
                          <span className="font-mono-num text-xs font-bold text-blue-700 shrink-0">
                            {projLeads.length} {projLeads.length === 1 ? "lead" : "leads"}
                          </span>
                        </div>

                        <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenProjectInCRM(proj.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-800 text-white cursor-pointer"
                          >
                            Work on Project →
                          </button>
                          <ExportLeadsBar
                            leads={projLeads}
                            projectName={proj.name}
                            compact
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Two-Column Workspace Tables: Recent Website Audits & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recent Client Website Audit Reports */}
                <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Client Website Audit Reports</h3>
                      <p className="text-xs text-slate-500">Interactive diagnostic pages tracked for prospect opens</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocation("/crm")}
                      className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Manage in CRM
                    </button>
                  </div>

                  {recentReports.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center">
                      <p className="text-xs text-slate-500 mb-3">
                        No client website audit reports generated yet in this workspace.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLocation("/crm")}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-950 rounded-lg cursor-pointer"
                      >
                        Generate First Website Audit in CRM
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {recentReports.map((r: any) => (
                        <div key={r.reportId} className="px-4 sm:px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {r.businessName || r.reportId}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              <span>{r.website}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono-num">{r.totalViews || 0} views</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocation(`/report/${r.reportId}`)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            View Report →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent User Activity Stream */}
                <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Recent Workspace Activity</h3>
                      <p className="text-xs text-slate-500">Live audit trail of hunts, emails, and billing events</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("activities")}
                      className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      View All ({activities.length})
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {activities.slice(0, 6).map((act) => (
                      <div key={act.id} className="px-4 sm:px-6 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900">{act.action}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{act.details}</div>
                        </div>
                        <div className="text-[11px] font-mono-num text-slate-400 whitespace-nowrap shrink-0">
                          {new Date(act.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 1A: PROJECTS & LEAD EXPORTS */}
          {activeTab === "projects" && (
            <div className="space-y-6">
              <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-950">
                    Workspace Projects & Lead Exports
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Work on one project and switch to another project anytime. Every project keeps its own target niche, scraped leads, and CRM pipeline with 1-click CSV & JSON export.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewProjForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Project</span>
                </button>
              </div>

              {showNewProjForm && (
                <form
                  onSubmit={handleCreateDashboardProject}
                  className="p-4 sm:p-5 bg-white rounded-xl border-2 border-blue-600 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <label className="text-xs font-bold text-slate-800 shrink-0">Project Name:</label>
                  <input
                    type="text"
                    autoFocus
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="Enter project name (leave empty for Untitled)"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="submit"
                      className="py-2 px-4 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Create Project
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewProjForm(false)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {projects.map((proj) => {
                  const projLeads = getProjectLeads(proj.id);
                  return (
                    <div
                      key={proj.id}
                      className="p-5 bg-white rounded-xl border border-slate-200 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-display text-base font-bold text-slate-950">{proj.name}</h3>
                          <span className="font-mono-num text-xs font-bold text-blue-700">
                            · {projLeads.length} generated {projLeads.length === 1 ? "lead" : "leads"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenProjectInCRM(proj.id)}
                            className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                          >
                            Open Project in AI Hunter & CRM →
                          </button>
                          {projects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDashboardProject(proj.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 cursor-pointer"
                              title="Delete project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <ExportLeadsBar
                        leads={projLeads}
                        projectName={proj.name}
                        label={`Export Leads for "${proj.name}"`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 1C: USER <-> ADMIN SUPPORT & MESSAGING INBOX */}
          {activeTab === "support" && (
            <div className="space-y-6">
              <div className="p-5 sm:p-6 bg-slate-950 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-semibold mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Direct Line to Platform Administration</span>
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                    Support Desk & Admin Messages
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Send a message directly to the Admin team for billing, plan upgrades, or technical support—and view Admin replies and announcements in real time.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono-num text-slate-300">
                    {supportThreads.length} {supportThreads.length === 1 ? "Thread" : "Threads"}
                  </span>
                  {unreadSupportCount > 0 && (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                      {unreadSupportCount} Unread Admin {unreadSupportCount === 1 ? "Reply" : "Replies"}
                    </span>
                  )}
                </div>
              </div>

              {supportNotice && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    supportNotice.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  <span>{supportNotice.text}</span>
                  <button
                    type="button"
                    onClick={() => setSupportNotice(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Send New Message to Admin + Thread List */}
                <div className="lg:col-span-5 space-y-5">
                  <form
                    onSubmit={handleSendNewSupportTicket}
                    className="p-5 bg-white rounded-xl border border-slate-200 space-y-3.5"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Send New Message to Admin</h3>
                      <p className="text-xs text-slate-500">
                        Open a new support ticket or request a manual account upgrade/adjustment
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Topic / Category
                      </label>
                      <select
                        value={supportCategory}
                        onChange={(e) => setSupportCategory(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="general">General Support & Questions</option>
                        <option value="plan_upgrade">Plan Upgrade / Quota Increase Request</option>
                        <option value="billing">Billing, Crypto Treasury & Lemon Squeezy</option>
                        <option value="technical">Technical / Scraper & SMTP Assistance</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        placeholder="e.g. Question about upgrading my plan or custom lead credits"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Your Message to Admin *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={supportBody}
                        onChange={(e) => setSupportBody(e.target.value)}
                        placeholder="Write your message or support question for the Administrator..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={supportSending}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{supportSending ? "Sending Message..." : "Send Message to Admin"}</span>
                    </button>
                  </form>

                  {/* Thread List */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Your Support Threads & Admin Inbox ({supportThreads.length})
                      </h3>
                    </div>

                    {supportThreads.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No messages yet. Use the form above to message the Admin!
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
                        {supportThreads.map((thr) => {
                          const isSelected = activeSupportThread?.threadId === thr.threadId;
                          const lastMsg = thr.messages[thr.messages.length - 1];
                          return (
                            <button
                              key={thr.threadId}
                              type="button"
                              onClick={() => handleOpenSupportThread(thr.threadId)}
                              className={`w-full text-left p-4 transition-colors cursor-pointer ${
                                isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-xs text-slate-950 line-clamp-1">
                                  {thr.subject}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {thr.hasUnreadAdminReply && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                      NEW REPLY
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      thr.status === "replied"
                                        ? "bg-blue-100 text-blue-800"
                                        : thr.status === "resolved"
                                        ? "bg-slate-200 text-slate-700"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {thr.status}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                                <span className="font-semibold text-slate-700">
                                  {lastMsg?.senderRole === "admin" ? "Admin: " : "You: "}
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
                </div>

                {/* Right Column: Active Conversation Thread & Reply Box */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                  {!activeSupportThread ? (
                    <div className="p-10 text-center text-xs text-slate-500">
                      Select a conversation thread on the left or send a new message to the Administrator.
                    </div>
                  ) : (
                    <>
                      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              {activeSupportThread.category}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono-num">
                              #{activeSupportThread.threadId.slice(0, 12)}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-950 mt-1">
                            {activeSupportThread.subject}
                          </h3>
                        </div>

                        <span
                          className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full self-start sm:self-auto ${
                            activeSupportThread.status === "replied"
                              ? "bg-emerald-100 text-emerald-800"
                              : activeSupportThread.status === "resolved"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {activeSupportThread.status === "replied"
                            ? "Admin Responded"
                            : activeSupportThread.status === "resolved"
                            ? "Resolved"
                            : "Awaiting Admin Reply"}
                        </span>
                      </div>

                      <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto bg-slate-50/30">
                        {activeSupportThread.messages.map((msg) => {
                          const isAdmin = msg.senderRole === "admin";
                          return (
                            <div
                              key={msg.id}
                              className={`p-4 rounded-xl border ${
                                isAdmin
                                  ? "bg-blue-50/70 border-blue-200 ml-0 sm:mr-6"
                                  : "bg-white border-slate-200 ml-0 sm:ml-6"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                  className={`text-xs font-bold ${
                                    isAdmin ? "text-blue-800" : "text-slate-900"
                                  }`}
                                >
                                  {isAdmin
                                    ? `🛡️ ${msg.senderName || "Platform Admin"}`
                                    : `${msg.senderName || user?.fullName || "You"}`}
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
                        onSubmit={handleSendThreadReply}
                        className="p-4 border-t border-slate-200 bg-white space-y-3"
                      >
                        <label className="block text-xs font-semibold text-slate-700">
                          Reply to Admin in this Thread
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={threadReplyBody}
                          onChange={(e) => setThreadReplyBody(e.target.value)}
                          placeholder="Write a follow-up reply to the Administrator..."
                          className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={supportSending}
                            className="px-4 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{supportSending ? "Sending..." : "Send Reply"}</span>
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTION PLANS, LEMON SQUEEZY & CRYPTO BILLING */}
          {activeTab === "billing" && (
            <div className="space-y-6 sm:space-y-8">
              <div className="p-4 sm:p-6 bg-white rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    <span>Current Active Subscription</span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-emerald-700 font-semibold uppercase">{user?.subscriptionStatus || "Active"}</span>
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-950 mt-1">
                    {activePlan?.name || "Growth"} Plan ({user?.billingCycle || "monthly"} billing)
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Includes {(activePlan?.monthlyHuntLimit || 5000).toLocaleString()} verified leads/month,{" "}
                    {(activePlan?.monthlyEmailLimit || 15000).toLocaleString()} cold outreach emails/month, and up to{" "}
                    {activePlan?.maxEmailAccounts || 10} rotational SMTP inboxes.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      billingCycle === "monthly" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("annual")}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      billingCycle === "annual" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    Annual (-20%)
                  </button>
                </div>
              </div>

              {/* Plan Tier Selector Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {allPlans.map((plan) => {
                  const isCurrent = user?.planId === plan.id;
                  const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
                  return (
                    <div
                      key={plan.id}
                      className={`p-5 sm:p-6 bg-white rounded-xl border flex flex-col justify-between ${
                        isCurrent ? "border-blue-700 ring-1 ring-blue-700" : "border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-display text-lg font-bold text-slate-950">{plan.name}</h3>
                          {isCurrent && <span className="text-xs font-semibold text-blue-700">Active Plan</span>}
                        </div>
                        <p className="text-xs text-slate-500 mb-4">{plan.audience}</p>
                        <div className="pb-4 mb-4 border-b border-slate-200">
                          <span className="font-mono-num text-3xl font-bold text-slate-950">${price}</span>
                          <span className="text-xs text-slate-500"> / mo</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-600 mb-6">
                          <div className="flex justify-between">
                            <span>Monthly Leads</span>
                            <span className="font-mono-num font-semibold text-slate-900">
                              {plan.monthlyHuntLimit.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Monthly Emails</span>
                            <span className="font-mono-num font-semibold text-slate-900">
                              {plan.monthlyEmailLimit.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>SMTP Inboxes</span>
                            <span className="font-mono-num font-semibold text-slate-900">
                              {plan.maxEmailAccounts}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutPlan(plan);
                            setPaymentMethodTab("lemon");
                            setCheckoutStatus(null);
                          }}
                          className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {isCurrent ? "Top Up via Lemon Squeezy" : `Upgrade via Lemon Squeezy`}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutPlan(plan);
                            setPaymentMethodTab("crypto");
                            setCheckoutStatus(null);
                          }}
                          className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Pay with Crypto (USDT / BTC)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dual Checkout Drawer / Panel when a plan is selected */}
              {checkoutPlan && (
                <div className="p-4 sm:p-7 bg-white rounded-xl border-2 border-blue-700 space-y-5 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-slate-200">
                    <div>
                      <div className="text-xs font-semibold text-blue-700">Instant Subscription & Credit Settlement</div>
                      <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mt-0.5">
                        Checkout: {checkoutPlan.name} Plan ({billingCycle === "annual" ? "Annual" : "Monthly"}) —{" "}
                        <span className="font-mono-num">
                          ${billingCycle === "annual" ? checkoutPlan.annualPrice * 12 : checkoutPlan.monthlyPrice} USD
                        </span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPaymentMethodTab("lemon")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                            paymentMethodTab === "lemon" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                          }`}
                        >
                          Lemon Squeezy
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethodTab("crypto")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                            paymentMethodTab === "crypto" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                          }`}
                        >
                          Crypto Treasury
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCheckoutPlan(null)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                    </div>
                  </div>

                  {checkoutStatus && (
                    <div
                      className={`p-4 rounded-lg text-xs font-medium border ${
                        checkoutStatus.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-red-50 border-red-200 text-red-700"
                      }`}
                    >
                      {checkoutStatus.text}
                    </div>
                  )}

                  {paymentMethodTab === "lemon" ? (
                    <form onSubmit={handleLemonCheckout} className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-end">
                      <div className="md:col-span-5">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Lemon Squeezy Store & Variant ID
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`Store #${billingConfig?.lemonStoreId || "94821"} · Variant ${checkoutPlan.lemonVariantId}`}
                          className="w-full px-3.5 py-2 text-xs font-mono-num bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Payment Card Last 4 Digits (Express Settlement)
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={cardLast4}
                          onChange={(e) => setCardLast4(e.target.value)}
                          placeholder="4242"
                          className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <button
                          type="submit"
                          disabled={checkoutBusy}
                          className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {checkoutBusy ? "Processing Order..." : "Complete Lemon Squeezy Order"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleCryptoCheckout} className="space-y-5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        {CRYPTO_NETWORKS.map((net) => (
                          <button
                            key={net.id}
                            type="button"
                            onClick={() => setSelectedCryptoNet(net.id)}
                            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                              selectedCryptoNet === net.id
                                ? "border-blue-700 bg-blue-50/50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-950">{net.ticker}</div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{net.label}</div>
                          </button>
                        ))}
                      </div>

                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-slate-500">
                            Send exact equivalent of{" "}
                            <strong className="font-mono-num text-slate-900">
                              ${billingCycle === "annual" ? checkoutPlan.annualPrice * 12 : checkoutPlan.monthlyPrice} USD
                            </strong>{" "}
                            to Official Treasury Wallet Address:
                          </div>
                          <div className="font-mono-num text-xs font-semibold text-slate-950 break-all mt-1">
                            {billingConfig?.wallets?.[selectedCryptoNet] || "TVanguard9xK8m2LpQ7rW4nJ6vB3cZ1yH5"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const addr = billingConfig?.wallets?.[selectedCryptoNet] || "TVanguard9xK8m2LpQ7rW4nJ6vB3cZ1yH5";
                            navigator.clipboard.writeText(addr);
                            setCopiedWallet(true);
                            setTimeout(() => setCopiedWallet(false), 2000);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {copiedWallet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedWallet ? "Copied" : "Copy Address"}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-9">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            On-Chain Transaction Hash (TXID / Reference)
                          </label>
                          <input
                            type="text"
                            required
                            value={cryptoTxHash}
                            onChange={(e) => setCryptoTxHash(e.target.value)}
                            placeholder="0x89f4b2c9e1a... or TRON TXID"
                            className="w-full px-3.5 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <button
                            type="submit"
                            disabled={checkoutBusy}
                            className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            {checkoutBusy ? "Verifying TX..." : "Verify & Activate Plan"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Payment & Invoice History Ledger */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-950">Billing & Crypto Settlement Ledger</h3>
                  <p className="text-xs text-slate-500">All Lemon Squeezy and cryptocurrency transactions for this account</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[580px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/60">
                        <th className="py-3 px-4 sm:px-6">Date</th>
                        <th className="py-3 px-4">Plan & Cycle</th>
                        <th className="py-3 px-4">Payment Gateway</th>
                        <th className="py-3 px-4">Order Ref / TX Hash</th>
                        <th className="py-3 px-4 text-right">Amount (USD)</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No billing transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 sm:px-6 font-mono-num text-slate-600">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900 capitalize">
                              {p.planId} ({p.billingCycle})
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {p.paymentMethod === "lemon_squeezy"
                                ? "Lemon Squeezy"
                                : `Crypto (${p.cryptoNetwork || p.paymentMethod})`}
                            </td>
                            <td className="py-3 px-4 font-mono-num text-slate-600 truncate max-w-[200px]">
                              {p.txHashOrRef}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-950">
                              ${p.amountUsd}
                            </td>
                            <td className="py-3 px-4 sm:px-6 text-right font-semibold">
                              <span
                                className={
                                  p.status === "completed"
                                    ? "text-emerald-700"
                                    : p.status === "pending"
                                    ? "text-amber-700"
                                    : "text-red-700"
                                }
                              >
                                {p.status.toUpperCase()}
                              </span>
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

          {/* TAB 3: ACTIVITY AUDIT LOG */}
          {activeTab === "activities" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-950">Workspace Activity & Execution Log</h2>
                  <p className="text-xs text-slate-500">Complete audit log of lead hunts, outreach dispatches, and billing events</p>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                  {["all", "hunt", "billing", "auth"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
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
                {filteredActivities.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No matching activities found.</div>
                ) : (
                  filteredActivities.map((act) => (
                    <div key={act.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-slate-50">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-950">{act.action}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500 uppercase text-[11px]">{act.category}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 break-words">{act.details}</div>
                      </div>
                      <div className="font-mono-num text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
                        {new Date(act.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: WORKSPACE SETTINGS */}
          {activeTab === "settings" && (
            <div className="max-w-xl bg-white rounded-xl border border-slate-200 p-5 sm:p-7 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-950">Workspace Profile & Security</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage your agency identity, login credentials, and workspace API session token.
                </p>
              </div>

              {profileNotice && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                  {profileNotice}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Company / Agency Name</label>
                  <input
                    type="text"
                    value={profileCompany}
                    onChange={(e) => setProfileCompany(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    readOnly
                    value={user?.email || ""}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Save Profile Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    ← Back to Overview
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
