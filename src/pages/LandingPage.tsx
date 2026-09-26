import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  SaasPlan,
  SaasUser,
  getCachedSaasUser,
  setSaasSession,
  saasFetch,
  isUserAdmin,
} from "@/lib/saas-auth";
import heroImg from "@/assets/images/hero_b2b_intelligence_1790378408952.jpg";
import caseDentalImg from "@/assets/images/case_study_dental_network_1790378421158.jpg";
import caseSolarImg from "@/assets/images/case_study_commercial_solar_1790378432723.jpg";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Menu,
  Shield,
  X,
} from "lucide-react";

const TARGET_VERTICALS = [
  { name: "Dental & Orthodontic Clinics", segment: "Local Services", dealSize: "$3,500 – $8,500" },
  { name: "Commercial Solar & MEP", segment: "Commercial B2B", dealSize: "$12,000 – $45,000" },
  { name: "MedSpas & Aesthetic Centers", segment: "Local Services", dealSize: "$4,000 – $9,500" },
  { name: "HVAC & Roofing Contractors", segment: "Local Services", dealSize: "$5,000 – $15,000" },
  { name: "Personal Injury & Family Law", segment: "Commercial B2B", dealSize: "$6,500 – $18,000" },
  { name: "Real Estate Brokerages", segment: "Commercial B2B", dealSize: "$4,500 – $12,000" },
  { name: "Wealth & CPA Advisory Firms", segment: "Commercial B2B", dealSize: "$5,500 – $16,000" },
  { name: "Multi-Location Fitness & Wellness", segment: "Local Services", dealSize: "$3,000 – $7,500" },
  { name: "Logistics & Fleet Operations", segment: "Commercial B2B", dealSize: "$8,000 – $24,000" },
  { name: "Home Remodeling & Restoration", segment: "Local Services", dealSize: "$4,500 – $11,000" },
  { name: "Private Medical & Vet Practices", segment: "Local Services", dealSize: "$3,800 – $9,000" },
  { name: "B2B Agencies & Consultancies", segment: "Commercial B2B", dealSize: "$7,500 – $25,000" },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [currentUser, setCurrentUser] = useState<SaasUser | null>(getCachedSaasUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("growth");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Image resilience state
  const [heroImgError, setHeroImgError] = useState(false);
  const [case1ImgError, setCase1ImgError] = useState(false);
  const [case2ImgError, setCase2ImgError] = useState(false);

  // Interactive vertical filter state
  const [selectedVerticalFilter, setSelectedVerticalFilter] = useState<"all" | "local" | "commercial">("all");

  useEffect(() => {
    fetch("/api/saas/plans")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.plans)) setPlans(d.plans);
      })
      .catch(() => {});

    if (localStorage.getItem("ds_api_token")) {
      saasFetch<{ user: SaasUser }>("/api/saas/auth/me")
        .then((d) => {
          if (d.user) {
            setCurrentUser(d.user);
            localStorage.setItem("vh_saas_user", JSON.stringify(d.user));
          }
        })
        .catch(() => {});
    }
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

  const handleOpenAuth = (mode: "login" | "register", planId = "growth") => {
    setAuthMode(mode);
    setSelectedPlanId(planId);
    setAuthError("");
    setMobileMenuOpen(false);
    setAuthModalOpen(true);
    try {
      window.history.pushState({ modal: "auth" }, "");
    } catch {}
  };

  const handleCloseAuth = () => {
    setAuthModalOpen(false);
    setAuthError("");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/saas/auth/login" : "/api/saas/auth/register";
      const payload =
        authMode === "login"
          ? { email, password }
          : { fullName, companyName, email, password, planId: selectedPlanId, billingCycle };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      setSaasSession(data.token, data.user);
      setCurrentUser(data.user);
      setAuthModalOpen(false);
      setLocation(isUserAdmin(data.user) ? "/admin" : "/dashboard");
    } catch (err: any) {
      setAuthError(err.message || "Unable to authenticate");
    } finally {
      setAuthLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const filteredVerticals = TARGET_VERTICALS.filter((v) => {
    if (selectedVerticalFilter === "all") return true;
    if (selectedVerticalFilter === "local") return v.segment === "Local Services";
    return v.segment === "Commercial B2B";
  });

  const ownerIsLoggedIn = isUserAdmin(currentUser);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#FAF9F6] text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Strict 3-Zone Top Bar Contract with Mobile Drawer */}
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-slate-200 w-full">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="font-display text-base sm:text-xl font-bold tracking-tight text-slate-950 whitespace-nowrap text-left cursor-pointer"
          >
            Vanguard Hunter
          </button>

          {/* Zone 2: Clean text navigation links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection("capabilities")}
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("verticals")}
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Markets & Verticals
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("case-studies")}
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Case Studies
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("pricing")}
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => setLocation("/crm")}
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
            >
              Hunter CRM
            </button>
          </nav>

          {/* Zone 3: Primary actions + Mobile Menu button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => setLocation("/dashboard")}
                  className="px-2.5 sm:px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Dashboard
                </button>
                {ownerIsLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => setLocation("/admin")}
                    className="px-3 sm:px-4 py-2 text-xs font-semibold text-amber-300 bg-slate-950 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Console</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLocation("/crm")}
                    className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Launch CRM
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("login")}
                  className="px-2.5 sm:px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("register", "growth")}
                  className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Start Free
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
              <button
                type="button"
                onClick={() => scrollToSection("capabilities")}
                className="px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
              >
                01. Capabilities
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("verticals")}
                className="px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
              >
                02. Target Markets
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("case-studies")}
                className="px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
              >
                03. Case Studies
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("pricing")}
                className="px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
              >
                04. SaaS Pricing
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLocation("/dashboard");
                }}
                className="px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-center cursor-pointer"
              >
                User Dashboard →
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLocation("/crm");
                }}
                className="px-3 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg text-center cursor-pointer"
              >
                Launch Hunter CRM →
              </button>
              {ownerIsLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLocation("/admin");
                  }}
                  className="sm:col-span-2 px-3 py-2.5 text-xs font-semibold text-amber-300 bg-slate-950 hover:bg-slate-800 rounded-lg text-center cursor-pointer"
                >
                  Owner Admin Console →
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Section 1: Proposition Hero */}
      <section className="pt-10 sm:pt-16 pb-14 sm:pb-20 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-5 sm:space-y-6 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                <span>Multi-Tenant B2B Revenue Infrastructure</span>
                <span aria-hidden="true">·</span>
                <span>Global Market Coverage</span>
                <span aria-hidden="true">·</span>
                <span>Verified Deliverability</span>
              </div>

              <h1
                className="font-display text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-slate-950 leading-[1.1] break-words"
                style={{ textWrap: "balance" }}
              >
                Autonomous B2B Lead Discovery and Cold Outreach Engine.
              </h1>

              <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-[62ch]">
                We power high-yield outbound pipelines for agencies and B2B revenue teams. Discover high-intent businesses in any city worldwide, generate interactive client-facing website audit reports, and dispatch multi-account cold outreach on autopilot.
              </p>

              <div className="pt-1 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenAuth("register", "growth")}
                  className="px-5 py-3.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Provision Agency Workspace</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setLocation("/dashboard")}
                  className="px-5 py-3.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors text-center cursor-pointer"
                >
                  Explore Live User Dashboard
                </button>
              </div>

              <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-3 sm:gap-6">
                <div>
                  <div className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-950">120+</div>
                  <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Target B2B Verticals</div>
                </div>
                <div>
                  <div className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-950">99.2%</div>
                  <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Inbox Deliverability Rate</div>
                </div>
                <div>
                  <div className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-950">24/7</div>
                  <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Autonomous Pipeline Execution</div>
                </div>
              </div>
            </div>

            {/* Dominant 16:9 Focal Visual Carrier */}
            <div className="lg:col-span-6 min-w-0">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                <div className="relative aspect-video overflow-hidden">
                  {!heroImgError ? (
                    <img
                      src={heroImg}
                      alt="Vanguard Hunter Multi-Tenant B2B Intelligence Command Center"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                      <Globe className="w-10 h-10 text-blue-400 mb-3" />
                      <span className="text-sm font-medium text-white">Vanguard Hunter Global Lead Discovery Grid</span>
                    </div>
                  )}
                  <div className="hidden sm:flex absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent flex-col justify-end p-6">
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15 text-white">
                      <div>
                        <div className="text-xs text-slate-300">Discovery Engine</div>
                        <div className="font-mono-num text-xs lg:text-sm font-semibold mt-0.5">
                          Multi-City Parallel Discovery
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-300">Conversion Asset</div>
                        <div className="font-mono-num text-xs lg:text-sm font-semibold mt-0.5">
                          Live Website Diagnostic Audits
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-300">Billing Settlement</div>
                        <div className="font-mono-num text-xs lg:text-sm font-semibold mt-0.5">
                          Card · USDT · BTC · SOL
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile-friendly caption bar below image on <sm screens */}
                <div className="sm:hidden p-4 bg-slate-950 text-white border-t border-slate-800 grid grid-cols-1 gap-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Discovery:</span>
                    <span className="font-mono-num font-semibold text-right">Multi-City Parallel Engine</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Deliverability:</span>
                    <span className="font-mono-num font-semibold text-emerald-400">99.2% Verified Inbox Rate</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Billing:</span>
                    <span className="font-mono-num font-semibold">Card · USDT · BTC · SOL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Core Capabilities Asymmetric Bento-Grid */}
      <section id="capabilities" className="py-14 sm:py-20 border-b border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10 sm:mb-12">
            <div className="text-xs font-medium text-slate-500 mb-2">
              <span>Platform Architecture</span>
              <span aria-hidden="true"> · </span>
              <span>End-to-End Outbound Pipeline</span>
            </div>
            <h2
              className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: "balance" }}
            >
              Four synchronized engines replacing fragmented lead lists and manual cold outreach.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Span-2 Marquee Capability */}
            <div className="lg:col-span-2 p-5 sm:p-8 rounded-xl border border-slate-200 bg-[#FAF9F6] flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-blue-700 mb-2">
                  <span>Real-Time Market Intelligence</span>
                  <span aria-hidden="true"> · </span>
                  <span>Zero Stale Databases</span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mb-3">
                  01. Autonomous Multi-City B2B Prospect Discovery
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-[65ch]">
                  Every campaign dispatches parallel discovery workers across your target cities and verticals—identifying active businesses, decision-maker contact details, website health signals, and high-value software or service gaps in real time.
                </p>
              </div>
              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">20 Workers</div>
                  <div className="text-xs text-slate-500">Concurrent site scanners</div>
                </div>
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">20 Cities</div>
                  <div className="text-xs text-slate-500">Bulk Hunter per batch</div>
                </div>
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">Lead Scoring</div>
                  <div className="text-xs text-slate-500">Opportunity prioritization</div>
                </div>
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">100% Live</div>
                  <div className="text-xs text-slate-500">Real-time business records</div>
                </div>
              </div>
            </div>

            {/* Span-1 Capability 02 */}
            <div className="p-5 sm:p-8 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">
                  <span>Deliverability Protection</span>
                  <span aria-hidden="true"> · </span>
                  <span>Zero-Bounce Gate</span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mb-3">
                  02. Multi-Layer Contact & Domain Verification
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Automatically validates business domains and mail servers in real time before any prospect enters your sequence—ensuring bounced messages never impact your sender reputation.
                </p>
              </div>
              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>Strict Mail Server Check</span>
                <span className="font-mono-num font-semibold text-emerald-700">Verified Only</span>
              </div>
            </div>

            {/* Span-1 Capability 03 */}
            <div className="p-5 sm:p-8 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">
                  <span>Conversion Asset</span>
                  <span aria-hidden="true"> · </span>
                  <span>Live Telemetry</span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mb-3">
                  03. Client-Facing Website Audit Reports
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Generates dedicated `/report/:id` diagnostic pages for each prospect—inspecting SSL security, mobile responsiveness, chat capture, booking systems, and conversion leaks with real-time view tracking.
                </p>
              </div>
              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>Interactive Proposal Trigger</span>
                <span className="font-mono-num font-semibold text-slate-900">Instant Shareable URL</span>
              </div>
            </div>

            {/* Span-2 Capability 04 */}
            <div className="lg:col-span-2 p-5 sm:p-8 rounded-xl border border-slate-200 bg-[#FAF9F6] flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-blue-700 mb-2">
                  <span>Autonomous Execution</span>
                  <span aria-hidden="true"> · </span>
                  <span>Multi-Inbox Rotation</span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mb-3">
                  04. Rotational Multi-Account Cold Outreach & 24/7 Autopilot Scheduler
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-[65ch]">
                  Connect your outreach inboxes in seconds. Vanguard Hunter rotates sender accounts automatically, enforces daily warm-up caps, tracks opens and link clicks, dispatches multi-day follow-ups, and organizes interested replies in your unified CRM inbox.
                </p>
              </div>
              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">Up to 100</div>
                  <div className="text-xs text-slate-500">Rotational sender inboxes</div>
                </div>
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">Follow-Ups</div>
                  <div className="text-xs text-slate-500">Automated sequence engine</div>
                </div>
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">Smart Inbox</div>
                  <div className="text-xs text-slate-500">Reply intent classification</div>
                </div>
                <div>
                  <div className="font-mono-num text-base sm:text-lg font-semibold text-slate-950">24/7 Autopilot</div>
                  <div className="text-xs text-slate-500">Unattended Hunt + Outreach</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2B: Interactive Target Verticals & Market Matrix */}
      <section id="verticals" className="py-14 sm:py-16 border-b border-slate-200 bg-[#FAF9F6]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">
                <span>High-Converting B2B Sectors</span>
                <span aria-hidden="true"> · </span>
                <span>Ready-to-Launch Outbound Playbooks</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
                120+ Industry Verticals & Deal Value Benchmarks
              </h2>
            </div>

            {/* Interactive Segmented Filter Control */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setSelectedVerticalFilter("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedVerticalFilter === "all" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                All Sectors (12)
              </button>
              <button
                type="button"
                onClick={() => setSelectedVerticalFilter("local")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedVerticalFilter === "local" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Local Services
              </button>
              <button
                type="button"
                onClick={() => setSelectedVerticalFilter("commercial")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  selectedVerticalFilter === "commercial" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Commercial B2B
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {filteredVerticals.map((v, idx) => (
                <div key={v.name} className={`p-4 sm:p-5 ${idx >= 4 ? "lg:border-t lg:border-slate-200" : ""}`}>
                  <div className="text-sm font-semibold text-slate-950">{v.name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                    <span>{v.segment}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num text-slate-800 font-medium">{v.dealSize}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Proof of Impact / Case Studies */}
      <section id="case-studies" className="py-14 sm:py-20 border-b border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10 sm:mb-12">
            <div className="text-xs font-medium text-slate-500 mb-2">
              <span>Verified Customer Outcomes</span>
              <span aria-hidden="true"> · </span>
              <span>Production Case Studies</span>
            </div>
            <h2
              className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: "balance" }}
            >
              Quantified pipeline growth across local service and commercial B2B verticals.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Case Study 1 */}
            <article className="rounded-xl border border-slate-200 bg-[#FAF9F6] overflow-hidden flex flex-col">
              <div className="aspect-4/3 bg-slate-900 relative overflow-hidden border-b border-slate-200">
                {!case1ImgError ? (
                  <img
                    src={caseDentalImg}
                    alt="Apex Dental Growth Partners clinic network"
                    referrerPolicy="no-referrer"
                    onError={() => setCase1ImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-300 text-sm p-4 text-center">
                    Healthcare Practice Automation Case Study
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent flex items-end p-4 sm:p-6">
                  <div className="text-white">
                    <div className="text-[11px] sm:text-xs text-slate-300">Healthcare & Dental Growth Agency · Austin & Dallas, TX</div>
                    <div className="font-mono-num text-lg sm:text-2xl font-bold mt-0.5">+318% Qualified Discovery Calls in 90 Days</div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-8 flex-1 flex flex-col justify-between space-y-5 sm:space-y-6">
                <div className="space-y-3">
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                    How Apex Digital Replaced $4,200/mo in Static Lead Lists with Live Website Audit Outreach
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Before Vanguard Hunter, Apex Digital purchased recycled CSV lists with a 28% bounce rate. By switching to real-time prospect discovery paired with automated Website Audit Report links, they engaged 6,400 dental and orthodontic clinics across Texas and achieved a 41.4% email open rate.
                  </p>
                </div>

                <blockquote className="pt-5 sm:pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-800 italic leading-relaxed">
                    "Attaching a live Website Audit Report URL that shows a clinic owner their exact missing chat widget and booking gaps doubled our reply rate in the first week. Closed $68,000 in new retainer ARR within 60 days."
                  </p>
                  <footer className="mt-3 text-xs text-slate-500">
                    <strong className="font-semibold text-slate-900">Elena Vance</strong> · Managing Partner, Apex Digital Growth
                  </footer>
                </blockquote>
              </div>
            </article>

            {/* Case Study 2 */}
            <article className="rounded-xl border border-slate-200 bg-[#FAF9F6] overflow-hidden flex flex-col">
              <div className="aspect-4/3 bg-slate-900 relative overflow-hidden border-b border-slate-200">
                {!case2ImgError ? (
                  <img
                    src={caseSolarImg}
                    alt="SunGrid Commercial Solar & HVAC Engineering"
                    referrerPolicy="no-referrer"
                    onError={() => setCase2ImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-300 text-sm p-4 text-center">
                    Commercial Solar & HVAC Outbound Case Study
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent flex items-end p-4 sm:p-6">
                  <div className="text-white">
                    <div className="text-[11px] sm:text-xs text-slate-300">Commercial MEP & Solar Advisory · 14 US Metro Markets</div>
                    <div className="font-mono-num text-lg sm:text-2xl font-bold mt-0.5">$1.84M Closed-Won Pipeline in 6 Months</div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-8 flex-1 flex flex-col justify-between space-y-5 sm:space-y-6">
                <div className="space-y-3">
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                    Scaling 20-City Bulk Prospecting with Autonomous Multi-Inbox Cold Sequences
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Northstar Commercial connected 18 rotational sender inboxes in their Vanguard Hunter workspace. Their autonomous 24/7 scheduler discovers, audits, and sequences 450 commercial contractors every morning without manual prospecting.
                  </p>
                </div>

                <blockquote className="pt-5 sm:pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-800 italic leading-relaxed">
                    "Running automated 20-city bulk campaigns lets our team cover entire regional markets overnight. Our account executives only step in when warm prospects request a consultation from their audit report."
                  </p>
                  <footer className="mt-3 text-xs text-slate-500">
                    <strong className="font-semibold text-slate-900">Marcus Thorne</strong> · VP of Revenue Operations, Northstar Commercial Systems
                  </footer>
                </blockquote>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Section 4: Multi-Tier SaaS Pricing (Lemon Squeezy & Crypto Ready) */}
      <section id="pricing" className="py-14 sm:py-20 border-b border-slate-200 bg-[#FAF9F6]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2">
                <span>Transparent SaaS Licensing</span>
                <span aria-hidden="true"> · </span>
                <span>Instant Card & Crypto Settlement</span>
              </div>
              <h2
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950"
                style={{ textWrap: "balance" }}
              >
                Choose the lead velocity that matches your revenue team.
              </h2>
            </div>

            {/* Interactive Billing Cadence Toggle */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  billingCycle === "monthly" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  billingCycle === "annual" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Annual Billing (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
              return (
                <div
                  key={plan.id}
                  className={`p-5 sm:p-7 rounded-xl border flex flex-col justify-between bg-white ${
                    plan.isPopular ? "border-blue-700 ring-1 ring-blue-700" : "border-slate-200"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-display text-xl font-bold text-slate-950">{plan.name}</h3>
                      {plan.isPopular && (
                        <span className="text-xs font-semibold text-blue-700">Most Selected</span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-500 mb-4">{plan.audience}</p>

                    <div className="pb-6 mb-6 border-b border-slate-200">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono-num text-3xl sm:text-4xl font-bold text-slate-950">${price}</span>
                        <span className="text-xs text-slate-500">/ month</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono-num">
                        {billingCycle === "annual"
                          ? `Billed annually ($${price * 12}/yr)`
                          : `Or $${plan.annualPrice}/mo billed annually`}
                      </div>
                    </div>

                    <div className="space-y-2.5 mb-6 text-xs text-slate-700">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Verified Leads / mo</span>
                        <span className="font-mono-num font-semibold text-slate-950">
                          {plan.monthlyHuntLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Cold Outreach / mo</span>
                        <span className="font-mono-num font-semibold text-slate-950">
                          {plan.monthlyEmailLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Rotational Inboxes</span>
                        <span className="font-mono-num font-semibold text-slate-950">
                          Up to {plan.maxEmailAccounts}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">20-City Bulk Hunter</span>
                        <span className="font-semibold text-slate-950">
                          {plan.bulkHuntEnabled ? "Included" : "Single-City"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">24/7 Autopilot Engine</span>
                        <span className="font-semibold text-slate-950">
                          {plan.autoPilotEnabled ? "Included" : "Manual Trigger"}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2.5 mb-8">
                      {(Array.isArray(plan.features) ? plan.features : []).map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                          <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentUser) {
                          setLocation(`/dashboard?tab=billing&plan=${plan.id}&cycle=${billingCycle}`);
                        } else {
                          handleOpenAuth("register", plan.id);
                        }
                      }}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        plan.isPopular
                          ? "bg-blue-700 text-white hover:bg-blue-800"
                          : "bg-slate-950 text-white hover:bg-slate-800"
                      }`}
                    >
                      Select {plan.name} Plan
                    </button>
                    <div className="text-[11px] text-center text-slate-500">
                      Instant Card Checkout · USDT · BTC · ETH · SOL
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="py-10 sm:py-12 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="font-display text-lg font-bold text-slate-950">Vanguard Hunter</div>
            <div className="text-xs text-slate-500 mt-1">
              SOC-2 Type II Infrastructure · Verified Inbox Deliverability · Multi-Tenant B2B Revenue Platform
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-medium text-slate-600">
            <button type="button" onClick={() => setLocation("/dashboard")} className="hover:text-slate-950 cursor-pointer">
              User Dashboard
            </button>
            <button type="button" onClick={() => setLocation("/crm")} className="hover:text-slate-950 cursor-pointer">
              Hunter CRM
            </button>
            <button type="button" onClick={() => handleOpenAuth("login")} className="hover:text-slate-950 cursor-pointer">
              Sign In / Register
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile-Responsive Login / Registration Authentication Modal with Explicit Back Controls */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseAuth();
          }}
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-4 sm:p-6 my-auto max-h-[92dvh] overflow-y-auto relative shadow-xl">
            {/* Top Navigation Bar inside Modal: Explicit Back Button + Mode Switcher + Close */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={handleCloseAuth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    authMode === "login" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    authMode === "register" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600"
                  }`}
                >
                  Register
                </button>
              </div>

              <button
                type="button"
                onClick={handleCloseAuth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close authentication modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <div className="text-[11px] font-medium text-blue-700 mb-0.5">
                Vanguard Hunter Multi-Tenant SaaS
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-950">
                {authMode === "login" ? "Sign in to your workspace" : "Create your SaaS workspace"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {authMode === "login"
                  ? "Access your lead hunter pipeline, website audit reports, and outreach engine."
                  : "Instant workspace provisioning with automated lead discovery and multi-inbox outreach."}
              </p>
            </div>

            {authError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "register" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Elena Vance"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Company / Agency</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Apex Growth"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Subscription Tier</label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-700"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ${billingCycle === "annual" ? p.annualPrice : p.monthlyPrice}/mo ({p.monthlyHuntLimit.toLocaleString()} leads/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@apexagency.io"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {authLoading
                    ? "Authenticating..."
                    : authMode === "login"
                    ? "Sign In to Workspace"
                    : "Create Workspace & Continue"}
                </button>

                <button
                  type="button"
                  onClick={handleCloseAuth}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Landing Page</span>
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center text-xs text-slate-600">
              {authMode === "login" ? (
                <>
                  Need a multi-user agency account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("register")}
                    className="font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    Register new workspace
                  </button>
                </>
              ) : (
                <>
                  Already have a workspace account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    Sign in
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
