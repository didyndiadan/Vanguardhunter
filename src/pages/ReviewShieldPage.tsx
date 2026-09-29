import React, { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { speakWithStudioVoice, stopStudioVoice } from "@/lib/studio-voices";
import {
  Star,
  Shield,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  Lock,
  Sparkles,
  MessageSquareWarning,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Building2,
  Coins,
  X,
  Phone,
  Globe,
  RotateCcw,
} from "lucide-react";

export default function ReviewShieldPage() {
  const [, params] = useRoute("/review/:siteId");
  const [, setLocation] = useLocation();
  const siteId = params?.siteId || "valley-construction-sacramento";

  const initialPreloaded = (() => {
    if (typeof window === "undefined") return null;
    const w = window as any;
    if (w.__PRELOADED_SITE_DATA__?.site?.siteId === siteId) {
      return w.__PRELOADED_SITE_DATA__;
    }
    try {
      const raw =
        sessionStorage.getItem(`vh_site_cache_${siteId}`) ||
        localStorage.getItem(`vh_site_cache_${siteId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.site) return parsed;
      }
    } catch {}
    return null;
  })();

  const [site, setSite] = useState<any>(() => initialPreloaded?.site || null);
  const [paymentConfig, setPaymentConfig] = useState<any>(() => initialPreloaded?.paymentConfig || null);
  const [loading, setLoading] = useState<boolean>(() => !initialPreloaded?.site);
  const [notFound, setNotFound] = useState(false);

  // Interactive Demo / Live Gate State
  const [viewTab, setViewTab] = useState<"gate" | "qr_poster" | "how_it_works">("gate");
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);

  // 1-3 Star Private Intercept Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Standalone Claim / Activate Modal State
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<"shield_only_97" | "shield_plus_site_147">(
    "shield_only_97"
  );
  const [billingMonths, setBillingMonths] = useState<1 | 3 | 12>(1);
  const [claimName, setClaimName] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState("");

  // Step 2 Payment State
  const [activePaymentTab, setActivePaymentTab] = useState<"lemon_card" | "bank_transfer" | "crypto">(
    "lemon_card"
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const isLiveMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("live") === "1";

  useEffect(() => {
    const w = typeof window !== "undefined" ? (window as any) : null;
    if (w?.__PRELOADED_SITE_DATA__?.site?.siteId === siteId) {
      const data = w.__PRELOADED_SITE_DATA__;
      setSite(data.site);
      if (data.paymentConfig) setPaymentConfig(data.paymentConfig);
      setClaimName(data.site.ownerName || "");
      setClaimEmail(data.site.email || "");
      setClaimPhone(data.site.phone || "");
      setLoading(false);
    } else if (!site) {
      setLoading(true);
    }

    fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}`)
      .then(async (r) => {
        if (!r.ok) {
          if (!site) setNotFound(true);
          return;
        }
        const data = await r.json();
        if (data?.site) {
          setSite(data.site);
          if (data.paymentConfig) setPaymentConfig(data.paymentConfig);
          setClaimName(data.site.ownerName || "");
          setClaimEmail(data.site.email || "");
          setClaimPhone(data.site.phone || "");
          try {
            const serialized = JSON.stringify(data);
            sessionStorage.setItem(`vh_site_cache_${siteId}`, serialized);
            localStorage.setItem(`vh_site_cache_${siteId}`, serialized);
          } catch {}
        } else if (!site) {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!site) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  const copyText = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const reviewShieldUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/review/${siteId}`
      : `/review/${siteId}`;

  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    `${reviewShieldUrl}?live=1`
  )}`;

  const BILLING_DURATIONS = [
    {
      months: 1 as const,
      label: "1 Month",
      discountPct: 0,
      desc: "Monthly · Cancel anytime",
    },
    {
      months: 3 as const,
      label: "3 Months",
      discountPct: 10,
      desc: "Save 10% · Great for Bank/Crypto",
    },
    {
      months: 12 as const,
      label: "12 Months",
      discountPct: 20,
      desc: "Save 20% (2 Months Free)",
    },
  ] as const;

  const PACKAGES = {
    shield_only_97: {
      id: "shield_only_97" as const,
      name: "Standalone 5-Star Review Shield & Bad-Review Blocker",
      monthlyPrice: 97,
      badge: "Standalone · Works With Any Website",
      desc: "Smart 1–3 Star Private Complaint Interceptor, 4–5 Star Google Maps Fast-Track, Printable Counter QR Stand, and SMS/WhatsApp Review Link.",
    },
    shield_plus_site_147: {
      id: "shield_plus_site_147" as const,
      name: "5-Star Review Shield + Full Custom 4-Tap Website Bundle",
      monthlyPrice: 147,
      badge: "Best Value · Save $97/mo",
      desc: "Everything in Review Shield PLUS your custom high-converting 4-Tap Instant Estimate Website, SSL hosting, and Owner Admin CMS.",
    },
  };

  const activePkg = PACKAGES[selectedPackage];
  const activeDur = BILLING_DURATIONS.find((d) => d.months === billingMonths) || BILLING_DURATIONS[0];
  const discountedMonthly = Math.round(activePkg.monthlyPrice * (1 - activeDur.discountPct / 100));
  const dueToday = discountedMonthly * billingMonths;
  const totalSavings = activePkg.monthlyPrice * billingMonths - dueToday;

  const handleStarClick = async (starCount: number) => {
    setSelectedStars(starCount);
    setFeedbackSubmitted(false);
    if (starCount >= 4) {
      // Log 4-5 star Google Maps redirect
      fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/review-shield-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stars: starCount,
          actionType: "google_maps_redirect",
        }),
      }).catch(() => {});
    }
  };

  const handlePrivateFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      await fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/review-shield-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stars: selectedStars || 2,
          customerName,
          customerPhone,
          feedback: feedbackText,
          actionType: "private_intercept",
        }),
      });
      setFeedbackSubmitted(true);
    } catch {
      setFeedbackSubmitted(true);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError("");
    if (!claimName.trim() || !claimPhone.trim()) {
      setClaimError("Please enter your name and phone number to activate your 5-Star Review Shield.");
      return;
    }
    setClaimSubmitting(true);
    try {
      const planLabel =
        billingMonths === 1
          ? `${activePkg.name} — 1 Month Plan ($${discountedMonthly}/mo)`
          : `${activePkg.name} — ${billingMonths} Months Package ($${discountedMonthly}/mo × ${billingMonths} mos = $${dueToday} · Save $${totalSavings})`;

      const res = await fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimedByName: claimName,
          claimedByEmail: claimEmail,
          claimedByPhone: claimPhone,
          domainPreference: "review_shield_activation",
          customDomain: googleMapsUrl,
          customNotes: `Activated via Standalone 5-Star Review Shield Page (/review/${siteId})`,
          selectedPlan: planLabel,
          billingMonths,
          hostingTermTotal: dueToday,
          dueToday,
          selectedAddons:
            selectedPackage === "shield_plus_site_147"
              ? ["Includes Custom 4-Tap Lead Website + 5-Star Review Shield"]
              : ["Standalone 5-Star Review Shield + Counter QR Stand"],
          monthlyTotal: discountedMonthly,
          oneTimeTotal: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit activation");
      if (data.paymentConfig) setPaymentConfig(data.paymentConfig);
      setClaimSuccess(true);
    } catch (err: any) {
      setClaimError(err.message || "Could not submit request");
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleConfirmPayment = async (method: "lemon_card" | "bank_transfer" | "crypto") => {
    setPaymentSubmitting(true);
    try {
      await fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          billingMonths,
          dueToday,
          paymentReference:
            paymentReference.trim() ||
            (method === "lemon_card" ? "Lemon Squeezy Card Checkout" : "Transfer Sent"),
        }),
      });
      setPaymentConfirmed(true);
    } catch {
      setPaymentConfirmed(true);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const hasAutoSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || notFound || !site?.siteId || isLiveMode) return;
    if (hasAutoSpokenRef.current === site.siteId) return;
    hasAutoSpokenRef.current = site.siteId;

    const preferredVoice =
      site?.siteConfig?.chatbotConfig?.voicePersona ||
      site?.siteConfig?.walkthroughVoice ||
      "Kore";
    const ownerFirst = site.ownerName
      ? String(site.ownerName).trim().split(/\s+/)[0]
      : "";
    const greeting = ownerFirst ? `Hi ${ownerFirst}!` : `Hi there!`;
    const cityPhrase = site.city ? ` in ${site.city}` : "";
    const scriptText = `${greeting} Welcome to the custom 5-Star Review Shield we built for ${site.businessName}${cityPhrase}. Try tapping 5 stars below to see how happy customers are routed straight to your Google Maps listing, or tap 1 to 3 stars to see how complaints are privately intercepted before they ever go public!`;

    const timer = setTimeout(() => {
      speakWithStudioVoice(scriptText, preferredVoice, {
        businessName: site.businessName || "Our Team",
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [loading, notFound, site?.siteId, site?.businessName, site?.city, site?.ownerName, isLiveMode]);

  useEffect(() => {
    return () => {
      stopStudioVoice();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-slate-900">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold">Review Shield Not Found</h1>
          <p className="text-xs text-slate-400">
            Please check the URL or generate a Review Shield link from the AI Builder dashboard.
          </p>
        </div>
      </div>
    );
  }

  const googleMapsSearchHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${site.businessName} ${site.city || ""}`
  )}`;

  const starLabels: Record<number, string> = {
    1: "1 Star — Very Dissatisfied (Intercepted Privately)",
    2: "2 Stars — Below Expectations (Intercepted Privately)",
    3: "3 Stars — Needs Improvement (Intercepted Privately)",
    4: "4 Stars — Great Experience! (Sent to Google Maps)",
    5: "5 Stars — Outstanding! (Sent Straight to Google Maps)",
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col">
      {/* ─── TOP OWNER PITCH & DEMO BAR (Hidden when ?live=1 is used for real customers) ─── */}
      {!isLiveMode && (
        <div className="sticky top-0 z-50 bg-slate-950 text-white border-b border-slate-800 px-3 sm:px-6 py-2.5 shadow-lg">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider shrink-0">
                Live Interactive Demo
              </span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                5-Star Review Shield &amp; Bad-Review Blocker for {site.businessName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setViewTab("gate")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    viewTab === "gate" ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:text-white"
                  }`}
                >
                  ★ Test Review Shield
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("qr_poster")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    viewTab === "qr_poster"
                      ? "bg-amber-400 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  QR Counter Stand
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("how_it_works")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    viewTab === "how_it_works"
                      ? "bg-amber-400 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  How It Protects You
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActivateModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Activate Review Shield ($97/mo) →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOP-OF-PAGE POWERFUL PITCH & CLAIM / ACTIVATE BANNER (Hidden when ?live=1 is used for real customers) ─── */}
      {!isLiveMode && (
        <section className="bg-gradient-to-b from-slate-950 via-[#0F172A] to-slate-900 text-white py-5 sm:py-7 px-4 sm:px-8 border-b-2 border-amber-400/40 shadow-xl">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Custom Built for {site.businessName} ({site.city}) · Protect Your Google Rating &amp; Win More Local Calls</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                We Built This 5-Star Review Shield for {site.businessName} —{" "}
                <span className="text-amber-400 underline decoration-amber-400/40 underline-offset-4">
                  Claim &amp; Activate Now
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Happy 4–5★ customers are routed straight to your Google Maps review page in 1 tap, while 1–3★ complaints are privately intercepted to your phone before they ever go public. You can also bundle your full custom 4-Tap Lead Website at $0 build fee.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <a
                href={`/site/${site.siteId}`}
                className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-center whitespace-nowrap"
              >
                View Your Custom Website →
              </a>
              <button
                type="button"
                onClick={() => setActivateModalOpen(true)}
                className="px-5 py-3.5 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20 text-center cursor-pointer whitespace-nowrap"
              >
                Claim Shield + Website Now →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Interactive Tester Hint Banner for Business Owner */}
        {!isLiveMode && viewTab === "gate" && (
          <div className="w-full max-w-xl mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Owner Preview: Try Tapping Both Good &amp; Bad Ratings Below!</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Tap <strong>1–3 Stars</strong> to see how unhappy customers are caught privately. Then tap{" "}
                <strong>5 Stars</strong> to see how happy customers are sent straight to your Google Maps!
              </p>
            </div>
            {selectedStars !== null && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStars(null);
                  setFeedbackSubmitted(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-bold flex items-center gap-1 shrink-0 hover:bg-amber-100 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Test</span>
              </button>
            )}
          </div>
        )}

        {/* ─── TAB 1: THE INTERACTIVE 5-STAR REVIEW SHIELD GATE ─── */}
        {viewTab === "gate" && (
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
            {/* Business Header */}
            <div className="bg-slate-900 text-white p-6 sm:p-8 text-center space-y-2 border-b border-slate-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                <Shield className="w-3.5 h-3.5" />
                <span>Verified Customer Experience Portal · {site.city}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {site.businessName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                Thank you for choosing {site.businessName}! Your feedback takes 10 seconds and helps us serve{" "}
                {site.city} even better.
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Star Selector */}
              <div className="text-center space-y-3">
                <div className="text-sm sm:text-base font-bold text-slate-800">
                  How would you rate your experience with us today?
                </div>

                <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoveredStar || selectedStars || 0) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onClick={() => handleStarClick(star)}
                        className={`p-2.5 sm:p-3.5 rounded-2xl border-2 transition-all transform hover:scale-110 cursor-pointer ${
                          active
                            ? "border-amber-400 bg-amber-50/70 shadow-md"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                        }`}
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${
                            active ? "fill-amber-400 text-amber-400" : "text-slate-300"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs font-semibold text-slate-500 min-h-[20px]">
                  {hoveredStar
                    ? starLabels[hoveredStar]
                    : selectedStars
                    ? starLabels[selectedStars]
                    : "Tap a star above (1 = Poor, 5 = Excellent)"}
                </div>
              </div>

              {/* Quick Demo Switch Buttons for Business Owner */}
              {!isLiveMode && selectedStars === null && (
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleStarClick(5)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>😊 Simulate 5-Star Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStarClick(2)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>😠 Simulate 2-Star Unhappy Customer</span>
                  </button>
                </div>
              )}

              {/* ─── PATH A: 4 OR 5 STARS → GOOGLE MAPS PUBLIC REVIEW FAST-TRACK ─── */}
              {selectedStars !== null && selectedStars >= 4 && (
                <div className="bg-emerald-50/90 border-2 border-emerald-500 rounded-2xl p-5 sm:p-6 space-y-4 animate-in fade-in">
                  {!isLiveMode && (
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-900 text-emerald-100 text-[11px] font-bold flex items-center justify-between">
                      <span>✓ SHIELD RESULT: 4–5★ Happy Customer → Sent Straight to Google Maps!</span>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-extrabold text-emerald-950">
                        Thank You for Your {selectedStars}-Star Rating!
                      </h3>
                      <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                        As a local {site.city} business, public Google reviews mean the world to our team. Would you mind sharing your experience on Google Maps? It takes just 15 seconds!
                      </p>
                    </div>
                  </div>

                  <a
                    href={googleMapsSearchHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <span>Post Your {selectedStars}-Star Review on Google Maps</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* ─── PATH B: 1, 2, OR 3 STARS → PRIVATE OWNER INTERCEPT (BLOCKED FROM GOOGLE!) ─── */}
              {selectedStars !== null && selectedStars <= 3 && (
                <div className="bg-amber-50/70 border-2 border-amber-500 rounded-2xl p-5 sm:p-6 space-y-4 animate-in fade-in">
                  {!isLiveMode && (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-300 text-[11px] font-bold flex items-center justify-between">
                      <span>🛡️ SHIELD ACTIVATED: {selectedStars}★ Rating Blocked from Google Maps &amp; Kept Private!</span>
                    </div>
                  )}

                  {feedbackSubmitted ? (
                    <div className="text-center py-4 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Sent Privately to Ownership Management
                      </h3>
                      <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                        Thank you for letting us know directly. The owner of {site.businessName} has been notified privately and will reach out to resolve this for you right away.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handlePrivateFeedbackSubmit} className="space-y-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <MessageSquareWarning className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                            We’re Sorry We Didn’t Earn 5 Stars Today
                          </h3>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            We want to make this right immediately. Send a direct private note to the owner of{" "}
                            <strong>{site.businessName}</strong> below so we can personally fix the issue:
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Your Name"
                          required
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Your Phone Number (For Owner Call-Back)"
                          required
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <textarea
                        rows={3}
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell the owner what happened and how we can make it right for you…"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />

                      <button
                        type="submit"
                        disabled={submittingFeedback}
                        className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                      >
                        {submittingFeedback
                          ? "Sending Private Alert to Owner…"
                          : "Send Private Message Directly to Owner →"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: PRINTABLE QR COUNTER STAND & SMS REVIEW LINK ─── */}
        {viewTab === "qr_poster" && (
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
              <QrCode className="w-3.5 h-3.5" />
              <span>Ready-to-Print Counter Stand &amp; Technician QR Card</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 text-white max-w-sm mx-auto space-y-4 border border-slate-800 shadow-lg">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Scan to Rate Your Experience
              </div>
              <div className="text-lg font-extrabold text-white">{site.businessName}</div>
              <div className="bg-white p-3 rounded-2xl inline-block mx-auto">
                <img
                  src={qrCodeImageUrl}
                  alt={`QR Code for ${site.businessName}`}
                  className="w-48 h-48 mx-auto"
                />
              </div>
              <div className="flex justify-center gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400" />
                ))}
              </div>
              <p className="text-[11px] text-slate-300">
                Open your phone camera and point it at the QR code above to share your feedback in 10 seconds!
              </p>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <div className="text-xs font-bold text-slate-700">
                Your Direct SMS / WhatsApp Review Shield Link:
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${reviewShieldUrl}?live=1`}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${reviewShieldUrl}?live=1`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: HOW IT PROTECTS YOUR GOOGLE RATING ─── */}
        {viewTab === "how_it_works" && (
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Works With Any Existing Website or Standalone
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Why {site.businessName} Needs the 5-Star Review Shield
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-xs font-extrabold text-amber-700 uppercase">Step 1</div>
                <div className="text-sm font-bold text-slate-900">Customer Scans QR or Clicks Text</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  After a job or visit, your customer taps 1 to 5 stars on your branded rating page.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="text-xs font-extrabold text-emerald-700 uppercase">Step 2 (4–5 Stars)</div>
                <div className="text-sm font-bold text-emerald-950">Public Google Maps Review</div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Happy 4 &amp; 5-star customers are automatically redirected to post their glowing review on Google Maps.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
                <div className="text-xs font-extrabold text-rose-700 uppercase">Step 3 (1–3 Stars)</div>
                <div className="text-sm font-bold text-rose-950">Bad Review Blocked Privately</div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Unhappy customers are kept OFF Google Maps and routed to a private resolution form sent straight to your phone.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-amber-400">
                  We Also Built a Free Custom 4-Tap Website for {site.businessName}
                </div>
                <p className="text-xs text-slate-300">
                  Want to see your custom website preview too? Or activate just the Review Shield standalone.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/site/${siteId}`}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>View Free Website</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivateModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                >
                  Activate Shield ($97/mo) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Pitch Callout Bar for Owner */}
        {!isLiveMode && (
          <div className="w-full max-w-xl mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white border border-slate-800">
            <div className="text-xs">
              <span className="font-bold text-amber-400">Own {site.businessName}?</span> Activate this 5-Star Review Shield standalone ($97/mo) or bundle it with your free website.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/site/${siteId}`}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                See Free Website
              </a>
              <button
                type="button"
                onClick={() => setActivateModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
              >
                Activate Now →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── ACTIVATE STANDALONE REVIEW SHIELD MODAL (WITH 1 / 3 / 12 MONTHS + LEMON / BANK / CRYPTO) ─── */}
      {activateModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivateModalOpen(false);
          }}
        >
          <div className="bg-white text-slate-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-white shrink-0">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  24/7 Google Rating Protection · Works With Any Website
                </div>
                <h3 className="text-base sm:text-xl font-bold text-slate-900">
                  {claimSuccess
                    ? `Review Shield Reserved for ${site.businessName}!`
                    : `Activate 5-Star Review Shield: ${site.businessName}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivateModalOpen(false)}
                className="p-2 -mr-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {claimSuccess ? (
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 space-y-1">
                    <div className="font-bold text-sm">
                      Step 1 Complete: Your 5-Star Review Shield Is Reserved!
                    </div>
                    <p>
                      Complete Step 2 below via <strong>Credit Card (Lemon Squeezy)</strong>,{" "}
                      <strong>Bank Transfer</strong>, or <strong>Crypto</strong> to activate your live Google Maps redirect and receive your printable Counter QR Stand.
                    </p>
                  </div>
                </div>

                {/* Summary + 1 / 3 / 12 Month Switcher */}
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <div className="text-amber-400 font-bold uppercase text-[10px]">
                        Selected Package ({billingMonths} {billingMonths === 1 ? "Month" : "Months"})
                      </div>
                      <div className="font-bold text-sm">{activePkg.name}</div>
                      {totalSavings > 0 && (
                        <div className="text-emerald-400 text-[11px] font-semibold">
                          ✓ Multi-Month Discount Applied: You Save ${totalSavings}
                        </div>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <div className="text-[10px] uppercase text-slate-400">Total Due Today</div>
                      <div className="text-2xl font-extrabold text-amber-400 font-mono">${dueToday}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        (${discountedMonthly}/mo × {billingMonths} mo{billingMonths > 1 ? "s" : ""})
                      </div>
                    </div>
                  </div>

                  {!paymentConfirmed && (
                    <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300">
                        Switch Billing Duration (Save up to 20% on 3 or 12 months):
                      </span>
                      <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 gap-1">
                        {BILLING_DURATIONS.map((dur) => (
                          <button
                            key={dur.months}
                            type="button"
                            onClick={() => setBillingMonths(dur.months)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                              billingMonths === dur.months
                                ? "bg-amber-400 text-slate-950"
                                : "text-slate-300 hover:text-white"
                            }`}
                          >
                            {dur.label}
                            {dur.discountPct > 0 ? ` (-${dur.discountPct}%)` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {paymentConfirmed ? (
                  <div className="bg-emerald-950 text-emerald-100 border border-emerald-700 rounded-xl p-4 space-y-2">
                    <div className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Payment Confirmed — Your 5-Star Review Shield Is Active!</span>
                    </div>
                    <p className="text-xs text-emerald-200">
                      Your direct customer link (
                      <span className="font-mono">{reviewShieldUrl}?live=1</span>) and QR Counter Stand are ready to use immediately.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePaymentTab("lemon_card")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 cursor-pointer ${
                          activePaymentTab === "lemon_card"
                            ? "border-amber-600 bg-amber-50/70"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-amber-700" />
                        <div className="text-xs font-bold">Credit Card</div>
                        <div className="text-[10px] text-slate-500">Lemon Squeezy</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePaymentTab("bank_transfer")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 cursor-pointer ${
                          activePaymentTab === "bank_transfer"
                            ? "border-amber-600 bg-amber-50/70"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <Building2 className="w-4 h-4 text-blue-700" />
                        <div className="text-xs font-bold">Bank Transfer</div>
                        <div className="text-[10px] text-slate-500">ACH / Wire / Zelle</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePaymentTab("crypto")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 cursor-pointer ${
                          activePaymentTab === "crypto"
                            ? "border-amber-600 bg-amber-50/70"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <Coins className="w-4 h-4 text-purple-700" />
                        <div className="text-xs font-bold">Crypto</div>
                        <div className="text-[10px] text-slate-500">USDT / USDC / BTC</div>
                      </button>
                    </div>

                    {activePaymentTab === "lemon_card" && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <a
                          href={
                            paymentConfig?.lemonCheckoutUrl ||
                            paymentConfig?.lemonCheckoutUrl97 ||
                            "https://insidex.lemonsqueezy.com/checkout"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Open Lemon Squeezy Card Checkout (${dueToday}) →</span>
                        </a>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Optional: Order # or Receipt Email"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmPayment("lemon_card")}
                            className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                          >
                            I Paid by Card ✓
                          </button>
                        </div>
                      </div>
                    )}

                    {activePaymentTab === "bank_transfer" && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            {
                              label: "Bank Name",
                              val: paymentConfig?.bankName || "Mercury Business Bank / Chase Commercial",
                            },
                            {
                              label: "Account Holder",
                              val:
                                paymentConfig?.bankAccountName ||
                                paymentConfig?.accountHolderName ||
                                "Update Design Agency LLC",
                            },
                            {
                              label: "Account Number",
                              val:
                                paymentConfig?.bankAccountNumber ||
                                paymentConfig?.accountNumber ||
                                "980144281902",
                            },
                            {
                              label: "Zelle / Routing",
                              val:
                                paymentConfig?.zelleOrFasterPay ||
                                paymentConfig?.ibanOrZelle ||
                                "jwandersonar@gmail.com",
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
                                <div className="font-mono font-bold truncate">{item.val}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyText(item.label, item.val)}
                                className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold cursor-pointer"
                              >
                                {copiedKey === item.label ? "Copied" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Sender Name or Transfer Reference #"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmPayment("bank_transfer")}
                            className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                          >
                            Confirm Bank Transfer ✓
                          </button>
                        </div>
                      </div>
                    )}

                    {activePaymentTab === "crypto" && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                        <div className="font-bold">Send ${dueToday} USD Equivalent in USDT / USDC / BTC:</div>
                        <div className="space-y-2">
                          {(
                            paymentConfig?.cryptoWallets || [
                              {
                                symbol: "USDT (TRC20)",
                                address:
                                  paymentConfig?.wallets?.usdt_trc20 ||
                                  "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
                              },
                              {
                                symbol: "USDC (ERC20/Base)",
                                address:
                                  paymentConfig?.wallets?.usdc_base ||
                                  "0x71C94F8B2E6A1D3098F4C2A9B5E8D104F7A3C92B",
                              },
                              {
                                symbol: "BTC",
                                address:
                                  paymentConfig?.wallets?.btc ||
                                  "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
                              },
                            ]
                          ).map((w: any) => (
                            <div
                              key={w.symbol}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-bold">{w.symbol}</div>
                                <div className="font-mono text-[11px] text-slate-600 truncate">
                                  {w.address}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyText(w.symbol, w.address)}
                                className="px-2.5 py-1 rounded bg-slate-100 text-[10px] font-bold cursor-pointer"
                              >
                                {copiedKey === w.symbol ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Paste TXID / Transaction Hash"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmPayment("crypto")}
                            className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                          >
                            Confirm Crypto Sent ✓
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleActivateSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                  {/* 1. Billing Duration (1 / 3 / 12 Months) */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      1. Choose Billing Duration (Save up to 20% on 3 or 12 Months)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {BILLING_DURATIONS.map((dur) => {
                        const active = billingMonths === dur.months;
                        return (
                          <button
                            key={dur.months}
                            type="button"
                            onClick={() => setBillingMonths(dur.months)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              active
                                ? "border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/20"
                                : "border-slate-200 bg-slate-50/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                                {dur.label}
                              </span>
                              {dur.discountPct > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                  -{dur.discountPct}%
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">{dur.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Standalone vs Website Bundle */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      2. Choose Standalone Review Shield or Website Bundle
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(Object.values(PACKAGES) as Array<(typeof PACKAGES)[keyof typeof PACKAGES]>).map(
                        (pkg) => {
                          const active = selectedPackage === pkg.id;
                          const pkgMo = Math.round(
                            pkg.monthlyPrice * (1 - activeDur.discountPct / 100)
                          );
                          const pkgTotal = pkgMo * billingMonths;
                          return (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => setSelectedPackage(pkg.id)}
                              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between gap-2 cursor-pointer ${
                                active
                                  ? "border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-amber-800">
                                    {pkg.badge}
                                  </span>
                                  <span className="text-sm font-extrabold font-mono text-slate-900">
                                    ${pkgMo}/mo
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-slate-900">{pkg.name}</div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">{pkg.desc}</p>
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-700 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                                <span>
                                  {billingMonths === 1
                                    ? "Billed monthly"
                                    : `$${pkgTotal} total for ${billingMonths} months`}
                                </span>
                                <span>{active ? "✓ Selected" : "Select"}</span>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* 3. Business Owner Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        value={claimName}
                        onChange={(e) => setClaimName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Best Phone for Private Complaint Alerts *
                      </label>
                      <input
                        type="tel"
                        value={claimPhone}
                        onChange={(e) => setClaimPhone(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address (For Invoice &amp; QR Stand PDF)
                      </label>
                      <input
                        type="email"
                        value={claimEmail}
                        onChange={(e) => setClaimEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Your Google Maps Link (Optional — we auto-connect)
                      </label>
                      <input
                        type="text"
                        value={googleMapsUrl}
                        onChange={(e) => setGoogleMapsUrl(e.target.value)}
                        placeholder="Paste Google Maps URL or leave blank"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  {claimError && <p className="text-xs font-bold text-rose-600">{claimError}</p>}
                </div>

                <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <div className="text-slate-500">
                      Total Due Today ({billingMonths} {billingMonths === 1 ? "Month" : "Months"}):
                    </div>
                    <div className="text-base font-extrabold font-mono text-slate-900">
                      ${dueToday} USD
                      {totalSavings > 0 && (
                        <span className="ml-1.5 text-[11px] text-emerald-700 font-bold">
                          (Save ${totalSavings})
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={claimSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm cursor-pointer"
                  >
                    {claimSubmitting ? "Activating…" : "Continue to Payment Options →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
