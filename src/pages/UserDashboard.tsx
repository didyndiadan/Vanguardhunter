import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import {
  SaasUser,
  SaasPlan,
  SaasPayment,
  UserActivity,
  SupportMessage,
  getSaasToken,
  getCachedSaasUser,
  saasFetch,
  setSaasSession,
  clearSaasSession,
  isUserAdmin,
} from "@/lib/saas-auth";
import { ExportLeadsBar } from "@/components/ProjectWorkspaceBar";
import MultiSmtpManagerPanel, { SmtpAppPasswordGuide } from "@/components/MultiSmtpManagerPanel";
import TrainYourAIPanel from "@/components/TrainYourAIPanel";
import {
  LeadProject,
  ExportableLead,
  DEFAULT_PROJECT_ID,
  loadProjects,
  saveProjects,
  syncProjectsFromServer,
  setActiveProjectId,
  loadProjectHuntedResults,
  loadUserProspects,
  saveUserProspects,
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
  Mail,
  Compass,
  CheckCircle2,
  ChevronRight,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";

/**
 * Extracts a clean, normalized domain from a website URL or email address
 * e.g. "https://www.austinsmilesdental.com/about" -> "austinsmilesdental.com"
 */
function extractCleanDomain(urlOrEmail?: string): string {
  if (!urlOrEmail) return "";
  let raw = String(urlOrEmail).trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@") && !raw.startsWith("http")) {
    raw = raw.split("@").pop() || "";
  }
  raw = raw.replace(/^[a-z]+:\/\//i, "");
  raw = raw.replace(/^www\./i, "");
  raw = raw.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
  return raw.trim();
}

function matchesBusinessOrDomain(
  rawQuery: string,
  item: {
    businessName?: string;
    website?: string;
    email?: string;
    category?: string;
    city?: string;
    projectName?: string;
    reportId?: string;
  }
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const qDomain = extractCleanDomain(q);

  const bName = (item.businessName || "").toLowerCase();
  const webRaw = (item.website || "").toLowerCase();
  const webDomain = extractCleanDomain(item.website);
  const emailRaw = (item.email || "").toLowerCase();
  const emailDomain = extractCleanDomain(item.email);
  const cat = (item.category || "").toLowerCase();
  const city = (item.city || "").toLowerCase();
  const proj = (item.projectName || "").toLowerCase();
  const repId = (item.reportId || "").toLowerCase();

  if (
    bName.includes(q) ||
    webRaw.includes(q) ||
    webDomain.includes(q) ||
    emailRaw.includes(q) ||
    emailDomain.includes(q) ||
    cat.includes(q) ||
    city.includes(q) ||
    proj.includes(q) ||
    repId.includes(q)
  ) {
    return true;
  }

  if (
    qDomain &&
    qDomain.length >= 2 &&
    (webDomain.includes(qDomain) || emailDomain.includes(qDomain) || bName.includes(qDomain))
  ) {
    return true;
  }

  return false;
}

type DashboardTab = "overview" | "projects" | "train-ai" | "smtp" | "support" | "billing" | "activities" | "settings";

const DISCOVERY_PRESET_PLAYBOOKS = [
  {
    id: "dentist-austin",
    category: "Dentist",
    city: "Austin",
    country: "USA",
    count: "50",
    context: "Focus on private dental & orthodontic practices missing 24/7 booking widgets",
    note: "High-ticket patient booking & AI receptionist demand",
  },
  {
    id: "medspa-miami",
    category: "MedSpa",
    city: "Miami",
    country: "USA",
    count: "50",
    context: "Aesthetic clinics & medspas needing instant lead capture and review funnels",
    note: "High-LTV cosmetic consultation & review shield fit",
  },
  {
    id: "roofing-phoenix",
    category: "Roofing & Solar",
    city: "Phoenix",
    country: "USA",
    count: "50",
    context: "Residential & commercial roofing contractors without instant quote calculators",
    note: "High-value home service quote capture",
  },
  {
    id: "law-chicago",
    category: "Law Firm",
    city: "Chicago",
    country: "USA",
    count: "50",
    context: "Personal injury & family law practices needing 24/7 client intake qualification",
    note: "High-retainer legal intake & qualification",
  },
  {
    id: "realestate-toronto",
    category: "Real Estate Agency",
    city: "Toronto",
    country: "Canada",
    count: "50",
    context: "Independent brokerages & property teams missing automated showing schedulers",
    note: "Listing inquiry & automated showing scheduler",
  },
  {
    id: "hvac-london",
    category: "HVAC & Plumbing",
    city: "London",
    country: "UK",
    count: "50",
    context: "Emergency heating & plumbing services losing after-hours calls to competitors",
    note: "Emergency dispatch & missed-call recovery",
  },
];

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
  const [loading, setLoading] = useState<boolean>(() => !getCachedSaasUser());

  const [user, setUser] = useState<SaasUser | null>(() => getCachedSaasUser());
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
  const [savedProspectsList, setSavedProspectsList] = useState<ExportableLead[]>(() =>
    loadUserProspects<ExportableLead>()
  );
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
  const [quickCount, setQuickCount] = useState("50");
  const [quickContext, setQuickContext] = useState("");
  const [highlightQuickHunt, setHighlightQuickHunt] = useState(false);

  // Getting Started & Lead Discovery Guided Tour state
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourStep, setTourStep] = useState<1 | 2 | 3 | 4>(1);
  const [tourDismissed, setTourDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vh_getting_started_dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [tourSelectedProjectId, setTourSelectedProjectId] = useState<string>(() => {
    const initialProjects = loadProjects();
    return initialProjects[0]?.id || DEFAULT_PROJECT_ID;
  });
  const [tourNewProjectName, setTourNewProjectName] = useState("");
  const [tourProjectCreatedNotice, setTourProjectCreatedNotice] = useState("");

  // Profile Settings state
  const [profileName, setProfileName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

  // Activity filter state
  const [activityFilter, setActivityFilter] = useState<string>("all");

  // Search bar state for filtering generated reports & saved lead lists by business name or domain
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState<string>("");
  const [searchScope, setSearchScope] = useState<"all" | "leads" | "reports">("all");
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [showAllReports, setShowAllReports] = useState<boolean>(false);
  const dashboardSearchInputRef = useRef<HTMLInputElement | null>(null);

  const loadDashboard = useCallback(async () => {
    const token = getSaasToken();
    const cached = getCachedSaasUser();
    if (!token && !cached) {
      clearSaasSession();
      setLocation("/auth?mode=login&redirect=/dashboard");
      return;
    }
    if (cached) {
      setUser((prev) => prev || cached);
      setProfileName((prev) => prev || cached.fullName || "");
      setProfileCompany((prev) => prev || cached.companyName || "");
    }
    setLoading(true);
    try {
      const [meData, plansData, cfgData, reportsData, crmData] = await Promise.all([
        saasFetch("/api/saas/auth/me").catch(() => ({ user: cached })),
        fetch("/api/saas/plans").then((r) => r.json()).catch(() => ({ plans: [] })),
        fetch("/api/saas/billing/config").then((r) => r.json()).catch(() => null),
        saasFetch("/api/reports").catch(() => ({ reports: [] })),
        saasFetch("/api/crm/prospects").catch(() => ({ prospects: [] })),
      ]);

      const resolvedUser = meData?.user || cached;
      if (resolvedUser) {
        setUser(resolvedUser);
        setProfileName(resolvedUser.fullName || "");
        setProfileCompany(resolvedUser.companyName || "");
        localStorage.setItem("vh_saas_user", JSON.stringify(resolvedUser));
        // Now that vh_saas_user is set to the authenticated user, reload user-scoped projects & prospects
        setProjects(loadProjects());
        const localProspects = loadUserProspects<ExportableLead>();
        const serverProspects: ExportableLead[] = Array.isArray(crmData?.prospects) ? crmData.prospects : [];
        if (serverProspects.length > 0 && localProspects.length === 0) {
          saveUserProspects(serverProspects);
          setSavedProspectsList(serverProspects);
        } else {
          setSavedProspectsList(localProspects);
        }
        syncProjectsFromServer().then((merged) => {
          if (merged.length > 0) setProjects(merged);
        }).catch(() => {});
      }
      if (meData?.plan) setActivePlan(meData.plan);
      if (Array.isArray(meData?.activities)) setActivities(meData.activities);
      if (Array.isArray(meData?.payments)) setPayments(meData.payments);
      if (Array.isArray(meData?.supportMessages)) {
        setSupportMessages(meData.supportMessages);
        const unread = meData.supportMessages.filter(
          (m: SupportMessage) => !m.readByUser && m.senderRole === "admin"
        ).length;
        setUnreadSupportCount(unread);
      }
      if (meData?.workspaceCounts) setWorkspaceCounts(meData.workspaceCounts);
      if (Array.isArray(plansData?.plans)) {
        setAllPlans(plansData.plans);
        const urlParams = new URLSearchParams(window.location.search);
        const requestedPlanId = urlParams.get("plan");
        const requestedCycle = urlParams.get("cycle");
        if (requestedCycle === "annual" || requestedCycle === "monthly") {
          setBillingCycle(requestedCycle);
        }
        if (requestedPlanId) {
          const matchedPlan = plansData.plans.find((p: SaasPlan) => p.id === requestedPlanId);
          if (matchedPlan) {
            setCheckoutPlan(matchedPlan);
            setActiveTab("billing");
          }
        }
      }
      if (cfgData) setBillingConfig(cfgData);
      if (Array.isArray(reportsData)) {
        setRecentReports(reportsData);
      } else if (Array.isArray(reportsData?.reports)) {
        setRecentReports(reportsData.reports);
      }
    } catch (err) {
      console.error("Failed to load user dashboard:", err);
      if (!cached) {
        clearSaasSession();
        setLocation("/auth?mode=login&redirect=/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as DashboardTab | null;
    if (
      tabParam &&
      ["overview", "projects", "train-ai", "smtp", "support", "billing", "activities", "settings"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
    const cycleParam = params.get("cycle");
    if (cycleParam === "annual" || cycleParam === "monthly") {
      setBillingCycle(cycleParam);
    }
    if (params.get("tour") === "1" || params.get("onboarding") === "1") {
      setShowTourModal(true);
      setTourStep(1);
    }
    loadDashboard();
    setSavedProspectsList(loadUserProspects<ExportableLead>());
  }, [loadDashboard]);

  useEffect(() => {
    if (projects.length > 0 && !projects.some((p) => p.id === tourSelectedProjectId)) {
      setTourSelectedProjectId(projects[0].id);
    }
  }, [projects, tourSelectedProjectId]);

  // Keyboard shortcut (⌘K / Ctrl+K or '/') to quickly focus the dashboard search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (activeTab !== "overview" && activeTab !== "projects") {
          setActiveTab("overview");
        }
        setTimeout(() => {
          dashboardSearchInputRef.current?.focus();
          dashboardSearchInputRef.current?.select();
        }, 40);
      } else if (!isEditable && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (activeTab === "overview" || activeTab === "projects") {
          e.preventDefault();
          dashboardSearchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab]);

  const openTourStep = (step: 1 | 2 | 3 | 4 = 1) => {
    setTourStep(step);
    setShowTourModal(true);
    setMobileMenuOpen(false);
  };

  const handleDismissTourBanner = () => {
    setTourDismissed(true);
    try {
      localStorage.setItem("vh_getting_started_dismissed", "1");
    } catch {}
  };

  const handleCreateProjectInsideTour = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = tourNewProjectName.trim() || `${quickCategory} - ${quickCity}`;
    const now = new Date().toISOString();
    const created: LeadProject = {
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      description: `Lead discovery campaign for ${quickCategory} in ${quickCity}, ${quickCountry}`,
      targetCategory: quickCategory,
      targetCity: quickCity,
      targetCountry: quickCountry,
      extraContext: quickContext,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...projects, created];
    setProjects(next);
    saveProjects(next);
    setActiveProjectId(created.id);
    setTourSelectedProjectId(created.id);
    setTourNewProjectName("");
    setTourProjectCreatedNotice(`Project "${created.name}" created and selected.`);
  };

  const handleLaunchTourDiscovery = (autoRunInCrm: boolean) => {
    const chosenProjId = tourSelectedProjectId || projects[0]?.id || DEFAULT_PROJECT_ID;
    setActiveProjectId(chosenProjId);
    // Update the selected project's target fields so it remembers the user's first discovery settings
    const updatedProjects = projects.map((p) =>
      p.id === chosenProjId
        ? {
            ...p,
            targetCategory: quickCategory.trim() || "Dentist",
            targetCity: quickCity.trim() || "Austin",
            targetCountry: quickCountry.trim() || "USA",
            extraContext: quickContext.trim(),
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    setProjects(updatedProjects);
    saveProjects(updatedProjects);

    localStorage.setItem(
      "vh_quick_hunt",
      JSON.stringify({
        category: quickCategory.trim() || "Dentist",
        city: quickCity.trim() || "Austin",
        country: quickCountry.trim() || "USA",
        count: quickCount || "50",
        extraContext: quickContext.trim(),
        autoRun: autoRunInCrm,
      })
    );
    setShowTourModal(false);
    setLocation(`/crm?tab=hunter&project=${encodeURIComponent(chosenProjId)}`);
  };

  const handleApplyTourToQuickBar = () => {
    setShowTourModal(false);
    setActiveTab("overview");
    setHighlightQuickHunt(true);
    setTimeout(() => {
      const el = document.getElementById("quick-lead-hunt-launcher");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
    setTimeout(() => setHighlightQuickHunt(false), 4000);
  };

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
      if (res.user) {
        setUser(res.user);
        setSaasSession(getSaasToken(), res.user);
      }
      if (res.plan) {
        setActivePlan(res.plan);
      }
      setCheckoutStatus({ type: "success", text: res.message || "Subscription upgraded via Lemon Squeezy!" });
      await loadDashboard();
      setTimeout(() => setCheckoutPlan(null), 2200);
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
      if (res.user) {
        setUser(res.user);
        setSaasSession(getSaasToken(), res.user);
      }
      if (res.plan) {
        setActivePlan(res.plan);
      }
      setCheckoutStatus({ type: "success", text: res.message || "Crypto payment verified!" });
      setCryptoTxHash("");
      await loadDashboard();
      setTimeout(() => setCheckoutPlan(null), 2200);
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

  const isFreePlanUser = (user?.planId || activePlan?.id) === "free";
  const huntLimit = activePlan?.monthlyHuntLimit ?? (isFreePlanUser ? 50 : 1000);
  const emailLimit = activePlan?.monthlyEmailLimit ?? (isFreePlanUser ? 150 : 3000);
  const huntsPct = Math.min(100, Math.round(((user?.huntsUsedThisMonth || 0) / Math.max(1, huntLimit)) * 100));
  const emailsPct = Math.min(100, Math.round(((user?.emailsSentThisMonth || 0) / Math.max(1, emailLimit)) * 100));

  const filteredActivities = activities.filter((a) =>
    activityFilter === "all" ? true : a.category === activityFilter
  );

  const normalizedSearchQuery = dashboardSearchQuery.trim();
  const isSearchActive = normalizedSearchQuery.length > 0;

  // Filter generated website audit reports by business name or domain
  const filteredReports = useMemo(() => {
    if (!isSearchActive) return recentReports;
    return recentReports.filter((r: any) =>
      matchesBusinessOrDomain(normalizedSearchQuery, {
        businessName: r.businessName,
        website: r.website,
        reportId: r.reportId,
        category: r.category,
        city: r.city,
      })
    );
  }, [recentReports, isSearchActive, normalizedSearchQuery]);

  const visibleReports = useMemo(() => {
    if (isSearchActive || showAllReports) return filteredReports;
    return filteredReports.slice(0, 6);
  }, [filteredReports, isSearchActive, showAllReports]);

  // Compute per-project lead lists and filtered leads by business name or domain
  const projectLeadSummaries = useMemo(() => {
    return projects.map((proj) => {
      const allLeads = getProjectLeads(proj.id);
      const matchingLeads = !isSearchActive
        ? allLeads
        : allLeads.filter((lead) =>
            matchesBusinessOrDomain(normalizedSearchQuery, {
              businessName: lead.businessName,
              website: lead.website,
              email: lead.email,
              category: lead.category || proj.targetCategory,
              city: lead.city || proj.targetCity,
              projectName: proj.name,
            })
          );
      const projectMetaMatches =
        isSearchActive &&
        matchesBusinessOrDomain(normalizedSearchQuery, {
          businessName: proj.name,
          category: proj.targetCategory,
          city: proj.targetCity,
          projectName: proj.name,
        });
      return {
        project: proj,
        allLeads,
        matchingLeads,
        projectMetaMatches,
        hasMatch: !isSearchActive || matchingLeads.length > 0 || projectMetaMatches,
      };
    });
  }, [projects, getProjectLeads, isSearchActive, normalizedSearchQuery]);

  const visibleProjectSummaries = useMemo(() => {
    if (!isSearchActive) return projectLeadSummaries;
    return projectLeadSummaries.filter((item) => item.hasMatch);
  }, [projectLeadSummaries, isSearchActive]);

  const totalSavedLeadsCount = useMemo(
    () => projectLeadSummaries.reduce((acc, item) => acc + item.allLeads.length, 0),
    [projectLeadSummaries]
  );

  const matchingSavedLeads = useMemo(() => {
    if (!isSearchActive) {
      return projectLeadSummaries.flatMap((item) => item.allLeads);
    }
    return projectLeadSummaries.flatMap((item) => item.matchingLeads);
  }, [projectLeadSummaries, isSearchActive]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectIds((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

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
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-400 truncate">
                {user?.email || "founder@apexagency.io"}
              </span>
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-[10px] font-semibold text-emerald-400">
                ✓ Verified
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Active Tier</span>
              <span className="font-semibold text-[#C4B5FD] uppercase">
                {activePlan?.name || (user?.planId === "free" ? "Free Explorer" : user?.planId) || "Free Explorer"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Lead Credits</span>
              <span className="font-mono-num font-semibold text-emerald-400">
                {(user?.creditsBalance ?? (isFreePlanUser ? 50 : 1000)).toLocaleString()}
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
              onClick={() => handleSelectTab("train-ai")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "train-ai"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Train Your AI &amp; Offers</span>
              </span>
              <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                Offers
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("smtp")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === "smtp"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Multi-SMTP & Gmails</span>
              </span>
              <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                Guide
              </span>
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
              onClick={() => openTourStep(1)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#DDD6FE] border border-[#8B3DFF]/35 transition-colors cursor-pointer mb-1.5"
            >
              <span className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[#C4B5FD]" />
                <span>Getting Started Tour</span>
              </span>
              <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-[#8B3DFF]/30 text-white">
                4 Steps
              </span>
            </button>

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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#FAF9F5] text-[#0B0F17] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar ($260px Workspace Canvas) */}
      <aside className="hidden lg:flex w-[260px] shrink-0 bg-[#0B0F17] text-slate-200 border-r border-slate-800 flex-col justify-between">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B0F17]/65 backdrop-blur-xs lg:hidden flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[270px] max-w-[85vw] h-full overflow-y-auto bg-[#0B0F17] text-slate-200 border-r border-slate-800 flex flex-col justify-between shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Bar Contract for SaaS Dashboard with Mobile Drawer Toggle & Explicit Back Button */}
        <header className="bg-white border-b border-[#E4E2DD] px-4 sm:px-8 py-3 sm:h-16 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#E4E2DD] text-[#0B0F17] hover:bg-[#F2F0EA] cursor-pointer"
              aria-label="Open workspace menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0B0F17] bg-[#F2F0EA] hover:bg-[#E4E2DD] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-medium text-[#525866] truncate">
              <span className="hidden sm:inline">Workspace</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="text-[#0B0F17] font-semibold capitalize truncate">{activeTab}</span>
              <span className="hidden md:inline" aria-hidden="true">·</span>
              <span className="hidden md:inline truncate">{user?.fullName || "Elena Vance"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Header Search Input for Reports & Saved Leads */}
            <div className="relative hidden xl:block w-64">
              <Search className="w-3.5 h-3.5 text-[#525866] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={dashboardSearchQuery}
                onChange={(e) => {
                  setDashboardSearchQuery(e.target.value);
                  if (activeTab !== "overview" && activeTab !== "projects") {
                    setActiveTab("overview");
                  }
                }}
                placeholder="Filter reports & leads by name/domain..."
                aria-label="Filter generated reports and saved lead lists by business name or domain"
                className="w-full pl-8 pr-12 py-1.5 text-xs bg-[#FAF9F5] border border-[#E4E2DD] rounded-lg text-[#0B0F17] placeholder:text-[#525866] focus:outline-none focus:bg-white focus:border-[#1D4ED8] transition-colors"
              />
              {dashboardSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setDashboardSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#525866] hover:text-[#0B0F17] cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="font-mono-num text-[10px] text-[#525866] bg-white border border-[#E4E2DD] rounded px-1 py-0.2 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  ⌘K
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => openTourStep(1)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#5B21B6] bg-[#EDE9FE] hover:bg-[#DDD6FE] border border-[#7C3AED]/30 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Getting Started</span>
            </button>
            <button
              type="button"
              onClick={loadDashboard}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#525866] hover:text-[#0B0F17] border border-[#E4E2DD] rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("support")}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#0B0F17] bg-[#F2F0EA] hover:bg-[#E4E2DD] rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1D4ED8]" />
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
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-[#0B0F17] bg-[#F2F0EA] hover:bg-[#E4E2DD] rounded-lg whitespace-nowrap cursor-pointer"
            >
              <span className="sm:hidden">Billing</span>
              <span className="hidden sm:inline">Upgrade Plan / Crypto Top-Up</span>
            </button>
            <button
              type="button"
              onClick={() => setLocation("/crm")}
              className="px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] rounded-lg whitespace-nowrap cursor-pointer"
            >
              + Hunt Leads
            </button>
            <button
              type="button"
              onClick={() => {
                clearSaasSession();
                setLocation("/landing");
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Quick-Navigation Tab Strip */}
        <div className="lg:hidden bg-white border-b border-[#E4E2DD] px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "projects", label: `Projects (${projects.length})` },
              { id: "train-ai", label: "Train Your AI (Offers)" },
              { id: "smtp", label: "Multi-SMTP & Gmail" },
              {
                id: "support",
                label: unreadSupportCount > 0 ? `Support (${unreadSupportCount} New)` : "Support & Inbox",
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
                  ? "bg-[#0B0F17] text-white"
                  : "bg-[#F2F0EA] text-[#525866] hover:text-[#0B0F17]"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLocation("/crm")}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap bg-[#EFF6FF] text-[#1D4ED8] cursor-pointer"
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
          {/* UNIFIED SEARCH & FILTER BAR FOR GENERATED REPORTS & SAVED LEAD LISTS */}
          {(activeTab === "overview" || activeTab === "projects") && (
            <div className="p-4 sm:p-5 bg-white rounded-xl border border-[#E4E2DD] space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#525866] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={dashboardSearchInputRef}
                    type="text"
                    value={dashboardSearchQuery}
                    onChange={(e) => setDashboardSearchQuery(e.target.value)}
                    placeholder="Search generated audit reports & saved lead lists by business name or domain (e.g. Austin Smiles, austinsmiles.com)..."
                    aria-label="Search generated reports and saved lead lists by business name or domain"
                    className="w-full pl-10 pr-24 py-2.5 text-xs sm:text-sm bg-[#FAF9F5] border border-[#E4E2DD] rounded-lg text-[#0B0F17] placeholder:text-[#525866] focus:outline-none focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 transition-all"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {dashboardSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setDashboardSearchQuery("")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#F2F0EA] hover:bg-[#E4E2DD] text-[#0B0F17] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    ) : (
                      <span className="hidden sm:inline-block font-mono-num text-[11px] text-[#525866] bg-white border border-[#E4E2DD] px-1.5 py-0.5 rounded">
                        ⌘K or /
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {(
                    [
                      {
                        id: "all",
                        label: "All Workspace",
                        count: matchingSavedLeads.length + filteredReports.length,
                      },
                      {
                        id: "leads",
                        label: "Saved Lead Lists",
                        count: matchingSavedLeads.length,
                      },
                      {
                        id: "reports",
                        label: "Generated Reports",
                        count: filteredReports.length,
                      },
                    ] as const
                  ).map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setSearchScope(scope.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        searchScope === scope.id
                          ? "bg-[#0B0F17] text-white"
                          : "bg-[#FAF9F5] text-[#525866] hover:text-[#0B0F17] border border-[#E4E2DD]"
                      }`}
                    >
                      <span>{scope.label}</span>
                      <span
                        className={`font-mono-num text-[11px] px-1.5 py-0.2 rounded ${
                          searchScope === scope.id
                            ? "bg-white/15 text-white"
                            : "bg-white text-[#0B0F17] border border-[#E4E2DD]"
                        }`}
                      >
                        {scope.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Search Live Match Breakdown & Instant Filtered Results */}
              {isSearchActive && (
                <div className="pt-3 border-t border-[#E4E2DD] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-[#525866]">
                      <span>
                        Filtering by business name or domain:{" "}
                        <strong className="text-[#0B0F17] font-mono-num">"{normalizedSearchQuery}"</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-semibold text-[#1D4ED8]">
                        {matchingSavedLeads.length} matching{" "}
                        {matchingSavedLeads.length === 1 ? "saved lead" : "saved leads"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-semibold text-emerald-700">
                        {filteredReports.length} matching{" "}
                        {filteredReports.length === 1 ? "audit report" : "audit reports"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDashboardSearchQuery("");
                        setSearchScope("all");
                      }}
                      className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </div>

                  {/* Instant Filtered Results Grid when user is searching */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {(searchScope === "all" || searchScope === "leads") && (
                      <div
                        className={`${
                          searchScope === "leads" ? "lg:col-span-12" : "lg:col-span-7"
                        } rounded-xl border border-slate-200 bg-[#FAF9F5] overflow-hidden`}
                      >
                        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-xs font-bold text-slate-950">
                              Matching Leads in Saved Lists ({matchingSavedLeads.length})
                            </span>
                          </div>
                          {matchingSavedLeads.length > 0 && (
                            <ExportLeadsBar
                              leads={matchingSavedLeads}
                              projectName={`filtered-${normalizedSearchQuery}`}
                              compact
                            />
                          )}
                        </div>
                        {matchingSavedLeads.length === 0 ? (
                          <div className="p-5 text-center text-xs text-slate-500">
                            No saved leads match "{normalizedSearchQuery}" by business name or domain.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto bg-white">
                            {matchingSavedLeads.slice(0, 25).map((lead, idx) => {
                              const cleanDom =
                                extractCleanDomain(lead.website) || extractCleanDomain(lead.email);
                              return (
                                <div
                                  key={`${lead.projectId || "p"}-${lead.id || idx}`}
                                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-slate-950 truncate">
                                        {lead.businessName}
                                      </span>
                                      {cleanDom && (
                                        <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate">
                                          {cleanDom}
                                        </span>
                                      )}
                                      {lead.projectName && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                          {lead.projectName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {[lead.category, lead.city, lead.email].filter(Boolean).join(" · ") ||
                                        "Saved workspace prospect"}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {lead.reportUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setLocation(lead.reportUrl!)}
                                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                                      >
                                        Audit
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenProjectInCRM(
                                          lead.projectId || projects[0]?.id || DEFAULT_PROJECT_ID
                                        )
                                      }
                                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded-md cursor-pointer"
                                    >
                                      Open in CRM →
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {(searchScope === "all" || searchScope === "reports") && (
                      <div
                        className={`${
                          searchScope === "reports" ? "lg:col-span-12" : "lg:col-span-5"
                        } rounded-xl border border-slate-200 bg-[#FAF9F5] overflow-hidden`}
                      >
                        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-950">
                              Matching Audit Reports ({filteredReports.length})
                            </span>
                          </div>
                        </div>
                        {filteredReports.length === 0 ? (
                          <div className="p-5 text-center text-xs text-slate-500">
                            No generated website reports match "{normalizedSearchQuery}".
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto bg-white">
                            {filteredReports.map((r: any) => {
                              const cleanDom = extractCleanDomain(r.website);
                              return (
                                <div
                                  key={r.reportId}
                                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-slate-950 truncate">
                                        {r.businessName || r.reportId}
                                      </span>
                                      {cleanDom && (
                                        <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 truncate">
                                          {cleanDom}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                      <span>{r.website}</span>
                                      <span aria-hidden="true"> · </span>
                                      <span className="font-mono-num">{r.totalViews || 0} views</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setLocation(`/report/${r.reportId}`)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded-md shrink-0 cursor-pointer"
                                  >
                                    View Report →
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Apollo-Style Free Explorer Account Entitlements & Locked Features Banner */}
              {isFreePlanUser && !isUserAdmin(user) && (
                <div
                  className="p-5 sm:p-6 rounded-2xl text-white shadow-sm border border-white/15 space-y-4"
                  style={{
                    background: "linear-gradient(115deg, #8B2CF5 0%, #6D3BF7 48%, #434CE8 100%)",
                  }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/15 pb-4">
                    <div>
                      <div className="text-[11px] font-mono-num uppercase tracking-wider text-white/85">
                        APOLLO-STYLE FREE EXPLORER ACCOUNT · LIMITED ACCESS TIER ($0/MO)
                      </div>
                      <h2 className="font-display text-lg sm:text-xl font-bold text-white mt-0.5">
                        You are on the Free Explorer Plan ({user?.creditsBalance ?? 50} of 50 monthly lead credits remaining)
                      </h2>
                      <p className="text-xs text-white/90 mt-1 max-w-3xl">
                        Free accounts include basic single-city discovery to test Vanguard Hunter live, while high-volume multi-city extraction, multi-inbox SMTP rotation, 24/7 Autopilot, and AI Website + Review Shield builders are locked until you upgrade.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("billing")}
                      className="px-4 py-2.5 rounded-xl bg-white text-[#141413] hover:bg-stone-100 text-xs font-bold whitespace-nowrap self-start lg:self-center shadow-xs cursor-pointer"
                    >
                      Upgrade Account Plan →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white/15 border border-white/20 space-y-1.5">
                      <div className="font-bold text-white">✓ What Free Explorer Users Get (Apollo Free Model)</div>
                      <ul className="space-y-1 text-white/90 text-[11px]">
                        <li>• <strong>50 Verified B2B Lead Credits / month</strong> (DNS &amp; MX verified emails)</li>
                        <li>• <strong>Single-City Basic Search</strong> (capped at up to 25 leads per scan)</li>
                        <li>• <strong>1 Connected Sender Mailbox</strong> (capped at 150 outreach emails / month)</li>
                        <li>• <strong>1 Sample Website Diagnostic Audit Report</strong> preview (<code className="font-mono-num">/report/:id</code>)</li>
                      </ul>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#141413]/35 border border-white/15 space-y-1.5">
                      <div className="font-bold text-[#EDE9FE]">🔒 Locked on Free Plan (Requires Starter / Growth / Scale / VIP)</div>
                      <ul className="space-y-1 text-white/85 text-[11px]">
                        <li>• 🔒 <strong>20-City Bulk Lead Hunter</strong> &amp; Uncapped Batch Extraction (Growth+)</li>
                        <li>• 🔒 <strong>Multi-Inbox Rotational Pool (3 to 100 Inboxes)</strong> &amp; 24/7 Autopilot</li>
                        <li>• 🔒 <strong>AI 4-Tap Client Website Builder (<code className="font-mono-num">/site/:id</code>)</strong> &amp; 5-Star Review Shield</li>
                        <li>• 🔒 <strong>Autonomous AI Outbound Phone Caller</strong> &amp; Bulk CSV/JSON Exports</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Metric Strip (Single-Elevation, Tabular Numerals) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Available Lead Credits</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {(user?.creditsBalance ?? (isFreePlanUser ? 50 : 1000)).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    <span>Plan: {activePlan?.name || (isFreePlanUser ? "Free Explorer" : "Starter")}</span>
                    <span aria-hidden="true"> · </span>
                    <span className={isFreePlanUser ? "text-[#7C3AED] font-semibold" : "text-emerald-700 font-medium"}>
                      {isFreePlanUser ? "Free Tier (Capped)" : "Active"}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Leads Hunted This Month</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {(user?.huntsUsedThisMonth ?? 0).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400">/ {huntLimit.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${huntsPct}%` }} />
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Outreach Emails Dispatched</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {(user?.emailsSentThisMonth ?? 0).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400">/ {emailLimit.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${emailsPct}%` }} />
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Client Website Audit Reports</div>
                  <div className="font-mono-num text-2xl font-bold text-slate-950 mt-1">
                    {workspaceCounts.auditReports || user?.auditsRunThisMonth || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 flex items-center justify-between gap-2">
                    <div>
                      <span>Rotational Inboxes: {workspaceCounts.connectedEmailAccounts}</span>
                      <span aria-hidden="true"> / </span>
                      <span>{activePlan?.maxEmailAccounts ?? (isFreePlanUser ? 1 : 3)} max</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("smtp")}
                      className="text-[11px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      + Setup Gmails →
                    </button>
                  </div>
                </div>
              </div>

              {/* Getting Started: Interactive Lead Discovery Onboarding Checklist & Tour Trigger */}
              {!tourDismissed ? (
                <div className="p-5 sm:p-6 bg-white rounded-xl border border-[#E4E2DD] space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E4E2DD]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#1D4ED8]">
                        <Compass className="w-4 h-4" />
                        <span>Getting Started · Step 1: Train Your AI First</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num text-[#525866]">~60 sec setup</span>
                      </div>
                      <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B0F17]">
                        Start Here: Train Your AI With Your Offers First, Then Hunt Leads
                      </h2>
                      <p className="text-xs sm:text-sm text-[#525866] max-w-3xl">
                        <strong>Important first step:</strong> Before hunting businesses or sending cold emails, train the AI with your service offers, pain points, and email blueprint in <strong>Train Your AI &amp; Offers</strong> so every cold email is hyper-personalized to what you sell.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectTab("train-ai")}
                        className="px-4 py-2.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Step 1: Train Your AI First →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openTourStep(1)}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Launch Interactive Guided Tour</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissTourBanner}
                        className="px-3 py-2.5 text-xs font-medium text-[#525866] hover:text-[#0B0F17] border border-[#E4E2DD] hover:bg-[#FAF9F5] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Dismiss Guide
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[
                      {
                        step: 1 as const,
                        index: "01",
                        title: "Train Your AI First (My Offers)",
                        desc: "Start here! Add your service offers, target pain points, and cold email template so the AI writes personalized emails for your offers.",
                        meta: user?.aiTrainingProfile?.offerDetails ? "Custom Offers Trained ✓" : "Click to train your AI offers first",
                        done: Boolean(user?.aiTrainingProfile?.offerDetails),
                      },
                      {
                        step: 2 as const,
                        index: "02",
                        title: "Select Niche & City",
                        desc: "Choose from 120+ business verticals (e.g. Dentist, MedSpa, Roofing) and specify your target city.",
                        meta: `Current: ${quickCategory} · ${quickCity}`,
                        done: Boolean(quickCategory.trim() && quickCity.trim()),
                      },
                      {
                        step: 3 as const,
                        index: "03",
                        title: "Assign Campaign Project",
                        desc: "Isolate scraped prospects, pipeline stages, and CSV/JSON exports inside a dedicated workspace project.",
                        meta: `${projects.length} active ${projects.length === 1 ? "project" : "projects"}`,
                        done: projects.length > 0,
                      },
                      {
                        step: 4 as const,
                        index: "04",
                        title: "Execute Lead Hunt & Outreach",
                        desc: "Run the live discovery scan in the CRM Hunter and generate personalized cold emails matched to your trained offers.",
                        meta:
                          savedProspectsList.length > 0
                            ? `${savedProspectsList.length} leads in workspace`
                            : "Ready to launch first scan",
                        done: savedProspectsList.length > 0,
                      },
                    ].map((item) => (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => openTourStep(item.step)}
                        className="text-left p-4 rounded-xl border border-[#E4E2DD] bg-[#FAF9F5] hover:bg-white hover:border-[#1D4ED8] transition-colors flex flex-col justify-between gap-3 group cursor-pointer"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono-num font-bold text-[#1D4ED8]">
                              Step {item.index}
                            </span>
                            <span className="text-[11px] font-medium text-[#525866] group-hover:text-[#1D4ED8] flex items-center gap-0.5">
                              <span>{item.done ? "Configured" : "Configure"}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#0B0F17]">{item.title}</h3>
                          <p className="text-xs text-[#525866] leading-relaxed">{item.desc}</p>
                        </div>

                        <div className="pt-2.5 border-t border-[#E4E2DD] flex items-center justify-between text-[11px] font-mono-num text-[#0B0F17]">
                          <span className="truncate">{item.meta}</span>
                          {item.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 bg-white rounded-xl border border-[#E4E2DD] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#525866]">
                    <Compass className="w-4 h-4 text-[#1D4ED8]" />
                    <span className="font-semibold text-[#0B0F17]">Need a refresher on launching lead discovery campaigns?</span>
                    <span className="hidden sm:inline">Open the 4-step interactive walkthrough with pre-built market templates anytime.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTourDismissed(false);
                        try {
                          localStorage.removeItem("vh_getting_started_dismissed");
                        } catch {}
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-[#525866] hover:text-[#0B0F17] cursor-pointer"
                    >
                      Show Checklist
                    </button>
                    <button
                      type="button"
                      onClick={() => openTourStep(1)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B0F17] hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Open Guided Tour →
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Lead Hunt Launcher Bar */}
              <div
                id="quick-lead-hunt-launcher"
                className={`p-4 sm:p-6 bg-white rounded-xl border transition-all ${
                  highlightQuickHunt
                    ? "border-[#1D4ED8] ring-2 ring-[#1D4ED8]/20"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-slate-950">
                      Quick-Launch Autonomous B2B Lead Hunt
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Discover active businesses in any target market with automated contact and domain verification.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
                    <button
                      type="button"
                      onClick={() => openTourStep(1)}
                      className="text-xs font-semibold text-[#525866] hover:text-[#0B0F17] flex items-center gap-1 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-[#1D4ED8]" />
                      <span>How It Works (Tour)</span>
                    </button>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setLocation("/crm")}
                      className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      Open Full AI Hunter & Sequence Pipeline →
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    localStorage.setItem(
                      "vh_quick_hunt",
                      JSON.stringify({
                        category: quickCategory,
                        city: quickCity,
                        country: quickCountry,
                        count: quickCount,
                        extraContext: quickContext,
                        autoRun: true,
                      })
                    );
                    setLocation("/crm?tab=hunter");
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
              {(searchScope === "all" || searchScope === "leads") && (
                <div className="p-4 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-blue-600" />
                        <h2 className="font-display text-base sm:text-lg font-bold text-slate-950">
                          Your Active Projects & Saved Lead Lists
                        </h2>
                        <span className="font-mono-num text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {isSearchActive
                            ? `${matchingSavedLeads.length} of ${totalSavedLeadsCount} leads`
                            : `${totalSavedLeadsCount} total leads`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Organize your lead generation into separate projects, filter saved leads by business name or domain, and export to CSV or JSON.
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

                  {visibleProjectSummaries.length === 0 ? (
                    <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60 text-center space-y-2">
                      <p className="text-xs text-slate-600">
                        No saved lead lists or businesses matched{" "}
                        <span className="font-semibold text-slate-900">"{normalizedSearchQuery}"</span>.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDashboardSearchQuery("")}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                      >
                        Clear Search Filter
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {visibleProjectSummaries.map(({ project: proj, allLeads, matchingLeads }) => {
                        const isExpanded = Boolean(expandedProjectIds[proj.id]) || isSearchActive;
                        const leadsToDisplay = isSearchActive ? matchingLeads : allLeads;
                        return (
                          <div
                            key={proj.id}
                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="text-sm font-bold text-slate-950 truncate">{proj.name}</h3>
                                  {(proj.targetCategory || proj.targetCity) && (
                                    <p className="text-[11px] text-slate-500 truncate">
                                      {[proj.targetCategory, proj.targetCity, proj.targetCountry]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                  )}
                                </div>
                                <span className="font-mono-num text-xs font-bold text-blue-700 shrink-0">
                                  {isSearchActive
                                    ? `${matchingLeads.length}/${allLeads.length} leads`
                                    : `${allLeads.length} ${allLeads.length === 1 ? "lead" : "leads"}`}
                                </span>
                              </div>

                              {allLeads.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleProjectExpand(proj.id)}
                                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-blue-600 transition-colors cursor-pointer"
                                >
                                  <span>
                                    {isExpanded
                                      ? `Hide Saved Leads (${leadsToDisplay.length})`
                                      : `Preview Saved Leads & Domains (${leadsToDisplay.length})`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                </button>
                              )}

                              {isExpanded && leadsToDisplay.length > 0 && (
                                <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                  {leadsToDisplay.slice(0, 15).map((lead, idx) => {
                                    const cleanDom =
                                      extractCleanDomain(lead.website) || extractCleanDomain(lead.email);
                                    return (
                                      <div
                                        key={`${proj.id}-lead-${lead.id || idx}`}
                                        className="px-2.5 py-2 flex items-center justify-between gap-2 text-[11px] hover:bg-slate-50"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-900 truncate">
                                            {lead.businessName}
                                          </div>
                                          <div className="font-mono-num text-[10px] text-slate-500 truncate">
                                            {cleanDom || lead.city || lead.category || "No domain"}
                                          </div>
                                        </div>
                                        {lead.website && (
                                          <a
                                            href={
                                              lead.website.startsWith("http")
                                                ? lead.website
                                                : `https://${lead.website}`
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 shrink-0"
                                            title={lead.website}
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
                                leads={leadsToDisplay}
                                projectName={proj.name}
                                compact
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Two-Column Workspace Tables: Recent Website Audits & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recent Client Website Audit Reports */}
                {(searchScope === "all" || searchScope === "reports") && (
                  <div
                    className={`${
                      searchScope === "reports" ? "lg:col-span-12" : "lg:col-span-6"
                    } bg-white rounded-xl border border-slate-200 overflow-hidden`}
                  >
                    <div className="px-4 sm:px-6 py-4 border-b border-slate-200 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-950">
                              Client Website Audit Reports
                            </h3>
                            <span className="font-mono-num text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {isSearchActive
                                ? `${filteredReports.length} of ${recentReports.length}`
                                : recentReports.length}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Interactive diagnostic pages tracked for prospect opens — filter by business or domain
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLocation("/crm")}
                          className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Manage in CRM
                        </button>
                      </div>

                      {/* Inline Quick Filter for Generated Reports */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={dashboardSearchQuery}
                          onChange={(e) => setDashboardSearchQuery(e.target.value)}
                          placeholder="Filter generated reports by business name or domain..."
                          aria-label="Filter generated reports by business name or domain"
                          className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
                        />
                        {dashboardSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDashboardSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear report filter"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {loading && recentReports.length === 0 ? (
                      <div className="divide-y divide-slate-200 animate-pulse">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="h-3.5 w-44 bg-slate-200 rounded" />
                              <div className="h-3 w-56 bg-slate-100 rounded" />
                            </div>
                            <div className="h-7 w-24 bg-slate-100 rounded-md shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : recentReports.length === 0 ? (
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
                    ) : filteredReports.length === 0 ? (
                      <div className="p-6 sm:p-8 text-center space-y-2">
                        <p className="text-xs text-slate-500">
                          No generated audit reports match{" "}
                          <span className="font-semibold text-slate-900">"{normalizedSearchQuery}"</span>.
                        </p>
                        <button
                          type="button"
                          onClick={() => setDashboardSearchQuery("")}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                        >
                          Show All Reports ({recentReports.length})
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-slate-200">
                          {visibleReports.map((r: any) => {
                            const cleanDom = extractCleanDomain(r.website);
                            return (
                              <div
                                key={r.reportId}
                                className="px-4 sm:px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-900 truncate">
                                      {r.businessName || r.reportId}
                                    </span>
                                    {cleanDom && (
                                      <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 truncate">
                                        {cleanDom}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
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
                            );
                          })}
                        </div>
                        {!isSearchActive && filteredReports.length > 6 && (
                          <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-mono-num">
                              Showing {visibleReports.length} of {filteredReports.length} generated reports
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowAllReports((v) => !v)}
                              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              {showAllReports ? "Show Recent 6" : `View All ${filteredReports.length} Reports`}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Recent User Activity Stream */}
                <div
                  className={`${
                    searchScope === "reports"
                      ? "hidden"
                      : searchScope === "leads"
                      ? "lg:col-span-12"
                      : "lg:col-span-6"
                  } bg-white rounded-xl border border-slate-200 overflow-hidden`}
                >
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

                  {loading && activities.length === 0 ? (
                    <div className="divide-y divide-slate-200 animate-pulse">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="px-4 sm:px-6 py-3.5 flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-36 bg-slate-200 rounded" />
                            <div className="h-3 w-64 bg-slate-100 rounded" />
                          </div>
                          <div className="h-3 w-16 bg-slate-100 rounded shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
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
                {visibleProjectSummaries.length === 0 ? (
                  <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-600">
                      No saved lead lists or businesses match{" "}
                      <span className="font-semibold text-slate-900">"{normalizedSearchQuery}"</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDashboardSearchQuery("")}
                      className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                    >
                      Clear Search Filter
                    </button>
                  </div>
                ) : (
                  visibleProjectSummaries.map(({ project: proj, allLeads, matchingLeads }) => {
                    const leadsToDisplay = isSearchActive ? matchingLeads : allLeads;
                    const isExpanded = Boolean(expandedProjectIds[proj.id]) || isSearchActive;
                    return (
                      <div
                        key={proj.id}
                        className="p-5 bg-white rounded-xl border border-slate-200 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-display text-base font-bold text-slate-950">{proj.name}</h3>
                            <span className="font-mono-num text-xs font-bold text-blue-700">
                              ·{" "}
                              {isSearchActive
                                ? `${matchingLeads.length} of ${allLeads.length} matching leads`
                                : `${allLeads.length} saved ${allLeads.length === 1 ? "lead" : "leads"}`}
                            </span>
                            {(proj.targetCategory || proj.targetCity) && (
                              <span className="text-xs text-slate-500">
                                ({[proj.targetCategory, proj.targetCity, proj.targetCountry].filter(Boolean).join(", ")})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {allLeads.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleProjectExpand(proj.id)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>{isExpanded ? "Hide Leads" : `View Leads (${leadsToDisplay.length})`}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
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

                        {isExpanded && leadsToDisplay.length > 0 && (
                          <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <div className="col-span-5 sm:col-span-4">Business Name</div>
                              <div className="col-span-4 sm:col-span-4">Domain / Website</div>
                              <div className="hidden sm:block sm:col-span-2">Location / Niche</div>
                              <div className="col-span-3 sm:col-span-2 text-right">Action</div>
                            </div>
                            <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto bg-white">
                              {leadsToDisplay.map((lead, idx) => {
                                const cleanDom =
                                  extractCleanDomain(lead.website) || extractCleanDomain(lead.email);
                                return (
                                  <div
                                    key={`${proj.id}-row-${lead.id || idx}`}
                                    className="px-4 py-2.5 grid grid-cols-12 items-center gap-2 text-xs hover:bg-slate-50"
                                  >
                                    <div className="col-span-5 sm:col-span-4 font-semibold text-slate-900 truncate">
                                      {lead.businessName}
                                    </div>
                                    <div className="col-span-4 sm:col-span-4 truncate">
                                      {cleanDom ? (
                                        <span className="font-mono-num text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                          {cleanDom}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[11px]">No domain</span>
                                      )}
                                    </div>
                                    <div className="hidden sm:block sm:col-span-2 text-[11px] text-slate-500 truncate">
                                      {[lead.city, lead.category].filter(Boolean).join(" · ") || "—"}
                                    </div>
                                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                                      {lead.reportUrl && (
                                        <button
                                          type="button"
                                          onClick={() => setLocation(lead.reportUrl!)}
                                          className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded cursor-pointer"
                                        >
                                          Report
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenProjectInCRM(proj.id)}
                                        className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                                      >
                                        CRM →
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <ExportLeadsBar
                          leads={leadsToDisplay}
                          projectName={proj.name}
                          label={
                            isSearchActive
                              ? `Export Matching Leads (${leadsToDisplay.length}) for "${proj.name}"`
                              : `Export Leads for "${proj.name}"`
                          }
                        />
                      </div>
                    );
                  })
                )}
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
                  const isHighLevel = plan.id === "scale" || plan.id === "enterprise";
                  const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
                  return (
                    <div
                      key={plan.id}
                      className={`p-5 sm:p-6 bg-white rounded-xl border flex flex-col justify-between ${
                        isCurrent
                          ? "border-[#7C3AED] ring-1 ring-[#7C3AED]"
                          : isHighLevel
                          ? "border-[#4F46E5]/80 ring-1 ring-[#7C3AED]/40"
                          : "border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <h3 className="font-display text-lg font-bold text-slate-950">{plan.name}</h3>
                          {isCurrent && <span className="text-xs font-semibold text-[#7C3AED]">Active Plan</span>}
                          {!isCurrent && isHighLevel && (
                            <span className="px-2 py-0.5 rounded bg-[#EDE9FE] border border-[#C4B5FD] text-[10px] font-extrabold uppercase tracking-wider text-[#5B21B6]">
                              👑 High-Level VIP
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{plan.audience}</p>

                        {isHighLevel && (
                          <div className="mb-3 p-2 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[11px] font-bold text-[#4C1D95] leading-snug">
                            ✨ Auto-Unlocks AI Website + 5-Star Review Shield Builder
                          </div>
                        )}

                        <div className="pb-4 mb-4 border-b border-slate-200">
                          <span className="font-mono-num text-3xl font-bold text-slate-950">${price}</span>
                          <span className="text-xs text-slate-500"> / mo</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-600 mb-5">
                          <div className="flex justify-between pb-1.5 border-b border-slate-100">
                            <span>AI Website &amp; Review Shield</span>
                            <span
                              className={`font-bold ${
                                isHighLevel ? "text-emerald-700" : "text-slate-400"
                              }`}
                            >
                              {isHighLevel ? "✨ Unlocked" : "High-Level Only"}
                            </span>
                          </div>
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

                        {Array.isArray(plan.features) && plan.features.length > 0 && (
                          <ul className="space-y-1.5 mb-5 pt-3 border-t border-slate-100">
                            {plan.features.slice(0, 4).map((feat, idx) => (
                              <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5 leading-snug">
                                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-2">
                        {plan.id === "free" ? (
                          <div className="w-full py-2 px-3 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg text-center">
                            {isCurrent ? "Current Free Explorer Tier" : "Included Free Tier ($0/mo)"}
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setCheckoutPlan(plan);
                                setPaymentMethodTab("lemon");
                                setCheckoutStatus(null);
                              }}
                              className="w-full py-2 px-3 bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
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
                          </>
                        )}
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

                  {/* Instant Upgrade Entitlements Summary */}
                  <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>
                        <strong>Credits Added Immediately:</strong>{" "}
                        <span className="font-mono-num font-bold text-blue-700">
                          +{checkoutPlan.monthlyHuntLimit.toLocaleString()} leads
                        </span>
                      </span>
                      <span>
                        <strong>Monthly Outreach:</strong>{" "}
                        <span className="font-mono-num font-semibold">
                          {checkoutPlan.monthlyEmailLimit.toLocaleString()} emails/mo
                        </span>
                      </span>
                      <span>
                        <strong>SMTP Inboxes:</strong>{" "}
                        <span className="font-mono-num font-semibold">{checkoutPlan.maxEmailAccounts}</span>
                      </span>
                      {(checkoutPlan.id === "scale" || checkoutPlan.id === "enterprise") && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-bold">
                          ✨ Unlocks AI 4-Tap Website + 5-Star Review Shield Builder
                        </span>
                      )}
                    </div>
                    {checkoutPlan.lemonCheckoutUrl && (
                      <a
                        href={checkoutPlan.lemonCheckoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Hosted Checkout Link</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>

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
                          {checkoutBusy
                            ? "Processing Order..."
                            : `Pay $${billingCycle === "annual" ? checkoutPlan.annualPrice * 12 : checkoutPlan.monthlyPrice} & Upgrade Now`}
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
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-slate-700">
                              On-Chain Transaction Hash (TXID / Reference)
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setCryptoTxHash(
                                  `0x${Array.from({ length: 32 }, () =>
                                    Math.floor(Math.random() * 16).toString(16)
                                  ).join("")}`
                                )
                              }
                              className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              Fill Sample TXID
                            </button>
                          </div>
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

          {/* TAB: MULTI-SMTP & APP PASSWORD INSTRUCTIONS */}
          {activeTab === "smtp" && (
            <div className="space-y-6">
              <MultiSmtpManagerPanel
                mode="user"
                title="Multi-SMTP & Multiple Gmail Accounts + App Password Setup Guide"
                subtitle="Connect multiple Gmail or custom SMTP accounts to wire up your outreach & messaging activities, and follow the step-by-step instructions below to generate your Gmail 16-character App Password or other SMTP credentials."
              />
            </div>
          )}

          {/* TAB: TRAIN YOUR AI & OFFERS */}
          {activeTab === "train-ai" && (
            <div className="space-y-6">
              <TrainYourAIPanel
                userFullName={user?.fullName}
                userCompanyName={user?.companyName}
                userEmail={user?.email}
                onNavigateToHunter={() => setLocation("/crm?tab=hunter")}
              />
            </div>
          )}

          {/* TAB 4: WORKSPACE SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-8">
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

              {/* Multi-SMTP & App Password Setup Instructions right inside Workspace Settings */}
              <div className="pt-2">
                <MultiSmtpManagerPanel
                  mode="user"
                  title="Email Sending Pool (Multi-Gmail & SMTP) + App Password Instructions"
                  subtitle="Connect multiple Gmail or SMTP accounts for sending messages and view step-by-step instructions on how to get a Gmail App Password or other SMTP credentials."
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* INTERACTIVE GETTING STARTED & FIRST LEAD DISCOVERY GUIDED TOUR MODAL */}
      {showTourModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0B0F17]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTourModal(false);
          }}
        >
          <div className="bg-white border border-[#E4E2DD] rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="bg-[#0B0F17] text-white px-5 sm:px-7 py-5 flex items-start justify-between gap-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#C4B5FD] font-semibold">
                  <Compass className="w-4 h-4" />
                  <span>Interactive Workspace Walkthrough</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-slate-300">Step {tourStep} of 4</span>
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
                  Initiate Your First Autonomous B2B Lead Discovery Search
                </h2>
                <p className="text-xs text-slate-300">
                  Configure your first target vertical and geography below—your selections sync directly with the AI Lead Hunter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTourModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close guided tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Navigation Strip */}
            <div className="bg-[#FAF9F5] border-b border-[#E4E2DD] px-5 sm:px-7 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { step: 1, label: "01. Train AI First" },
                  { step: 2, label: "02. Target Market" },
                  { step: 3, label: "03. Project & AI Scan" },
                  { step: 4, label: "04. Launch Search" },
                ] as const
              ).map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setTourStep(item.step)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer flex items-center justify-between ${
                    tourStep === item.step
                      ? "bg-[#0B0F17] text-white"
                      : tourStep > item.step
                      ? "bg-white text-emerald-700 border border-[#E4E2DD]"
                      : "bg-white text-[#525866] border border-[#E4E2DD] hover:text-[#0B0F17]"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {tourStep > item.step && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>

            {/* Modal Step Content Body */}
            <div className="p-5 sm:p-7 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* STEP 1: TRAIN YOUR AI FIRST (MY OFFERS) */}
              {tourStep === 1 && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Mandatory First Step Before Hunting Leads</span>
                    </div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-[#0B0F17]">
                      01. Train Your AI With Your Service Offers First
                    </h3>
                    <p className="text-xs sm:text-sm text-[#525866] leading-relaxed">
                      Before running your first lead hunt or sending cold emails, configure <strong>Train Your AI (My Offers)</strong>. The AI uses your custom service catalog, target pain points, subject line style, and static email blueprint to write personalized cold outreach for every business it audits.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-[#E4E2DD] bg-[#FAF9F5] space-y-1">
                      <div className="font-mono-num text-xs font-bold text-purple-700">1. Your Offers</div>
                      <div className="text-xs font-bold text-[#0B0F17]">Define What You Sell</div>
                      <p className="text-[11px] text-[#525866] leading-relaxed">
                        Add all your services (e.g. Website Creation, 5-Star Review Shield, AI Receptionist, SEO) and which business signals trigger each offer.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[#E4E2DD] bg-[#FAF9F5] space-y-1">
                      <div className="font-mono-num text-xs font-bold text-purple-700">2. Email Blueprint</div>
                      <div className="text-xs font-bold text-[#0B0F17]">Your Cold Email Style</div>
                      <p className="text-[11px] text-[#525866] leading-relaxed">
                        Set your sender name, agency name, subject line formula, call-to-action, and static email example.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[#E4E2DD] bg-[#FAF9F5] space-y-1">
                      <div className="font-mono-num text-xs font-bold text-purple-700">3. Auto-Match</div>
                      <div className="text-xs font-bold text-[#0B0F17]">Smart Offer Matching</div>
                      <p className="text-[11px] text-[#525866] leading-relaxed">
                        When you hunt leads, the AI audits each business and automatically pitches the exact offer they need most.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#0B0F17]">
                        Ready to customize your offers &amp; cold email AI?
                      </div>
                      <div className="text-[11px] text-[#525866] mt-0.5">
                        Open the Train Your AI studio now, save your offers, then continue with Step 02 to hunt leads.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowTourModal(false);
                          setActiveTab("train-ai");
                        }}
                        className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Open Train Your AI Now →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTourStep(2)}
                        className="px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] hover:bg-[#F2F0EA] text-[#0B0F17] border border-[#E4E2DD] text-xs font-semibold cursor-pointer"
                      >
                        Already Trained · Go to Step 02 →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: TARGET NICHE & GEOGRAPHY */}
              {tourStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-[#0B0F17]">
                      02. Choose Your Target Business Vertical & City
                    </h3>
                    <p className="text-xs sm:text-sm text-[#525866] mt-1 leading-relaxed">
                      Vanguard Hunter scans live business directories across 120+ industries, verifies active domains, and removes dead websites automatically. Pick a high-converting preset playbook below or type any custom niche and city.
                    </p>
                  </div>

                  {/* Preset Market Playbooks */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#0B0F17]">
                      1-Click High-Converting Market Playbooks:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {DISCOVERY_PRESET_PLAYBOOKS.map((preset) => {
                        const isSelected =
                          quickCategory.toLowerCase() === preset.category.toLowerCase() &&
                          quickCity.toLowerCase() === preset.city.toLowerCase();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setQuickCategory(preset.category);
                              setQuickCity(preset.city);
                              setQuickCountry(preset.country);
                              setQuickCount(preset.count);
                              setQuickContext(preset.context);
                            }}
                            className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                              isSelected
                                ? "border-[#1D4ED8] bg-[#EFF6FF]/60"
                                : "border-[#E4E2DD] bg-[#FAF9F5] hover:bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#0B0F17] truncate">
                                {preset.category}
                              </span>
                              <span className="text-[11px] font-mono-num text-[#1D4ED8] font-semibold shrink-0">
                                {preset.city}, {preset.country}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#525866] mt-1 line-clamp-2">
                              {preset.note}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Inputs */}
                  <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4E2DD] grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#0B0F17] mb-1">
                        Business Category / Niche
                      </label>
                      <input
                        type="text"
                        value={quickCategory}
                        onChange={(e) => setQuickCategory(e.target.value)}
                        placeholder="e.g. Dentist, MedSpa, Solar"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#0B0F17] mb-1">
                        Target City
                      </label>
                      <input
                        type="text"
                        value={quickCity}
                        onChange={(e) => setQuickCity(e.target.value)}
                        placeholder="e.g. Austin, Miami, London"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#0B0F17] mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={quickCountry}
                        onChange={(e) => setQuickCountry(e.target.value)}
                        placeholder="e.g. USA, UK, Canada"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: PROJECT WORKSPACE & AUTONOMOUS AI DIAGNOSTICS */}
              {tourStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-[#0B0F17]">
                      03. Assign Your Campaign Project & Configure AI Diagnostics
                    </h3>
                    <p className="text-xs sm:text-sm text-[#525866] mt-1 leading-relaxed">
                      Every lead search is saved inside a Project workspace, and Vanguard Hunter automatically audits each business and matches it against your trained offers:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="block text-xs font-semibold text-[#0B0F17]">
                      Select Active Project for This Search:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {projects.map((proj) => {
                        const projLeads = getProjectLeads(proj.id);
                        const isSelected = tourSelectedProjectId === proj.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              setTourSelectedProjectId(proj.id);
                              setActiveProjectId(proj.id);
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? "border-[#1D4ED8] bg-[#EFF6FF]/60"
                                : "border-[#E4E2DD] bg-[#FAF9F5] hover:bg-white"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#0B0F17] truncate">
                                {proj.name}
                              </div>
                              <div className="text-[11px] text-[#525866] font-mono-num mt-0.5">
                                {projLeads.length} saved {projLeads.length === 1 ? "lead" : "leads"}
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                isSelected
                                  ? "bg-[#1D4ED8] text-white"
                                  : "bg-white text-[#525866] border border-[#E4E2DD]"
                              }`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Inline New Project Creator */}
                  <form
                    onSubmit={handleCreateProjectInsideTour}
                    className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4E2DD] space-y-2.5"
                  >
                    <div className="text-xs font-semibold text-[#0B0F17]">
                      Or Create a New Campaign Project Right Now:
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={tourNewProjectName}
                        onChange={(e) => setTourNewProjectName(e.target.value)}
                        placeholder={`e.g. ${quickCategory} - ${quickCity} Outreach`}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0B0F17] hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        + Create & Select Project
                      </button>
                    </div>
                    {tourProjectCreatedNotice && (
                      <p className="text-xs font-medium text-emerald-700">
                        {tourProjectCreatedNotice}
                      </p>
                    )}
                  </form>

                  <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4E2DD] grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-[#0B0F17] mb-1">
                        Businesses per Search Batch
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {["25", "50", "100"].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setQuickCount(num)}
                            className={`py-2 text-xs font-mono-num font-bold rounded-lg border cursor-pointer transition-colors ${
                              quickCount === num
                                ? "bg-[#0B0F17] text-white border-[#0B0F17]"
                                : "bg-white text-[#0B0F17] border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-semibold text-[#0B0F17] mb-1">
                        Optional AI Qualifying Context / Focus
                      </label>
                      <input
                        type="text"
                        value={quickContext}
                        onChange={(e) => setQuickContext(e.target.value)}
                        placeholder="e.g. Focus on independent practices missing online booking"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: SUMMARY & 1-CLICK EXECUTION */}
              {tourStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-[#0B0F17]">
                      04. Ready to Launch Your First Lead Discovery Search
                    </h3>
                    <p className="text-xs sm:text-sm text-[#525866] mt-1 leading-relaxed">
                      Review your configured discovery parameters below. Click <strong>Launch Live Lead Discovery Now</strong> to open the AI Hunter and immediately scan your target market.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E4E2DD] bg-[#FAF9F5] divide-y divide-[#E4E2DD] text-xs">
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-[#525866] font-medium">Target Business Vertical</span>
                      <span className="font-bold text-[#0B0F17]">{quickCategory || "Dentist"}</span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-[#525866] font-medium">Target Market Geography</span>
                      <span className="font-bold text-[#0B0F17]">
                        {quickCity || "Austin"}, {quickCountry || "USA"}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-[#525866] font-medium">Assigned Campaign Project</span>
                      <span className="font-bold text-[#1D4ED8]">
                        {projects.find((p) => p.id === tourSelectedProjectId)?.name ||
                          projects[0]?.name ||
                          "Default Project"}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-[#525866] font-medium">Discovery Batch Size</span>
                      <span className="font-mono-num font-bold text-[#0B0F17]">
                        Up to {quickCount} verified businesses
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-[#525866] font-medium">AI Qualification Focus</span>
                      <span className="text-[#0B0F17] truncate max-w-xs">
                        {quickContext || "Standard website conversion & AI readiness audit"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleLaunchTourDiscovery(true)}
                      className="w-full py-3 px-4 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Crosshair className="w-4 h-4" />
                      <span>Launch Live Lead Discovery Now →</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyTourToQuickBar}
                      className="w-full py-3 px-4 bg-[#FAF9F5] hover:bg-[#F2F0EA] text-[#0B0F17] border border-[#E4E2DD] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Apply to Dashboard Quick-Hunt Bar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-[#FAF9F5] border-t border-[#E4E2DD] px-5 sm:px-7 py-4 flex items-center justify-between gap-3">
              <div>
                {tourStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setTourStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#0B0F17] bg-white hover:bg-[#F2F0EA] border border-[#E4E2DD] rounded-lg transition-colors cursor-pointer"
                  >
                    ← Previous Step
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTourModal(false)}
                    className="px-3.5 py-2 text-xs font-medium text-[#525866] hover:text-[#0B0F17] cursor-pointer"
                  >
                    Skip for Now
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {tourStep < 4 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleLaunchTourDiscovery(true)}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF] rounded-lg transition-colors cursor-pointer"
                    >
                      <span>Quick-Launch in CRM Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTourStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B0F17] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Next Step →
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLaunchTourDiscovery(true)}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer"
                  >
                    Start Lead Discovery Search →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
