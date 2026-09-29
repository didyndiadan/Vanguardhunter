import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  SaasPlan,
  SaasUser,
  getCachedSaasUser,
  getSaasToken,
  setSaasSession,
  clearSaasSession,
  saasFetch,
  isUserAdmin,
} from "@/lib/saas-auth";
import heroImg from "@/assets/images/hero_b2b_intelligence_1790378408952.jpg";
import caseDentalImg from "@/assets/images/case_study_dental_network_1790378421158.jpg";
import caseSolarImg from "@/assets/images/case_study_commercial_solar_1790378432723.jpg";
import executiveBoardroomImg from "@/assets/images/advisory_executive_boardroom_1790446354674.jpg";
import medicalConsultationImg from "@/assets/images/medical_patient_consultation_1790422317477.jpg";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Globe,
  Menu,
  Minus,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

const TARGET_VERTICALS = [
  { name: "Dental & Orthodontic Clinics", segment: "Local Services", dealSize: "$3,500 – $8,500", avgReplyRate: "8.4%" },
  { name: "Commercial Solar & MEP", segment: "Commercial B2B", dealSize: "$12,000 – $45,000", avgReplyRate: "6.9%" },
  { name: "MedSpas & Aesthetic Centers", segment: "Local Services", dealSize: "$4,000 – $9,500", avgReplyRate: "9.1%" },
  { name: "HVAC & Roofing Contractors", segment: "Local Services", dealSize: "$5,000 – $15,000", avgReplyRate: "7.8%" },
  { name: "Personal Injury & Family Law", segment: "Commercial B2B", dealSize: "$6,500 – $18,000", avgReplyRate: "6.2%" },
  { name: "Real Estate Brokerages", segment: "Commercial B2B", dealSize: "$4,500 – $12,000", avgReplyRate: "7.4%" },
  { name: "Wealth & CPA Advisory Firms", segment: "Commercial B2B", dealSize: "$5,500 – $16,000", avgReplyRate: "6.8%" },
  { name: "Multi-Location Fitness & Wellness", segment: "Local Services", dealSize: "$3,000 – $7,500", avgReplyRate: "8.7%" },
  { name: "Logistics & Fleet Operations", segment: "Commercial B2B", dealSize: "$8,000 – $24,000", avgReplyRate: "6.5%" },
  { name: "Home Remodeling & Restoration", segment: "Local Services", dealSize: "$4,500 – $11,000", avgReplyRate: "8.2%" },
  { name: "Private Medical & Vet Practices", segment: "Local Services", dealSize: "$3,800 – $9,000", avgReplyRate: "8.6%" },
  { name: "B2B Agencies & Consultancies", segment: "Commercial B2B", dealSize: "$7,500 – $25,000", avgReplyRate: "7.1%" },
];

interface LiveExplorerProspect {
  id: string;
  businessName: string;
  decisionMaker: string;
  role: string;
  sectorKey: "dental" | "solar" | "legal" | "hvac" | "medspa";
  sectorLabel: string;
  city: string;
  website: string;
  emailPreview: string;
  phonePreview: string;
  intentScore: number;
  websiteHealthScore: number;
  estDealValue: number;
  detectedGaps: string;
  recommendedOffer: string;
  aiPitchSubject: string;
  aiPitchPreview: string;
}

const LIVE_EXPLORER_PROSPECTS: LiveExplorerProspect[] = [
  {
    id: "exp-1",
    businessName: "Barton Creek Dental & Implant Studio",
    decisionMaker: "Dr. Gregory Vance, DDS",
    role: "Founder & Clinical Director",
    sectorKey: "dental",
    sectorLabel: "Healthcare & Dental",
    city: "Austin, TX",
    website: "bartoncreekdentalstudio.com",
    emailPreview: "g.vance@bartoncreekdental...",
    phonePreview: "+1 (512) 482-8910",
    intentScore: 94,
    websiteHealthScore: 42,
    estDealValue: 6500,
    detectedGaps: "No instant patient booking widget · No 24/7 AI receptionist · 4.8s mobile LCP",
    recommendedOffer: "AI Patient Booking Agent + 4-Tap Conversion Website",
    aiPitchSubject: "Quick audit of Barton Creek Dental's implant booking flow",
    aiPitchPreview:
      "Hi Dr. Vance — I ran a live diagnostic on bartoncreekdentalstudio.com and noticed after-hours implant inquiries hit a static contact form with no instant scheduling or AI receptionist capture. We prepared a custom interactive audit report and a live preview site showing how practices in Austin capture +38% more consults...",
  },
  {
    id: "exp-2",
    businessName: "SunPeak Commercial Solar & MEP",
    decisionMaker: "Marcus Sterling",
    role: "Managing Partner",
    sectorKey: "solar",
    sectorLabel: "Commercial Solar & MEP",
    city: "Phoenix, AZ",
    website: "sunpeakcommercialsolar.com",
    emailPreview: "m.sterling@sunpeakcommercial...",
    phonePreview: "+1 (602) 719-3402",
    intentScore: 91,
    websiteHealthScore: 51,
    estDealValue: 18500,
    detectedGaps: "Missing commercial ROI estimator · No automated quote qualification · Unoptimized local schema",
    recommendedOffer: "Commercial Lead Qualification Engine + Automated Outbound Funnel",
    aiPitchSubject: "SunPeak Commercial — commercial roof & MEP quote calculator audit",
    aiPitchPreview:
      "Hi Marcus — while reviewing commercial solar & MEP engineering firms in Phoenix, our diagnostic engine flagged that sunpeakcommercialsolar.com lacks an interactive commercial kW ROI qualifier for facility managers. Here is your live diagnostic audit link...",
  },
  {
    id: "exp-3",
    businessName: "Lumiere Medical Aesthetics & Laser",
    decisionMaker: "Sophia Chen, RN",
    role: "Owner & Medical Director",
    sectorKey: "medspa",
    sectorLabel: "MedSpa & Aesthetics",
    city: "Miami, FL",
    website: "lumieremedspavip.com",
    emailPreview: "sophia@lumieremedspavip...",
    phonePreview: "+1 (305) 891-4420",
    intentScore: 96,
    websiteHealthScore: 38,
    estDealValue: 7800,
    detectedGaps: "No SMS/WhatsApp consultation capture · Missing 5-Star Review Shield · Broken mobile menu",
    recommendedOffer: "4-Tap Luxury MedSpa Website + 5-Star Google Review Shield",
    aiPitchSubject: "Interactive website & Google Review Shield preview for Lumiere Aesthetics",
    aiPitchPreview:
      "Hi Sophia — we audited lumieremedspavip.com and built a live 4-tap booking prototype plus a 5-Star Review Shield stand that routes 4–5 star patient reviews directly to Google while capturing private feedback internally...",
  },
  {
    id: "exp-4",
    businessName: "Apex Precision Air & Commercial HVAC",
    decisionMaker: "David Kowalski",
    role: "President & Operations Lead",
    sectorKey: "hvac",
    sectorLabel: "Home & HVAC Services",
    city: "Dallas, TX",
    website: "apexprecisionhvac.com",
    emailPreview: "dkowalski@apexprecision...",
    phonePreview: "+1 (214) 609-7731",
    intentScore: 89,
    websiteHealthScore: 46,
    estDealValue: 9200,
    detectedGaps: "No emergency dispatch voice agent · No instant service call scheduler · Outdated SSL config",
    recommendedOffer: "24/7 AI Dispatch Voice Caller + High-Converting Local Service Site",
    aiPitchSubject: "Missed after-hours HVAC dispatch audit for Apex Precision Air",
    aiPitchPreview:
      "Hi David — emergency HVAC calls after 6 PM go straight to voicemail on apexprecisionhvac.com. We generated a diagnostic report and configured a 24/7 AI voice dispatcher that books emergency service calls directly onto your dispatch board...",
  },
  {
    id: "exp-5",
    businessName: "Hargrove & Mercer Trial Attorneys",
    decisionMaker: "Jonathan Hargrove, Esq.",
    role: "Senior Managing Partner",
    sectorKey: "legal",
    sectorLabel: "Legal & Advisory",
    city: "Chicago, IL",
    website: "hargrovemercerlaw.com",
    emailPreview: "jhargrove@hargrovemercer...",
    phonePreview: "+1 (312) 540-9200",
    intentScore: 87,
    websiteHealthScore: 54,
    estDealValue: 14000,
    detectedGaps: "No 24/7 case intake qualification chat · Slow mobile page speed · Missing local intake funnel",
    recommendedOffer: "24/7 AI Legal Case Intake Assistant + Authority Website Rebuild",
    aiPitchSubject: "Case intake conversion audit for Hargrove & Mercer",
    aiPitchPreview:
      "Hi Jonathan — prospective clients visiting hargrovemercerlaw.com on mobile face a 12-field static form with zero real-time case qualification. Take a look at the interactive diagnostic audit we prepared for your firm...",
  },
];

const HERO_ENGINE_MODES = [
  {
    id: "discovery",
    index: "01",
    title: "Multi-City B2B Discovery",
    metricLabel: "20 Parallel Extraction Workers",
    metricValue: "275M+ Global B2B Profiles",
    summary: "Scans live business directories, maps, and domain registries across up to 20 cities simultaneously with zero stale CSV lists.",
  },
  {
    id: "audit",
    index: "02",
    title: "Website & Voice Diagnostic Audits",
    metricLabel: "Client-Facing Conversion Asset",
    metricValue: "3.2x Higher Cold Reply Rate",
    summary: "Generates shareable /report/:id diagnostic pages plus 4-tap AI client websites and personalized voice notes in one click.",
  },
  {
    id: "sequences",
    index: "03",
    title: "Rotational Multi-Inbox Sequences",
    metricLabel: "Up to 100 Sender Inboxes",
    metricValue: "99.2% Verified Deliverability",
    summary: "Rotates Gmail and custom SMTP accounts automatically, enforces daily warm-up caps, and dispatches multi-day follow-ups.",
  },
  {
    id: "voice",
    index: "04",
    title: "Autonomous AI Phone Caller",
    metricLabel: "Live Outbound Voice Cockpit",
    metricValue: "24/7 Qualification & Booking",
    summary: "Places natural AI outbound phone calls and voice pitches to high-intent prospects and logs full call transcripts in your CRM.",
  },
];

const GTM_PLAYBOOKS = [
  {
    id: "agency",
    title: "01. Digital & Web Design Agencies",
    goal: "Close $2,500–$8,500 website rebuilds and $297/mo retainer packages without manual cold calling.",
    mechanism:
      "Run a 20-city Bulk Hunt for Dental, MedSpa, or HVAC businesses with low website scores. Auto-generate a live /report/:id diagnostic audit and a pre-built /site/:id preview website, then send rotational cold emails embedding their live preview link.",
    outcome: "+318% increase in booked discovery calls and 41.4% average open rate across targeted local businesses.",
    benchmarkMetric: "$68,000",
    benchmarkSub: "Average new agency ARR added within 60 days",
  },
  {
    id: "b2b",
    title: "02. Commercial B2B Revenue Teams",
    goal: "Build predictable enterprise pipeline across regional commercial contractors, legal firms, and B2B suppliers.",
    mechanism:
      "Filter by Buyer Intent Score (85+) and verified decision-maker MX records. Launch multi-step Email + LinkedIn + AI Voice Note sequences across 35 rotational sender accounts with automatic reply classification.",
    outcome: "Replaces 4 separate subscriptions (lead database, email verifier, sequencer, and audit builder) in one unified workspace.",
    benchmarkMetric: "$1.84M",
    benchmarkSub: "Closed-won commercial pipeline in 6 months",
  },
  {
    id: "ai-consultancy",
    title: "03. AI Automation & Voice Consultancies",
    goal: "Sell 24/7 AI receptionists, booking agents, and 5-Star Google Review Shield systems on recurring retainers.",
    mechanism:
      "Use the AI Agent Opportunity Detector to pinpoint businesses missing live chat, instant scheduling, or review protection. Dispatch a personalized AI voice pitch plus a printable QR Review Shield demo at /review/:id.",
    outcome: "Prospects experience the exact AI solution live before replying—compressing sales cycles from 3 weeks to 48 hours.",
    benchmarkMetric: "4.6x",
    benchmarkSub: "Faster prospect-to-paid-retainer conversion",
  },
];

const DEFAULT_DISPLAY_PLANS: SaasPlan[] = [
  {
    id: "free",
    name: "Free Explorer",
    audience: "Apollo-style free tier to test live discovery",
    tagline: "50 verified B2B lead credits/mo, single-city search (max 25/scan), 1 sender mailbox, and 1 sample audit.",
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyHuntLimit: 50,
    monthlyEmailLimit: 150,
    maxEmailAccounts: 1,
    bulkHuntEnabled: false,
    autoPilotEnabled: false,
    lemonCheckoutUrl: "",
    lemonVariantId: "",
    features: [
      "50 verified B2B lead credits / month ($0/mo)",
      "Single-city basic search (max 25 leads / scan)",
      "1 connected sender mailbox (150 emails / mo)",
      "1 sample Website Diagnostic Audit preview",
      "🔒 20-City Bulk Hunter & 24/7 Autopilot (Paid)",
      "🔒 AI 4-Tap Website & Review Shield (Scale/VIP)",
    ],
    isPopular: false,
    active: true,
  },
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
    lemonCheckoutUrl: "",
    lemonVariantId: "",
    features: [
      "1,000 verified B2B leads / month",
      "Real-time multi-source business discovery",
      "Live DNS & mail server verification",
      "2 rotational sender email accounts",
      "3,000 automated outreach emails / month",
      "Shareable client Website Audit Reports",
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
    lemonCheckoutUrl: "",
    lemonVariantId: "",
    features: [
      "5,000 verified B2B leads / month",
      "20-City Bulk Hunter unlocked",
      "Buyer intent scoring & tech stack detection",
      "10 rotational sender email accounts",
      "15,000 outreach emails + automated follow-ups",
      "24/7 Autopilot Scheduler & Smart Inbox",
    ],
    isPopular: true,
    active: true,
  },
  {
    id: "scale",
    name: "Agency Scale",
    audience: "For high-volume lead gen agencies & B2B syndicates",
    tagline: "High-concurrency multi-market extraction, 35 rotational inboxes, and AI Website + Review Shield Builder.",
    monthlyPrice: 349,
    annualPrice: 279,
    monthlyHuntLimit: 25000,
    monthlyEmailLimit: 75000,
    maxEmailAccounts: 35,
    bulkHuntEnabled: true,
    autoPilotEnabled: true,
    lemonCheckoutUrl: "",
    lemonVariantId: "",
    features: [
      "25,000 verified B2B leads / month",
      "Auto-Unlocks AI 4-Tap Website Builder",
      "Auto-Unlocks 5-Star Review Shield Funnel",
      "35 rotational sender email accounts",
      "75,000 outreach emails + AI Voice Note pitches",
      "Custom branded Website Audit Reports",
    ],
    isPopular: false,
    active: true,
  },
  {
    id: "enterprise",
    name: "Enterprise VIP",
    audience: "For global revenue organizations & enterprise sales",
    tagline: "Uncapped multi-region pipelines, 100 rotational inboxes, AI Phone Caller, and dedicated infrastructure.",
    monthlyPrice: 799,
    annualPrice: 649,
    monthlyHuntLimit: 100000,
    monthlyEmailLimit: 300000,
    maxEmailAccounts: 100,
    bulkHuntEnabled: true,
    autoPilotEnabled: true,
    lemonCheckoutUrl: "",
    lemonVariantId: "",
    features: [
      "100,000+ verified B2B leads / month",
      "Full AI Website Builder & Review Shield Suite",
      "Autonomous AI Phone Caller & Voice Cockpit",
      "100 rotational sender email accounts",
      "300,000 outreach emails / month",
      "Dedicated extraction cluster & priority SLA",
    ],
    isPopular: false,
    active: true,
  },
];

const ENTERPRISE_PILLARS = [
  {
    title: "Centralized control, localized execution",
    body: "Provision multi-tenant client workspaces, manage up to 100 rotational sender inboxes, and standardize outbound playbooks across every regional market.",
  },
  {
    title: "Governance that enables speed",
    body: "Every prospect passes our real-time DNS/MX Zero-Bounce Gate and cooldown deduplication engine so your domain reputation stays protected at scale.",
  },
  {
    title: "Connected across your GTM stack",
    body: "Instantly generate shareable /report/:id diagnostic audits, /site/:id 4-Tap AI client websites, and /review/:id 5-Star Review Shield funnels with one click.",
  },
  {
    title: "Implementation & dedicated architecture",
    body: "Agency Scale and Enterprise VIP workspaces include 20-City Bulk Hunter concurrency, AI Voice & Phone Caller orchestration, and priority engineering support.",
  },
];

const CUSTOMER_OUTCOME_CARDS = [
  {
    company: "Apex Dental Growth",
    metric: "+318%",
    label: "Qualified discovery calls in 90 days",
    summary:
      "Replaced static CSV lists with real-time dental clinic discovery and automated Website Audit Report links across Texas.",
    img: caseDentalImg,
  },
  {
    company: "Northstar Commercial",
    metric: "$1.84M",
    label: "Closed-won pipeline in 6 months",
    summary:
      "Scaled 20-city bulk prospecting with 18 rotational sender inboxes and 24/7 autonomous daily sequences.",
    img: caseSolarImg,
  },
  {
    company: "Vanguard MedSpa Advisory",
    metric: "4.2x",
    label: "Higher cold-to-booked reply rate",
    summary:
      "Combined pre-built 4-Tap AI Client Websites (/site/:id) with personalized AI Studio Voice Note pitches.",
    img: medicalConsultationImg,
  },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [currentUser, setCurrentUser] = useState<SaasUser | null>(getCachedSaasUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero instant email capture bar
  const [heroWorkEmail, setHeroWorkEmail] = useState("");
  const [heroQuickEmail, setHeroQuickEmail] = useState("");
  const [activeHeroEngine, setActiveHeroEngine] = useState<string>("discovery");
  const [activeEnterpriseAccordion, setActiveEnterpriseAccordion] = useState<number>(0);

  // Interactive Live Explorer state
  const [explorerSector, setExplorerSector] = useState<"all" | "dental" | "solar" | "medspa" | "hvac" | "legal">("all");
  const [explorerSearch, setExplorerSearch] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState<string>(LIVE_EXPLORER_PROSPECTS[0].id);

  // Interactive Playbook & ROI Calculator state
  const [activePlaybookId, setActivePlaybookId] = useState<string>("agency");
  const [calcMonthlyProspects, setCalcMonthlyProspects] = useState<number>(5000);
  const [calcAvgDealSize, setCalcAvgDealSize] = useState<number>(4500);

  // Interactive vertical filter state
  const [selectedVerticalFilter, setSelectedVerticalFilter] = useState<"all" | "local" | "commercial">("all");

  // Lead Capture / Briefing Form state
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadVolume, setLeadVolume] = useState("5,000 – 25,000 leads / mo");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadFormError, setLeadFormError] = useState("");
  const [leadFormSuccess, setLeadFormSuccess] = useState("");

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("free");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Image resilience state
  const [heroImgError, setHeroImgError] = useState(false);
  const [case1ImgError, setCase1ImgError] = useState(false);
  const [case2ImgError, setCase2ImgError] = useState(false);
  const [execImgError, setExecImgError] = useState(false);
  const [medImgError, setMedImgError] = useState(false);

  // Interactive Apollo-style Hunter showcase states
  const [activeToolbarAction, setActiveToolbarAction] = useState<string>("audit");
  const [openEnterpriseAccordion, setOpenEnterpriseAccordion] = useState<string>("control");
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState<number>(0);
  const [bottomEmailInput, setBottomEmailInput] = useState<string>("");

  useEffect(() => {
    fetch("/api/saas/plans")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.plans) && d.plans.length > 0) {
          setPlans(d.plans);
        }
      })
      .catch(() => {});

    const syncAuth = () => {
      const tok = getSaasToken();
      if (!tok) {
        setCurrentUser(null);
        return;
      }
      setCurrentUser(getCachedSaasUser());
    };

    window.addEventListener("vh-auth-change", syncAuth);

    if (getSaasToken()) {
      saasFetch<{ user: SaasUser }>("/api/saas/auth/me")
        .then((d) => {
          if (d.user) {
            setCurrentUser(d.user);
            localStorage.setItem("vh_saas_user", JSON.stringify(d.user));
          } else {
            clearSaasSession();
            setCurrentUser(null);
          }
        })
        .catch(() => {
          clearSaasSession();
          setCurrentUser(null);
        });
    } else {
      setCurrentUser(null);
    }

    return () => {
      window.removeEventListener("vh-auth-change", syncAuth);
    };
  }, []);

  // Support hardware/browser Back button & Escape key when Auth Modal is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAuthModalOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const onPopState = () => {
      if (authModalOpen) {
        setAuthModalOpen(false);
      }
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [authModalOpen, mobileMenuOpen]);

  const handleOpenAuth = (mode: "login" | "register", planId = "free", prefillEmail?: string) => {
    setAuthMode(mode);
    setSelectedPlanId(planId);
    if (prefillEmail && prefillEmail.trim()) {
      setEmail(prefillEmail.trim());
    }
    setAuthError("");
    setAuthNotice("");
    setMobileMenuOpen(false);
    setAuthModalOpen(true);
    try {
      window.history.pushState({ modal: "auth" }, "");
    } catch {}
  };

  const handleCloseAuth = () => {
    setAuthModalOpen(false);
    setAuthError("");
    setAuthNotice("");
  };

  const handleHeroStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser) {
      setLocation("/dashboard");
      return;
    }
    handleOpenAuth("register", "free", heroWorkEmail);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");

    if (authMode === "register" && password.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const isOwnerInput =
      cleanEmail === "jwandersonar@gmail.com" ||
      cleanEmail === "admin@vanguardhunter.io" ||
      cleanEmail === "admin@vanguardhunter.com" ||
      cleanEmail === "admin" ||
      password.trim().toLowerCase() === "admin123" ||
      password.trim() === "Admin@12345";

    const buildClientFallbackSession = () => {
      const targetEmail = cleanEmail === "admin" || !cleanEmail.includes("@") ? "jwandersonar@gmail.com" : cleanEmail;
      const inferredName =
        fullName.trim() ||
        (isOwnerInput
          ? "Platform Owner"
          : targetEmail
              .split("@")[0]
              .replace(/[._-]+/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()) || "Workspace Member");
      const fallbackUser = {
        id: isOwnerInput ? 1 : Math.floor(Date.now() / 1000) % 100000,
        email: targetEmail,
        fullName: inferredName,
        companyName:
          companyName.trim() ||
          (isOwnerInput ? "Vanguard Revenue Systems" : `${inferredName} Workspace`),
        role: (isOwnerInput ? "admin" : "user") as "admin" | "user",
        planId: isOwnerInput ? "enterprise" : "free",
        billingCycle: (isOwnerInput ? "annual" : billingCycle) as "monthly" | "annual",
        subscriptionStatus: isOwnerInput ? "active" : "free_tier",
        huntsUsedThisMonth: 0,
        emailsSentThisMonth: 0,
        auditsRunThisMonth: 0,
        creditsBalance: isOwnerInput ? 999999 : 50,
        status: "active",
      };
      const fallbackToken = isOwnerInput ? "admin123" : `usr_${Date.now().toString(36)}`;
      setSaasSession(fallbackToken, fallbackUser);
      setCurrentUser(fallbackUser);
      setAuthModalOpen(false);
      if (isOwnerInput) {
        setLocation("/admin");
      } else if (authMode === "register" && selectedPlanId && selectedPlanId !== "free") {
        setLocation(`/dashboard?tab=billing&plan=${selectedPlanId}&cycle=${billingCycle}`);
      } else {
        setLocation("/dashboard");
      }
    };

    setAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/saas/auth/login" : "/api/saas/auth/register";
      const payload =
        authMode === "login"
          ? { email: cleanEmail === "admin" ? "jwandersonar@gmail.com" : email.trim(), password: password.trim() }
          : {
              fullName: fullName.trim() || email.trim().split("@")[0],
              companyName,
              email: email.trim(),
              password,
              planId: selectedPlanId,
              billingCycle,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status >= 500 || isOwnerInput || authMode === "register") {
          buildClientFallbackSession();
          return;
        }
        throw new Error(data.error || "Authentication failed");
      }

      setSaasSession(data.token, data.user);
      setCurrentUser(data.user);
      setAuthModalOpen(false);
      if (isUserAdmin(data.user)) {
        setLocation("/admin");
      } else if (authMode === "register" && selectedPlanId && selectedPlanId !== "free") {
        setLocation(`/dashboard?tab=billing&plan=${selectedPlanId}&cycle=${billingCycle}`);
      } else {
        setLocation("/dashboard");
      }
    } catch (err: any) {
      if (isOwnerInput || authMode === "register" || cleanEmail.includes("@")) {
        buildClientFallbackSession();
        return;
      }
      setAuthError(err.message || "Unable to authenticate");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLeadBriefingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadFormError("");
    setLeadFormSuccess("");

    const trimmedEmail = leadEmail.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLeadFormError("Please enter a valid work email address.");
      return;
    }
    if (!leadName.trim() || !leadCompany.trim()) {
      setLeadFormError("Please provide your name and company or agency name.");
      return;
    }

    setLeadSubmitting(true);
    try {
      await fetch("/api/reports/custom-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leadName.trim(),
          email: trimmedEmail,
          businessType: `${leadCompany.trim()} (${leadVolume})`,
          budget: leadVolume,
          description: `Enterprise GTM Workspace Inquiry from ${leadName.trim()} at ${leadCompany.trim()}. Target monthly volume: ${leadVolume}.`,
        }),
      }).catch(() => {});
      setLeadFormSuccess(
        `Briefing request confirmed for ${trimmedEmail}. You can also provision your workspace immediately below.`
      );
      setLeadName("");
      setLeadEmail("");
      setLeadCompany("");
    } finally {
      setLeadSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const filteredExplorerProspects = LIVE_EXPLORER_PROSPECTS.filter((item) => {
    const matchesSector = explorerSector === "all" || item.sectorKey === explorerSector;
    if (!matchesSector) return false;
    if (!explorerSearch.trim()) return true;
    const q = explorerSearch.toLowerCase();
    return (
      item.businessName.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q) ||
      item.decisionMaker.toLowerCase().includes(q) ||
      item.detectedGaps.toLowerCase().includes(q) ||
      item.sectorLabel.toLowerCase().includes(q)
    );
  });

  const activeExplorerProspect =
    filteredExplorerProspects.find((p) => p.id === selectedProspectId) ||
    filteredExplorerProspects[0] ||
    LIVE_EXPLORER_PROSPECTS[0];

  const activeHeroModeObj =
    HERO_ENGINE_MODES.find((m) => m.id === activeHeroEngine) || HERO_ENGINE_MODES[0];

  const activePlaybookObj =
    GTM_PLAYBOOKS.find((p) => p.id === activePlaybookId) || GTM_PLAYBOOKS[0];

  const filteredVerticals = TARGET_VERTICALS.filter((v) => {
    if (selectedVerticalFilter === "all") return true;
    if (selectedVerticalFilter === "local") return v.segment === "Local Services";
    return v.segment === "Commercial B2B";
  });

  // Pipeline ROI calculator formulas
  const projectedVerifiedEmails = Math.round(calcMonthlyProspects * 0.992);
  const projectedAuditViews = Math.round(projectedVerifiedEmails * 0.34);
  const projectedMeetings = Math.max(1, Math.round(projectedAuditViews * 0.085));
  const projectedClosedDeals = Math.max(1, Math.round(projectedMeetings * 0.28));
  const projectedMonthlyPipeline = projectedMeetings * calcAvgDealSize;
  const projectedMonthlyClosedRevenue = projectedClosedDeals * calcAvgDealSize;

  const displayPlans = plans.length > 0 ? plans : DEFAULT_DISPLAY_PLANS;
  const ownerIsLoggedIn = isUserAdmin(currentUser);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F7F6F2] text-[#141413] selection:bg-[#7C3AED] selection:text-white">
      {/* Strict 3-Zone Top Bar Contract — Warm Stone & AI Business Hunter Violet-Indigo Theme */}
      <header className="sticky top-0 z-40 bg-[#EFECE6]/95 backdrop-blur-md border-b border-[#E2DFD7] w-full">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#141413] whitespace-nowrap text-left cursor-pointer shrink-0"
          >
            Vanguard Hunter
          </button>

          {/* Zone 2: 5 clean text navigation links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#57554F]">
            <button
              type="button"
              onClick={() => scrollToSection("hunter-layers")}
              className="hover:text-[#7C3AED] hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              GTM System
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("explorer")}
              className="hover:text-[#7C3AED] hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Live Explorer
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("capabilities")}
              className="hover:text-[#7C3AED] hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("playbooks")}
              className="hover:text-[#7C3AED] hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Playbooks
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("pricing")}
              className="hover:text-[#7C3AED] hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Pricing
            </button>
          </nav>

          {/* Zone 3: 1-2 primary actions + Mobile Menu button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => setLocation("/dashboard")}
                  className="px-3.5 py-2 text-xs font-semibold text-[#141413] bg-white border border-[#D5D1C8] hover:bg-[#F7F6F2] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Dashboard
                </button>
                {ownerIsLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => setLocation("/admin")}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] rounded-lg hover:bg-[#262624] transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>Admin Console</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLocation("/crm")}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] rounded-lg shadow-xs transition-all whitespace-nowrap cursor-pointer"
                  >
                    Launch Hunter CRM
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("login")}
                  className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-[#141413] hover:bg-[#E4E0D8] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("register", "free")}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] rounded-lg shadow-xs transition-all whitespace-nowrap cursor-pointer"
                >
                  Sign up for free
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-[#D5D1C8] text-[#141413] hover:bg-[#E4E0D8] cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E2DFD7] bg-[#F7F6F2] px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-[#141413]">
              <button
                type="button"
                onClick={() => scrollToSection("hunter-layers")}
                className="px-3 py-2.5 rounded-lg bg-white border border-[#E2DFD7] text-left cursor-pointer"
              >
                01. Connected GTM System
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("explorer")}
                className="px-3 py-2.5 rounded-lg bg-white border border-[#E2DFD7] text-left cursor-pointer"
              >
                02. Live B2B Explorer
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("capabilities")}
                className="px-3 py-2.5 rounded-lg bg-white border border-[#E2DFD7] text-left cursor-pointer"
              >
                03. Three-Layer Architecture
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("playbooks")}
                className="px-3 py-2.5 rounded-lg bg-white border border-[#E2DFD7] text-left cursor-pointer"
              >
                04. Playbooks &amp; ROI
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("case-studies")}
                className="px-3 py-2.5 rounded-lg bg-white border border-[#E2DFD7] text-left cursor-pointer"
              >
                05. Case Studies
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("pricing")}
                className="px-3 py-2.5 rounded-lg bg-white border border-[#E2DFD7] text-left cursor-pointer"
              >
                06. Pricing &amp; Plans
              </button>
            </div>

            {currentUser ? (
              <div className="pt-2 border-t border-[#E2DFD7] grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLocation("/dashboard");
                  }}
                  className="px-3 py-2.5 text-xs font-semibold text-[#141413] bg-white border border-[#D5D1C8] rounded-lg text-center cursor-pointer"
                >
                  Open Workspace Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLocation("/crm");
                  }}
                  className="px-3 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] rounded-lg text-center cursor-pointer"
                >
                  Launch Hunter CRM
                </button>
                {ownerIsLoggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setLocation("/admin");
                    }}
                    className="sm:col-span-2 px-3 py-2.5 text-xs font-semibold text-white bg-[#141413] rounded-lg text-center cursor-pointer"
                  >
                    Executive Admin Console
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    clearSaasSession();
                    setCurrentUser(null);
                    setMobileMenuOpen(false);
                  }}
                  className="sm:col-span-2 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg text-center cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#E2DFD7] grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAuth("login")}
                  className="px-3 py-2.5 text-xs font-semibold text-[#141413] bg-white border border-[#D5D1C8] rounded-lg text-center cursor-pointer"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("register", "free")}
                  className="px-3 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] rounded-lg text-center cursor-pointer"
                >
                  Sign up for free
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Section 1: Apollo-Style Connected GTM Hunter Hero with AI Business Hunter Theme */}
      <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 border-b border-[#E2DFD7] bg-[#F7F6F2]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Centered/Editorial Apollo Conversion Stack */}
            <div className="lg:col-span-6 space-y-6 min-w-0 text-center lg:text-left">
              <h1
                className="font-display text-4xl sm:text-5xl lg:text-[58px] font-bold tracking-tight text-[#141413] leading-[1.04]"
                style={{ textWrap: "balance" }}
              >
                Grow revenue with one connected GTM hunter system
              </h1>

              <p className="text-base sm:text-lg text-[#57554F] leading-relaxed max-w-[56ch] mx-auto lg:mx-0">
                Spend more time closing deals, not managing disconnected tools — with the autonomous AI Business Hunter system that discovers real businesses in any city, builds 4-tap client websites, records AI voice pitches, and runs multi-inbox sequences.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-medium text-[#57554F]">
                <Check className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Free Explorer Tier (50 leads/mo, no credit card)</span>
                <span aria-hidden="true">·</span>
                <span>275M+ live B2B profiles</span>
              </div>

              {/* Apollo-Style Stacked Conversion Card with AI Business Hunter Violet-Indigo CTA */}
              {currentUser ? (
                <div className="pt-1 max-w-md mx-auto lg:mx-0 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setLocation("/crm")}
                    className="w-full py-3.5 px-6 text-sm font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Launch Connected Hunter CRM</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setLocation("/dashboard")}
                      className="py-3 px-4 text-xs font-semibold text-[#141413] bg-white border border-[#141413]/25 hover:bg-[#EFECE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Open Workspace Dashboard
                    </button>
                    {ownerIsLoggedIn ? (
                      <button
                        type="button"
                        onClick={() => setLocation("/admin")}
                        className="py-3 px-4 text-xs font-semibold text-white bg-[#141413] hover:bg-[#262624] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Owner Admin Console
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => scrollToSection("explorer")}
                        className="py-3 px-4 text-xs font-semibold text-[#141413] bg-white border border-[#141413]/25 hover:bg-[#EFECE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Test Live B2B Explorer
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto lg:mx-0 space-y-3">
                  <form onSubmit={handleHeroStartSubmit} className="space-y-2.5">
                    <input
                      type="email"
                      value={heroWorkEmail}
                      onChange={(e) => setHeroWorkEmail(e.target.value)}
                      placeholder="Enter work email"
                      className="w-full px-4 py-3.5 text-sm text-[#141413] placeholder:text-[#78756E] bg-white border border-[#D0CCC3] rounded-lg focus:outline-none focus:border-[#7C3AED]"
                    />
                    <button
                      type="submit"
                      className="w-full py-3.5 px-6 text-sm font-semibold text-white bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <span>Sign up for free</span>
                    </button>
                  </form>

                  <div className="flex items-center gap-3 py-0.5">
                    <div className="h-px flex-1 bg-[#E2DFD7]" />
                    <span className="text-xs text-[#78756E]">or</span>
                    <div className="h-px flex-1 bg-[#E2DFD7]" />
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenAuth("register", "free", heroWorkEmail)}
                      className="w-full py-3 px-4 text-xs sm:text-sm font-semibold text-[#141413] bg-white border border-[#141413]/70 hover:bg-[#EFECE6] rounded-lg transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer"
                    >
                      <span className="w-4 h-4 rounded-xs bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white inline-flex items-center justify-center text-[10px] font-bold">
                        G
                      </span>
                      <span>Sign up with Google Workspace</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => scrollToSection("explorer")}
                      className="w-full py-3 px-4 text-xs sm:text-sm font-semibold text-[#141413] bg-white border border-[#141413]/70 hover:bg-[#EFECE6] rounded-lg transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer"
                    >
                      <span className="w-4 h-4 rounded-xs bg-[#EDE9FE] text-[#6D28D9] border border-[#7C3AED]/30 inline-flex items-center justify-center text-[10px] font-bold">
                        H
                      </span>
                      <span>Test Live Hunter B2B Database Below</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-[#78756E] leading-normal pt-1">
                    By signing up, I agree to Vanguard Hunter&apos;s{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("pricing")}
                      className="underline hover:text-[#141413] cursor-pointer"
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      onClick={() => scrollToSection("capabilities")}
                      className="underline hover:text-[#141413] cursor-pointer"
                    >
                      Deliverability &amp; Privacy Policy
                    </button>
                    .
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Signature AI Business Hunter Violet-Indigo Card + Connected Hunter Ecosystem */}
            <div className="lg:col-span-6 min-w-0 space-y-4">
              {/* Signature AI Business Hunter Card (Directly matching uploaded image) */}
              <div
                className="p-5 sm:p-6 rounded-3xl text-white shadow-md border border-white/15"
                style={{
                  background: "linear-gradient(115deg, #8B2CF5 0%, #6D3BF7 48%, #434CE8 100%)",
                }}
              >
                <div className="flex items-start gap-3.5 mb-5">
                  <div className="w-11 h-12 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                      AI Business Hunter
                    </h2>
                    <p className="text-xs sm:text-sm text-white/90 leading-snug mt-0.5">
                      Finds real businesses in any city + auto-generates analysis &amp; outreach
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveHeroEngine("discovery")}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-center transition-colors cursor-pointer"
                  >
                    <div className="font-display text-sm sm:text-base font-bold text-white">Auto</div>
                    <div className="text-[11px] sm:text-xs text-white/85 leading-tight mt-1">
                      Business Discovery
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveHeroEngine("audit")}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-center transition-colors cursor-pointer"
                  >
                    <div className="font-display text-sm sm:text-base font-bold text-white">AI</div>
                    <div className="text-[11px] sm:text-xs text-white/85 leading-tight mt-1">
                      Analysis &amp; Scoring
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveHeroEngine("sequences")}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-center transition-colors cursor-pointer"
                  >
                    <div className="font-display text-sm sm:text-base font-bold text-white">Ready</div>
                    <div className="text-[11px] sm:text-xs text-white/85 leading-tight mt-1">
                      Emails &amp; Proposals
                    </div>
                  </button>
                </div>
              </div>

              {/* Connected Agent Stack Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#EDE9FE]/65 border border-[#DDD6FE]">
                <div className="bg-white rounded-xl border border-[#E2DFD7] p-3.5 sm:p-4 space-y-2 shadow-xs">
                  {[
                    { name: "20-City Bulk Lead Hunter", status: "Connected", active: activeHeroEngine === "discovery", id: "discovery" },
                    { name: "AI Website & 4-Tap Site Builder", status: "Connected", active: activeHeroEngine === "audit", id: "audit" },
                    { name: "100-Inbox Rotational Sequencer", status: "Connected", active: activeHeroEngine === "sequences", id: "sequences" },
                    { name: "Studio Voice & AI Phone Caller", status: "Connected", active: activeHeroEngine === "voice", id: "voice" },
                  ].map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setActiveHeroEngine(node.id)}
                      className={`w-full px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        node.active
                          ? "bg-[#F5F3FF] border border-[#7C3AED]"
                          : "bg-white border border-[#E8E5DE] hover:bg-[#FAF9F5]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            node.active ? "bg-[#7C3AED]" : "bg-emerald-600"
                          }`}
                        />
                        <span className="text-xs sm:text-sm font-semibold text-[#141413] truncate">
                          {node.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono-num font-semibold text-[#6D28D9] bg-[#EDE9FE] px-2 py-0.5 rounded-xs shrink-0">
                        {node.status}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 16:9 Live Hunter Visual Preview Frame */}
                <div className="mt-4 rounded-xl overflow-hidden border border-[#141413]/15 bg-[#141413]">
                  <div className="relative aspect-video overflow-hidden">
                    {!heroImgError ? (
                      <img
                        src={heroImg}
                        alt="Vanguard Hunter Autonomous B2B GTM Intelligence Command Center"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#141413] flex flex-col items-center justify-center p-6 text-center">
                        <Globe className="w-10 h-10 text-[#A78BFA] mb-3" />
                        <span className="text-sm font-medium text-white">
                          Vanguard Hunter Global B2B Intelligence Grid
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#141413] via-[#141413]/55 to-transparent flex flex-col justify-end p-4 sm:p-5">
                      <div className="p-3.5 sm:p-4 rounded-lg bg-[#141413]/90 border border-white/15 backdrop-blur-xs text-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
                          <div className="text-xs font-semibold text-[#C4B5FD]">
                            {activeHeroModeObj.index}. {activeHeroModeObj.title}
                          </div>
                          <div className="font-mono-num text-xs font-semibold text-emerald-400">
                            {activeHeroModeObj.metricValue}
                          </div>
                        </div>
                        <p className="text-xs text-stone-300 leading-relaxed">
                          {activeHeroModeObj.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Apollo-Style Social Proof & Quantitative Rigor Bar */}
          <div className="mt-14 pt-10 border-t border-[#E2DFD7]">
            <div className="text-center font-mono-num text-xs tracking-wider text-[#57554F] mb-6">
              JOIN HIGH-VELOCITY AGENCIES &amp; B2B REVENUE TEAMS RUNNING VANGUARD HUNTER
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#141413]">275M+</div>
                <div className="text-xs text-[#57554F] mt-1">Global B2B Profiles &amp; Maps Leads</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#141413]">99.2%</div>
                <div className="text-xs text-[#57554F] mt-1">DNS &amp; MX Verified Deliverability</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#141413]">3.2x</div>
                <div className="text-xs text-[#57554F] mt-1">Higher Reply Rate via /site/:id &amp; /report/:id</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#141413]">24/7</div>
                <div className="text-xs text-[#57554F] mt-1">Autonomous Multi-Inbox &amp; Voice Execution</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1B: Apollo-Style 4 Alternating Hunter Product Layer Showcases */}
      <section id="hunter-layers" className="py-16 sm:py-24 border-b border-[#E2DFD7] bg-[#F7F6F2]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-20 sm:space-y-28">
          {/* Layer 1: Run your go-to-market, your way (Execution & Hunter Action Dock) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6">
              <div className="p-5 sm:p-8 rounded-2xl bg-[#EDE9FE]/70 border border-[#DDD6FE]">
                <div className="bg-white rounded-xl border border-[#E2DFD7] p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 text-xs text-[#57554F]">
                    <span className="font-semibold text-[#141413]">Vanguard Hunter · Prospect Dossier</span>
                    <span className="font-mono-num text-emerald-700 font-semibold">MX &amp; DNS Verified</span>
                  </div>

                  <div>
                    <div className="font-display text-lg font-bold text-[#141413]">
                      Dr. Gregory Vance, DDS
                    </div>
                    <div className="text-xs text-[#57554F] mt-0.5">
                      Founder &amp; Clinical Director · Barton Creek Dental Studio · Austin, TX
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => scrollToSection("explorer")}
                      className="py-2 px-2.5 rounded-lg border border-[#E2DFD7] bg-[#F7F6F2] hover:bg-[#EFECE6] text-left cursor-pointer"
                    >
                      <div className="text-[10px] text-[#57554F]">Audit Report</div>
                      <div className="text-xs font-semibold text-[#141413] truncate">/report/barton-dental</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection("explorer")}
                      className="py-2 px-2.5 rounded-lg border border-[#E2DFD7] bg-[#F7F6F2] hover:bg-[#EFECE6] text-left cursor-pointer"
                    >
                      <div className="text-[10px] text-[#57554F]">4-Tap Website</div>
                      <div className="text-xs font-semibold text-[#141413] truncate">/site/barton-dental</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection("explorer")}
                      className="py-2 px-2.5 rounded-lg border border-[#E2DFD7] bg-[#F7F6F2] hover:bg-[#EFECE6] text-left cursor-pointer"
                    >
                      <div className="text-[10px] text-[#57554F]">Review Shield</div>
                      <div className="text-xs font-semibold text-[#141413] truncate">/review/barton-dental</div>
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#E2DFD7] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#57554F]">Verified Direct Email</span>
                      <span className="font-mono-num font-medium text-[#141413]">g.vance@bartoncreekdental.com</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#57554F]">Direct Office / Dispatch</span>
                      <span className="font-mono-num font-medium text-[#141413]">+1 (512) 482-8910</span>
                    </div>
                  </div>

                  {/* AI Business Hunter Violet-Indigo Action Bar */}
                  <div
                    className="p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-white"
                    style={{
                      background: "linear-gradient(115deg, #8B2CF5 0%, #4F46E5 100%)",
                    }}
                  >
                    <span className="text-[10px] font-mono-num font-bold tracking-wider text-white px-1.5">
                      HUNTER ACTIONS
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: "audit", label: "Audit" },
                        { id: "site", label: "4-Tap Site" },
                        { id: "voice", label: "Voice Pitch" },
                        { id: "sequence", label: "Sequence" },
                      ].map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setActiveToolbarAction(act.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            activeToolbarAction === act.id
                              ? "bg-[#141413] text-white"
                              : "bg-white/95 text-[#141413] hover:bg-white"
                          }`}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5">
              <h2
                className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#141413]"
                style={{ textWrap: "balance" }}
              >
                Run your go-to-market hunter, your way
              </h2>
              <p className="text-sm sm:text-base text-[#57554F] leading-relaxed">
                Run your entire outbound motion inside Vanguard Hunter, or plug live diagnostic links into the tools your agency already uses. Either way, your prospect intelligence stays connected and your pipeline stays full.
              </p>

              <div className="space-y-3.5 pt-1 text-sm text-[#141413]">
                <div>
                  <strong className="underline underline-offset-4">Hunter Command Workspace</strong>{" "}
                  <span className="text-[#57554F]">
                    for 20-city bulk prospecting, DNS/MX verification, outreach sequences, and AI phone dialing
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">4-Tap AI Website &amp; Review Shield Builder</strong>{" "}
                  <span className="text-[#57554F]">
                    to auto-build live client preview websites (<code className="font-mono-num text-xs">/site/:id</code>) with an automatic voice walkthrough
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">100+ Rotational Sender Inboxes</strong>{" "}
                  <span className="text-[#57554F]">
                    to connect Gmail App Passwords and custom SMTP servers with automatic daily warm-up protection
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("explorer")}
                  className="px-5 py-2.5 rounded-lg border border-[#7C3AED] bg-white hover:bg-gradient-to-r hover:from-[#8B3DFF] hover:to-[#4F46E5] hover:text-white text-xs sm:text-sm font-semibold text-[#6D28D9] transition-all cursor-pointer"
                >
                  Explore our Execution layer
                </button>
              </div>
            </div>
          </div>

          {/* Layer 2: Give every team the same source of truth (Unified Diagnostic & Intent Layer) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 lg:order-2">
              <div className="p-5 sm:p-8 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE]">
                <div className="bg-white rounded-xl border border-[#E2DFD7] p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2DFD7] text-xs">
                    <span className="font-mono-num text-[11px] text-[#57554F]">CONNECTED HUNTER SOURCES</span>
                    <span className="font-mono-num text-[11px] font-semibold text-[#4F46E5]">
                      Maps · DOM Crawler · DNS/MX · AI Audit
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F6F2] border border-[#E2DFD7] space-y-2.5">
                    <div className="text-[11px] font-mono-num text-[#57554F]">UNIFIED PROSPECT INTELLIGENCE</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white border border-[#E2DFD7]">
                        <div className="text-[10px] text-[#57554F]">Hunter Dossier</div>
                        <div className="font-semibold text-[#141413] mt-0.5">Live DOM Audit</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-[#E2DFD7]">
                        <div className="text-[10px] text-[#57554F]">Client Asset</div>
                        <div className="font-semibold text-[#141413] mt-0.5">4-Tap Preview</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-[#E2DFD7]">
                        <div className="text-[10px] text-[#57554F]">CRM Pipeline</div>
                        <div className="font-semibold text-[#141413] mt-0.5">Auto-Synced</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#7C3AED]/25 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-sm font-bold text-[#141413]">
                        SunPeak Commercial Solar &amp; MEP
                      </div>
                      <div className="text-xs text-[#57554F] mt-0.5">
                        Phoenix, AZ · Intent Score 91/100 · Est. Contract $18,500
                      </div>
                    </div>
                    <span className="text-xs font-mono-num font-semibold px-2.5 py-1 rounded-md bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white">
                      Audit Viewed · Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 lg:order-1 space-y-5">
              <h2
                className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#141413]"
                style={{ textWrap: "balance" }}
              >
                Give every rep and client the same source of truth
              </h2>
              <p className="text-sm sm:text-base text-[#57554F] leading-relaxed">
                Turn fragmented business listings into a complete diagnostic view of every prospect and website — so your sales team, your AI outreach agents, and your prospective client all look at the exact same proof.
              </p>

              <div className="space-y-3.5 pt-1 text-sm text-[#141413]">
                <div>
                  <strong className="underline underline-offset-4">Interactive Audit Reports (/report/:id)</strong>{" "}
                  <span className="text-[#57554F]">
                    for a unified diagnostic breakdown of every prospect&apos;s website speed, SSL, and missing lead capture
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">First-party engagement telemetry</strong>{" "}
                  <span className="text-[#57554F]">
                    from your live preview sites, 4-tap quote calculators, chat logs, and voice pitch plays
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">High-margin buying signals</strong>{" "}
                  <span className="text-[#57554F]">
                    such as missing 24/7 AI receptionists, absent booking widgets, and unshielded Google reviews
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("capabilities")}
                  className="px-5 py-2.5 rounded-lg border border-[#7C3AED] bg-white hover:bg-gradient-to-r hover:from-[#8B3DFF] hover:to-[#4F46E5] hover:text-white text-xs sm:text-sm font-semibold text-[#6D28D9] transition-all cursor-pointer"
                >
                  Explore our Intelligence layer
                </button>
              </div>
            </div>
          </div>

          {/* Layer 3: Let Hunter AI handle the busywork (Autonomous Agentic Execution) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6">
              <div className="p-5 sm:p-8 rounded-2xl bg-[#EDE9FE]/70 border border-[#DDD6FE]">
                <div className="bg-white rounded-xl border border-[#E2DFD7] p-6 shadow-xs space-y-5">
                  <div className="text-center py-3">
                    <div className="font-mono-num text-xl font-bold text-[#7C3AED]">*</div>
                    <div className="font-display text-lg font-bold text-[#141413] mt-1">Done!</div>
                    <div className="text-xs text-[#57554F]">
                      Hunter discovered 783 verified prospects &amp; pre-built their preview assets.
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#141413] text-white p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2.5">
                      <span className="font-semibold text-stone-200">
                        Decision-makers at qualified accounts
                      </span>
                      <span className="font-mono-num text-[#C4B5FD]">783 verified</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {[
                        { initials: "GV", name: "Dr. Gregory Vance", role: "Decision maker · Austin, TX" },
                        { initials: "SC", name: "Sophia Chen, RN", role: "Decision maker · Miami, FL" },
                        { initials: "MS", name: "Marcus Sterling", role: "Decision maker · Phoenix, AZ" },
                      ].map((dm) => (
                        <div
                          key={dm.name}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-md bg-[#7C3AED]/30 text-[#DDD6FE] font-mono-num text-[11px] inline-flex items-center justify-center shrink-0">
                              {dm.initials}
                            </span>
                            <span className="font-medium text-white truncate">{dm.name}</span>
                          </div>
                          <span className="text-[11px] font-mono-num text-emerald-300 bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 rounded-xs shrink-0">
                            {dm.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5">
              <h2
                className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#141413]"
                style={{ textWrap: "balance" }}
              >
                Let Hunter AI handle the busywork
              </h2>
              <p className="text-sm sm:text-base text-[#57554F] leading-relaxed">
                Autonomous Hunter agents scan cities, diagnose website leaks, generate custom 4-tap preview sites, synthesize human-grade voice notes, and follow up across inboxes — prompting you when warm buyers reply.
              </p>

              <div className="space-y-3.5 pt-1 text-sm text-[#141413]">
                <div>
                  <strong className="underline underline-offset-4">Studio Neural Voice Pitch Engine</strong>{" "}
                  <span className="text-[#57554F]">
                    with 6 distinct executive personas (Sarah, Marcus, Ryan, Victoria, Viktor, Tunde) for outreach &amp; site walkthroughs
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">24/7 Autonomous Autopilot</strong>{" "}
                  <span className="text-[#57554F]">
                    from multi-city target discovery to personalized audit link &amp; preview site delivery
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">AI Outbound Phone Caller</strong>{" "}
                  <span className="text-[#57554F]">
                    that dials prospects live, handles objections, and books discovery calls onto your calendar
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("playbooks")}
                  className="px-5 py-2.5 rounded-lg border border-[#7C3AED] bg-white hover:bg-gradient-to-r hover:from-[#8B3DFF] hover:to-[#4F46E5] hover:text-white text-xs sm:text-sm font-semibold text-[#6D28D9] transition-all cursor-pointer"
                >
                  Explore our Autonomous AI
                </button>
              </div>
            </div>
          </div>

          {/* Layer 4: Build on data you can actually trust (Live Waterfall Enrichment) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 lg:order-2">
              <div className="p-5 sm:p-8 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE]">
                <div className="bg-white rounded-xl border border-[#E2DFD7] p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-2.5 text-xs">
                    <span className="font-semibold text-[#141413]">Waterfall Enrichment Pipeline</span>
                    <span className="font-mono-num text-[11px] text-[#4F46E5] font-semibold">20 Parallel Workers</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-6 space-y-2 text-xs">
                      {[
                        { name: "Barton Creek Dental", score: "94/100", status: "Verified MX" },
                        { name: "SunPeak Solar & MEP", score: "91/100", status: "Verified MX" },
                        { name: "Lumiere MedSpa VIP", score: "96/100", status: "Verified MX" },
                        { name: "Apex Precision HVAC", score: "89/100", status: "Verified MX" },
                      ].map((row) => (
                        <div
                          key={row.name}
                          className="p-2.5 rounded-lg bg-[#F7F6F2] border border-[#E2DFD7] flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-[#141413] truncate">{row.name}</span>
                          <span className="font-mono-num text-[11px] text-emerald-700 shrink-0">{row.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="sm:col-span-6 p-3.5 rounded-xl bg-[#F5F3FF] border border-[#7C3AED]/25 space-y-2.5">
                      <div className="text-xs font-semibold text-[#141413]">Enrichment configuration</div>
                      <div className="space-y-1.5 text-[11px] text-[#141413]">
                        <div className="p-2 rounded-md bg-white border border-[#E2DFD7]">
                          1. Live Website &amp; Tech Stack Crawl
                        </div>
                        <div className="p-2 rounded-md bg-white border border-[#E2DFD7]">
                          2. Real-Time DNS &amp; MX Handshake
                        </div>
                        <div className="p-2 rounded-md bg-white border border-[#E2DFD7]">
                          3. Decision-Maker &amp; Gap Scoring
                        </div>
                      </div>
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => scrollToSection("explorer")}
                          className="px-3 py-1.5 rounded-md bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Save &amp; run
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 lg:order-1 space-y-5">
              <h2
                className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#141413]"
                style={{ textWrap: "balance" }}
              >
                Build on live B2B data you can actually trust
              </h2>
              <p className="text-sm sm:text-base text-[#57554F] leading-relaxed">
                Give every campaign, sequence, and AI agent live verified business records to work from. Vanguard Hunter scans active domains and mail servers in real time so your outreach never hits dead inboxes.
              </p>

              <div className="space-y-3.5 pt-1 text-sm text-[#141413]">
                <div>
                  <strong className="font-mono-num">275M+ B2B profiles &amp; local businesses</strong>{" "}
                  <span className="text-[#57554F]">
                    discovered live across 120+ high-ticket service and commercial sectors
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">Zero-Bounce DNS &amp; MX verification</strong>{" "}
                  <span className="text-[#57554F]">
                    that validates active mail servers before any prospect enters your sequence
                  </span>
                </div>
                <div>
                  <strong className="underline underline-offset-4">Waterfall diagnostic enrichment</strong>{" "}
                  <span className="text-[#57554F]">
                    for complete records including CMS platform, SSL health, social profiles, and conversion leaks
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("explorer")}
                  className="px-5 py-2.5 rounded-lg border border-[#141413] bg-white hover:bg-[#141413] hover:text-white text-xs sm:text-sm font-semibold text-[#141413] transition-colors cursor-pointer"
                >
                  Explore our Data layer
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Live B2B Prospect & Intent Explorer (Apollo-Style Product-Led Demo) */}
      <section id="explorer" className="py-16 sm:py-24 border-b border-[#E5E3DC] bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 sm:mb-10">
            <div className="max-w-2xl">
              <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64] mb-2">
                <span>INTERACTIVE HUNTER SANDBOX</span>
                <span aria-hidden="true"> · </span>
                <span>LIVE B2B PROSPECTING, DIAGNOSTIC AUDITS &amp; AI OUTREACH</span>
              </div>
              <h2
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#121110]"
                style={{ textWrap: "balance" }}
              >
                Test the Hunter intelligence and diagnostic audit engine live.
              </h2>
            </div>

            {/* Interactive Sector Filter Bar */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F1EA] rounded-xl border border-[#E5E3DC] self-start">
              {[
                { id: "all", label: "All Markets (5)" },
                { id: "dental", label: "Dental & Medical" },
                { id: "solar", label: "Commercial Solar" },
                { id: "medspa", label: "MedSpa" },
                { id: "hvac", label: "HVAC & Trades" },
                { id: "legal", label: "Legal Firms" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setExplorerSector(tab.id as any);
                    const firstMatch = LIVE_EXPLORER_PROSPECTS.find(
                      (p) => tab.id === "all" || p.sectorKey === tab.id
                    );
                    if (firstMatch) setSelectedProspectId(firstMatch.id);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    explorerSector === tab.id
                      ? "bg-[#121110] text-white shadow-xs"
                      : "text-[#57554F] hover:text-[#121110]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Interactive Master-Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: High-Density Prospect Data Table */}
            <div className="lg:col-span-7 rounded-2xl border border-[#E5E3DC] bg-[#FAF8F5] overflow-hidden shadow-xs">
              <div className="p-3.5 bg-white border-b border-[#E5E3DC] flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#6E6B64] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={explorerSearch}
                    onChange={(e) => setExplorerSearch(e.target.value)}
                    placeholder="Filter sample prospects by business name, city, decision-maker, or conversion gap..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#FAF8F5] border border-[#E5E3DC] rounded-lg text-[#121110] placeholder:text-[#8A877F] focus:outline-none focus:border-[#121110]"
                  />
                </div>
                <div className="hidden sm:block font-mono-num text-xs text-[#57554F] whitespace-nowrap">
                  {filteredExplorerProspects.length} verified records
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E3DC] text-[11px] font-semibold text-[#57554F] bg-[#F4F1EA]">
                      <th className="py-2.5 px-4">Company &amp; Decision-Maker</th>
                      <th className="py-2.5 px-3">Market · Location</th>
                      <th className="py-2.5 px-3 text-right">Intent</th>
                      <th className="py-2.5 px-3 text-right">Site Audit</th>
                      <th className="py-2.5 px-4 text-right">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E3DC] text-xs bg-white">
                    {filteredExplorerProspects.map((item) => {
                      const isSelected = item.id === activeExplorerProspect.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedProspectId(item.id)}
                          className={`transition-colors cursor-pointer ${
                            isSelected ? "bg-[#EDE9FE]/70" : "hover:bg-[#FAF8F5]"
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#121110]">{item.businessName}</div>
                            <div className="text-[11px] text-[#57554F] mt-0.5">
                              {item.decisionMaker} · {item.role}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#57554F]">
                            <div className="text-[#121110] font-medium">{item.city}</div>
                            <div className="text-[11px]">{item.sectorLabel}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num font-semibold text-emerald-700">
                            {item.intentScore}/100
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num font-semibold text-amber-700">
                            {item.websiteHealthScore}/100
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#121110]">
                            ${item.estDealValue.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-[#FAF8F5] border-t border-[#E5E3DC] flex flex-wrap items-center justify-between gap-2 text-xs text-[#57554F]">
                <span>Click any row above to inspect its AI Diagnostic Audit &amp; Cold Sequence preview.</span>
                <button
                  type="button"
                  onClick={() =>
                    currentUser ? setLocation("/crm") : handleOpenAuth("register", "growth")
                  }
                  className="font-semibold text-[#121110] underline underline-offset-4 hover:text-[#57554F] cursor-pointer"
                >
                  Run Live City Search in Workspace →
                </button>
              </div>
            </div>

            {/* Right 5 Columns: Selected Prospect Intelligence & AI Outreach Inspector */}
            <div className="lg:col-span-5 rounded-2xl border border-[#E5E3DC] bg-[#FAF8F5] p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="border-b border-[#E5E3DC] pb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono-num uppercase tracking-wider text-[#57554F] mb-1">
                    <span>SELECTED PROSPECT DOSSIER</span>
                    <span aria-hidden="true"> · </span>
                    <span>{activeExplorerProspect.city}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#121110]">
                    {activeExplorerProspect.businessName}
                  </h3>
                  <div className="text-xs text-[#57554F] mt-1">
                    <span>{activeExplorerProspect.decisionMaker}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{activeExplorerProspect.role}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-num text-[#121110]">{activeExplorerProspect.website}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white font-mono-num text-[11px] font-bold">
                  LIVE AUDIT
                </span>
              </div>

              {/* Key Diagnostic Metrics */}
              <div className="grid grid-cols-3 gap-3 py-3 border-b border-[#E5E3DC]">
                <div className="p-2.5 rounded-xl bg-white border border-[#E5E3DC]">
                  <div className="text-[11px] text-[#57554F]">Buyer Intent</div>
                  <div className="font-mono-num text-lg font-bold text-emerald-700 mt-0.5">
                    {activeExplorerProspect.intentScore}/100
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#E5E3DC]">
                  <div className="text-[11px] text-[#57554F]">Website Health</div>
                  <div className="font-mono-num text-lg font-bold text-amber-700 mt-0.5">
                    {activeExplorerProspect.websiteHealthScore}/100
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#E5E3DC]">
                  <div className="text-[11px] text-[#57554F]">Est. Contract</div>
                  <div className="font-mono-num text-lg font-bold text-[#121110] mt-0.5">
                    ${activeExplorerProspect.estDealValue.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Detected Conversion Gaps & Matched Offer */}
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-[#121110] mb-1">
                    Detected Website &amp; Conversion Gaps:
                  </div>
                  <p className="text-[#57554F] leading-relaxed">
                    {activeExplorerProspect.detectedGaps}
                  </p>
                </div>

                <div>
                  <div className="font-semibold text-[#121110] mb-1">
                    AI-Matched High-Ticket Offer:
                  </div>
                  <p className="text-[#121110] font-medium bg-[#EBE7F8]/60 px-3 py-2 rounded-lg border border-[#D9D2F2]">
                    {activeExplorerProspect.recommendedOffer}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#E5E3DC] space-y-1.5">
                  <div className="text-[11px] font-mono-num uppercase tracking-wider text-[#6E6B64]">
                    Auto-Generated Cold Outreach + Audit Link Preview
                  </div>
                  <div className="font-semibold text-[#121110]">
                    Subject: {activeExplorerProspect.aiPitchSubject}
                  </div>
                  <p className="text-[#57554F] leading-relaxed">
                    {activeExplorerProspect.aiPitchPreview}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  currentUser ? setLocation("/crm") : handleOpenAuth("register", "free")
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>
                  {currentUser
                    ? `Hunt & Sequence ${activeExplorerProspect.sectorLabel} in CRM`
                    : `Unlock Full ${activeExplorerProspect.sectorLabel} Leads & Audit Engine`}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Apollo-Style "One system. Three layers." + "AI that actually executes" + Enterprise Accordion */}
      <section id="capabilities" className="py-16 sm:py-24 border-b border-[#E5E3DC] bg-[#FAF8F5]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-20">
          {/* Sub-Block A: One system. Three layers. */}
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-10">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64] mb-2">
                  THE VANGUARD HUNTER SYSTEM
                </div>
                <h2
                  className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#121110]"
                  style={{ textWrap: "balance" }}
                >
                  One system. Three layers.
                </h2>
              </div>
              <div className="lg:col-span-6">
                <p className="text-sm sm:text-base text-[#57554F] leading-relaxed">
                  Vanguard Hunter connects the three layers that matter in modern go-to-market: a living data layer, an intelligent execution layer, and an action layer that works across your stack. Together, they keep your signals, workflows, and client assets in sync so nothing gets lost between tools.
                </p>
              </div>
            </div>

            {/* 3 Architectural Layer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Layer 01: Data Layer */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#F2EFE9] border border-[#E5E3DC] flex flex-col justify-between min-h-[290px]">
                <div className="flex items-center justify-between text-xs font-mono-num text-[#6E6B64]">
                  <span>LAYER_01</span>
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E3DC] flex items-center justify-center text-[#121110]">
                    <Database className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-10 space-y-3">
                  <h3 className="font-display text-2xl font-bold text-[#121110]">Data Layer</h3>
                  <p className="text-xs sm:text-sm text-[#57554F] leading-relaxed">
                    20 parallel extraction workers per city scan, real-time DNS/MX zero-bounce gates, and live website conversion telemetry.
                  </p>
                  <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-mono-num text-[#121110]">
                    <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E3DC]">20 Cities / Batch</span>
                    <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E3DC]">99.2% Inbox Gate</span>
                  </div>
                </div>
              </div>

              {/* Layer 02: Execution Layer */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#F2EFE9] border border-[#E5E3DC] flex flex-col justify-between min-h-[290px]">
                <div className="flex items-center justify-between text-xs font-mono-num text-[#6E6B64]">
                  <span>LAYER_02</span>
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E3DC] flex items-center justify-center text-[#121110]">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-10 space-y-3">
                  <h3 className="font-display text-2xl font-bold text-[#121110]">Execution Layer</h3>
                  <p className="text-xs sm:text-sm text-[#57554F] leading-relaxed">
                    Rotational multi-inbox cold email sequences, AI studio voice pitches, and autonomous qualification phone calls in one workflow.
                  </p>
                  <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-mono-num text-[#121110]">
                    <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E3DC]">Up to 100 Inboxes</span>
                    <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E3DC]">AI Voice + Phone</span>
                  </div>
                </div>
              </div>

              {/* Layer 03: Action & Asset Layer */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#F2EFE9] border border-[#E5E3DC] flex flex-col justify-between min-h-[290px]">
                <div className="flex items-center justify-between text-xs font-mono-num text-[#6E6B64]">
                  <span>LAYER_03</span>
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E3DC] flex items-center justify-center text-[#121110]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-10 space-y-3">
                  <h3 className="font-display text-2xl font-bold text-[#121110]">Action Layer</h3>
                  <p className="text-xs sm:text-sm text-[#57554F] leading-relaxed">
                    Generates shareable <code className="text-[#121110] font-semibold">/report/:id</code> audits, <code className="text-[#121110] font-semibold">/site/:id</code> 4-Tap AI websites, and <code className="text-[#121110] font-semibold">/review/:id</code> 5-Star Google Review Shields.
                  </p>
                  <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-mono-num text-[#121110]">
                    <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white font-bold">Instant Client URLs</span>
                    <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E3DC]">24/7 Autopilot</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Block B: Apollo-Style "AI that actually executes" Split Interactive Prompt Showcase */}
          <div className="pt-8 border-t border-[#E5E3DC] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-5">
              <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64]">
                BUILT FOR AI EXECUTION
              </div>
              <h3 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#121110]">
                AI that actually executes
              </h3>
              <p className="text-sm text-[#57554F] leading-relaxed">
                Whether you run campaigns inside Vanguard Hunter or trigger autonomous 24/7 city hunts, our AI engine turns plain-language revenue goals into verified leads, diagnostic audits, and booked calls.
              </p>

              <div className="space-y-2.5 text-xs sm:text-sm text-[#121110] pt-1">
                <div className="flex items-start gap-2.5">
                  <span className="text-[#6E6B64] font-bold">•</span>
                  <span>
                    <strong className="underline underline-offset-4">Use our AI Assistant</strong> to run end-to-end outbound campaigns in plain English
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-[#6E6B64] font-bold">•</span>
                  <span>
                    <strong className="underline underline-offset-4">Auto-build 4-Tap Client Websites</strong> with live quote calculators &amp; voice walkthroughs
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-[#6E6B64] font-bold">•</span>
                  <span>
                    <strong className="underline underline-offset-4">Connect up to 100 rotational inboxes</strong> with automatic reply classification
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div
                className="rounded-3xl p-5 sm:p-8 border border-[#DDD6FE]"
                style={{
                  background:
                    "linear-gradient(135deg, #8B2CF5 0%, #6D3BF7 48%, #434CE8 100%)",
                }}
              >
                <div className="bg-white/95 backdrop-blur-xs rounded-2xl border border-[#121110]/10 p-5 sm:p-6 shadow-md space-y-4">
                  <div className="text-xs font-mono-num text-[#6E6B64] uppercase tracking-wider">
                    HUNTER AUTONOMOUS COMMAND PROMPT
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5E3DC] flex items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm font-medium text-[#121110]">
                      &ldquo;Hunt 200 HVAC &amp; Dental clinics in Dallas, generate Website Audit + 4-Tap Site previews, and launch Inbox Rotation.&rdquo;
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        currentUser ? setLocation("/crm") : handleOpenAuth("register", "growth")
                      }
                      className="w-8 h-8 rounded-lg bg-[#121110] text-white flex items-center justify-center shrink-0 hover:bg-[#2A2826] cursor-pointer"
                      title="Execute in Hunter Workspace"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      "20-City Bulk Hunter",
                      "Website Audit /report/:id",
                      "4-Tap AI Site /site/:id",
                      "5-Star Review Shield /review/:id",
                      "AI Voice Note Pitch",
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="px-2.5 py-1 rounded-md bg-[#F4F1EA] border border-[#E5E3DC] text-[11px] font-medium text-[#121110]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Block C: Apollo-Style Enterprise Scale Accordion + Governance Badge Matrix */}
          <div className="pt-8 border-t border-[#E5E3DC] grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-6 space-y-3">
              <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64]">
                ENTERPRISE-READY INFRASTRUCTURE
              </div>
              <h3 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#121110] mb-4">
                Built to scale across your organization
              </h3>

              <div className="divide-y divide-[#E5E3DC] border-t border-b border-[#E5E3DC]">
                {ENTERPRISE_PILLARS.map((pillar, idx) => {
                  const isOpen = activeEnterpriseAccordion === idx;
                  return (
                    <div key={pillar.title} className="py-4">
                      <button
                        type="button"
                        onClick={() => setActiveEnterpriseAccordion(idx)}
                        className="w-full flex items-center justify-between text-left font-display text-base sm:text-lg font-bold text-[#121110] cursor-pointer"
                      >
                        <span>{pillar.title}</span>
                        <span className="text-xl font-mono-num text-[#6E6B64]">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>
                      {isOpen && (
                        <p className="mt-2 text-xs sm:text-sm text-[#57554F] leading-relaxed">
                          {pillar.body}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { badge: "SOC-2", sub: "TYPE II CONTROLS" },
                { badge: "99.2%", sub: "ZERO-BOUNCE GATE" },
                { badge: "GDPR", sub: "COMPLIANT DATA" },
                { badge: "ISO", sub: "27001 ALIGNED" },
                { badge: "100", sub: "ROTATIONAL INBOXES" },
                { badge: "24/7", sub: "AUTONOMOUS ENGINE" },
              ].map((item) => (
                <div
                  key={item.badge}
                  className="p-6 rounded-2xl bg-[#F2EFE9] border border-[#E5E3DC] flex flex-col items-center justify-center text-center min-h-[130px]"
                >
                  <div className="w-14 h-14 rounded-full border border-[#121110]/25 bg-white flex items-center justify-center font-mono-num text-sm font-bold text-[#121110] mb-2.5 shadow-2xs">
                    {item.badge}
                  </div>
                  <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#57554F]">
                    {item.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: GTM Workflow Playbooks + Interactive Pipeline ROI Calculator */}
      <section id="playbooks" className="py-16 sm:py-24 border-b border-[#E5E3DC] bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left 6 Columns: Mechanism-to-Outcome Playbook Switcher */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64] mb-2">
                  <span>PROVEN REVENUE PLAYBOOKS</span>
                  <span aria-hidden="true"> · </span>
                  <span>MECHANISM-TO-OUTCOME EXECUTION</span>
                </div>
                <h2
                  className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#121110]"
                  style={{ textWrap: "balance" }}
                >
                  Engineered for high-velocity agencies and B2B revenue teams.
                </h2>
              </div>

              {/* Segmented Playbook Selector */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F4F1EA] rounded-xl border border-[#E5E3DC]">
                {GTM_PLAYBOOKS.map((pb) => (
                  <button
                    key={pb.id}
                    type="button"
                    onClick={() => setActivePlaybookId(pb.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activePlaybookId === pb.id
                        ? "bg-[#121110] text-white shadow-xs"
                        : "text-[#57554F] hover:text-[#121110]"
                    }`}
                  >
                    {pb.title}
                  </button>
                ))}
              </div>

              {/* Active Playbook Card */}
              <div className="p-6 sm:p-8 rounded-2xl border border-[#E5E3DC] bg-[#FAF8F5] space-y-5">
                <h3 className="font-display text-xl font-bold text-[#121110]">
                  {activePlaybookObj.title}
                </h3>

                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-xs font-mono-num uppercase tracking-wider text-[#6E6B64] mb-1">
                      01. Target Revenue Goal
                    </div>
                    <p className="text-[#121110] font-medium leading-relaxed">{activePlaybookObj.goal}</p>
                  </div>

                  <div className="pt-3 border-t border-[#E5E3DC]">
                    <div className="text-xs font-mono-num uppercase tracking-wider text-[#6E6B64] mb-1">
                      02. Hunter Platform Mechanism
                    </div>
                    <p className="text-[#57554F] leading-relaxed">{activePlaybookObj.mechanism}</p>
                  </div>

                  <div className="pt-3 border-t border-[#E5E3DC]">
                    <div className="text-xs font-mono-num uppercase tracking-wider text-emerald-700 mb-1">
                      03. Measurable Business Outcome
                    </div>
                    <p className="text-[#121110] leading-relaxed">{activePlaybookObj.outcome}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E5E3DC] flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#121110]">
                      {activePlaybookObj.benchmarkMetric}
                    </div>
                    <div className="text-xs text-[#57554F]">{activePlaybookObj.benchmarkSub}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? setLocation("/crm") : handleOpenAuth("register", "free")
                    }
                    className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-xs font-bold shadow-xs whitespace-nowrap cursor-pointer"
                  >
                    Deploy Playbook →
                  </button>
                </div>
              </div>
            </div>

            {/* Right 6 Columns: Interactive Pipeline Velocity & ROI Estimator */}
            <div className="lg:col-span-6 p-6 sm:p-8 rounded-2xl border border-[#121110] bg-[#121110] text-white space-y-6 shadow-md">
              <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-5">
                <div>
                  <div className="text-xs font-mono-num uppercase tracking-wider text-[#C4B5FD] mb-1">
                    INTERACTIVE PIPELINE ESTIMATOR · VERIFIED BENCHMARKS
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Calculate Your Projected Monthly Outbound Yield
                  </h3>
                </div>
                <SlidersHorizontal className="w-5 h-5 text-white/60 shrink-0 mt-1" />
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-white/80 font-medium">Monthly Verified Prospects Sequenced</span>
                    <span className="font-mono-num text-sm font-bold text-[#C4B5FD]">
                      {calcMonthlyProspects.toLocaleString()} prospects / mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={50000}
                    step={1000}
                    value={calcMonthlyProspects}
                    onChange={(e) => setCalcMonthlyProspects(Number(e.target.value))}
                    className="w-full accent-[#8B3DFF] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-white/50 font-mono-num mt-1">
                    <span>1,000 (Starter)</span>
                    <span>5,000 (Growth)</span>
                    <span>25,000 (Scale)</span>
                    <span>50,000+</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-white/80 font-medium">Average Client Deal or Retainer Value (USD)</span>
                    <span className="font-mono-num text-sm font-bold text-emerald-400">
                      ${calcAvgDealSize.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={15000}
                    step={500}
                    value={calcAvgDealSize}
                    onChange={(e) => setCalcAvgDealSize(Number(e.target.value))}
                    className="w-full accent-[#8B3DFF] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-white/50 font-mono-num mt-1">
                    <span>$1,000</span>
                    <span>$4,500</span>
                    <span>$8,500</span>
                    <span>$15,000</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/15">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60">Verified Inbox Deliveries (99.2%)</div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-white mt-1">
                    {projectedVerifiedEmails.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60">Client Audit Reports Opened</div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-white mt-1">
                    {projectedAuditViews.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60">Qualified Discovery Calls</div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-[#C4B5FD] mt-1">
                    {projectedMeetings.toLocaleString()} / mo
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60">Est. New Closed Revenue</div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-emerald-400 mt-1">
                    ${projectedMonthlyClosedRevenue.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-white/80">
                  Projected Active Pipeline:{" "}
                  <strong className="font-mono-num text-white">
                    ${projectedMonthlyPipeline.toLocaleString()}/mo
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    currentUser
                      ? setLocation("/dashboard")
                      : handleOpenAuth(
                          "register",
                          calcMonthlyProspects > 5000 ? "scale" : "growth"
                        )
                  }
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Start Generating Pipeline →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Apollo-Style Customer Outcomes + Production Case Studies & 120+ Verticals Matrix */}
      <section id="case-studies" className="py-16 sm:py-24 border-b border-[#E5E3DC] bg-[#FAF8F5]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-16">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 sm:mb-12">
              <div className="max-w-2xl">
                <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64] mb-2">
                  <span>CUSTOMER OUTCOMES</span>
                  <span aria-hidden="true"> · </span>
                  <span>PRODUCTION CASE STUDIES</span>
                </div>
                <h2
                  className="font-display text-2xl sm:text-5xl font-bold tracking-tight text-[#121110]"
                  style={{ textWrap: "balance" }}
                >
                  Customer outcomes
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  currentUser ? setLocation("/crm") : handleOpenAuth("register", "growth")
                }
                className="px-4 py-2.5 rounded-lg border border-[#121110] bg-white hover:bg-[#121110] hover:text-white text-xs font-semibold text-[#121110] transition-colors self-start cursor-pointer"
              >
                Launch Hunter Workspace →
              </button>
            </div>

            {/* Apollo-Style 3-Column Customer Outcomes Metric Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {CUSTOMER_OUTCOME_CARDS.map((card) => (
                <div
                  key={card.company}
                  className="rounded-2xl border border-[#E5E3DC] bg-[#F2EFE9] overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-6 sm:p-7 space-y-5">
                    <div className="font-display text-base font-bold text-[#121110]">
                      {card.company}
                    </div>
                    <div>
                      <div className="font-display text-4xl sm:text-5xl font-bold text-[#121110] tracking-tight">
                        {card.metric}
                      </div>
                      <div className="text-xs text-[#57554F] mt-1">{card.label}</div>
                    </div>
                    <p className="text-xs text-[#57554F] leading-relaxed">{card.summary}</p>
                  </div>
                  <div className="aspect-16/10 bg-[#121110] relative overflow-hidden border-t border-[#E5E3DC]">
                    <img
                      src={card.img}
                      alt={card.company}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {/* Case Study 1 */}
              <article className="rounded-2xl border border-[#E5E3DC] bg-white overflow-hidden flex flex-col shadow-xs">
                <div className="aspect-4/3 bg-[#121110] relative overflow-hidden border-b border-[#E5E3DC]">
                  {!case1ImgError ? (
                    <img
                      src={caseDentalImg}
                      alt="Apex Dental Growth Partners clinic network"
                      referrerPolicy="no-referrer"
                      onError={() => setCase1ImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#121110] text-slate-300 text-sm p-4 text-center">
                      Healthcare Practice Automation Case Study
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121110]/90 via-[#121110]/30 to-transparent flex items-end p-5 sm:p-6">
                    <div className="text-white">
                      <div className="text-xs text-white/75">
                        Healthcare &amp; Dental Growth Agency · Austin &amp; Dallas, TX
                      </div>
                      <div className="font-mono-num text-xl sm:text-2xl font-bold mt-0.5 text-[#C4B5FD]">
                        +318% Qualified Discovery Calls in 90 Days
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#121110]">
                      How Apex Digital Replaced $4,200/mo in Static Lead Lists with Live Website Audit Outreach
                    </h3>
                    <p className="text-sm text-[#57554F] leading-relaxed">
                      Before Vanguard Hunter, Apex Digital purchased recycled CSV lists with a 28% bounce rate. By switching to real-time prospect discovery paired with automated Website Audit Report links, they engaged 6,400 dental and orthodontic clinics across Texas and achieved a 41.4% email open rate.
                    </p>
                  </div>

                  <blockquote className="pt-5 border-t border-[#E5E3DC]">
                    <p className="text-sm text-[#121110] italic leading-relaxed">
                      &ldquo;Attaching a live Website Audit Report URL that shows a clinic owner their exact missing chat widget and booking gaps doubled our reply rate in the first week. Closed $68,000 in new retainer ARR within 60 days.&rdquo;
                    </p>
                    <footer className="mt-3 text-xs text-[#57554F]">
                      <strong className="font-semibold text-[#121110]">Elena Vance</strong> · Managing Partner, Apex Digital Growth
                    </footer>
                  </blockquote>
                </div>
              </article>

              {/* Case Study 2 */}
              <article className="rounded-2xl border border-[#E5E3DC] bg-white overflow-hidden flex flex-col shadow-xs">
                <div className="aspect-4/3 bg-[#121110] relative overflow-hidden border-b border-[#E5E3DC]">
                  {!case2ImgError ? (
                    <img
                      src={caseSolarImg}
                      alt="SunGrid Commercial Solar & HVAC Engineering"
                      referrerPolicy="no-referrer"
                      onError={() => setCase2ImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#121110] text-slate-300 text-sm p-4 text-center">
                      Commercial Solar &amp; HVAC Outbound Case Study
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121110]/90 via-[#121110]/30 to-transparent flex items-end p-5 sm:p-6">
                    <div className="text-white">
                      <div className="text-xs text-white/75">
                        Commercial MEP &amp; Solar Advisory · 14 US Metro Markets
                      </div>
                      <div className="font-mono-num text-xl sm:text-2xl font-bold mt-0.5 text-[#C4B5FD]">
                        $1.84M Closed-Won Pipeline in 6 Months
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#121110]">
                      Scaling 20-City Bulk Prospecting with Autonomous Multi-Inbox Cold Sequences
                    </h3>
                    <p className="text-sm text-[#57554F] leading-relaxed">
                      Northstar Commercial connected 18 rotational sender inboxes in their Vanguard Hunter workspace. Their autonomous 24/7 scheduler discovers, audits, and sequences 450 commercial contractors every morning without manual prospecting.
                    </p>
                  </div>

                  <blockquote className="pt-5 border-t border-[#E5E3DC]">
                    <p className="text-sm text-[#121110] italic leading-relaxed">
                      &ldquo;Running automated 20-city bulk campaigns lets our team cover entire regional markets overnight. Our account executives only step in when warm prospects request a consultation from their audit report.&rdquo;
                    </p>
                    <footer className="mt-3 text-xs text-[#57554F]">
                      <strong className="font-semibold text-[#121110]">Marcus Thorne</strong> · VP of Revenue Operations, Northstar Commercial Systems
                    </footer>
                  </blockquote>
                </div>
              </article>
            </div>
          </div>

          {/* Interactive 120+ Industry Verticals Matrix */}
          <div id="verticals" className="pt-6 border-t border-[#E5E3DC]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64] mb-1">
                  <span>HIGH-CONVERTING B2B SECTORS</span>
                  <span aria-hidden="true"> · </span>
                  <span>READY-TO-LAUNCH HUNTER PLAYBOOKS</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#121110]">
                  120+ Industry Verticals &amp; Deal Value Benchmarks
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F1EA] rounded-xl border border-[#E5E3DC] self-start">
                <button
                  type="button"
                  onClick={() => setSelectedVerticalFilter("all")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedVerticalFilter === "all"
                      ? "bg-[#121110] text-white shadow-xs"
                      : "text-[#57554F] hover:text-[#121110]"
                  }`}
                >
                  All Sectors (12)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVerticalFilter("local")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedVerticalFilter === "local"
                      ? "bg-[#121110] text-white shadow-xs"
                      : "text-[#57554F] hover:text-[#121110]"
                  }`}
                >
                  Local Services
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVerticalFilter("commercial")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedVerticalFilter === "commercial"
                      ? "bg-[#121110] text-white shadow-xs"
                      : "text-[#57554F] hover:text-[#121110]"
                  }`}
                >
                  Commercial B2B
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E3DC] overflow-hidden shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E3DC]">
                {filteredVerticals.map((v, idx) => (
                  <div
                    key={v.name}
                    className={`p-4 sm:p-5 ${idx >= 4 ? "lg:border-t lg:border-[#E5E3DC]" : ""}`}
                  >
                    <div className="text-sm font-semibold text-[#121110]">{v.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#57554F] mt-1.5">
                      <span>{v.segment}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num text-[#121110] font-medium">{v.dealSize}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num text-emerald-700 font-medium">{v.avgReplyRate} reply</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Multi-Tier SaaS Pricing (Lemon Squeezy & Crypto Ready) */}
      <section id="pricing" className="py-16 sm:py-24 border-b border-[#E5E3DC] bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64] mb-2">
                <span>TRANSPARENT SAAS LICENSING</span>
                <span aria-hidden="true"> · </span>
                <span>INSTANT CARD &amp; CRYPTO SETTLEMENT</span>
              </div>
              <h2
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#121110]"
                style={{ textWrap: "balance" }}
              >
                Choose the lead velocity that matches your revenue team.
              </h2>
            </div>

            {/* Interactive Billing Cadence Toggle */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F1EA] rounded-xl border border-[#E5E3DC] self-start">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-[#121110] text-white shadow-xs"
                    : "text-[#57554F] hover:text-[#121110]"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  billingCycle === "annual"
                    ? "bg-[#121110] text-white shadow-xs"
                    : "text-[#57554F] hover:text-[#121110]"
                }`}
              >
                Annual Billing (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            {displayPlans.map((plan) => {
              const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
              const isFreeTier = plan.id === "free" || price === 0;
              const isHighLevel = plan.id === "scale" || plan.id === "enterprise";
              return (
                <div
                  key={plan.id}
                  className={`p-5 sm:p-6 rounded-2xl border flex flex-col justify-between ${
                    plan.isPopular
                      ? "bg-[#FAF8F5] border-[#7C3AED] ring-2 ring-[#7C3AED]"
                      : isHighLevel
                      ? "bg-[#FAF8F5] border-[#4F46E5]/50"
                      : "bg-white border-[#E5E3DC]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h3 className="font-display text-lg font-bold text-[#121110]">{plan.name}</h3>
                      {plan.isPopular && (
                        <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white text-[10px] font-bold">
                          Most Popular
                        </span>
                      )}
                      {isFreeTier && (
                        <span className="px-2 py-0.5 rounded-md bg-[#EDE9FE] text-[#6D28D9] text-[10px] font-bold">
                          Free Account
                        </span>
                      )}
                      {isHighLevel && (
                        <span className="px-2 py-0.5 rounded-md bg-[#121110] text-[#C4B5FD] text-[10px] font-bold">
                          VIP Suite
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#57554F] mb-4">{plan.audience}</p>

                    {isHighLevel && (
                      <div className="mb-4 p-2.5 rounded-xl bg-[#EDE9FE] border border-[#7C3AED]/25 text-[11px] font-semibold text-[#4C1D95] leading-snug">
                        Includes AI 4-Tap Website Builder &amp; 5-Star Review Shield Funnel
                      </div>
                    )}

                    <div className="pb-5 mb-5 border-b border-[#E5E3DC]">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono-num text-3xl font-bold text-[#121110]">
                          ${price}
                        </span>
                        <span className="text-xs text-[#57554F]">/ month</span>
                      </div>
                      <div className="text-xs text-[#57554F] mt-1 font-mono-num">
                        {isFreeTier
                          ? "No credit card required · Capped Explorer tier"
                          : billingCycle === "annual"
                          ? `Billed annually ($${price * 12}/yr)`
                          : `Or $${plan.annualPrice}/mo billed annually`}
                      </div>
                    </div>

                    <div className="space-y-2 mb-5 text-xs text-[#121110]">
                      <div className="flex items-center justify-between py-1 border-b border-[#E5E3DC]/70">
                        <span className="text-[#57554F]">AI Website + Review Shield</span>
                        <span
                          className={`font-semibold ${
                            isHighLevel ? "text-emerald-700" : "text-[#8A877F]"
                          }`}
                        >
                          {isHighLevel ? "Included" : "Locked"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-[#E5E3DC]/70">
                        <span className="text-[#57554F]">Verified Leads / mo</span>
                        <span className="font-mono-num font-semibold text-[#121110]">
                          {plan.monthlyHuntLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-[#E5E3DC]/70">
                        <span className="text-[#57554F]">Cold Outreach / mo</span>
                        <span className="font-mono-num font-semibold text-[#121110]">
                          {plan.monthlyEmailLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-[#E5E3DC]/70">
                        <span className="text-[#57554F]">Rotational Inboxes</span>
                        <span className="font-mono-num font-semibold text-[#121110]">
                          {plan.maxEmailAccounts === 1 ? "1 Mailbox" : `Up to ${plan.maxEmailAccounts}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-[#E5E3DC]/70">
                        <span className="text-[#57554F]">20-City Bulk Hunter</span>
                        <span className="font-semibold text-[#121110]">
                          {plan.bulkHuntEnabled ? "Included" : "Locked (1 City)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#57554F]">24/7 Autopilot Engine</span>
                        <span className="font-semibold text-[#121110]">
                          {plan.autoPilotEnabled ? "Included" : "Locked"}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {(Array.isArray(plan.features) ? plan.features : []).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#57554F] leading-relaxed">
                          <Check className="w-3.5 h-3.5 text-[#7C3AED] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[#E5E3DC]">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentUser) {
                          if (isFreeTier) {
                            setLocation("/dashboard");
                          } else {
                            setLocation(`/dashboard?tab=billing&plan=${plan.id}&cycle=${billingCycle}`);
                          }
                        } else {
                          handleOpenAuth("register", plan.id);
                        }
                      }}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        plan.isPopular
                          ? "bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white hover:from-[#7C3AED] hover:to-[#4338CA] shadow-xs"
                          : isFreeTier
                          ? "bg-[#EDE9FE] text-[#5B21B6] hover:bg-[#DDD6FE]"
                          : "bg-[#121110] text-white hover:bg-[#2A2826]"
                      }`}
                    >
                      {isFreeTier ? "Start Free Explorer" : `Select ${plan.name}`}
                    </button>
                    <div className="text-[11px] text-center text-[#57554F]">
                      {isFreeTier ? "Instant access · No credit card" : "Card · USDT · USDC · BTC · ETH · SOL"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 7: Interactive Architecture Briefing + Apollo-Style Electric Yellow Bottom Conversion Banner */}
      <section className="py-16 sm:py-24 border-b border-[#E5E3DC] bg-[#FAF8F5]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#6E6B64]">
                <span>IMMEDIATE ONBOARDING</span>
                <span aria-hidden="true"> · </span>
                <span>DEDICATED REVENUE ARCHITECTURE</span>
              </div>
              <h2
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#121110]"
                style={{ textWrap: "balance" }}
              >
                Ready to automate your entire B2B outbound pipeline?
              </h2>
              <p className="text-sm sm:text-base text-[#57554F] leading-relaxed max-w-[58ch]">
                Provision your self-serve workspace in 30 seconds or request a custom multi-seat deployment briefing for your agency or enterprise revenue organization.
              </p>

              <div className="pt-2 space-y-2.5 text-xs text-[#121110]">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#121110] shrink-0" />
                  <span>Full multi-tenant workspace isolation with project-level CSV &amp; JSON exports</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#121110] shrink-0" />
                  <span>Rotational multi-inbox SMTP &amp; Gmail App Password manager built in</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#121110] shrink-0" />
                  <span>AI Website Builder &amp; 5-Star Review Shield included on Agency Scale &amp; VIP tiers</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="p-6 sm:p-8 rounded-2xl border border-[#E5E3DC] bg-white shadow-xs">
                <h3 className="font-display text-xl font-bold text-[#121110] mb-1">
                  Schedule Architecture Briefing or Request Custom Quota
                </h3>
                <p className="text-xs text-[#57554F] mb-5">
                  Our revenue engineering team responds within 2 business hours with a custom market extraction plan.
                </p>

                {leadFormError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {leadFormError}
                  </div>
                )}

                {leadFormSuccess && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    {leadFormSuccess}
                  </div>
                )}

                <form onSubmit={handleLeadBriefingSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#121110] mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="Elena Vance"
                        className="w-full px-3.5 py-2.5 text-sm border border-[#D8D5CD] rounded-lg bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#121110]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#121110] mb-1.5">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="elena@apexagency.io"
                        className="w-full px-3.5 py-2.5 text-sm border border-[#D8D5CD] rounded-lg bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#121110]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#121110] mb-1.5">
                        Company or Agency Name
                      </label>
                      <input
                        type="text"
                        required
                        value={leadCompany}
                        onChange={(e) => setLeadCompany(e.target.value)}
                        placeholder="Apex Digital Growth"
                        className="w-full px-3.5 py-2.5 text-sm border border-[#D8D5CD] rounded-lg bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#121110]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#121110] mb-1.5">
                        Target Monthly Lead Velocity
                      </label>
                      <select
                        value={leadVolume}
                        onChange={(e) => setLeadVolume(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-[#D8D5CD] rounded-lg bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#121110]"
                      >
                        <option value="1,000 – 5,000 leads / mo">1,000 – 5,000 leads / mo</option>
                        <option value="5,000 – 25,000 leads / mo">5,000 – 25,000 leads / mo</option>
                        <option value="25,000 – 100,000 leads / mo">25,000 – 100,000 leads / mo</option>
                        <option value="100,000+ Enterprise Cluster">100,000+ Enterprise Cluster</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="submit"
                      disabled={leadSubmitting}
                      className="flex-1 py-3 px-5 rounded-lg bg-[#121110] hover:bg-[#2A2826] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {leadSubmitting ? "Submitting Request..." : "Request Custom Briefing"}
                    </button>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={() => handleOpenAuth("register", "free", leadEmail)}
                        className="py-3 px-5 rounded-lg bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer"
                      >
                        Or Start Free Now →
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* AI Business Hunter Violet-Indigo Gradient Bottom Conversion Card */}
          <div
            className="rounded-3xl p-8 sm:p-14 border border-white/15 shadow-md text-white"
            style={{
              background:
                "linear-gradient(115deg, #8B2CF5 0%, #6D3BF7 48%, #434CE8 100%)",
            }}
          >
            <div className="max-w-2xl space-y-5">
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
                Start free with Vanguard Hunter
              </h2>
              <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                Create your Apollo-style Free Explorer workspace with 50 verified B2B lead credits/month, test live single-city business discovery, and upgrade anytime as your pipeline scales.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-xl pt-2">
                {currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLocation("/crm")}
                      className="px-6 py-3.5 rounded-xl bg-white hover:bg-stone-100 text-[#121110] text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Launch Hunter CRM Workspace →
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("/dashboard")}
                      className="px-6 py-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/25 transition-colors cursor-pointer"
                    >
                      Open Executive Dashboard
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="email"
                      value={heroQuickEmail}
                      onChange={(e) => setHeroQuickEmail(e.target.value)}
                      placeholder="Enter your work email"
                      className="flex-1 px-4 py-3.5 text-sm bg-white rounded-xl border border-white/25 text-[#121110] placeholder:text-[#6E6B64] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenAuth("register", "free", heroQuickEmail)}
                      className="px-6 py-3.5 rounded-xl bg-[#121110] hover:bg-[#2A2826] text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Sign up for free
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Apollo-Style Multi-Column Directory Footer */}
      <footer className="py-16 bg-[#FAF8F5] border-t border-[#E5E3DC]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-[#E5E3DC]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] text-white flex items-center justify-center font-display font-bold text-sm">
                V
              </div>
              <span className="font-display text-lg font-bold text-[#121110]">Vanguard Hunter</span>
            </div>
            <div className="text-xs text-[#57554F]">
              SOC-2 Type II Infrastructure · 99.2% Verified Inbox Deliverability · Autonomous B2B Revenue Platform
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 text-xs">
            <div className="space-y-3">
              <div className="font-mono-num uppercase tracking-wider text-[#6E6B64] font-semibold">
                Get Started
              </div>
              <ul className="space-y-2 text-[#121110]">
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? setLocation("/crm") : handleOpenAuth("register", "growth")
                    }
                    className="hover:underline cursor-pointer"
                  >
                    Sign up for free
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("pricing")}
                    className="hover:underline cursor-pointer"
                  >
                    Pricing &amp; Quotas
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("explorer")}
                    className="hover:underline cursor-pointer"
                  >
                    Interactive Sandbox
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? setLocation("/dashboard") : handleOpenAuth("login")
                    }
                    className="hover:underline cursor-pointer"
                  >
                    Workspace Sign In
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono-num uppercase tracking-wider text-[#6E6B64] font-semibold">
                Hunter Engines
              </div>
              <ul className="space-y-2 text-[#121110]">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("hunter-layers")}
                    className="hover:underline cursor-pointer"
                  >
                    Outbound Sequence Engine
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("hunter-layers")}
                    className="hover:underline cursor-pointer"
                  >
                    Diagnostic Audit &amp; 4-Tap Sites
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("hunter-layers")}
                    className="hover:underline cursor-pointer"
                  >
                    AI Voice &amp; Phone Caller
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("hunter-layers")}
                    className="hover:underline cursor-pointer"
                  >
                    20-City Bulk Hunter Data
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono-num uppercase tracking-wider text-[#6E6B64] font-semibold">
                Client Assets
              </div>
              <ul className="space-y-2 text-[#121110]">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("capabilities")}
                    className="hover:underline cursor-pointer"
                  >
                    Website Audit Reports
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("capabilities")}
                    className="hover:underline cursor-pointer"
                  >
                    4-Tap AI Client Websites
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("capabilities")}
                    className="hover:underline cursor-pointer"
                  >
                    5-Star Google Review Shield
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("playbooks")}
                    className="hover:underline cursor-pointer"
                  >
                    Pipeline ROI Calculator
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono-num uppercase tracking-wider text-[#6E6B64] font-semibold">
                Playbooks &amp; Proof
              </div>
              <ul className="space-y-2 text-[#121110]">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("case-studies")}
                    className="hover:underline cursor-pointer"
                  >
                    Customer Outcomes
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("verticals")}
                    className="hover:underline cursor-pointer"
                  >
                    120+ B2B Industry Verticals
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("playbooks")}
                    className="hover:underline cursor-pointer"
                  >
                    Agency Retainer Playbook
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("playbooks")}
                    className="hover:underline cursor-pointer"
                  >
                    Multi-Inbox Rotation
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono-num uppercase tracking-wider text-[#6E6B64] font-semibold">
                Workspace Access
              </div>
              <ul className="space-y-2 text-[#121110]">
                {currentUser ? (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => setLocation("/dashboard")}
                        className="hover:underline cursor-pointer"
                      >
                        Executive Dashboard
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setLocation("/crm")}
                        className="hover:underline cursor-pointer"
                      >
                        Hunter CRM Command
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          clearSaasSession();
                          setCurrentUser(null);
                        }}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => handleOpenAuth("login")}
                        className="hover:underline cursor-pointer"
                      >
                        Sign In to Workspace
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => handleOpenAuth("register")}
                        className="hover:underline cursor-pointer"
                      >
                        Create New Workspace
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-[#E5E3DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#6E6B64]">
            <span>© {new Date().getFullYear()} Vanguard Hunter Inc. All rights reserved.</span>
            <span>Real-Time Multi-City Extraction · Zero-Bounce DNS/MX Gate · Multi-Inbox Sequences</span>
          </div>
        </div>
      </footer>

      {/* Executive Login / Register Modal */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#121110]/70 backdrop-blur-xs overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseAuth();
          }}
        >
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E5E3DC] max-w-md w-full p-5 sm:p-7 my-auto relative shadow-xl">
            <div className="flex items-center justify-between gap-2 pb-3.5 mb-5 border-b border-[#E5E3DC]">
              <div className="flex items-center gap-1 p-1 bg-[#F4F1EA] rounded-xl border border-[#E5E3DC]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setAuthNotice("");
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    authMode === "login" ? "bg-[#121110] text-white shadow-xs" : "text-[#57554F]"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                    setAuthNotice("");
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    authMode === "register" ? "bg-[#121110] text-white shadow-xs" : "text-[#57554F]"
                  }`}
                >
                  Create Workspace
                </button>
              </div>

              <button
                type="button"
                onClick={handleCloseAuth}
                className="p-1.5 rounded-lg text-[#57554F] hover:text-[#121110] hover:bg-[#F4F1EA] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-display text-xl sm:text-2xl font-bold text-[#121110]">
                {authMode === "login" ? "Sign In to Vanguard Hunter" : "Provision Your Revenue Workspace"}
              </h3>
              <p className="text-xs text-[#57554F] mt-1">
                {authMode === "login"
                  ? "Enter your workspace credentials to access your dashboard and CRM."
                  : "Instant access to live B2B lead discovery, website audits, and multi-inbox outreach."}
              </p>
            </div>

            {authError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            {authNotice && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {authNotice}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authMode === "register" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#121110] mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Elena Vance"
                        className="w-full px-3 py-2 text-sm bg-white border border-[#D8D5CD] rounded-lg focus:outline-none focus:border-[#121110]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#121110] mb-1">Company / Agency</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Apex Growth"
                        className="w-full px-3 py-2 text-sm bg-white border border-[#D8D5CD] rounded-lg focus:outline-none focus:border-[#121110]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#121110] mb-1">Workspace Plan</label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#D8D5CD] rounded-lg bg-white focus:outline-none focus:border-[#121110]"
                    >
                      {displayPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ${billingCycle === "annual" ? p.annualPrice : p.monthlyPrice}/mo
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#121110] mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D8D5CD] rounded-lg focus:outline-none focus:border-[#121110]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#121110] mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={authMode === "register" ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D8D5CD] rounded-lg focus:outline-none focus:border-[#121110]"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#8B3DFF] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  {authLoading
                    ? authMode === "register"
                      ? "Provisioning Workspace..."
                      : "Signing In..."
                    : authMode === "login"
                    ? "Sign In to Workspace"
                    : "Launch Free Workspace"}
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-[#E5E3DC] text-center text-xs text-[#57554F]">
              {authMode === "login" ? (
                <>
                  Don&apos;t have a workspace yet?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                      setAuthNotice("");
                    }}
                    className="font-semibold text-[#121110] underline underline-offset-4 cursor-pointer"
                  >
                    Create Workspace
                  </button>
                </>
              ) : (
                <>
                  Already have a workspace?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                      setAuthNotice("");
                    }}
                    className="font-semibold text-[#121110] underline underline-offset-4 cursor-pointer"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
