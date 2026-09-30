import React, { useState, useEffect, useCallback } from "react";
import {
  AiTrainingProfile,
  TrainedServiceOffer,
  saasFetch,
  getCachedTrainingProfile,
  setCachedTrainingProfile,
} from "@/lib/saas-auth";
import {
  Sparkles,
  Check,
  RefreshCw,
  Building2,
  User,
  Globe,
  Mail,
  FileText,
  Wand2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Layers,
  Target,
} from "lucide-react";

interface TrainYourAIPanelProps {
  initialProfile?: AiTrainingProfile | null;
  userFullName?: string;
  userCompanyName?: string;
  userEmail?: string;
  onSaved?: (profile: AiTrainingProfile) => void;
  onNavigateToHunter?: () => void;
}

const PRESET_TEMPLATES: Array<{
  id: string;
  label: string;
  offerDetails: string;
  servicesOffered: TrainedServiceOffer[];
  targetPainPoints: string;
  subjectLineGuide: string;
  staticEmailExample: (sender: string, company: string) => string;
  aiInstructions: string;
  callToAction: string;
}> = [
  {
    id: "website_review_service",
    label: "Website Creation & Review Service (Primary Offer)",
    offerDetails:
      "We build modern, high-converting websites and automated 5-star Google review generation systems for local businesses.",
    servicesOffered: [
      {
        id: "srv_website_creation",
        name: "Website Creation & Mobile Redesign",
        description:
          "Custom, fast-loading business website with mobile click-to-call, clear service pages, and instant quote/booking capture.",
        targetSignals:
          "No website, outdated design, weak mobile layout, or low conversion rate",
      },
      {
        id: "srv_review_service",
        name: "5-Star Review Service & Reputation Shield",
        description:
          "Direct review generation link and automated review funnel that routes happy clients to Google Reviews while capturing private feedback first.",
        targetSignals:
          "Low Google review count, inconsistent new reviews, or no direct review collection link",
      },
    ],
    targetPainPoints:
      "Missing or outdated website, mobile visitors dropping off without calling, and satisfied customers leaving without posting a 5-star Google review.",
    subjectLineGuide: "New website preview & review page for {{BusinessName}}",
    staticEmailExample: (sender, company) => `Hi {{BusinessName}} Team,

I was looking at {{BusinessName}} in {{City}} today and put together a custom website preview and a 5-star Google review collection page tailored for your team.

At ${company}, our primary focus is helping {{Category}} businesses turn more local searches into booked clients with a clean, mobile-ready website and a simple review system that steadily grows your 5-star reputation.

If you're open to it, I can share the live website preview and review link for {{BusinessName}} right away.

Best regards,
${sender}
${company}`,
    aiInstructions:
      "Evaluate each business's website audit and diagnostic signals first. Only make Website Creation and/or 5-Star Review Service the primary offer when the audit indicates the business actually needs a website/redesign or review generation system. Keep the cold email classic, simple, and professional, and naturally include the live website preview or review link when generated.",
    callToAction: "Would you like me to send over the live website preview and review page for {{BusinessName}}?",
  },
  {
    id: "web_ai_agency",
    label: "Web Design, AI Receptionist & SEO",
    offerDetails:
      "We build high-converting websites, online booking systems, 24/7 AI receptionists, and local Google Maps SEO campaigns for local businesses.",
    servicesOffered: [
      {
        id: "srv_web_redesign",
        name: "High-Converting Website & Mobile Redesign",
        description:
          "Modern, fast-loading website with clear service pages, trust badges, and instant quote/lead capture forms that turn visitors into paying clients.",
        targetSignals:
          "No website, outdated design, poor mobile experience, slow load speed, or missing clear call-to-action",
      },
      {
        id: "srv_ai_receptionist",
        name: "24/7 AI Receptionist & Automated Booking System",
        description:
          "AI web chat and missed-call text-back assistant that answers customer questions 24/7, captures leads, and books appointments automatically.",
        targetSignals:
          "No online booking calendar, no live chat/AI assistant on site, or missed customer inquiries after hours",
      },
      {
        id: "srv_local_seo",
        name: "Local SEO & Google Maps Top-3 Optimization",
        description:
          "Google Business Profile optimization, local citation building, and review automation to rank in the top 3 local results.",
        targetSignals:
          "Weak SEO score, low Google visibility, missing local keywords, or strong website that needs more traffic",
      },
    ],
    targetPainPoints:
      "Outdated website design, slow mobile experience, no instant online booking or quote form, and missed customer inquiries after hours.",
    subjectLineGuide: "Quick idea for {{BusinessName}} in {{City}}",
    staticEmailExample: (sender, company) => `Hi {{BusinessName}} Team,

I was looking at {{BusinessName}} in {{City}} today and noticed a couple of quick areas where new customers searching online might be dropping off before booking with you.

At ${company}, we help {{Category}} businesses capture more local leads with modern, conversion-ready websites, 24/7 automated booking assistants, and local search growth—without adding extra work for your staff.

If you're open to it, I'd love to share 2–3 specific ideas tailored to {{BusinessName}}. Just reply to this email and I'll send them right over.

Best regards,
${sender}
${company}`,
    aiInstructions:
      "Follow my static email message above as the blueprint. Analyze the scraped business's website and gaps, pick the #1 most relevant offer from my Multiple Offers/Services list, and focus the pitch on that specific service. Keep it under 150 words and sign off with my name and business.",
    callToAction: "If you're open to it, just reply to this email and I'll send over 2–3 tailored ideas.",
  },
  {
    id: "marketing_seo",
    label: "Marketing, Paid Ads & Review Automation",
    offerDetails:
      "We provide local SEO, Google Maps ranking optimization, paid lead generation ads, and automated 5-star review systems.",
    servicesOffered: [
      {
        id: "srv_gmaps_seo",
        name: "Google Maps & Local Search Domination",
        description:
          "Rank your business in the top 3 Google Maps pack in your city so high-intent local customers call you before competitors.",
        targetSignals: "Low SEO score, missing meta tags/local schema, or competitors ranking higher in their city",
      },
      {
        id: "srv_paid_ads",
        name: "Done-For-You Google & Meta Lead Gen Ads",
        description:
          "Targeted local ad campaigns with dedicated landing pages delivering 25–50+ exclusive customer inquiries per month.",
        targetSignals: "Good website and operations, but needs immediate, predictable high-ticket client volume",
      },
      {
        id: "srv_reputation",
        name: "Automated 5-Star Review & Reputation Engine",
        description:
          "Automated SMS/email follow-up system that turns happy customers into 5-star Google reviews every week.",
        targetSignals: "Few online reviews, low social proof on website, or no automated customer follow-up",
      },
    ],
    targetPainPoints:
      "Low visibility on Google Maps and local search, competitors ranking higher in their city, and inconsistent monthly lead flow.",
    subjectLineGuide: "More local clients for {{BusinessName}} in {{City}}",
    staticEmailExample: (sender, company) => `Hi {{BusinessName}} Team,

I was searching for {{Category}} businesses in {{City}} earlier and noticed {{BusinessName}}. You have a great local reputation, but a few nearby competitors are currently capturing the top search spots where new customers look first.

At ${company}, we specialize in helping {{Category}} businesses dominate local search in {{City}} and bring in a steady stream of high-intent clients every month.

Would you be open to seeing a quick breakdown of how we could help {{BusinessName}} capture more local customers? Just reply to this email and I'll share it.

Best regards,
${sender}
${company}`,
    aiInstructions:
      "Use my static message above as the exact style and structure. Match the scraped business to the best service from my Multiple Offers list based on their analysis gaps, keep it warm and concise (under 150 words), and end with my signature.",
    callToAction: "Reply to this email if you'd like me to send over the local growth breakdown for your business.",
  },
  {
    id: "b2b_commercial",
    label: "B2B Automation, CRM & Commercial Services",
    offerDetails:
      "We provide B2B workflow automation, custom CRM pipelines, and dedicated commercial growth systems that reduce overhead by 20–30%.",
    servicesOffered: [
      {
        id: "srv_crm_pipeline",
        name: "Custom CRM & Lead Follow-Up Automation",
        description:
          "Centralized CRM pipeline with instant SMS/email lead response so zero inbound inquiries slip through the cracks.",
        targetSignals: "Basic contact form only, slow response times, or manual lead tracking",
      },
      {
        id: "srv_ai_support",
        name: "AI Customer Support & Appointment Triage Agent",
        description:
          "Custom-trained AI agent that handles FAQs, qualifies commercial inquiries, and schedules consultations directly on your calendar.",
        targetSignals: "High inquiry volume, no live chat or automated qualification on website",
      },
      {
        id: "srv_b2b_portal",
        name: "Client Portal & Online Quote Calculator",
        description:
          "Interactive online estimator and client onboarding portal that speeds up proposal closing by 40%.",
        targetSignals: "Service business with no online quote request, pricing estimator, or client portal",
      },
    ],
    targetPainPoints:
      "High operational overhead, slow lead follow-up, manual quote handling, and lack of automated client onboarding.",
    subjectLineGuide: "Partnership inquiry for {{BusinessName}}",
    staticEmailExample: (sender, company) => `Hi {{BusinessName}} Team,

I've been following {{BusinessName}} in {{City}} and wanted to reach out directly.

My name is ${sender} from ${company}. We partner with established {{Category}} businesses in {{City}} to automate client intake, speed up quote conversion, and streamline day-to-day operations.

If you're open to a quick comparison, reply to this email and I'll send over a brief overview tailored to {{BusinessName}}.

Best regards,
${sender}
${company}`,
    aiInstructions:
      "Keep the tone professional, respectful, and executive. Select the best-fitting B2B service from my Multiple Offers catalog for the scraped business, personalize it for their name, category, and city, and keep it under 130 words.",
    callToAction: "Just reply to this email if you'd like me to send over our tailored overview and pricing.",
  },
];

export default function TrainYourAIPanel({
  initialProfile,
  userFullName,
  userCompanyName,
  userEmail,
  onSaved,
  onNavigateToHunter,
}: TrainYourAIPanelProps) {
  const cachedInit = initialProfile || getCachedTrainingProfile();
  const [loading, setLoading] = useState(!cachedInit);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [senderName, setSenderName] = useState(cachedInit?.senderName || userFullName || "Alex Morgan");
  const [businessName, setBusinessName] = useState(cachedInit?.businessName || userCompanyName || "Apex Digital Growth");
  const [websiteUrl, setWebsiteUrl] = useState(cachedInit?.websiteUrl || "");
  const [senderEmail, setSenderEmail] = useState(cachedInit?.senderEmail || userEmail || "");
  const [servicesOffered, setServicesOffered] = useState<TrainedServiceOffer[]>(
    cachedInit?.servicesOffered && cachedInit.servicesOffered.length > 0
      ? cachedInit.servicesOffered
      : PRESET_TEMPLATES[0].servicesOffered
  );
  const [offerDetails, setOfferDetails] = useState(
    cachedInit?.offerDetails || PRESET_TEMPLATES[0].offerDetails
  );
  const [targetPainPoints, setTargetPainPoints] = useState(
    cachedInit?.targetPainPoints || PRESET_TEMPLATES[0].targetPainPoints
  );
  const [staticEmailExample, setStaticEmailExample] = useState(
    cachedInit?.staticEmailExample ||
      PRESET_TEMPLATES[0].staticEmailExample(
        cachedInit?.senderName || userFullName || "Alex Morgan",
        cachedInit?.businessName || userCompanyName || "Apex Digital Growth"
      )
  );
  const [subjectLineGuide, setSubjectLineGuide] = useState(
    cachedInit?.subjectLineGuide || PRESET_TEMPLATES[0].subjectLineGuide
  );
  const [aiInstructions, setAiInstructions] = useState(
    cachedInit?.aiInstructions || PRESET_TEMPLATES[0].aiInstructions
  );
  const [tone, setTone] = useState<AiTrainingProfile["tone"]>(cachedInit?.tone || "conversational");
  const [callToAction, setCallToAction] = useState(
    cachedInit?.callToAction || PRESET_TEMPLATES[0].callToAction
  );
  const [includeAuditReportLink, setIncludeAuditReportLink] = useState<boolean>(
    cachedInit?.includeAuditReportLink ?? true
  );
  const [isTrained, setIsTrained] = useState<boolean>(cachedInit?.isTrained ?? false);
  const [updatedAt, setUpdatedAt] = useState<string>(cachedInit?.updatedAt || "");

  // Live Test Simulator State
  const [sampleBusinessName, setSampleBusinessName] = useState("Bella Vista Dental Studio");
  const [sampleCategory, setSampleCategory] = useState("Dentist");
  const [sampleCity, setSampleCity] = useState("Austin");
  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{ subject: string; body: string } | null>(null);
  const [testError, setTestError] = useState("");

  const applyProfileData = useCallback((p: AiTrainingProfile) => {
    setSenderName(p.senderName || userFullName || "Alex Morgan");
    setBusinessName(p.businessName || userCompanyName || "Apex Digital Growth");
    setWebsiteUrl(p.websiteUrl || "");
    setSenderEmail(p.senderEmail || userEmail || "");
    if (Array.isArray(p.servicesOffered) && p.servicesOffered.length > 0) {
      setServicesOffered(p.servicesOffered);
    }
    setOfferDetails(p.offerDetails || "");
    setTargetPainPoints(p.targetPainPoints || "");
    setStaticEmailExample(p.staticEmailExample || "");
    setSubjectLineGuide(p.subjectLineGuide || "");
    setAiInstructions(p.aiInstructions || "");
    setTone(p.tone || "conversational");
    setCallToAction(p.callToAction || "");
    setIncludeAuditReportLink(p.includeAuditReportLink ?? true);
    setIsTrained(Boolean(p.isTrained));
    setUpdatedAt(p.updatedAt || "");
  }, [userFullName, userCompanyName, userEmail]);

  useEffect(() => {
    if (initialProfile) {
      applyProfileData(initialProfile);
      setCachedTrainingProfile(initialProfile);
      setLoading(false);
      return;
    }
    let mounted = true;
    saasFetch("/api/saas/ai-training")
      .then((res) => {
        if (!mounted || !res?.profile) return;
        const localCached = getCachedTrainingProfile();
        if (localCached?.isTrained && !res.profile.isTrained) {
          applyProfileData(localCached);
          saasFetch("/api/saas/ai-training", {
            method: "PUT",
            body: JSON.stringify(localCached),
          }).catch(() => {});
        } else {
          applyProfileData(res.profile);
          setCachedTrainingProfile(res.profile);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [initialProfile, applyProfileData]);

  const handleApplyPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;
    const sName = senderName.trim() || "Alex Morgan";
    const bName = businessName.trim() || "Apex Digital Growth";
    setServicesOffered(preset.servicesOffered.map((s) => ({ ...s })));
    setOfferDetails(preset.offerDetails);
    setTargetPainPoints(preset.targetPainPoints);
    setSubjectLineGuide(preset.subjectLineGuide);
    setStaticEmailExample(preset.staticEmailExample(sName, bName));
    setAiInstructions(preset.aiInstructions);
    setCallToAction(preset.callToAction);
  };

  const handleAddServiceOffer = () => {
    setServicesOffered((prev) => [
      ...prev,
      {
        id: `srv_${Date.now()}_${prev.length + 1}`,
        name: "",
        description: "",
        targetSignals: "",
      },
    ]);
  };

  const handleUpdateServiceOffer = (
    id: string,
    field: keyof TrainedServiceOffer,
    value: string
  ) => {
    setServicesOffered((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveServiceOffer = (id: string) => {
    setServicesOffered((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0
        ? next
        : [
            {
              id: `srv_${Date.now()}_1`,
              name: "",
              description: "",
              targetSignals: "",
            },
          ];
    });
  };

  const insertTokenIntoStaticEmail = (token: string) => {
    setStaticEmailExample((prev) => `${prev}${prev.endsWith(" ") || prev.endsWith("\n") ? "" : " "}${token}`);
  };

  const handleSaveTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedServices = servicesOffered
      .map((s, idx) => ({
        id: s.id || `srv_${idx + 1}`,
        name: s.name.trim(),
        description: s.description.trim(),
        targetSignals: s.targetSignals.trim(),
      }))
      .filter((s) => s.name.length > 0 || s.description.length > 0);

    const effectiveOfferDetails =
      offerDetails.trim() ||
      cleanedServices
        .map((s) => `${s.name}: ${s.description}`)
        .filter(Boolean)
        .join(" | ");

    if (!senderName.trim() || !businessName.trim() || !effectiveOfferDetails || !staticEmailExample.trim()) {
      setSaveBanner({
        type: "error",
        text: "Please fill in your Name, Business Name, at least one Offer/Service, and your Static Email Message.",
      });
      return;
    }
    setSaving(true);
    setSaveBanner(null);
    const localProfilePayload: AiTrainingProfile = {
      senderName: senderName.trim(),
      businessName: businessName.trim(),
      websiteUrl: websiteUrl.trim(),
      senderEmail: senderEmail.trim(),
      offerDetails: effectiveOfferDetails,
      servicesOffered: cleanedServices,
      targetPainPoints: targetPainPoints.trim(),
      staticEmailExample: staticEmailExample.trim(),
      staticEmailTemplate: staticEmailExample.trim(),
      subjectLineGuide: subjectLineGuide.trim(),
      aiInstructions: aiInstructions.trim(),
      tone,
      callToAction: callToAction.trim(),
      includeAuditReportLink,
      isTrained: true,
      updatedAt: new Date().toISOString(),
    };
    setCachedTrainingProfile(localProfilePayload);

    try {
      const res = await saasFetch("/api/saas/ai-training", {
        method: "PUT",
        body: JSON.stringify(localProfilePayload),
      });
      const finalProfile = res?.profile
        ? { ...localProfilePayload, ...res.profile, isTrained: true }
        : localProfilePayload;
      applyProfileData(finalProfile);
      setCachedTrainingProfile(finalProfile);
      onSaved?.(finalProfile);
      setSaveBanner({
        type: "success",
        text: `✓ Saved & Seeded ${cleanedServices.length || 1} Offer(s)/Service(s) into the Cold Email Generator & AI Intelligence! All generated cold emails and audits now use ${finalProfile.senderName} (${finalProfile.businessName}).`,
      });
    } catch {
      applyProfileData(localProfilePayload);
      onSaved?.(localProfilePayload);
      setSaveBanner({
        type: "success",
        text: `✓ Saved & Seeded ${cleanedServices.length || 1} Offer(s)/Service(s) into the Cold Email Generator! All generated cold emails now use ${localProfilePayload.senderName} (${localProfilePayload.businessName}).`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearTrainingFields = () => {
    setServicesOffered([
      {
        id: `srv_${Date.now()}_1`,
        name: "",
        description: "",
        targetSignals: "",
      },
    ]);
    setOfferDetails("");
    setTargetPainPoints("");
    setSubjectLineGuide("");
    setStaticEmailExample("");
    setAiInstructions("");
    setCallToAction("");
    setTestResult(null);
    setSaveBanner({
      type: "success",
      text: "Cleared training fields. Fill in your custom offer & static email or pick a preset blueprint above, then click Save & Seed.",
    });
  };

  const handleTestTrainedAi = async () => {
    setTestingAi(true);
    setTestError("");
    const cleanedServices = servicesOffered
      .map((s, idx) => ({
        id: s.id || `srv_${idx + 1}`,
        name: s.name.trim(),
        description: s.description.trim(),
        targetSignals: s.targetSignals.trim(),
      }))
      .filter((s) => s.name.length > 0 || s.description.length > 0);

    try {
      const res = await saasFetch("/api/crm/test-trained-ai", {
        method: "POST",
        body: JSON.stringify({
          sampleBusinessName: sampleBusinessName.trim() || "Bella Vista Dental Studio",
          sampleCategory: sampleCategory.trim() || "Dentist",
          sampleCity: sampleCity.trim() || "Austin",
          profileOverride: {
            senderName: senderName.trim(),
            businessName: businessName.trim(),
            websiteUrl: websiteUrl.trim(),
            senderEmail: senderEmail.trim(),
            offerDetails: offerDetails.trim(),
            servicesOffered: cleanedServices,
            targetPainPoints: targetPainPoints.trim(),
            staticEmailExample: staticEmailExample.trim(),
            subjectLineGuide: subjectLineGuide.trim(),
            aiInstructions: aiInstructions.trim(),
            tone,
            callToAction: callToAction.trim(),
            includeAuditReportLink,
          },
        }),
      });
      setTestResult({
        subject: res.subject || "",
        body: res.body || "",
      });
    } catch (err: any) {
      setTestError(err.message || "Failed to test AI message generation");
    } finally {
      setTestingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-3 text-slate-600 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span>Loading your AI Outreach Intelligence profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="p-5 sm:p-7 rounded-2xl bg-slate-950 text-white border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Train Your AI — Multi-Offer Analysis & Outreach Intelligence</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Train the AI on Multiple Offers & Services You Provide
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              List all the offers and services your business provides. When our AI analyzes a scraped business's website or writes an outreach email, it automatically diagnoses which of your services they need most and focuses both the <strong>Website Audit Analysis</strong> and <strong>Outreach Email</strong> on that exact offer.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2.5 shrink-0">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                isTrained
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-300"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isTrained ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span>
                {isTrained
                  ? `AI Trained (${servicesOffered.filter((s) => s.name.trim()).length || 1} Active Offers)`
                  : "Ready to Train Your AI"}
              </span>
            </div>
            {updatedAt && (
              <div className="text-[11px] text-slate-400">
                Active Sender: <strong className="text-white">{senderName}</strong> ({businessName})
              </div>
            )}
          </div>
        </div>
      </div>

      {saveBanner && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            saveBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs sm:text-sm font-medium">
            {saveBanner.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{saveBanner.text}</span>
          </div>
          {saveBanner.type === "success" && onNavigateToHunter && (
            <button
              type="button"
              onClick={onNavigateToHunter}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Scrape Businesses & Trigger Send</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLUMNS: TRAINING FORM */}
        <form onSubmit={handleSaveTraining} className="lg:col-span-7 space-y-6">
          {/* Quick Starter Templates */}
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Optional: Load a Multi-Offer Training Blueprint
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any template below to pre-fill multiple offers/services and a matching email blueprint, or list your own from scratch.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TEMPLATES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-700 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Your Name & Business */}
          <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">Your Name & Business Identity</h3>
                <p className="text-xs text-slate-500">
                  Who the AI represents when introducing your business and signing every email
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Name (Sender Name) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. John Carter"
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Business / Company Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apex Growth Agency"
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Website or Booking Link (optional)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="e.g. https://yourbusiness.com"
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Contact / Signature Email (optional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="e.g. hello@yourbusiness.com"
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Multiple Offers & Services Catalog */}
          <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Your Offers & Services Catalog (AI Analysis & Emailing Focus)
                  </h3>
                  <p className="text-xs text-slate-500">
                    List every offer or service you provide. The AI will inspect each scraped business, match them to the exact service(s) they need most, and focus both its Website Analysis and Outreach Email on that offer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddServiceOffer}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Offer / Service</span>
              </button>
            </div>

            {/* Classic Primary Offer Quick-Select for Website Creation & Review Service */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Website Creation &amp; Review Service:</span>{" "}
                When selected, the AI checks each lead&apos;s audit first and sets Website Creation &amp; Review Service as their Primary Offer (with inline Website &amp; Review generation) whenever the audit indicates the business needs them.
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const sender = senderName.trim() || "Alex Morgan";
                    const company = businessName.trim() || "Apex Digital Growth";
                    const preset = PRESET_TEMPLATES.find((p) => p.id === "website_review_service");
                    if (preset) {
                      setOfferDetails(preset.offerDetails);
                      setServicesOffered(preset.servicesOffered.map((s) => ({ ...s })));
                      setTargetPainPoints(preset.targetPainPoints);
                      setSubjectLineGuide(preset.subjectLineGuide);
                      setStaticEmailExample(preset.staticEmailExample(sender, company));
                      setAiInstructions(preset.aiInstructions);
                      setCallToAction(preset.callToAction);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Set Website Creation &amp; Review Service as Primary Offer
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              {servicesOffered.map((srv, index) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Offer / Service #{index + 1}</span>
                    </span>
                    {servicesOffered.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveServiceOffer(srv.id)}
                        className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                        title="Remove this offer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Offer / Service Name *
                      </label>
                      <input
                        type="text"
                        value={srv.name}
                        onChange={(e) => handleUpdateServiceOffer(srv.id, "name", e.target.value)}
                        placeholder="e.g. Website Redesign, 24/7 AI Receptionist, Local SEO..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        When AI Should Pitch This (Target Signals / Gaps)
                      </label>
                      <input
                        type="text"
                        value={srv.targetSignals}
                        onChange={(e) =>
                          handleUpdateServiceOffer(srv.id, "targetSignals", e.target.value)
                        }
                        placeholder="e.g. Outdated site, no online booking, low Google ranking..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      What This Offer Delivers & Value Proposition *
                    </label>
                    <textarea
                      rows={2}
                      value={srv.description}
                      onChange={(e) =>
                        handleUpdateServiceOffer(srv.id, "description", e.target.value)
                      }
                      placeholder="Describe what this specific service does and the result it delivers for the client..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Overall Agency / Business Value Proposition Summary
                </label>
                <textarea
                  rows={2}
                  value={offerDetails}
                  onChange={(e) => setOfferDetails(e.target.value)}
                  placeholder="High-level summary of how your offers work together to help businesses grow..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Key Problems You Look For During Website Analysis (optional)
                </label>
                <input
                  type="text"
                  value={targetPainPoints}
                  onChange={(e) => setTargetPainPoints(e.target.value)}
                  placeholder="e.g. Outdated website, missing online booking, slow response to customer calls, low local search visibility"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Static Reference Email Message */}
          <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Your Static Email Message (How You Want the Message to Look)
                </h3>
                <p className="text-xs text-slate-500">
                  Add a static message showing how you want your emails structured. The AI will use this as its model and personalize it for every business you scrape.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Line Style / Example
              </label>
              <input
                type="text"
                value={subjectLineGuide}
                onChange={(e) => setSubjectLineGuide(e.target.value)}
                placeholder="e.g. Quick idea for {{BusinessName}} in {{City}}"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Static Email Message Blueprint *
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-slate-400 mr-1">Insert smart tag:</span>
                  {["{{BusinessName}}", "{{City}}", "{{Category}}", "{{OwnerName}}"].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => insertTokenIntoStaticEmail(tok)}
                      className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded border border-slate-200 cursor-pointer"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={9}
                required
                value={staticEmailExample}
                onChange={(e) => setStaticEmailExample(e.target.value)}
                placeholder="Write or paste a static email message showing how you want your outreach email to look..."
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                You can use tags like <code className="font-mono text-slate-700">{"{{BusinessName}}"}</code> or just write a normal static email—our AI intelligence will automatically adapt it to each scraped business!
              </p>
            </div>
          </div>

          {/* Step 4: Tell the AI What to Do */}
          <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                4
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Tell the AI What to Do (Your Instructions to AI Intelligence)
                </h3>
                <p className="text-xs text-slate-500">
                  Give the AI specific rules on how to customize your message for each business when you trigger the send
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instructions to AI *
              </label>
              <textarea
                rows={4}
                required
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder="Tell the AI what to do (e.g. 'Use my static message above as the template. Mention 2 real things from their website or business category, explain how our offer helps them, keep it under 150 words, and sign off with my name and business name.')"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outreach Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as AiTrainingProfile["tone"])}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="conversational">Conversational & Human (Recommended)</option>
                  <option value="direct">Executive & Direct</option>
                  <option value="friendly">Warm & Friendly</option>
                  <option value="analytical">Analytical & Value-First</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Closing Call-to-Action (CTA)
                </label>
                <input
                  type="text"
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                  placeholder="e.g. Just reply to this email and I'll send the details."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAuditReportLink}
                onChange={(e) => setIncludeAuditReportLink(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600">
                <strong className="text-slate-900">Include Personalized Audit Report Link:</strong> When a website audit report is generated for a scraped business, automatically include the link in the email.
              </span>
            </label>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Seeding to Cold Email Generator...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Save &amp; Seed to Cold Email Generator</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearTrainingFields}
                className="px-4 py-3 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 hover:border-red-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Fields</span>
              </button>

              {onNavigateToHunter && (
                <button
                  type="button"
                  onClick={onNavigateToHunter}
                  className="px-4 py-3 bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Go to AI Lead Hunter</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* RIGHT 5 COLUMNS: LIVE AI INTELLIGENCE PREVIEW & SIMULATOR */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
          <div className="p-5 sm:p-6 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-950">
                  Test Your Trained AI right now
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Live Simulator
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              See how the AI Intelligence uses your static message, your business offer, and your instructions to write a personalized email for any scraped business:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sample Scraped Business Name
                </label>
                <input
                  type="text"
                  value={sampleBusinessName}
                  onChange={(e) => setSampleBusinessName(e.target.value)}
                  placeholder="e.g. Bella Vista Dental Studio"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Business Category
                  </label>
                  <input
                    type="text"
                    value={sampleCategory}
                    onChange={(e) => setSampleCategory(e.target.value)}
                    placeholder="e.g. Dentist"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={sampleCity}
                    onChange={(e) => setSampleCity(e.target.value)}
                    placeholder="e.g. Austin"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestTrainedAi}
                disabled={testingAi}
                className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {testingAi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Personalized Preview...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Generate Sample Personalized Email</span>
                  </>
                )}
              </button>
            </div>

            {testError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {testError}
              </div>
            )}

            {testResult ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-blue-600 text-white text-xs font-semibold flex items-center justify-between">
                  <span>AI Personalized Output for {sampleBusinessName}</span>
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="p-3.5 space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Subject Line</span>
                    <span className="font-semibold text-slate-900">{testResult.subject}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 whitespace-pre-wrap font-mono text-slate-800 leading-relaxed max-h-[340px] overflow-y-auto">
                    {testResult.body}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5">
                <FileText className="w-7 h-7 text-slate-300 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">
                  Preview Your Trained AI Output
                </div>
                <p className="text-[11px] text-slate-500">
                  Click "Generate Sample Personalized Email" above to test how the AI adapts your static message for a scraped business.
                </p>
              </div>
            )}
          </div>

          {/* How It Works Summary Card */}
          <div className="p-5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
              How Multi-Offer AI Intelligence Works
            </h4>
            <ol className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong className="text-white">List Your Multiple Offers & Services:</strong> Add every service you provide (Web Design, AI Receptionists, Local SEO, Ads, etc.) and when the AI should pitch each one.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong className="text-white">Offer-Focused Website Analysis:</strong> When the AI analyzes any business website, it diagnoses their gaps against your exact services catalog and recommends your best-matching offer.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong className="text-white">Offer-Matched Outreach Emails:</strong> When generating or sending emails, the AI automatically pitches the specific offer(s) from your list that solve that business's #1 bottleneck.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
