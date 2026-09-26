import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  Phone,
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Smartphone,
  Monitor,
  Award,
  Calendar,
  Wrench,
  X,
  Settings,
  CreditCard,
  Building2,
  Coins,
  Copy,
  Mail,
} from "lucide-react";
import {
  WebsiteOwnerAdminDrawer,
  WEBSITE_COLOR_THEMES,
} from "@/components/WebsiteOwnerAdminDrawer";

import kitchenImg from "@/assets/images/showcase_kitchen_remodel_1790391137149.jpg";
import bathroomImg from "@/assets/images/showcase_bathroom_renovation_1790391148499.jpg";
import exteriorImg from "@/assets/images/showcase_whole_home_exterior_1790391161411.jpg";
import commercialImg from "@/assets/images/showcase_commercial_service_1790391173740.jpg";
import plumbingHvacImg from "@/assets/images/industry_plumbing_hvac_1790393997472.jpg";
import roofingExteriorImg from "@/assets/images/industry_roofing_exterior_1790394014092.jpg";
import dentalMedicalImg from "@/assets/images/industry_dental_medical_1790394023456.jpg";
import dentalNetworkImg from "@/assets/images/case_study_dental_network_1790378421158.jpg";
import restaurantCulinaryImg from "@/assets/images/industry_restaurant_culinary_1790394033671.jpg";
import legalAdvisoryImg from "@/assets/images/industry_legal_advisory_1790394045191.jpg";
import autoMechanicalImg from "@/assets/images/industry_auto_mechanical_1790394056628.jpg";
import salonWellnessImg from "@/assets/images/industry_salon_wellness_1790394067909.jpg";
import landscapingOutdoorImg from "@/assets/images/industry_landscaping_outdoor_1790394078101.jpg";
import commercialSolarImg from "@/assets/images/case_study_commercial_solar_1790378432723.jpg";
import b2bIntelligenceImg from "@/assets/images/hero_b2b_intelligence_1790378408952.jpg";

const SHOWCASE_IMAGES: Record<string, string> = {
  kitchen: kitchenImg,
  bathroom: bathroomImg,
  exterior: exteriorImg,
  commercial: commercialImg,
  plumbing_hvac: plumbingHvacImg,
  roofing_exterior: roofingExteriorImg,
  dental_medical: dentalMedicalImg,
  dental_network: dentalNetworkImg,
  restaurant_culinary: restaurantCulinaryImg,
  legal_advisory: legalAdvisoryImg,
  auto_mechanical: autoMechanicalImg,
  salon_wellness: salonWellnessImg,
  landscaping_outdoor: landscapingOutdoorImg,
  commercial_solar: commercialSolarImg,
  b2b_intelligence: b2bIntelligenceImg,
};

function resolveAccurateShowcaseImage(proj: any, idx: number, category = "", businessName = ""): string {
  if (proj?.customImageUrl && /^https?:\/\//i.test(proj.customImageUrl)) {
    return proj.customImageUrl;
  }
  const combined = `${proj?.title || ""} ${proj?.scope || ""} ${category} ${businessName}`.toLowerCase();
  const industryOnly = `${category} ${businessName}`.toLowerCase();

  // If the business is NOT a kitchen/bathroom/home remodeler, never show kitchen/bath images even if legacy imageType said so
  const isRemodeler = /construct|remodel|renovat|kitchen|bath|cabinet|countertop|builder|addition|carpentr/i.test(
    industryOnly
  );
  if (proj?.imageType && SHOWCASE_IMAGES[proj.imageType]) {
    if (
      !isRemodeler &&
      (proj.imageType === "kitchen" || proj.imageType === "bathroom" || proj.imageType === "exterior")
    ) {
      // Fall through to accurate industry matching below
    } else {
      return SHOWCASE_IMAGES[proj.imageType];
    }
  }

  if (/dent|orthodont|clinic|med|doctor|chiro|physio|optom|health|vet|dermatol|pediatr|patient/i.test(combined)) {
    return [dentalMedicalImg, dentalNetworkImg, salonWellnessImg][idx % 3];
  }
  if (/restaur|cafe|coffee|bakery|bistro|pizz|grill|sushi|taco|bar|cater|food|dining|menu|chef/i.test(combined)) {
    return [restaurantCulinaryImg, commercialImg, restaurantCulinaryImg][idx % 3];
  }
  if (/salon|barber|spa|medspa|nail|beauty|lash|brow|massage|aesthetic|hair|yoga|pilates|gym|fitness/i.test(combined)) {
    return [salonWellnessImg, dentalMedicalImg, salonWellnessImg][idx % 3];
  }
  if (/law|attorney|legal|account|cpa|tax|insur|real estate|realtor|mortgage|financ|consult|agency|advisor/i.test(combined)) {
    return [legalAdvisoryImg, b2bIntelligenceImg, commercialImg][idx % 3];
  }
  if (/auto|mechanic|car |brake|tire|transmission|collision|detailing|towing|engine|vehicle/i.test(combined)) {
    return [autoMechanicalImg, plumbingHvacImg, commercialImg][idx % 3];
  }
  if (/plumb|hvac|air condition|heating|electr|water heater|drain|pipe|duct|furnace|appliance/i.test(combined)) {
    return [plumbingHvacImg, commercialImg, roofingExteriorImg][idx % 3];
  }
  if (/solar/i.test(combined)) {
    return [commercialSolarImg, roofingExteriorImg, exteriorImg][idx % 3];
  }
  if (/roof|gutter|siding|shingle|window/i.test(combined)) {
    return [roofingExteriorImg, exteriorImg, landscapingOutdoorImg][idx % 3];
  }
  if (/landscap|lawn|tree|hardscap|pool|paver|patio|fence|deck|pest|outdoor/i.test(combined)) {
    return [landscapingOutdoorImg, exteriorImg, roofingExteriorImg][idx % 3];
  }
  if (isRemodeler) {
    return [kitchenImg, bathroomImg, exteriorImg][idx % 3];
  }
  return [commercialImg, b2bIntelligenceImg, legalAdvisoryImg][idx % 3];
}

interface ThemePalette {
  id: string;
  name: string;
  topBarBg: string;
  topBarAccent: string;
  canvasBg: string;
  sectionAltBg: string;
  inkPrimary: string;
  inkMuted: string;
  accentBg: string;
  accentHover: string;
  accentText: string;
  accentSoftBg: string;
  borderSubtle: string;
}

const THEMES: Record<string, ThemePalette> = Object.fromEntries(
  Object.values(WEBSITE_COLOR_THEMES).map((t) => [
    t.id,
    {
      id: t.id,
      name: t.name,
      topBarBg: t.topBarBg,
      topBarAccent: t.accentSoft,
      canvasBg: t.bgCanvas,
      sectionAltBg: t.bgSubtle,
      inkPrimary: t.textPrimary,
      inkMuted: t.textSecondary,
      accentBg: t.accent,
      accentHover: t.accentHover,
      accentText: t.accent,
      accentSoftBg: t.accentSoft,
      borderSubtle: t.border,
    },
  ])
);

export default function GeneratedWebsitePage() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId || "valley-construction-sacramento";

  const [site, setSite] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // View controls for Business Owner
  const [viewMode, setViewMode] = useState<"live_site" | "what_changed">("live_site");
  const [viewportMode, setViewportMode] = useState<"desktop" | "mobile">("desktop");
  const [activeThemeId, setActiveThemeId] = useState<string>("valley_craft");

  // 4-Tap Interactive Lead Funnel state
  const [funnelStep, setFunnelStep] = useState<1 | 2 | 3 | 4>(1);
  const [tap1Choice, setTap1Choice] = useState<string>("");
  const [tap2Choice, setTap2Choice] = useState<string>("");
  const [tap3Choice, setTap3Choice] = useState<string>("");
  const [funnelPhone, setFunnelPhone] = useState<string>("");
  const [funnelName, setFunnelName] = useState<string>("");
  const [funnelSubmitting, setFunnelSubmitting] = useState(false);
  const [funnelSuccess, setFunnelSuccess] = useState(false);
  const [funnelError, setFunnelError] = useState("");

  // FAQ Accordion state
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Claim Website Modal state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("admin") === "1";
    }
    return false;
  });
  const [forceCleanLiveView] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("live") === "1";
    }
    return false;
  });
  const [claimName, setClaimName] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimDomainPref, setClaimDomainPref] = useState("connect_existing");
  const [claimCustomDomain, setClaimCustomDomain] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [claimHostingPlan, setClaimHostingPlan] = useState<"managed_49" | "vip_growth_97">("vip_growth_97");
  const [claimAddons, setClaimAddons] = useState<string[]>(["custom_logo"]);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [activePaymentTab, setActivePaymentTab] = useState<"lemon_card" | "bank_transfer" | "crypto">("lemon_card");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const copyPaymentField = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const HOSTING_PLANS = {
    managed_49: {
      id: "managed_49",
      name: "Standard Cloud Hosting & Admin CMS",
      monthlyPrice: 49,
      setupFee: 0,
      badge: "Essential",
      desc: "High-speed hosting, SSL security, Owner Admin Panel access, and 4-Tap SMS/email lead alerts.",
    },
    vip_growth_97: {
      id: "vip_growth_97",
      name: "VIP Hosting, Domain Care & Unlimited Edits",
      monthlyPrice: 97,
      setupFee: 0,
      badge: "Most Popular · $0 Setup",
      desc: "Everything in Standard + white-glove custom domain connection, unlimited monthly text/photo updates, and Google indexing.",
    },
  } as const;

  const GROWTH_ADDONS = [
    {
      id: "custom_logo",
      name: "Custom Logo Design & Brand Polish",
      priceLabel: "+$99 one-time",
      monthly: 0,
      oneTime: 99,
      desc: "We design or upgrade a crisp, high-resolution vector logo matched to your new website.",
    },
    {
      id: "ai_receptionist",
      name: "24/7 AI Website Receptionist & Missed-Call Text Back",
      priceLabel: "+$197/mo",
      monthly: 197,
      oneTime: 0,
      desc: "Answers customer questions on your site 24/7, books estimates automatically, and texts back missed phone calls.",
    },
    {
      id: "review_automation",
      name: "Automated 5-Star Google Review Booster",
      priceLabel: "+$147/mo",
      monthly: 147,
      oneTime: 0,
      desc: "Automatically texts happy customers after each job to multiply your 5-star Google Maps reviews.",
    },
    {
      id: "local_seo",
      name: "Local Google Maps Top-3 & AI Search SEO",
      priceLabel: "+$497/mo",
      monthly: 497,
      oneTime: 0,
      desc: "Ranks your business in the Top 3 on Google Maps ('near me' searches) and AI search engines.",
    },
  ] as const;

  const toggleClaimAddon = (addonId: string) => {
    setClaimAddons((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const selectedPlanObj = HOSTING_PLANS[claimHostingPlan];
  const selectedAddonObjs = GROWTH_ADDONS.filter((a) => claimAddons.includes(a.id));
  const claimMonthlyTotal =
    selectedPlanObj.monthlyPrice + selectedAddonObjs.reduce((sum, a) => sum + a.monthly, 0);
  const claimOneTimeTotal = selectedAddonObjs.reduce((sum, a) => sum + a.oneTime, 0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        if (data?.site) {
          setSite(data.site);
          if (data.paymentConfig) {
            setPaymentConfig(data.paymentConfig);
          }
          const cfg = data.site.siteConfig || {};
          setActiveThemeId(data.site.themeId || cfg.themeId || "valley_craft");
          setClaimName(data.site.ownerName || "");
          setClaimEmail(data.site.email || "");
          setClaimPhone(data.site.phone || "");
          setClaimCustomDomain(data.site.originalWebsite || "");
          if (data.site.claimRequested) {
            setClaimSuccess(true);
            if (data.site.claimData?.paymentStatus === "payment_submitted" || data.site.claimData?.paymentStatus === "paid_active") {
              setPaymentConfirmed(true);
            }
          }
          const firstOpt = cfg?.funnelConfig?.step1Options?.[0]?.label || "Kitchen Remodeling";
          const secondOpt = cfg?.funnelConfig?.step2Options?.[0]?.label || "Within 2 to 4 weeks";
          const thirdOpt = cfg?.funnelConfig?.step3Options?.[0]?.label || "On-time schedule & daily updates";
          setTap1Choice(firstOpt);
          setTap2Choice(secondOpt);
          setTap3Choice(thirdOpt);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [siteId]);

  const handleTapOption = (step: 1 | 2 | 3, label: string) => {
    if (step === 1) {
      setTap1Choice(label);
      setFunnelStep(2);
    } else if (step === 2) {
      setTap2Choice(label);
      setFunnelStep(3);
    } else if (step === 3) {
      setTap3Choice(label);
      setFunnelStep(4);
    }
  };

  const handleFunnelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFunnelError("");
    const cleanedPhone = funnelPhone.replace(/[^0-9+]/g, "");
    if (cleanedPhone.length < 7) {
      setFunnelError("Please enter a valid phone number so we can text or call with your estimate.");
      return;
    }
    setFunnelSubmitting(true);
    try {
      const res = await fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/funnel-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: tap1Choice,
          step2: tap2Choice,
          step3: tap3Choice,
          phone: funnelPhone,
          name: funnelName,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setFunnelSuccess(true);
    } catch {
      setFunnelError("Could not send right now. Please call us directly.");
    } finally {
      setFunnelSubmitting(false);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError("");
    if (!claimName.trim() || !claimPhone.trim()) {
      setClaimError("Please enter your full name and phone number so we can finalize your website handoff.");
      return;
    }
    setClaimSubmitting(true);
    try {
      const res = await fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimedByName: claimName,
          claimedByEmail: claimEmail,
          claimedByPhone: claimPhone,
          domainPreference: claimDomainPref,
          customDomain: claimCustomDomain,
          customNotes: claimNotes,
          selectedPlan: `${selectedPlanObj.name} ($${selectedPlanObj.monthlyPrice}/mo · $0 Free Website Build)`,
          selectedAddons: selectedAddonObjs.map((a) => `${a.name} (${a.priceLabel})`),
          monthlyTotal: claimMonthlyTotal,
          oneTimeTotal: claimOneTimeTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim website");
      if (data.paymentConfig) {
        setPaymentConfig(data.paymentConfig);
      }
      setClaimSuccess(true);
      setSite((prev: any) =>
        prev
          ? {
              ...prev,
              claimRequested: true,
              status: "claimed",
              claimData: data.claimData || prev.claimData,
            }
          : prev
      );
    } catch (err: any) {
      setClaimError(err.message || "Could not submit claim request");
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleConfirmPayment = async (method: "lemon_card" | "bank_transfer" | "crypto") => {
    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          paymentReference: paymentReference.trim() || (method === "lemon_card" ? "Lemon Squeezy Card Checkout" : "Transfer Initiated"),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentConfirmed(true);
        setSite((prev: any) =>
          prev ? { ...prev, claimData: data.claimData || prev.claimData } : prev
        );
      }
    } catch {
      // fallback
      setPaymentConfirmed(true);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    setViewMode("live_site");
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 60);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F0] text-[#141210]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#E6DEC8] border-t-[#7C4A15] rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#57534E]">Loading custom website preview…</p>
        </div>
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F0] text-[#141210] p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Website Preview Not Found</h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            This custom website preview link may have expired or been moved.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#7C4A15] hover:bg-[#633A0F] transition-colors"
          >
            Return to Platform
          </a>
        </div>
      </div>
    );
  }

  const cfg = site.siteConfig || {};
  const rawTheme = THEMES[activeThemeId] || THEMES.valley_craft;
  const theme: ThemePalette = cfg.customAccentColor
    ? {
        ...rawTheme,
        accentBg: cfg.customAccentColor,
        accentHover: cfg.customAccentColor,
        accentText: cfg.customAccentColor,
      }
    : rawTheme;
  const isLiveHostedMode = forceCleanLiveView || cfg.hostingMode === "live_hosted";
  const funnel = cfg.funnelConfig || {};
  const trans = cfg.transformationSummary || {};
  const phoneDisplay = cfg.phoneDisplay || site.phone || "(916) 291-1047";
  const phoneHref = `tel:${phoneDisplay.replace(/[^0-9+]/g, "")}`;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0C0C0B] text-[#141210]">
      {/* ─── OWNER PRESENTATION & CLAIM BAR (Hidden when Live Production Mode is active) ─── */}
      {!isLiveHostedMode && (
      <div className="sticky top-0 z-50 bg-[#0F172A] text-white border-b border-slate-800 px-3 sm:px-6 lg:px-8 py-2 shadow-lg">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Top Row on Mobile: Custom Prepared Status + Claim Website Button */}
          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-amber-400 truncate">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Custom Preview: {site.businessName}</span>
            </span>
            <span className="text-slate-600 hidden lg:inline">·</span>
            <span className="text-xs text-slate-300 hidden xl:inline truncate">
              {site.detectionStatus === "no_website"
                ? "No Existing Website Found — Ready to Launch"
                : `Upgraded from ${site.originalScore || 38}/100 → 98/100 Conversion Score`}
            </span>

            {/* Mobile Claim CTA (shown on top right on small screens) */}
            <div className="sm:hidden shrink-0">
              {claimSuccess || site.claimRequested ? (
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500 text-slate-950 flex items-center gap-1 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Claimed</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-3 py-1 rounded-md text-[11px] font-bold bg-amber-400 text-slate-950 whitespace-nowrap shadow-xs"
                >
                  Claim Free Site →
                </button>
              )}
            </div>
          </div>

          {/* Second Row on Mobile / Right Side on Desktop: Mode Switcher + Theme + Desktop Claim CTA */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setViewMode("live_site")}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  viewMode === "live_site"
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Live Website
              </button>
              <button
                type="button"
                onClick={() => setViewMode("what_changed")}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap text-center ${
                  viewMode === "what_changed"
                    ? "bg-amber-400 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Why It Gets Leads ({trans.whatChanged?.length || 4})
              </button>
            </div>

            {/* Desktop vs Mobile Viewport Toggle (Desktop only) */}
            <div className="hidden lg:flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewportMode("desktop")}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewportMode === "desktop" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
                title="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewportMode("mobile")}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewportMode === "mobile" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
                title="Mobile Lead Funnel View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Theme Selector */}
            <select
              value={activeThemeId}
              onChange={(e) => setActiveThemeId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] sm:text-xs rounded-lg px-2 py-1.5 focus:outline-none max-w-[130px] sm:max-w-none truncate"
              aria-label="Choose color theme"
            >
              {Object.values(THEMES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Admin / Edit Website CMS Button */}
            <button
              type="button"
              onClick={() => setAdminDrawerOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Open Website Admin CMS (Edit Logo, Colors, Services & Hosting)"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Admin / Edit Site</span>
            </button>

            {/* Desktop Claim CTA */}
            <div className="hidden sm:flex items-center">
              {claimSuccess || site.claimRequested ? (
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Website Claimed — View Details</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shadow-xs"
                >
                  Claim Free Website ($0 Build) →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ─── VIEW MODE 1: "WHAT CHANGED & WHY THIS GETS LEADS FASTER" PITCH DECK ─── */}
      {viewMode === "what_changed" && (
        <div className="bg-slate-950 text-white py-8 sm:py-12 px-4 sm:px-8 border-b border-slate-800">
          <div className="max-w-5xl mx-auto space-y-8 sm:space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-slate-800 pb-6 sm:pb-8">
              <div className="space-y-2.5 max-w-2xl">
                <div className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase text-amber-400">
                  Executive Conversion Audit &amp; Turnkey Website Upgrade
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white" style={{ textWrap: "balance" }}>
                  Why we built this new 4-Tap Lead Engine for {site.businessName}
                </h1>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  {trans.diagnosisHeadline}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("live_site")}
                  className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors text-center"
                >
                  Test Live 4-Tap Website
                </button>
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors text-center"
                >
                  Claim This Website Now →
                </button>
              </div>
            </div>

            {/* Key Quantitative Impact Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-6">
                <div className="text-xs text-slate-400 font-medium">Previous Website Conversion Score</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-bold text-rose-400 font-mono tabular-nums">
                    {site.detectionStatus === "no_website" ? "0 / 100" : `${trans.originalScore || 38} / 100`}
                  </span>
                  <span className="text-xs text-rose-300">
                    {site.detectionStatus === "no_website" ? "No Website Found" : "Leaking Mobile Traffic"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {site.detectionStatus === "no_website"
                    ? `Customers searching in ${site.city} have no page to verify your work or request an estimate.`
                    : "Traditional static pages and multi-field forms lose over 88% of mobile visitors."}
                </p>
              </div>

              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-5 sm:p-6">
                <div className="text-xs text-emerald-300 font-medium">New Auto-Built Website Score</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono tabular-nums">98 / 100</span>
                  <span className="text-xs text-emerald-300">4-Tap Instant Funnel</span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  Engineered with a 4-tap no-form quote calculator, click-to-call header, and transparent project timeline.
                </p>
              </div>

              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-5 sm:p-6">
                <div className="text-xs text-amber-300 font-medium">Estimated Monthly Lead Lift in {site.city}</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                    {trans.estimatedMissedLeadsPerMonth || "18–35 Extra Calls/Mo"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  Projected revenue impact: <strong className="text-amber-300">{trans.estimatedMonthlyRevenueLift || "+$18,500–$45,000/mo"}</strong>
                </p>
              </div>
            </div>

            {/* Side-by-Side What Changed Breakdown */}
            <div className="space-y-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">
                What Changed: 4 Conversion Upgrades Built Into Your New Site
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {(trans.whatChanged || []).map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
                    <div className="text-sm sm:text-base font-bold text-white">{item.title}</div>
                    <div className="text-xs text-rose-300/90 bg-rose-950/30 border border-rose-900/40 rounded-lg p-3">
                      <strong className="uppercase tracking-wider text-[10px] text-rose-400 block mb-1">
                        Before (Old / Missing Setup):
                      </strong>
                      {item.before}
                    </div>
                    <div className="text-xs text-emerald-200 bg-emerald-950/30 border border-emerald-900/40 rounded-lg p-3">
                      <strong className="uppercase tracking-wider text-[10px] text-emerald-400 block mb-1">
                        Now Built For {site.businessName}:
                      </strong>
                      {item.after}
                    </div>
                    <div className="text-xs font-semibold text-amber-400 pt-1">
                      Result: {item.impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Claim Banner inside Pitch View */}
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-5 sm:p-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-xl">
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Ready to claim this website for {site.businessName}?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  We have already built the layout, local {site.city} copy, and 4-tap estimate funnel. Click below to claim it and we will connect it to your domain and phone number within 24 hours.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("live_site")}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 text-center"
                >
                  Inspect Live Website First
                </button>
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-6 py-3 rounded-lg text-xs sm:text-sm font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 text-center"
                >
                  Claim This Website →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── VIEW MODE 2: THE LIVE INTERACTIVE WEBSITE (VALLEY SIGNATURE + MOBILE-NATIVE) ─── */}
      <div
        className={`mx-auto transition-all duration-200 ${
          viewportMode === "mobile"
            ? "max-w-[430px] my-6 rounded-[32px] overflow-hidden border-[8px] border-slate-800 shadow-2xl"
            : "w-full"
        }`}
        style={{ backgroundColor: theme.canvasBg, color: theme.inkPrimary }}
      >
        {/* 1. TOP ANNOUNCEMENT BAR */}
        <div
          className="w-full py-2 px-3 sm:px-4 text-center text-[11px] sm:text-[13px] font-medium tracking-tight leading-snug"
          style={{ backgroundColor: theme.topBarBg, color: "#F5F5F4" }}
        >
          <span>
            {cfg.announcementBar || `Serving the ${cfg.city || site.city} area.`}{" "}
          </span>
          <span className="font-semibold" style={{ color: theme.topBarAccent }}>
            {cfg.hoursText || "Mon-Sat, 8 am to 8 pm."}
          </span>
        </div>

        {/* 2. MAIN NAVIGATION HEADER (Mobile + Desktop Responsive) */}
        <header
          className="w-full bg-white border-b px-3.5 sm:px-8 lg:px-12 py-3 sm:py-4"
          style={{ borderColor: theme.borderSubtle }}
        >
          <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Zone 1: Custom Uploaded Logo OR Industry-Matched Emblem + Brand Name */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-2.5 sm:gap-3 group min-w-0"
            >
              {cfg.customLogoUrl ? (
                <img
                  src={cfg.customLogoUrl}
                  alt={cfg.brandName || site.businessName}
                  className="h-9 sm:h-11 w-auto max-w-[130px] object-contain rounded-lg shrink-0"
                />
              ) : (
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex flex-col items-center justify-center border text-[9px] sm:text-[10px] font-extrabold tracking-tighter leading-none shrink-0"
                style={{
                  borderColor: theme.borderSubtle,
                  backgroundColor: theme.canvasBg,
                  color: theme.inkPrimary,
                }}
              >
                {cfg.emblemType === "medical" ? (
                  <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4V20M4 12H20" stroke={theme.accentBg} strokeWidth="2.8" strokeLinecap="round" />
                  </svg>
                ) : cfg.emblemType === "culinary" ? (
                  <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3V11C8 13.2 9.8 15 12 15C14.2 15 16 13.2 16 11V3M12 15V21M7 21H17" stroke={theme.accentBg} strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                ) : cfg.emblemType === "scales" ? (
                  <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3V21M5 7H19M5 7L2 14H8L5 7ZM19 7L16 14H22L19 7ZM8 21H16" stroke={theme.accentBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : cfg.emblemType === "wrench" ? (
                  <Wrench className="w-4 h-4 mb-0.5" style={{ color: theme.accentBg }} />
                ) : cfg.emblemType === "sparkle" ? (
                  <Sparkles className="w-4 h-4 mb-0.5" style={{ color: theme.accentBg }} />
                ) : cfg.emblemType === "shield" ? (
                  <ShieldCheck className="w-4 h-4 mb-0.5" style={{ color: theme.accentBg }} />
                ) : (
                  <svg className="w-4 h-3 sm:w-5 sm:h-3.5 mb-0.5" viewBox="0 0 24 14" fill="none">
                    <path
                      d="M2 12L12 3L22 12"
                      stroke={theme.accentBg}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 12L12 6.5L18 12"
                      stroke={theme.inkPrimary}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="uppercase text-[6px] sm:text-[7px] tracking-widest font-bold">
                  {(cfg.brandName || site.businessName || "BRAND").split(" ")[0].slice(0, 8)}
                </span>
              </div>
              )}
              <span
                className="text-[14px] sm:text-[18px] font-bold tracking-tight leading-tight line-clamp-2 max-w-[175px] sm:max-w-[260px]"
                style={{ color: theme.inkPrimary }}
              >
                {cfg.brandName || site.businessName}
              </span>
            </a>

            {/* Zone 2: Clean Typography Nav Links (Desktop) */}
            {viewportMode !== "mobile" && (
              <nav className="hidden xl:flex items-center gap-7 text-[14px] font-medium" style={{ color: theme.inkPrimary }}>
                <button type="button" onClick={() => scrollToSection("services")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  {cfg.navLabels?.services || "Services"}
                </button>
                <button type="button" onClick={() => scrollToSection("why-us")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  {cfg.navLabels?.process || "How We Work"}
                </button>
                <button type="button" onClick={() => scrollToSection("finished-work")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  {cfg.navLabels?.showcase || "Featured Work"}
                </button>
                <button type="button" onClick={() => scrollToSection("areas")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  {cfg.navLabels?.reviews || "Reviews"}
                </button>
                <button type="button" onClick={() => scrollToSection("faq")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  {cfg.navLabels?.faq || "FAQ"}
                </button>
                <button type="button" onClick={() => scrollToSection("funnel-card")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  Contact
                </button>
              </nav>
            )}

            {/* Zone 3: Phone Number + Reassurance + Primary CTA Button */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {viewportMode !== "mobile" && (
                <div className="hidden md:flex items-baseline gap-2">
                  <a
                    href={phoneHref}
                    className="text-[16px] font-extrabold tracking-tight font-mono tabular-nums hover:underline whitespace-nowrap"
                    style={{ color: theme.inkPrimary }}
                  >
                    {phoneDisplay}
                  </a>
                  <span className="text-[12px] hidden lg:inline whitespace-nowrap" style={{ color: theme.inkMuted }}>
                    {cfg.brandSubline || "Upfront pricing. Fast response."}
                  </span>
                </div>
              )}

              {/* Mobile Direct Call Icon Button */}
              <a
                href={phoneHref}
                className="md:hidden p-2 rounded-lg border flex items-center justify-center"
                style={{ borderColor: theme.borderSubtle, color: theme.inkPrimary, backgroundColor: theme.canvasBg }}
                aria-label="Call Business"
              >
                <Phone className="w-4 h-4" style={{ color: theme.accentText }} />
              </a>

              <button
                type="button"
                onClick={() => scrollToSection("funnel-card")}
                className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[12px] sm:text-[14px] font-bold text-white transition-colors whitespace-nowrap shadow-xs"
                style={{ backgroundColor: theme.accentBg }}
              >
                {cfg.navLabels?.primaryCta || "Free estimate"}
              </button>
            </div>
          </div>

          {/* Mobile Quick-Jump Section Bar */}
          <div
            className="xl:hidden mt-2.5 pt-2 border-t flex items-center gap-4 overflow-x-auto no-scrollbar text-[12px] font-semibold"
            style={{ borderColor: theme.borderSubtle, color: theme.inkMuted }}
          >
            <button type="button" onClick={() => scrollToSection("funnel-card")} className="whitespace-nowrap hover:underline" style={{ color: theme.accentText }}>
              {cfg.navLabels?.primaryCta || "4-Tap Quote"}
            </button>
            <button type="button" onClick={() => scrollToSection("finished-work")} className="whitespace-nowrap hover:underline">
              {cfg.navLabels?.showcase || "Featured Work"}
            </button>
            <button type="button" onClick={() => scrollToSection("why-us")} className="whitespace-nowrap hover:underline">
              {cfg.navLabels?.process || "How We Work"}
            </button>
            <button type="button" onClick={() => scrollToSection("services")} className="whitespace-nowrap hover:underline">
              {cfg.navLabels?.services || "Services"}
            </button>
            <button type="button" onClick={() => scrollToSection("areas")} className="whitespace-nowrap hover:underline">
              {cfg.navLabels?.reviews || "Reviews & Areas"}
            </button>
            <button type="button" onClick={() => scrollToSection("faq")} className="whitespace-nowrap hover:underline">
              {cfg.navLabels?.faq || "FAQ"}
            </button>
          </div>
        </header>

        {/* 3. HERO SECTION: LEFT EDITORIAL PROPOSITION + RIGHT 4-TAP INSTANT FUNNEL */}
        <section className="py-8 sm:py-16 lg:py-20 px-4 sm:px-8 lg:px-12">
          <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column (7 Cols) */}
            <div className={`${viewportMode === "mobile" ? "col-span-1" : "lg:col-span-7"} space-y-4 sm:space-y-6 pt-1`}>
              <div
                className="text-[11px] sm:text-[13px] font-bold tracking-[0.08em] uppercase"
                style={{ color: theme.accentText }}
              >
                {cfg.heroKicker || `${site.category?.toUpperCase()} IN ${site.city?.toUpperCase()}`}
              </div>

              <h1
                className={`${
                  viewportMode === "mobile"
                    ? "text-3xl"
                    : "text-[32px] sm:text-5xl lg:text-[58px]"
                } font-extrabold tracking-[-0.03em] leading-[1.08]`}
                style={{ color: theme.inkPrimary, textWrap: "balance" }}
              >
                {cfg.heroHeadline || "A kitchen you love, on a schedule you can see."}
              </h1>

              <p
                className="text-[15px] sm:text-[18px] leading-[1.6] max-w-[60ch] font-normal"
                style={{ color: theme.inkMuted }}
              >
                {cfg.heroSubheadline}
              </p>

              {/* Primary & Secondary Action Buttons — Responsive on mobile & desktop */}
              <div className="pt-1 sm:pt-2 space-y-2.5 sm:space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3.5">
                  <a
                    href={phoneHref}
                    className="inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3.5 rounded-lg text-[15px] font-bold text-white shadow-xs transition-transform active:scale-[0.99] whitespace-nowrap"
                    style={{ backgroundColor: theme.accentBg }}
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>Call {phoneDisplay}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => scrollToSection("funnel-card")}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 rounded-lg text-[15px] font-bold bg-white border shadow-xs hover:bg-stone-50 transition-colors whitespace-nowrap"
                    style={{ color: theme.inkPrimary, borderColor: theme.borderSubtle }}
                  >
                    <span>{cfg.heroSecondaryCta || "Get my free estimate"}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => scrollToSection("finished-work")}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[13px] sm:text-[14px] font-bold bg-white border shadow-xs hover:bg-stone-50 transition-colors whitespace-nowrap"
                    style={{ color: theme.inkPrimary, borderColor: theme.borderSubtle }}
                  >
                    {cfg.heroTertiaryCta || "See finished work"}
                  </button>
                </div>
              </div>

              {/* Quiet Unboxed Trust Metadata Strip */}
              <div
                className="pt-4 sm:pt-6 border-t flex flex-wrap items-center gap-y-1.5 gap-x-3 sm:gap-x-4 text-[12px] sm:text-[13px] font-medium"
                style={{ borderColor: theme.borderSubtle, color: theme.inkMuted }}
              >
                {(cfg.trustStats || []).map((st: any, i: number) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span>
                      <strong style={{ color: theme.inkPrimary }}>{st.value}</strong> {st.label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Right Column (5 Cols) — THE 4-TAP INSTANT ESTIMATE CARD */}
            <div
              id="funnel-card"
              className={`${viewportMode === "mobile" ? "col-span-1" : "lg:col-span-5"} w-full scroll-mt-24`}
            >
              <div
                className="bg-white rounded-2xl p-4 sm:p-8 shadow-[0_20px_50px_rgba(20,18,16,0.08)] border"
                style={{ borderColor: theme.borderSubtle }}
              >
                {/* Kicker Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase"
                    style={{ backgroundColor: theme.accentSoftBg, color: theme.accentText }}
                  >
                    <span>☀</span>
                    <span>{funnel.badge || "FREE ESTIMATE"}</span>
                  </span>

                  {/* Interactive Step Jumper so owner can inspect Step 1-4 or jump straight to Step 4 */}
                  <div className="flex items-center gap-1 text-[11px]">
                    {([1, 2, 3, 4] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setFunnelSuccess(false);
                          setFunnelStep(s);
                        }}
                        className={`w-6 h-6 rounded-full font-mono text-[11px] font-bold transition-colors ${
                          funnelStep === s
                            ? "text-white"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                        style={funnelStep === s ? { backgroundColor: theme.accentBg } : undefined}
                        title={`Preview Step ${s} of 4`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Funnel Title & Subtitle */}
                <h2
                  className="text-2xl sm:text-[26px] font-extrabold tracking-tight leading-snug"
                  style={{ color: theme.inkPrimary }}
                >
                  {funnel.title || "What are we remodeling?"}
                </h2>
                <p className="text-[14px] mt-1" style={{ color: theme.inkMuted }}>
                  {funnel.subtitle || "Four taps. No forms to fill out."}
                </p>

                {/* Progress Bar matching screenshot */}
                <div className="mt-5 mb-6 flex items-center gap-3">
                  <span className="text-[12px] font-medium shrink-0" style={{ color: theme.inkMuted }}>
                    Step {funnelStep} of 4
                  </span>
                  <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${(funnelStep / 4) * 100}%`,
                        backgroundColor: "#D97706",
                      }}
                    />
                  </div>
                </div>

                {/* Funnel Step Content */}
                {funnelSuccess ? (
                  <div
                    className="rounded-xl p-5 border space-y-3 text-left"
                    style={{ backgroundColor: theme.canvasBg, borderColor: theme.borderSubtle }}
                  >
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>Project details received!</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: theme.inkMuted }}>
                      We have logged your request for <strong>{tap1Choice}</strong> ({tap2Choice}) and will call or text{" "}
                      <strong className="font-mono">{funnelPhone}</strong> shortly to confirm your free walkthrough.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFunnelSuccess(false);
                        setFunnelStep(1);
                        setFunnelPhone("");
                      }}
                      className="text-xs font-semibold underline"
                      style={{ color: theme.accentText }}
                    >
                      Start another estimate
                    </button>
                  </div>
                ) : funnelStep === 1 ? (
                  <div className="space-y-3">
                    <div className="text-[13px] font-bold" style={{ color: theme.inkPrimary }}>
                      {funnel.step1Question || "What space are we remodeling?"}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {(funnel.step1Options || []).map((opt: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleTapOption(1, opt.label)}
                          className="w-full text-left p-3.5 rounded-xl border hover:border-amber-700/60 hover:bg-stone-50/80 transition-all flex items-center justify-between group"
                          style={{
                            borderColor: tap1Choice === opt.label ? theme.accentBg : theme.borderSubtle,
                            backgroundColor: tap1Choice === opt.label ? theme.canvasBg : "#FFFFFF",
                          }}
                        >
                          <div>
                            <div className="text-[14px] font-bold" style={{ color: theme.inkPrimary }}>
                              {opt.label}
                            </div>
                            {opt.desc && (
                              <div className="text-[12px] mt-0.5" style={{ color: theme.inkMuted }}>
                                {opt.desc}
                              </div>
                            )}
                          </div>
                          <ArrowRight
                            className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                            style={{ color: theme.accentText }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : funnelStep === 2 ? (
                  <div className="space-y-3">
                    <div className="text-[13px] font-bold" style={{ color: theme.inkPrimary }}>
                      {funnel.step2Question || "2. What is your ideal timeline?"}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {(funnel.step2Options || []).map((opt: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleTapOption(2, opt.label)}
                          className="w-full text-left p-3.5 rounded-xl border hover:bg-stone-50 transition-all flex items-center justify-between group"
                          style={{
                            borderColor: tap2Choice === opt.label ? theme.accentBg : theme.borderSubtle,
                            backgroundColor: tap2Choice === opt.label ? theme.canvasBg : "#FFFFFF",
                          }}
                        >
                          <div>
                            <div className="text-[14px] font-bold" style={{ color: theme.inkPrimary }}>
                              {opt.label}
                            </div>
                            {opt.desc && (
                              <div className="text-[12px] mt-0.5" style={{ color: theme.inkMuted }}>
                                {opt.desc}
                              </div>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 shrink-0" style={{ color: theme.accentText }} />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFunnelStep(1)}
                      className="text-[13px] underline pt-1 inline-block"
                      style={{ color: theme.inkMuted }}
                    >
                      Back
                    </button>
                  </div>
                ) : funnelStep === 3 ? (
                  <div className="space-y-3">
                    <div className="text-[13px] font-bold" style={{ color: theme.inkPrimary }}>
                      {funnel.step3Question || "3. What matters most to you on this project?"}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {(funnel.step3Options || []).map((opt: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleTapOption(3, opt.label)}
                          className="w-full text-left p-3.5 rounded-xl border hover:bg-stone-50 transition-all flex items-center justify-between group"
                          style={{
                            borderColor: tap3Choice === opt.label ? theme.accentBg : theme.borderSubtle,
                            backgroundColor: tap3Choice === opt.label ? theme.canvasBg : "#FFFFFF",
                          }}
                        >
                          <div>
                            <div className="text-[14px] font-bold" style={{ color: theme.inkPrimary }}>
                              {opt.label}
                            </div>
                            {opt.desc && (
                              <div className="text-[12px] mt-0.5" style={{ color: theme.inkMuted }}>
                                {opt.desc}
                              </div>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 shrink-0" style={{ color: theme.accentText }} />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFunnelStep(2)}
                      className="text-[13px] underline pt-1 inline-block"
                      style={{ color: theme.inkMuted }}
                    >
                      Back
                    </button>
                  </div>
                ) : (
                  /* STEP 4 OF 4 — Exact visual match to user's screenshot */
                  <form onSubmit={handleFunnelSubmit} className="space-y-4">
                    <div className="text-[13px] font-bold" style={{ color: theme.inkPrimary }}>
                      {funnel.step4Question || "Your phone number, and we'll take it from there."}
                    </div>

                    <input
                      type="tel"
                      value={funnelPhone}
                      onChange={(e) => setFunnelPhone(e.target.value)}
                      placeholder={phoneDisplay.replace(/\d{3}-\d{4}$/, "000-0000")}
                      className="w-full px-4 py-3.5 rounded-lg border text-[16px] font-mono focus:outline-none focus:ring-2"
                      style={{
                        borderColor: theme.borderSubtle,
                        color: theme.inkPrimary,
                      }}
                      required
                    />

                    {funnelError && (
                      <p className="text-xs text-rose-600 font-medium">{funnelError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={funnelSubmitting}
                      className="w-full py-3.5 px-6 rounded-lg text-[15px] font-bold text-white shadow-sm transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: theme.accentBg }}
                    >
                      {funnelSubmitting ? "Sending project details…" : funnel.submitButtonText || "Send my project details"}
                    </button>

                    <div>
                      <button
                        type="button"
                        onClick={() => setFunnelStep(3)}
                        className="text-[13px] underline"
                        style={{ color: theme.inkPrimary }}
                      >
                        Back
                      </button>
                    </div>
                  </form>
                )}

                {/* Bottom Reassurance Line matching screenshot */}
                <div
                  className="mt-6 pt-5 border-t text-[12px] leading-relaxed"
                  style={{ borderColor: theme.borderSubtle, color: theme.inkMuted }}
                >
                  Rather just talk it through? Call{" "}
                  <a
                    href={phoneHref}
                    className="font-bold hover:underline font-mono tabular-nums"
                    style={{ color: theme.accentText }}
                  >
                    {phoneDisplay}
                  </a>
                  , {cfg.hoursText || "Mon-Sat, 8 am to 8 pm"}.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. FEATURED WORK / SIGNATURE SERVICES GALLERY */}
        <section
          id="finished-work"
          className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
          style={{ backgroundColor: theme.sectionAltBg, borderColor: theme.borderSubtle }}
        >
          <div className="max-w-[1240px] mx-auto space-y-7 sm:space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1.5 sm:space-y-2 max-w-xl">
                <div
                  className="text-[11px] sm:text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.accentText }}
                >
                  {cfg.sectionHeaders?.showcaseKicker ||
                    `FEATURED ${(cfg.category || site.category || "SERVICES").toUpperCase()} IN ${(cfg.city || site.city).toUpperCase()}`}
                </div>
                <h2
                  className="text-2xl sm:text-4xl font-extrabold tracking-tight"
                  style={{ color: theme.inkPrimary, textWrap: "balance" }}
                >
                  {cfg.sectionHeaders?.showcaseHeading ||
                    `Real ${(cfg.category || site.category || "service").toLowerCase()} results for ${cfg.city || site.city} clients.`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("funnel-card")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white self-start md:self-auto whitespace-nowrap text-center"
                style={{ backgroundColor: theme.accentBg }}
              >
                {cfg.sectionHeaders?.showcaseCta || "Request this service →"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-7">
              {(cfg.finishedWork || []).map((proj: any, idx: number) => {
                const imgSrc = resolveAccurateShowcaseImage(
                  proj,
                  idx,
                  cfg.category || site.category,
                  site.businessName
                );
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl overflow-hidden border flex flex-col justify-between"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <div>
                      <div className="relative aspect-[16/10] w-full bg-stone-200 overflow-hidden">
                        <img
                          src={imgSrc}
                          alt={proj.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const fallback = resolveAccurateShowcaseImage(
                              { ...proj, customImageUrl: "" },
                              idx,
                              cfg.category || site.category,
                              site.businessName
                            );
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2 text-white text-[11px] sm:text-xs font-medium">
                          <span className="truncate">{proj.location}</span>
                          <span className="font-mono shrink-0">{proj.duration}</span>
                        </div>
                      </div>
                      <div className="p-4 sm:p-6 space-y-2">
                        <h3 className="text-base sm:text-lg font-bold leading-snug" style={{ color: theme.inkPrimary }}>
                          {proj.title}
                        </h3>
                        <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.inkMuted }}>
                          {proj.scope}
                        </p>
                      </div>
                    </div>
                    <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTap1Choice(proj.title);
                          setFunnelStep(2);
                          scrollToSection("funnel-card");
                        }}
                        className="text-xs font-bold inline-flex items-center gap-1.5 hover:underline"
                        style={{ color: theme.accentText }}
                      >
                        <span>{cfg.sectionHeaders?.showcaseCardCta || "Request a quote for this service"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. "WHY US" — 4-STEP CUSTOMER PROCESS */}
        <section
          id="why-us"
          className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
          style={{ backgroundColor: theme.canvasBg, borderColor: theme.borderSubtle }}
        >
          <div className="max-w-[1240px] mx-auto space-y-8 sm:space-y-12">
            <div className="max-w-2xl space-y-2.5">
              <div
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider"
                style={{ color: theme.accentText }}
              >
                {cfg.sectionHeaders?.processKicker || `HOW ${site.businessName.toUpperCase()} WORKS · ZERO SURPRISES`}
              </div>
              <h2
                className="text-2xl sm:text-4xl font-extrabold tracking-tight"
                style={{ color: theme.inkPrimary, textWrap: "balance" }}
              >
                {cfg.sectionHeaders?.processHeading || "A clear plan and upfront pricing before we start."}
              </h2>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: theme.inkMuted }}>
                {cfg.sectionHeaders?.processSubheading ||
                  `Here is how ${site.businessName} makes ${(cfg.category || site.category || "service").toLowerCase()} in ${cfg.city || site.city} simple, predictable, and stress-free from day one.`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {(cfg.scheduleSteps || []).map((st: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 sm:p-6 border flex flex-col justify-between space-y-3"
                  style={{ borderColor: theme.borderSubtle }}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold" style={{ color: theme.accentText }}>
                        {st.step}
                      </span>
                      <span style={{ color: theme.inkMuted }}>{st.duration}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold" style={{ color: theme.inkPrimary }}>
                      {st.title}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.inkMuted }}>
                      {st.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. CORE SERVICES SECTION */}
        <section
          id="services"
          className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
          style={{ backgroundColor: theme.sectionAltBg, borderColor: theme.borderSubtle }}
        >
          <div className="max-w-[1240px] mx-auto space-y-7 sm:space-y-10">
            <div className="max-w-2xl space-y-2">
              <div
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider"
                style={{ color: theme.accentText }}
              >
                {cfg.sectionHeaders?.servicesKicker || `OUR CORE SERVICES IN ${(cfg.city || site.city).toUpperCase()}`}
              </div>
              <h2
                className="text-2xl sm:text-4xl font-extrabold tracking-tight"
                style={{ color: theme.inkPrimary, textWrap: "balance" }}
              >
                {cfg.sectionHeaders?.servicesHeading || `Specialized ${(cfg.category || site.category || "services").toLowerCase()} by ${site.businessName}.`}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-7">
              {(cfg.services || []).map((srv: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 sm:p-7 border flex flex-col justify-between space-y-5"
                  style={{ borderColor: theme.borderSubtle }}
                >
                  <div className="space-y-2.5">
                    <div className="text-xs font-mono" style={{ color: theme.inkMuted }}>
                      {srv.index}. {srv.timeline}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold" style={{ color: theme.inkPrimary }}>
                      {srv.title}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.inkMuted }}>
                      {srv.description}
                    </p>
                    <ul className="space-y-2 pt-1">
                      {(srv.deliverables || []).map((d: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-xs font-medium" style={{ color: theme.inkPrimary }}>
                          <Check className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accentText }} />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTap1Choice(srv.title);
                      setFunnelStep(2);
                      scrollToSection("funnel-card");
                    }}
                    className="w-full py-3 px-4 rounded-lg text-xs font-bold border hover:bg-stone-50 transition-colors"
                    style={{ borderColor: theme.borderSubtle, color: theme.inkPrimary }}
                  >
                    {cfg.sectionHeaders?.servicesCardCtaPrefix || "Request"} {srv.title} →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. VERIFIED CUSTOMER REVIEWS & SERVICE AREAS */}
        <section
          id="areas"
          className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
          style={{ backgroundColor: theme.canvasBg, borderColor: theme.borderSubtle }}
        >
          <div className="max-w-[1240px] mx-auto space-y-10 sm:space-y-14">
            {/* Reviews */}
            <div className="space-y-6 sm:space-y-8">
              <div className="max-w-xl space-y-1.5">
                <div
                  className="text-[11px] sm:text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.accentText }}
                >
                  {cfg.sectionHeaders?.reviewsKicker || `VERIFIED CLIENT REVIEWS IN ${(cfg.city || site.city).toUpperCase()}`}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: theme.inkPrimary }}>
                  {cfg.sectionHeaders?.reviewsHeading || `What clients in ${cfg.city || site.city} say about ${site.businessName}.`}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {(cfg.reviews || []).map((rev: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl p-5 sm:p-6 border flex flex-col justify-between space-y-4"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.inkPrimary }}>
                      “{rev.quote}”
                    </p>
                    <div className="pt-3 border-t text-xs" style={{ borderColor: theme.borderSubtle }}>
                      <div className="font-bold" style={{ color: theme.inkPrimary }}>
                        {rev.author}
                      </div>
                      <div style={{ color: theme.inkMuted }}>
                        {rev.neighborhood} · {rev.project}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Areas Bar */}
            <div
              className="bg-white rounded-2xl p-5 sm:p-7 border flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5"
              style={{ borderColor: theme.borderSubtle }}
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: theme.accentText }}>
                  {cfg.sectionHeaders?.areasKicker || "AREAS WE SERVE"}
                </div>
                <h3 className="text-lg sm:text-xl font-bold" style={{ color: theme.inkPrimary }}>
                  {cfg.sectionHeaders?.areasHeading || `Serving ${cfg.city || site.city} and surrounding communities:`}
                </h3>
                <div className="text-xs sm:text-sm pt-1 leading-relaxed" style={{ color: theme.inkMuted }}>
                  {(cfg.serviceAreas || [site.city]).join(" · ")}
                </div>
              </div>
              <a
                href={phoneHref}
                className="px-6 py-3.5 rounded-lg text-sm font-bold text-white whitespace-nowrap shrink-0 text-center"
                style={{ backgroundColor: theme.accentBg }}
              >
                Call {phoneDisplay}
              </a>
            </div>
          </div>
        </section>

        {/* 8. FAQ ACCORDION */}
        <section
          id="faq"
          className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
          style={{ backgroundColor: theme.sectionAltBg, borderColor: theme.borderSubtle }}
        >
          <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
            <div className="space-y-2 text-center">
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: theme.accentText }}>
                {cfg.sectionHeaders?.faqKicker || "STRAIGHT ANSWERS"}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: theme.inkPrimary }}>
                {cfg.sectionHeaders?.faqHeading || `Common questions for ${site.businessName}`}
              </h2>
            </div>

            <div className="space-y-3">
              {(cfg.faqs || []).map((item: any, idx: number) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border overflow-hidden"
                    style={{ borderColor: theme.borderSubtle }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between gap-3 font-bold text-sm sm:text-[15px]"
                      style={{ color: theme.inkPrimary }}
                    >
                      <span>{item.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 shrink-0" style={{ color: theme.inkMuted }} />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: theme.inkMuted }} />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 sm:px-6 pb-4 sm:pb-5 text-xs sm:text-sm leading-relaxed" style={{ color: theme.inkMuted }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 9. QUIET FOOTER + OWNER CLAIM BANNER */}
        <footer
          className="py-10 sm:py-12 pb-24 sm:pb-12 px-4 sm:px-8 lg:px-12 border-t text-xs"
          style={{ backgroundColor: theme.topBarBg, color: "#A8A29E", borderColor: "#292524" }}
        >
          <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-1">
              <div className="text-white font-bold text-sm">{site.businessName}</div>
              <div className="leading-relaxed">
                Serving {(cfg.serviceAreas || [site.city]).slice(0, 4).join(", ")} · {phoneDisplay}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAdminDrawerOpen(true)}
                className="px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-stone-900/90 border border-stone-700 text-stone-300 hover:text-white hover:bg-stone-800 text-center flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                <span>Owner Admin Panel</span>
              </button>
              {!isLiveHostedMode && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("what_changed");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-stone-800 text-stone-200 hover:bg-stone-700 text-center"
                  >
                    See What Changed &amp; Conversion Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimModalOpen(true)}
                    className="px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 text-center"
                  >
                    Own {cfg.brandName || site.businessName}? Claim This Website →
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>

        {/* 10. MOBILE STICKY BOTTOM CALL & INSTANT ESTIMATE BAR */}
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t px-3 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] flex items-center gap-2"
          style={{ borderColor: theme.borderSubtle }}
        >
          <a
            href={phoneHref}
            className="flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 whitespace-nowrap"
            style={{
              borderColor: theme.borderSubtle,
              color: theme.inkPrimary,
              backgroundColor: theme.canvasBg,
            }}
          >
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accentText }} />
            <span className="truncate">Call {phoneDisplay}</span>
          </a>
          <button
            type="button"
            onClick={() => scrollToSection("funnel-card")}
            className="flex-1 py-2.5 px-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 whitespace-nowrap shadow-xs"
            style={{ backgroundColor: theme.accentBg }}
          >
            <span>Free 4-Tap Estimate</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* ─── MOBILE-COMPATIBLE "CLAIM THIS WEBSITE FOR FREE ($0 BUILD FEE)" MODAL ─── */}
      {claimModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClaimModalOpen(false);
          }}
        >
          <div className="bg-white text-slate-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Sticky Modal Header — Never clips on small mobile screens */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-white shrink-0">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  <span>$0 Website Build Fee ($1,500 Value Waived)</span>
                </div>
                <h3 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
                  {claimSuccess
                    ? `Free Website Reserved for ${site.businessName}!`
                    : `Claim Your Free Website: ${site.businessName}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalOpen(false)}
                className="p-2 -mr-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {claimSuccess ? (
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                {/* Top Confirmation + Automatic Email Notice */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs sm:text-sm font-bold text-emerald-950">
                      Step 1 Complete: Your Free Website Is Reserved ($0 Build Fee)
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      We also sent a copy of your activation invoice and payment options to{" "}
                      <strong className="font-mono">{claimEmail || site.email || "your email"}</strong>. Complete Step 2 below using{" "}
                      <strong>Credit Card (Lemon Squeezy)</strong>, <strong>Bank Transfer</strong>, or{" "}
                      <strong>Crypto</strong> to activate your hosting &amp; custom domain immediately.
                    </p>
                  </div>
                </div>

                {/* Package & Total Due Summary */}
                <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 text-xs">
                    <div className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                      Selected Hosting &amp; Growth Package
                    </div>
                    <div className="font-bold text-sm text-white">
                      {site.claimData?.selectedPlan || `${selectedPlanObj.name} ($${selectedPlanObj.monthlyPrice}/mo)`}
                    </div>
                    {selectedAddonObjs.length > 0 && (
                      <div className="text-slate-300 text-[11px]">
                        Add-Ons: {selectedAddonObjs.map((a) => `${a.name} (${a.priceLabel})`).join(" · ")}
                      </div>
                    )}
                    <div className="text-emerald-400 text-[11px] font-semibold">
                      ✓ Custom Website &amp; 4-Tap Estimate Funnel Build: $0.00 (FREE)
                    </div>
                  </div>
                  <div className="sm:text-right border-t sm:border-t-0 border-slate-800 pt-2.5 sm:pt-0 shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Due Today</div>
                    <div className="text-2xl font-extrabold text-amber-400 font-mono">
                      ${site.claimData?.dueToday ?? claimMonthlyTotal + claimOneTimeTotal}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      (${claimMonthlyTotal}/mo{claimOneTimeTotal > 0 ? ` + $${claimOneTimeTotal} one-time` : ""})
                    </div>
                  </div>
                </div>

                {paymentConfirmed ? (
                  <div className="bg-emerald-950 text-emerald-100 border border-emerald-700 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>Payment Confirmation Received — Onboarding Activated!</span>
                    </div>
                    <p className="text-xs text-emerald-200 leading-relaxed">
                      Thank you! Our team has been notified and is now connecting your domain (
                      <span className="font-mono font-semibold">{claimCustomDomain || "your business domain"}</span>
                      ), activating your SSL certificate, and routing all 4-Tap Estimate leads to{" "}
                      <span className="font-mono font-semibold">{claimPhone || site.phone}</span>.
                    </p>
                    <div className="pt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClaimModalOpen(false);
                          setAdminDrawerOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300"
                      >
                        Open Your Website Admin Panel (PIN: {site.siteConfig?.adminPin || "2026"})
                      </button>
                      <button
                        type="button"
                        onClick={() => setClaimModalOpen(false)}
                        className="px-3.5 py-2 rounded-lg bg-emerald-900/80 text-emerald-100 font-semibold text-xs hover:bg-emerald-900"
                      >
                        Return to Website Preview
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Step 2: Choose Your Payment Method to Activate Hosting
                    </div>

                    {/* 3 Payment Method Tabs: Credit Card (Lemon), Bank Transfer, Crypto */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePaymentTab("lemon_card")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          activePaymentTab === "lemon_card"
                            ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <CreditCard className="w-4 h-4 text-amber-700" />
                          <span className="text-[10px] font-bold text-emerald-700">Instant</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">Credit Card</div>
                        <div className="text-[10px] text-slate-500 truncate">Lemon Squeezy</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActivePaymentTab("bank_transfer")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          activePaymentTab === "bank_transfer"
                            ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Building2 className="w-4 h-4 text-blue-700" />
                          <span className="text-[10px] font-bold text-blue-700">0% Fee</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">Bank Transfer</div>
                        <div className="text-[10px] text-slate-500 truncate">ACH / Wire / Zelle</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActivePaymentTab("crypto")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          activePaymentTab === "crypto"
                            ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Coins className="w-4 h-4 text-purple-700" />
                          <span className="text-[10px] font-bold text-purple-700">Web3</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">Crypto</div>
                        <div className="text-[10px] text-slate-500 truncate">USDT / USDC / BTC</div>
                      </button>
                    </div>

                    {/* TAB 1: CREDIT / DEBIT CARD (LEMON SQUEEZY) */}
                    {activePaymentTab === "lemon_card" && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              Pay by Credit Card, Debit Card, or Apple Pay (via Lemon Squeezy)
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              {paymentConfig?.lemonNotes ||
                                "Instant secure card checkout powered by Lemon Squeezy. Supports Visa, Mastercard, Amex, and Apple Pay."}
                            </p>
                          </div>
                        </div>

                        <a
                          href={
                            paymentConfig?.lemonCheckoutUrl ||
                            "https://insidex.lemonsqueezy.com/checkout"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 rounded-xl bg-[#7C4A15] hover:bg-[#633A0F] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>
                            Open Secure Lemon Squeezy Card Checkout ($
                            {site.claimData?.dueToday ?? claimMonthlyTotal + claimOneTimeTotal}) →
                          </span>
                        </a>

                        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Optional: Enter Card Order # or Receipt Email"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={paymentSubmitting}
                            onClick={() => handleConfirmPayment("lemon_card")}
                            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            {paymentSubmitting ? "Confirming…" : "I Completed Card Payment ✓"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: BANK TRANSFER / WIRE / ZELLE */}
                    {activePaymentTab === "bank_transfer" && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <div className="text-xs font-bold text-slate-900">
                          Direct Bank Transfer / Wire / ACH / Zelle Details
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {[
                            {
                              label: "Bank Name",
                              val: paymentConfig?.bankName || "Mercury Business Bank / Chase Commercial",
                            },
                            {
                              label: "Account Holder",
                              val: paymentConfig?.bankAccountName || "Update Design Agency LLC",
                            },
                            {
                              label: "Account Number",
                              val: paymentConfig?.bankAccountNumber || "980144281902",
                            },
                            {
                              label: "Routing / ABA",
                              val: paymentConfig?.bankRoutingNumber || "021000021",
                            },
                            {
                              label: "SWIFT / IBAN",
                              val: paymentConfig?.bankSwiftIban || "CHASUS33 / US980144281902",
                            },
                            {
                              label: "Zelle / Instant Transfer",
                              val: paymentConfig?.zelleOrFasterPay || "jwandersonar@gmail.com",
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                                  {item.label}
                                </div>
                                <div className="font-mono font-bold text-slate-900 truncate">
                                  {item.val}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyPaymentField(item.label, item.val)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedKey === item.label ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {paymentConfig?.bankInstructions ||
                            `Please include "${site.businessName}" as the payment memo/reference so we can match and activate your domain immediately.`}
                        </p>
                        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Enter Sender Name or Bank Transfer Reference #"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={paymentSubmitting}
                            onClick={() => handleConfirmPayment("bank_transfer")}
                            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            {paymentSubmitting ? "Confirming…" : "Confirm Bank Transfer Sent ✓"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: CRYPTO (USDT / USDC / BTC / ETH / SOL) */}
                    {activePaymentTab === "crypto" && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <div className="text-xs font-bold text-slate-900">
                          Instant Crypto Payment ($
                          {site.claimData?.dueToday ?? claimMonthlyTotal + claimOneTimeTotal} USD Equivalent)
                        </div>
                        <div className="space-y-2 text-xs">
                          {(
                            paymentConfig?.cryptoWallets || [
                              {
                                symbol: "USDT",
                                network: "TRC20 / ERC20",
                                address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
                              },
                              {
                                symbol: "USDC",
                                network: "ERC20 / Solana / Base",
                                address: "0x71C...8976F",
                              },
                              {
                                symbol: "BTC",
                                network: "Bitcoin Mainnet",
                                address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
                              },
                            ]
                          ).map((w: any) => (
                            <div
                              key={`${w.symbol}-${w.network}`}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{w.symbol}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono">
                                    {w.network}
                                  </span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-600 truncate mt-0.5">
                                  {w.address}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyPaymentField(w.symbol, w.address)}
                                className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedKey === w.symbol ? "Copied!" : "Copy Address"}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Paste TXID / Transaction Hash or Sending Wallet"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={paymentSubmitting}
                            onClick={() => handleConfirmPayment("crypto")}
                            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0 cursor-pointer"
                          >
                            {paymentSubmitting ? "Confirming…" : "Confirm Crypto Sent ✓"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setClaimModalOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100"
                >
                  Pay Later via Email Invoice · Return to Live Website Preview
                </button>
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit} className="flex flex-col flex-1 min-h-0">
                {/* Scrollable Form Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                  {/* Zero-Risk Free Website Banner */}
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-emerald-950">
                        Custom {site.city} Website &amp; 4-Tap Lead Funnel Already Built for You
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        You get the complete custom website design for <strong>FREE ($0 build fee)</strong>. Simply choose your monthly hosting &amp; care plan below and any optional growth add-ons you want us to turn on.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] line-through text-slate-400 font-mono">$1,500 Build</div>
                      <div className="text-sm font-extrabold text-emerald-700 font-mono">$0 FREE</div>
                    </div>
                  </div>

                  {/* Step 1: Select Monthly Hosting & Care Plan */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      1. Choose Your Hosting &amp; Admin Care Plan (Website Design is $0 Free)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(Object.values(HOSTING_PLANS) as Array<(typeof HOSTING_PLANS)[keyof typeof HOSTING_PLANS]>).map(
                        (plan) => {
                          const active = claimHostingPlan === plan.id;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => setClaimHostingPlan(plan.id)}
                              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                                active
                                  ? "border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20"
                                  : "border-slate-200 hover:border-slate-300 bg-white"
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-amber-800">
                                    {plan.badge}
                                  </span>
                                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                                    ${plan.monthlyPrice}/mo
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-slate-900">{plan.name}</div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">{plan.desc}</p>
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-700 pt-1 border-t border-slate-100 flex items-center justify-between">
                                <span>Website Build Fee: $0 FREE</span>
                                <span>{active ? "✓ Selected" : "Select"}</span>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Step 2: Optional Branding & Lead Growth Add-Ons */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      2. Optional Branding &amp; Lead Growth Add-Ons (Check Any You Want)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {GROWTH_ADDONS.map((addon) => {
                        const checked = claimAddons.includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => toggleClaimAddon(addon.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                              checked
                                ? "border-emerald-600 bg-emerald-50/40"
                                : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                                checked
                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900 leading-snug">
                                  {addon.name}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-700 font-mono shrink-0">
                                  {addon.priceLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-relaxed">{addon.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Contact & Domain Setup */}
                  <div className="space-y-3 pt-1 border-t border-slate-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      3. Where Should We Connect Your Website &amp; Send Leads?
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Your Name (Owner / Manager) *
                        </label>
                        <input
                          type="text"
                          value={claimName}
                          onChange={(e) => setClaimName(e.target.value)}
                          placeholder="e.g. Marcus Vance"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Best Phone for Lead Alerts *
                        </label>
                        <input
                          type="tel"
                          value={claimPhone}
                          onChange={(e) => setClaimPhone(e.target.value)}
                          placeholder="(916) 291-1047"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Work Email Address
                        </label>
                        <input
                          type="email"
                          value={claimEmail}
                          onChange={(e) => setClaimEmail(e.target.value)}
                          placeholder="owner@yourbusiness.com"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Domain Setup Preference
                        </label>
                        <select
                          value={claimDomainPref}
                          onChange={(e) => setClaimDomainPref(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-base sm:text-sm bg-white focus:outline-none"
                        >
                          <option value="connect_existing">Connect to my existing domain</option>
                          <option value="register_new">Register a new .com domain for me</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Any quick edits before launch? (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={claimNotes}
                        onChange={(e) => setClaimNotes(e.target.value)}
                        placeholder="e.g. Update hours to 7am-6pm, add license #, or swap photos…"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                    </div>
                  </div>

                  {claimError && (
                    <p className="text-xs font-semibold text-rose-600">{claimError}</p>
                  )}
                </div>

                {/* Sticky Bottom Submit Footer — Always visible on mobile */}
                <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="text-xs text-slate-600 flex items-center justify-between sm:block">
                    <div>
                      Website Build: <strong className="text-emerald-700 font-mono">$0 FREE</strong>
                    </div>
                    <div className="font-semibold text-slate-900 font-mono">
                      Plan Total: ${claimMonthlyTotal}/mo
                      {claimOneTimeTotal > 0 ? ` + $${claimOneTimeTotal} one-time` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClaimModalOpen(false)}
                      className="px-3.5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 shrink-0"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={claimSubmitting}
                      className="flex-1 sm:flex-initial py-3 px-5 rounded-xl bg-[#7C4A15] hover:bg-[#633A0F] text-white font-bold text-xs sm:text-sm transition-colors shadow-md disabled:opacity-50 text-center leading-snug whitespace-nowrap"
                    >
                      {claimSubmitting
                        ? "Activating Free Website…"
                        : "Claim My Free Website →"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ─── WEBSITE OWNER ADMIN CMS & HOSTING CONTROL DRAWER ─── */}
      <WebsiteOwnerAdminDrawer
        isOpen={adminDrawerOpen}
        onClose={() => setAdminDrawerOpen(false)}
        site={site}
        onSiteUpdated={(updatedSite) => {
          setSite(updatedSite);
          const nextTheme =
            updatedSite?.themeId || updatedSite?.siteConfig?.themeId || activeThemeId;
          setActiveThemeId(nextTheme);
        }}
      />
    </div>
  );
}
