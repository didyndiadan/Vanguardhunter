import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  Phone,
  ArrowRight,
  ArrowLeft,
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
  Mic,
  Volume2,
  Play,
  Square,
} from "lucide-react";
import {
  WebsiteOwnerAdminDrawer,
  WEBSITE_COLOR_THEMES,
} from "@/components/WebsiteOwnerAdminDrawer";
import { WebsiteAutomatedChatbot } from "@/components/WebsiteAutomatedChatbot";
import {
  STUDIO_VOICE_PERSONAS,
  getStudioVoicePersona,
  isSiteWalkthroughAlreadyActive,
  speakWithStudioVoice,
  startSiteWalkthroughAudio,
  stopStudioVoice,
} from "@/lib/studio-voices";

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
import fitnessStrengthImg from "@/assets/images/fitness_strength_training_1790421475678.jpg";
import fitnessGroupImg from "@/assets/images/fitness_group_workout_1790421490041.jpg";
import fitnessCoachingImg from "@/assets/images/fitness_personal_coaching_1790421502270.jpg";
import restaurantDiningImg from "@/assets/images/restaurant_dining_experience_1790422268280.jpg";
import salonStylingImg from "@/assets/images/salon_barber_styling_1790422282481.jpg";
import autoDiagnosticImg from "@/assets/images/auto_diagnostic_service_1790422294786.jpg";
import hvacDispatchImg from "@/assets/images/hvac_electrical_dispatch_1790422305378.jpg";
import medicalConsultationImg from "@/assets/images/medical_patient_consultation_1790422317477.jpg";
import fitnessCardioFunctionalImg from "@/assets/images/fitness_cardio_functional_1790446127481.jpg";
import restaurantCateringBanquetImg from "@/assets/images/restaurant_catering_banquet_1790446138947.jpg";
import restaurantArtisanKitchenImg from "@/assets/images/restaurant_artisan_kitchen_1790446302167.jpg";
import salonSpaFacialImg from "@/assets/images/salon_spa_facial_treatment_1790446149827.jpg";
import salonLuxuryHairColorImg from "@/assets/images/salon_luxury_hair_color_1790446312366.jpg";
import autoBrakeTireImg from "@/assets/images/auto_brake_tire_alignment_1790446160171.jpg";
import autoPrecisionDetailingBayImg from "@/assets/images/auto_precision_detailing_bay_1790446323994.jpg";
import electricalPlumbingSpecialistImg from "@/assets/images/electrical_plumbing_specialist_1790446170455.jpg";
import hvacSmartClimateInstallImg from "@/assets/images/hvac_smart_climate_install_1790446336291.jpg";
import medicalModernTreatmentSuiteImg from "@/assets/images/medical_modern_treatment_suite_1790446292341.jpg";
import remodelCustomLivingImg from "@/assets/images/remodel_custom_living_carpentry_1790446181402.jpg";
import advisoryExecutiveBoardroomImg from "@/assets/images/advisory_executive_boardroom_1790446354674.jpg";
import { selectUniqueVisualsForBusiness } from "@/lib/industry-visual-pool";

const SHOWCASE_IMAGES: Record<string, string> = {
  fitness_strength: fitnessStrengthImg,
  fitness_group: fitnessGroupImg,
  fitness_coaching: fitnessCoachingImg,
  fitness_cardio_functional: fitnessCardioFunctionalImg,
  medical_consultation: medicalConsultationImg,
  medical_modern_treatment_suite: medicalModernTreatmentSuiteImg,
  restaurant_dining: restaurantDiningImg,
  restaurant_catering_banquet: restaurantCateringBanquetImg,
  restaurant_artisan_kitchen: restaurantArtisanKitchenImg,
  salon_styling: salonStylingImg,
  salon_spa_facial_treatment: salonSpaFacialImg,
  salon_luxury_hair_color: salonLuxuryHairColorImg,
  auto_diagnostic: autoDiagnosticImg,
  auto_brake_tire_alignment: autoBrakeTireImg,
  auto_precision_detailing_bay: autoPrecisionDetailingBayImg,
  hvac_dispatch: hvacDispatchImg,
  electrical_plumbing_specialist: electricalPlumbingSpecialistImg,
  hvac_smart_climate_install: hvacSmartClimateInstallImg,
  kitchen: kitchenImg,
  bathroom: bathroomImg,
  remodel_custom_living_carpentry: remodelCustomLivingImg,
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
  advisory_executive_boardroom: advisoryExecutiveBoardroomImg,
};

function getPureIndustryImagePool(category = "", businessName = ""): {
  niche: string;
  poolKeys: string[];
  poolUrls: string[];
} {
  const combined = `${category} ${businessName}`.toLowerCase();

  if (
    /gym|fitness|crossfit|workout|personal train|strength|conditioning|athletic|barbell|weightlift|powerlift|boxing|kickbox|martial art|mma|jiu jitsu|karate|pilates|yoga|boot ?camp|health club|spin|cycling|hiit|physique|sports performance/i.test(
      combined
    )
  ) {
    const keys = ["fitness_strength", "fitness_group", "fitness_coaching", "fitness_cardio_functional"];
    return { niche: "fitness", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/dent|orthodont|clinic|med|doctor|chiro|physio|optom|health|vet|dermatol|pediatr|patient/i.test(combined)) {
    const keys = [
      "medical_consultation",
      "dental_medical",
      "dental_network",
      "medical_modern_treatment_suite",
    ];
    return { niche: "medical", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/restaur|cafe|coffee|bakery|bistro|pizz|grill|sushi|taco|bar|cater|food|dining|menu|chef/i.test(combined)) {
    const keys = [
      "restaurant_dining",
      "restaurant_culinary",
      "restaurant_catering_banquet",
      "restaurant_artisan_kitchen",
    ];
    return { niche: "restaurant", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/salon|barber|spa|medspa|nail|beauty|lash|brow|massage|aesthetic|hair|wellness/i.test(combined)) {
    const keys = [
      "salon_styling",
      "salon_spa_facial_treatment",
      "salon_wellness",
      "salon_luxury_hair_color",
    ];
    return { niche: "salon", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/auto|mechanic|car |brake|tire|transmission|collision|detailing|towing|engine|vehicle/i.test(combined)) {
    const keys = [
      "auto_diagnostic",
      "auto_brake_tire_alignment",
      "auto_mechanical",
      "auto_precision_detailing_bay",
    ];
    return { niche: "auto", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/plumb|hvac|air condition|heating|electr|water heater|drain|pipe|duct|furnace|appliance/i.test(combined)) {
    const keys = [
      "hvac_dispatch",
      "plumbing_hvac",
      "electrical_plumbing_specialist",
      "hvac_smart_climate_install",
    ];
    return { niche: "dispatch", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/solar/i.test(combined)) {
    const keys = ["commercial_solar", "roofing_exterior", "electrical_plumbing_specialist", "exterior"];
    return { niche: "solar", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/landscap|lawn|tree|hardscap|pool|paver|patio|fence|deck|pest|outdoor/i.test(combined)) {
    const keys = ["landscaping_outdoor", "exterior", "remodel_custom_living_carpentry", "roofing_exterior"];
    return { niche: "landscaping", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/roof|gutter|siding|shingle|window/i.test(combined)) {
    const keys = ["roofing_exterior", "exterior", "remodel_custom_living_carpentry", "landscaping_outdoor"];
    return { niche: "roofing", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  if (/construct|remodel|renovat|kitchen|bath|cabinet|countertop|builder|addition|carpentr/i.test(combined)) {
    const keys = ["kitchen", "bathroom", "remodel_custom_living_carpentry", "exterior"];
    return { niche: "remodel", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
  }
  const keys = [
    "legal_advisory",
    "b2b_intelligence",
    "advisory_executive_boardroom",
    "commercial",
  ];
  return { niche: "advisory", poolKeys: keys, poolUrls: keys.map((k) => SHOWCASE_IMAGES[k]) };
}

function matchOfferingToBestKey(cardText: string, niche: string, poolKeys: string[]): string | null {
  const t = cardText.toLowerCase();
  if (niche === "fitness") {
    if (/group|class|hiit|bootcamp|boot camp|spin|team/i.test(t)) return "fitness_group";
    if (/1-on-1|personal|coach|assessment|custom|trainer/i.test(t)) return "fitness_coaching";
    if (/functional|turf|rope|kettlebell|conditioning|athletic|stamina|cardio/i.test(t)) return "fitness_cardio_functional";
    if (/strength|barbell|weight|muscle|lift|power/i.test(t)) return "fitness_strength";
  } else if (niche === "restaurant") {
    if (/cater|event|party|banquet|group|office|celebrat|tray|platter/i.test(t)) return "restaurant_catering_banquet";
    if (/menu|scratch|dish|culinary|takeout|order|lunch|special/i.test(t)) return "restaurant_culinary";
    if (/dine|table|reserv|chef|dinner|guest|experience/i.test(t)) return "restaurant_dining";
  } else if (niche === "salon") {
    if (/facial|skin|glow|medspa|peel|lash|brow|aesthetic|rejuvenat/i.test(t)) return "salon_spa_facial_treatment";
    if (/spa|massage|wellness|package|luxury|relax|body/i.test(t)) return "salon_wellness";
    if (/hair|cut|color|styl|barber|blowout|balayage|trim/i.test(t)) return "salon_styling";
  } else if (niche === "auto") {
    if (/brake|tire|wheel|align|suspension|rotor|pad/i.test(t)) return "auto_brake_tire_alignment";
    if (/diagnos|check engine|scan|inspect|electrical|computer|battery/i.test(t)) return "auto_diagnostic";
    if (/engine|transmission|oil|fluid|mechanic|repair|a\/c|cooling/i.test(t)) return "auto_mechanical";
  } else if (niche === "dispatch") {
    if (/electr|panel|wire|breaker|lighting|generator|tankless|water heater/i.test(t)) return "electrical_plumbing_specialist";
    if (/plumb|drain|pipe|leak|sewer|faucet|toilet|fixture/i.test(t)) return "plumbing_hvac";
    if (/hvac|air|heat|cooling|furnace|ac |duct|dispatch|tune-up/i.test(t)) return "hvac_dispatch";
  } else if (niche === "medical") {
    if (/consult|exam|new patient|second opinion|checkup|plan/i.test(t)) return "medical_consultation";
    if (/cosmetic|implant|specialty|whitening|ortho|suite|technology|restor/i.test(t)) return "dental_medical";
    if (/urgent|same-day|emergency|pain|family|team|care/i.test(t)) return "dental_network";
  } else if (niche === "remodel" || niche === "roofing" || niche === "landscaping" || niche === "solar") {
    if (/kitchen|cabinet|island|countertop/i.test(t) && poolKeys.includes("kitchen")) return "kitchen";
    if (/bath|shower|vanity|tub|spa/i.test(t) && poolKeys.includes("bathroom")) return "bathroom";
    if (/living|open-concept|open concept|carpentr|woodwork|interior|flooring|addition/i.test(t) && poolKeys.includes("remodel_custom_living_carpentry")) {
      return "remodel_custom_living_carpentry";
    }
    if (/solar|panel|energy/i.test(t) && poolKeys.includes("commercial_solar")) return "commercial_solar";
    if (/landscap|lawn|patio|paver|hardscap|tree|outdoor|pool/i.test(t) && poolKeys.includes("landscaping_outdoor")) {
      return "landscaping_outdoor";
    }
    if (/roof|shingle|gutter|siding/i.test(t) && poolKeys.includes("roofing_exterior")) return "roofing_exterior";
    if (/exterior|deck|window|adu/i.test(t) && poolKeys.includes("exterior")) return "exterior";
  } else if (niche === "advisory") {
    if (/law|legal|litigat|dispute|attorney|representation|court|contract/i.test(t)) return "legal_advisory";
    if (/strategy|tax|cpa|financ|wealth|advisory|audit|structur/i.test(t)) return "b2b_intelligence";
    if (/commercial|business|corporate|real estate|property/i.test(t)) return "commercial";
  }
  return null;
}

function resolveAccurateShowcaseImage(
  proj: any,
  idx: number,
  category = "",
  businessName = "",
  city = "",
  variationSeed = 0
): string {
  if (proj?.customImageUrl && /^(https?:\/\/|data:image\/)/i.test(proj.customImageUrl)) {
    return proj.customImageUrl;
  }
  const uniqueSel = selectUniqueVisualsForBusiness({
    category,
    businessName,
    city,
    variationSeed,
    count: 4,
    localAssetsMap: SHOWCASE_IMAGES,
  });
  if (uniqueSel.images[idx]) {
    return uniqueSel.images[idx];
  }
  const { poolUrls } = getPureIndustryImagePool(category, businessName);
  return poolUrls[idx % poolUrls.length];
}

function resolveLocalBundledFallbackImage(
  proj: any,
  idx: number,
  category = "",
  businessName = ""
): string {
  const { niche, poolKeys, poolUrls } = getPureIndustryImagePool(category, businessName);
  const semanticKey = matchOfferingToBestKey(`${proj?.title || ""} ${proj?.scope || ""}`, niche, poolKeys);
  if (semanticKey && SHOWCASE_IMAGES[semanticKey]) {
    return SHOWCASE_IMAGES[semanticKey];
  }
  if (proj?.imageType && poolKeys.includes(proj.imageType) && SHOWCASE_IMAGES[proj.imageType]) {
    return SHOWCASE_IMAGES[proj.imageType];
  }
  return poolUrls[idx % poolUrls.length];
}

/**
 * Resolves 100% unique, zero-duplicate images across all offering cards on a business page,
 * diversified per-business across 28 specific industry niches so no two businesses get the same photos.
 */
function resolveUniqueShowcaseImagesForPage(
  finishedWork: any[],
  category = "",
  businessName = "",
  city = "",
  variationSeed = 0
): string[] {
  if (!Array.isArray(finishedWork) || finishedWork.length === 0) return [];
  const uniqueSel = selectUniqueVisualsForBusiness({
    category,
    businessName,
    city,
    variationSeed,
    count: Math.max(3, finishedWork.length),
    localAssetsMap: SHOWCASE_IMAGES,
  });
  const usedUrls = new Set<string>();

  return finishedWork.map((proj: any, idx: number) => {
    const customUrl = String(proj?.customImageUrl || "").trim();
    if (customUrl && /^(https?:\/\/|data:image\/)/i.test(customUrl) && !usedUrls.has(customUrl)) {
      usedUrls.add(customUrl);
      return customUrl;
    }

    const diversifiedUrl =
      uniqueSel.images.find((u) => !usedUrls.has(u)) ||
      uniqueSel.images[idx % Math.max(1, uniqueSel.images.length)];
    if (diversifiedUrl) {
      usedUrls.add(diversifiedUrl);
      return diversifiedUrl;
    }

    const { poolUrls } = getPureIndustryImagePool(category, businessName);
    const nextUnused = poolUrls.find((u) => !usedUrls.has(u)) || poolUrls[idx % poolUrls.length];
    usedUrls.add(nextUnused);
    return nextUnused;
  });
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
  const [, setLocation] = useLocation();
  const siteId = params.siteId || "valley-construction-sacramento";

  const initialPreloaded = (() => {
    if (typeof window === "undefined") return null;
    try {
      const delRaw = localStorage.getItem("vh_deleted_website_ids_v1");
      if (delRaw) {
        const delList = JSON.parse(delRaw);
        if (Array.isArray(delList) && delList.includes(siteId)) {
          return null;
        }
      }
    } catch {}
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
      const listRaw = localStorage.getItem("vh_generated_websites_list_v1");
      if (listRaw) {
        const list = JSON.parse(listRaw);
        if (Array.isArray(list)) {
          const found = list.find((s: any) => s?.siteId === siteId);
          if (found) return { site: found };
        }
      }
    } catch {}
    return null;
  })();

  const [site, setSite] = useState<any | null>(() => initialPreloaded?.site || null);
  const [loading, setLoading] = useState<boolean>(() => !initialPreloaded?.site);
  const [notFound, setNotFound] = useState(false);

  // View controls for Business Owner — default directly to clean live site view
  const [viewMode, setViewMode] = useState<"live_site" | "what_changed">("live_site");
  const [showPitchDetails, setShowPitchDetails] = useState<boolean>(true);
  const [viewportMode, setViewportMode] = useState<"desktop" | "mobile">("desktop");
  const [activeThemeId, setActiveThemeId] = useState<string>(
    () =>
      initialPreloaded?.site?.themeId ||
      initialPreloaded?.site?.siteConfig?.themeId ||
      "valley_craft"
  );

  // 4-Tap Interactive Lead Funnel state
  const [funnelStep, setFunnelStep] = useState<1 | 2 | 3 | 4>(1);
  const [tap1Choice, setTap1Choice] = useState<string>(
    () =>
      initialPreloaded?.site?.siteConfig?.funnelConfig?.step1Options?.[0]?.label ||
      "Kitchen Remodeling"
  );
  const [tap2Choice, setTap2Choice] = useState<string>(
    () =>
      initialPreloaded?.site?.siteConfig?.funnelConfig?.step2Options?.[0]?.label ||
      "Within 2 to 4 weeks"
  );
  const [tap3Choice, setTap3Choice] = useState<string>(
    () =>
      initialPreloaded?.site?.siteConfig?.funnelConfig?.step3Options?.[0]?.label ||
      "On-time schedule & daily updates"
  );
  const [funnelPhone, setFunnelPhone] = useState<string>("");
  const [funnelName, setFunnelName] = useState<string>("");
  const [funnelSubmitting, setFunnelSubmitting] = useState(false);
  const [funnelSuccess, setFunnelSuccess] = useState(false);
  const [funnelError, setFunnelError] = useState("");

  // FAQ Accordion state
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [activeHeroSlideIdx, setActiveHeroSlideIdx] = useState<number>(0);

  // Claim Website Modal state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("admin") === "1";
    }
    return false;
  });
  const [forceCleanLiveView, setForceCleanLiveView] = useState(() => {
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
  const [claimBillingMonths, setClaimBillingMonths] = useState<1 | 3 | 12>(1);
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

  const BILLING_DURATIONS = [
    {
      months: 1 as const,
      label: "1 Month",
      shortTag: "Monthly",
      discountPct: 0,
      badge: "Flexible",
      desc: "Pay month-to-month · Cancel anytime",
    },
    {
      months: 3 as const,
      label: "3 Months",
      shortTag: "Save 10%",
      discountPct: 10,
      badge: "Save 10% · Popular for Bank/Crypto",
      desc: "Quarterly billing · No monthly transfer hassle",
    },
    {
      months: 12 as const,
      label: "12 Months",
      shortTag: "Save 20% (2 Mos Free)",
      discountPct: 20,
      badge: "Best Value · Free .COM Domain",
      desc: "2 months FREE + free custom domain renewal",
    },
  ] as const;

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
  const selectedDurationObj =
    BILLING_DURATIONS.find((d) => d.months === claimBillingMonths) || BILLING_DURATIONS[0];
  const discountedPlanMonthly = Math.round(
    selectedPlanObj.monthlyPrice * (1 - selectedDurationObj.discountPct / 100)
  );
  const hostingTermTotal = discountedPlanMonthly * claimBillingMonths;
  const hostingTermSavings =
    selectedPlanObj.monthlyPrice * claimBillingMonths - hostingTermTotal;
  const selectedAddonObjs = GROWTH_ADDONS.filter((a) => claimAddons.includes(a.id));
  const addonsMonthlyTotal = selectedAddonObjs.reduce((sum, a) => sum + a.monthly, 0);
  const claimMonthlyTotal = discountedPlanMonthly + addonsMonthlyTotal;
  const claimOneTimeTotal = selectedAddonObjs.reduce((sum, a) => sum + a.oneTime, 0);
  const claimDueToday = hostingTermTotal + addonsMonthlyTotal + claimOneTimeTotal;

  useEffect(() => {
    const applyLoadedData = (data: any) => {
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
        if (data.site.businessName && typeof document !== "undefined") {
          document.title = `${data.site.businessName}${
            data.site.city ? ` — ${data.site.city}` : ""
          }`;
        }
        try {
          const serialized = JSON.stringify(data);
          sessionStorage.setItem(`vh_site_cache_${siteId}`, serialized);
          localStorage.setItem(`vh_site_cache_${siteId}`, serialized);
        } catch {}
        if (data.site.claimRequested) {
          setClaimSuccess(true);
          if (
            data.site.claimData?.billingMonths === 1 ||
            data.site.claimData?.billingMonths === 3 ||
            data.site.claimData?.billingMonths === 12
          ) {
            setClaimBillingMonths(data.site.claimData.billingMonths);
          }
          if (
            data.site.claimData?.paymentStatus === "payment_submitted" ||
            data.site.claimData?.paymentStatus === "paid_active"
          ) {
            setPaymentConfirmed(true);
          }
        }
        const firstOpt =
          cfg?.funnelConfig?.step1Options?.[0]?.label || "Kitchen Remodeling";
        const secondOpt =
          cfg?.funnelConfig?.step2Options?.[0]?.label || "Within 2 to 4 weeks";
        const thirdOpt =
          cfg?.funnelConfig?.step3Options?.[0]?.label ||
          "On-time schedule & daily updates";
        setTap1Choice(firstOpt);
        setTap2Choice(secondOpt);
        setTap3Choice(thirdOpt);
        setLoading(false);
        return true;
      }
      return false;
    };

    const w = typeof window !== "undefined" ? (window as any) : null;
    if (w?.__PRELOADED_SITE_DATA__?.site?.siteId === siteId) {
      applyLoadedData(w.__PRELOADED_SITE_DATA__);
    } else if (!site) {
      setLoading(true);
    }

    const inflightPromise =
      w?.__PREFETCHED_SITE_ID__ === siteId && w?.__PREFETCHED_SITE_PROMISE__
        ? w.__PREFETCHED_SITE_PROMISE__
        : fetch(`/api/website-builder/public/${encodeURIComponent(siteId)}`).then(
            async (r) => (r.ok ? r.json() : null)
          );

    if (w?.__PREFETCHED_SITE_ID__ === siteId) {
      w.__PREFETCHED_SITE_PROMISE__ = null;
    }

    Promise.resolve(inflightPromise)
      .then((data) => {
        if (!applyLoadedData(data) && !site) {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!site) setNotFound(true);
      })
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

  const [regeneratingPageImages, setRegeneratingPageImages] = useState(false);
  const [regeneratingCardIndex, setRegeneratingCardIndex] = useState<number | null>(null);
  const [selectedEstimatorTierIdx, setSelectedEstimatorTierIdx] = useState<number>(0);
  const [selectedSlotType, setSelectedSlotType] = useState<string>("");
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<string>("");
  const [expandedBlogIdx, setExpandedBlogIdx] = useState<number | null>(0);
  const [generatingBlogPost, setGeneratingBlogPost] = useState<boolean>(false);
  const [customBlogTopic, setCustomBlogTopic] = useState<string>("");

  const handleGenerateBlogArticle = async () => {
    if (!site) return;
    setGeneratingBlogPost(true);
    try {
      const ownerPw =
        site?.siteConfig?.adminPassword || site?.siteConfig?.adminPin || "owner2026";
      const res = await fetch(
        `/api/website-builder/public/${encodeURIComponent(siteId)}/generate-blog-post`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: ownerPw,
            password: ownerPw,
            customTopic: customBlogTopic.trim(),
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.site) {
        setSite(data.site);
        setCustomBlogTopic("");
        setExpandedBlogIdx(0);
      }
    } catch (err) {
      console.error("Failed to generate blog post:", err);
    } finally {
      setGeneratingBlogPost(false);
    }
  };

  const handleQuickRegenerateImages = async (cardIndex?: number) => {
    if (!site) return;
    setRegeneratingPageImages(true);
    setRegeneratingCardIndex(typeof cardIndex === "number" ? cardIndex : null);
    try {
      const ownerPw =
        site?.siteConfig?.adminPassword || site?.siteConfig?.adminPin || "owner2026";
      const res = await fetch(
        `/api/website-builder/public/${encodeURIComponent(siteId)}/regenerate-images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: ownerPw,
            password: ownerPw,
            cardIndex: typeof cardIndex === "number" ? cardIndex : undefined,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.site) {
        setSite(data.site);
      }
    } catch (err) {
      console.error("Failed to regenerate images:", err);
    } finally {
      setRegeneratingPageImages(false);
      setRegeneratingCardIndex(null);
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
          selectedPlan:
            claimBillingMonths === 1
              ? `${selectedPlanObj.name} — 1 Month Plan ($${discountedPlanMonthly}/mo · $0 Free Website Build)`
              : `${selectedPlanObj.name} — ${claimBillingMonths} Months Package ($${discountedPlanMonthly}/mo × ${claimBillingMonths} mos = $${hostingTermTotal} · Save $${hostingTermSavings})`,
          billingMonths: claimBillingMonths,
          hostingTermTotal,
          dueToday: claimDueToday,
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
          billingMonths: claimBillingMonths,
          dueToday: claimDueToday,
          selectedPlan:
            claimBillingMonths === 1
              ? `${selectedPlanObj.name} — 1 Month Plan ($${discountedPlanMonthly}/mo · $0 Free Website Build)`
              : `${selectedPlanObj.name} — ${claimBillingMonths} Months Package ($${discountedPlanMonthly}/mo × ${claimBillingMonths} mos = $${hostingTermTotal} · Save $${hostingTermSavings})`,
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

  // Invisible AI Voice Walkthrough — automatically speaks when the business lands on the page
  const hasAutoSpokenForSiteRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || notFound || !site?.siteId) return;
    if (hasAutoSpokenForSiteRef.current === site.siteId) return;

    const currentSiteId = site.siteId;
    if (isSiteWalkthroughAlreadyActive(currentSiteId)) {
      hasAutoSpokenForSiteRef.current = currentSiteId;
      return;
    }

    const timer = setTimeout(() => {
      if (hasAutoSpokenForSiteRef.current === currentSiteId) return;
      hasAutoSpokenForSiteRef.current = currentSiteId;
      if (!isSiteWalkthroughAlreadyActive(currentSiteId)) {
        startSiteWalkthroughAudio(currentSiteId, site);
      }
    }, 80);

    return () => {
      clearTimeout(timer);
    };
  }, [loading, notFound, site?.siteId]);

  useEffect(() => {
    return () => {
      stopStudioVoice();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#FAF9F5] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-stone-300 border-t-stone-800 animate-spin" />
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
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#7C4A15] hover:bg-[#633A0F] transition-colors cursor-pointer"
          >
            Return to Platform
          </button>
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
      {/* Invisible background audio element for automatic voice walkthrough */}
      <audio id="vh-site-walkthrough-audio" className="hidden" aria-hidden="true" />

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
                : `Custom 4-Tap Conversion Website Built for ${site.businessName}`}
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
                  Claim Your Site Now →
                </button>
              )}
            </div>
          </div>

          {/* Second Row on Mobile / Right Side on Desktop: Viewport + Theme + Desktop Claim CTA */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
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

            {/* Quick Regenerate Images Button */}
            <button
              type="button"
              onClick={() => handleQuickRegenerateImages()}
              disabled={regeneratingPageImages}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              title="Regenerate Website Showcase Images (if any image looks unrelated or not unique)"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${regeneratingPageImages ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">
                {regeneratingPageImages ? "Regenerating…" : "Regen Images"}
              </span>
            </button>

            {/* Admin / Edit Website CMS Button */}
            <button
              type="button"
              onClick={() => setAdminDrawerOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Open Business Owner Admin (Password: owner2026)"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Owner Admin</span>
            </button>

            {/* Clean Client View (?live=1) */}
            <button
              type="button"
              onClick={() => setForceCleanLiveView(true)}
              className="hidden xl:inline-flex px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 items-center gap-1 whitespace-nowrap cursor-pointer"
              title="Open Clean White-Label Client View (hides this top preview bar)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Clean Client View</span>
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
                  className="px-4 py-1.5 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                >
                  Claim Your Site Now ($0 Build) →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ─── TOP-OF-PAGE POWERFUL PITCH & CLAIM WEBSITE SECTION (Hidden when Live Production Mode is active) ─── */}
      {!isLiveHostedMode && (
        <section className="bg-gradient-to-b from-slate-950 via-[#0F172A] to-slate-900 text-white py-6 sm:py-8 px-4 sm:px-8 border-b-2 border-amber-400/40 shadow-xl">
          <div className="max-w-[1320px] mx-auto space-y-6">
            {/* Hero Pitch Header & Immediate Claim CTA */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2.5 max-w-3xl">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Custom Built for {site.businessName} ({site.city}) · $0 Website Build Fee ($1,500 Value Waived)
                  </span>
                </div>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  We Built This Custom 4-Tap Website for {site.businessName} —{" "}
                  <span className="text-amber-400 underline decoration-amber-400/40 underline-offset-4">
                    Claim Your Site Now ($0 Build Fee)
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {trans.diagnosisHeadline ||
                    (site.detectionStatus === "no_website"
                      ? `${site.businessName} currently has no dedicated conversion website — meaning local customers searching in ${site.city} are calling competitors instead.`
                      : `We reviewed ${site.businessName} in ${site.city} and engineered this custom mobile-first upgrade to turn local visitors into booked calls.`)}{" "}
                  Instead of sending a traditional sales pitch, our team went ahead and built your complete custom website below—featuring a{" "}
                  <strong className="text-white">4-Tap Instant Estimate Calculator</strong> and a{" "}
                  <strong className="text-white">24/7 Automated Website Chat Assistant</strong>. We are waiving the entire $1,500 build fee so you can claim and launch it on your domain today.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPitchDetails((prev) => !prev)}
                  className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-center whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{showPitchDetails ? "Hide Upgrade Breakdown" : "See What We Built for You"}</span>
                  {showPitchDetails ? (
                    <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-5 py-3.5 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20 text-center cursor-pointer whitespace-nowrap"
                >
                  {claimSuccess || site.claimRequested
                    ? "Website Claimed — View Activation Details →"
                    : "Claim Your Site Now ($0 Build Fee) →"}
                </button>
              </div>
            </div>

            {/* Expandable Pitch & Transformation Breakdown on the Page */}
            {showPitchDetails && (
              <div className="pt-5 border-t border-slate-800/90 space-y-5">
                {/* 3 Key Impact Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Conversion Architecture Upgrade
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm font-mono line-through text-rose-400">
                        {trans.originalScore ?? (site.detectionStatus === "no_website" ? 0 : 38)}/100
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400">
                        {trans.newScore || 98}/100
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 truncate">
                      {site.originalWebsite && site.detectionStatus !== "no_website" ? (
                        <a
                          href={
                            site.originalWebsite.startsWith("http")
                              ? site.originalWebsite
                              : `https://${site.originalWebsite}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-amber-300 hover:underline truncate"
                        >
                          <span>Compared to {site.originalWebsite}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span>Upgraded from No Dedicated Website</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Estimated Missed Local Demand
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-amber-400 mt-1">
                      {trans.estimatedMissedLeadsPerMonth || "18–35 high-intent local callers/month"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Captured via 4-Tap Instant Quote &amp; 24/7 Chat Assistant
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Projected Monthly Revenue Lift
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-emerald-400 font-mono mt-1">
                      {trans.estimatedMonthlyRevenueLift || "+$18,500 – $45,000 / month"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      $0 Website Build Fee ($1,500 Value Waived Today)
                    </div>
                  </div>
                </div>

                {/* Why We Built This / What Changed Cards */}
                {Array.isArray(trans.whatChanged) && trans.whatChanged.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {trans.whatChanged.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-2">
                          <div className="text-xs font-extrabold text-white leading-snug">
                            {item.title}
                          </div>
                          <div className="p-2.5 rounded-lg bg-rose-950/35 border border-rose-500/20 text-[11px] text-rose-200/90 leading-relaxed">
                            <span className="font-bold uppercase text-[10px] text-rose-400 block mb-0.5">
                              Before:
                            </span>
                            {item.before}
                          </div>
                          <div className="p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-500/25 text-[11px] text-emerald-100 leading-relaxed">
                            <span className="font-bold uppercase text-[10px] text-emerald-400 block mb-0.5">
                              Built Into Your New Site:
                            </span>
                            {item.after}
                          </div>
                        </div>
                        {item.impact && (
                          <div className="pt-2 border-t border-slate-800 text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{item.impact}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Audit Reasons & Included Benefits Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                  {Array.isArray(site.auditReasons) && site.auditReasons.length > 0 && (
                    <div className="lg:col-span-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                      <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Why We Prepared This Upgrade for {site.businessName}:</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-200">
                        {site.auditReasons.map((reason: string, rIdx: number) => (
                          <li key={rIdx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div
                    className={`${
                      Array.isArray(site.auditReasons) && site.auditReasons.length > 0
                        ? "lg:col-span-7"
                        : "lg:col-span-12"
                    } p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                        Everything Included When You Claim Your Website Today:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300">
                        {(
                          trans.ownerBenefits || [
                            `Custom-built specifically for ${site.businessName} in ${site.city}`,
                            "Pre-wired 4-Tap Instant Estimate Calculator",
                            "24/7 Automated Website Chat Assistant included",
                            "Full Owner Admin Panel & Custom Domain connection",
                          ]
                        )
                          .slice(0, 4)
                          .map((benefit: string, bIdx: number) => (
                            <div key={bIdx} className="flex items-start gap-1.5 leading-snug">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{benefit}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setClaimModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 whitespace-nowrap cursor-pointer shadow-sm"
                      >
                        Claim Free Website ($0 Build) →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("live-website-preview");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 text-center whitespace-nowrap cursor-pointer"
                      >
                        Test Live Website Below ↓
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── THE LIVE INTERACTIVE WEBSITE (VALLEY SIGNATURE + MOBILE-NATIVE) ─── */}
      <div
        id="live-website-preview"
        className={`mx-auto transition-all duration-200 scroll-mt-14 ${
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
                {cfg.emblemType === "fitness" ? (
                  <svg className="w-4 h-4 mb-0.5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6.5 6.5L17.5 17.5M3 10L10 3M14 21L21 14M2 6L6 2M18 22L22 18"
                      stroke={theme.accentBg}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : cfg.emblemType === "medical" ? (
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
                <button type="button" onClick={() => scrollToSection("smart-conversion-hub")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  Price &amp; Booking
                </button>
                <button type="button" onClick={() => scrollToSection("local-seo-guides")} className="hover:opacity-70 transition-opacity whitespace-nowrap">
                  Local Guides
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

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => scrollToSection("finished-work")}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[13px] sm:text-[14px] font-bold bg-white border shadow-xs hover:bg-stone-50 transition-colors whitespace-nowrap"
                    style={{ color: theme.inkPrimary, borderColor: theme.borderSubtle }}
                  >
                    {cfg.heroTertiaryCta || "See finished work"}
                  </button>
                  {cfg.intelligentModules?.smsDirect?.enabled !== false && (
                    <a
                      href={`sms:${String(phoneDisplay).replace(/[^0-9+]/g, "")}?&body=${encodeURIComponent(
                        cfg.intelligentModules?.smsDirect?.prefilledMessage ||
                          `Hi ${cfg.brandName || site.businessName} in ${cfg.city || site.city}! I'm on your website and would like a quote.`
                      )}`}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] sm:text-[14px] font-bold border shadow-xs transition-colors whitespace-nowrap"
                      style={{
                        backgroundColor: theme.accentSoftBg,
                        color: theme.accentText,
                        borderColor: theme.accentBg,
                      }}
                    >
                      <span>
                        {cfg.intelligentModules?.smsDirect?.buttonLabel ||
                          `💬 Text ${cfg.brandName || site.businessName}`}
                      </span>
                    </a>
                  )}
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
              {(() => {
                const workItems = Array.isArray(cfg.finishedWork) ? cfg.finishedWork : [];
                const uniquePageImages = resolveUniqueShowcaseImagesForPage(
                  workItems,
                  cfg.category || site.category,
                  site.businessName,
                  cfg.city || site.city,
                  Number(cfg.imageVariationSeed || 0)
                );
                return workItems.map((proj: any, idx: number) => {
                  const imgSrc =
                    uniquePageImages[idx] ||
                    resolveAccurateShowcaseImage(
                      proj,
                      idx,
                      cfg.category || site.category,
                      site.businessName,
                      cfg.city || site.city,
                      Number(cfg.imageVariationSeed || 0)
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
                              const fallback = resolveLocalBundledFallbackImage(
                                proj,
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
                          {!isLiveHostedMode && (
                            <button
                              type="button"
                              disabled={regeneratingPageImages}
                              onClick={() => handleQuickRegenerateImages(idx)}
                              className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-amber-300 border border-amber-400/40 text-[11px] font-bold flex items-center gap-1 backdrop-blur-xs cursor-pointer disabled:opacity-50"
                              title="Regenerate a unique photo for this showcase card"
                            >
                              <Sparkles className={`w-3 h-3 ${regeneratingPageImages && regeneratingCardIndex === idx ? "animate-spin" : ""}`} />
                              <span>
                                {regeneratingPageImages && regeneratingCardIndex === idx
                                  ? "Generating…"
                                  : "↻ Regen Photo"}
                              </span>
                            </button>
                          )}
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
                });
              })()}
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

        {/* 7B. INTELLIGENT CONVERSION HUB: PROMO VOUCHER + PRICE ESTIMATOR + LIVE APPOINTMENT SLOT PICKER */}
        {(() => {
          const smart = cfg.intelligentModules;
          if (!smart) return null;
          const showPromo = smart.promoVoucher?.enabled !== false;
          const showEstimator = smart.priceEstimator?.enabled !== false;
          const showPicker = smart.appointmentPicker?.enabled !== false;
          if (!showPromo && !showEstimator && !showPicker) return null;

          const tiers = Array.isArray(smart.priceEstimator?.tiers)
            ? smart.priceEstimator.tiers
            : [];
          const activeTier = tiers[selectedEstimatorTierIdx] || tiers[0];
          const slotTypes = Array.isArray(smart.appointmentPicker?.slotTypes)
            ? smart.appointmentPicker.slotTypes
            : [];
          const timeWindows = Array.isArray(smart.appointmentPicker?.timeWindows)
            ? smart.appointmentPicker.timeWindows
            : [];
          const currentSlotType = selectedSlotType || slotTypes[0] || "Priority Appointment";
          const currentTimeWindow = selectedTimeWindow || timeWindows[0] || "Next Available Window";
          const smsDirectHref = `sms:${String(phoneDisplay).replace(/[^0-9+]/g, "")}?&body=${encodeURIComponent(
            smart.smsDirect?.prefilledMessage ||
              `Hi ${cfg.brandName || site.businessName} in ${cfg.city || site.city}! I'm on your website and would like a fast quote.`
          )}`;

          return (
            <section
              id="smart-conversion-hub"
              className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
              style={{ backgroundColor: theme.canvasBg, borderColor: theme.borderSubtle }}
            >
              <div className="max-w-[1240px] mx-auto space-y-8 sm:space-y-10">
                {/* Industry Intelligence Explanation Banner (Visible in Preview Mode) */}
                {!isLiveHostedMode && smart.industryProfileLabel && (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-amber-500/35 text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Industry-Matched Conversion Profile: {smart.industryProfileLabel}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {smart.aiSelectionReason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminDrawerOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Customize Modules in Admin →
                    </button>
                  </div>
                )}

                {/* 1. Industry-Tailored Promo / New-Client Voucher Box */}
                {showPromo && smart.promoVoucher && (
                  <div
                    className="rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-lg border-2 border-dashed"
                    style={{
                      backgroundColor: theme.topBarBg,
                      color: "#FFFFFF",
                      borderColor: theme.accentBg,
                    }}
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider text-white" style={{ backgroundColor: theme.accentBg }}>
                        <span>🎁 {smart.promoVoucher.badge}</span>
                        <span>· CODE: {smart.promoVoucher.code}</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                        {smart.promoVoucher.headline}
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                        {smart.promoVoucher.subtext} · <span className="text-amber-300 font-semibold">{smart.promoVoucher.expirationText}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTap1Choice(
                          `${smart.promoVoucher.badge} (${smart.promoVoucher.code})`
                        );
                        setFunnelStep(2);
                        scrollToSection("funnel-card");
                      }}
                      className="w-full lg:w-auto px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md hover:opacity-95 transition whitespace-nowrap cursor-pointer"
                      style={{ backgroundColor: theme.accentBg }}
                    >
                      {smart.promoVoucher.ctaText || "Claim Voucher Now →"}
                    </button>
                  </div>
                )}

                {/* 2 & 3. Interactive Price Estimator + Live Appointment/Dispatch Slot Picker */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                  {showEstimator && smart.priceEstimator && (
                    <div
                      className={`${
                        showPicker ? "lg:col-span-7" : "lg:col-span-12"
                      } bg-white rounded-2xl p-5 sm:p-8 border shadow-xs flex flex-col justify-between space-y-5`}
                      style={{ borderColor: theme.borderSubtle }}
                    >
                      <div className="space-y-4">
                        <div>
                          <div
                            className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider mb-1"
                            style={{ color: theme.accentText }}
                          >
                            {smart.priceEstimator.badge}
                          </div>
                          <h3
                            className="text-xl sm:text-2xl font-extrabold tracking-tight"
                            style={{ color: theme.inkPrimary }}
                          >
                            {smart.priceEstimator.title}
                          </h3>
                          <p
                            className="text-xs sm:text-sm mt-1 leading-relaxed"
                            style={{ color: theme.inkMuted }}
                          >
                            {smart.priceEstimator.subtitle}
                          </p>
                        </div>

                        {/* Interactive Tier Selector Cards */}
                        <div className="space-y-2.5">
                          {tiers.map((tier: any, idx: number) => {
                            const isSelected = selectedEstimatorTierIdx === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedEstimatorTierIdx(idx)}
                                className="w-full text-left p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                                style={{
                                  borderColor: isSelected ? theme.accentBg : theme.borderSubtle,
                                  backgroundColor: isSelected ? theme.accentSoftBg : theme.canvasBg,
                                }}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="font-bold text-sm sm:text-base"
                                      style={{ color: theme.inkPrimary }}
                                    >
                                      {tier.label}
                                    </span>
                                    {tier.turnaround && (
                                      <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold"
                                        style={{
                                          backgroundColor: "#FFFFFF",
                                          color: theme.accentText,
                                          border: `1px solid ${theme.borderSubtle}`,
                                        }}
                                      >
                                        {tier.turnaround}
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className="text-xs leading-relaxed"
                                    style={{ color: theme.inkMuted }}
                                  >
                                    {tier.scope}
                                  </p>
                                </div>
                                <div className="sm:text-right shrink-0">
                                  <div
                                    className="font-mono font-extrabold text-sm sm:text-base"
                                    style={{ color: theme.accentText }}
                                  >
                                    {tier.estimatedRange}
                                  </div>
                                  <div
                                    className="text-[11px] font-semibold"
                                    style={{ color: theme.inkMuted }}
                                  >
                                    {isSelected ? "✓ Selected Tier" : "Tap to select"}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {activeTier && (
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t" style={{ borderColor: theme.borderSubtle }}>
                          <div className="text-xs" style={{ color: theme.inkMuted }}>
                            Selected: <strong style={{ color: theme.inkPrimary }}>{activeTier.label}</strong> ({activeTier.estimatedRange})
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTap1Choice(`${activeTier.label} (${activeTier.estimatedRange})`);
                              setFunnelStep(2);
                              scrollToSection("funnel-card");
                            }}
                            className="px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm cursor-pointer whitespace-nowrap"
                            style={{ backgroundColor: theme.accentBg }}
                          >
                            {smart.priceEstimator.ctaText || "Lock In My Written Quote →"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {showPicker && smart.appointmentPicker && (
                    <div
                      className={`${
                        showEstimator ? "lg:col-span-5" : "lg:col-span-12"
                      } bg-white rounded-2xl p-5 sm:p-8 border shadow-xs flex flex-col justify-between space-y-5`}
                      style={{ borderColor: theme.borderSubtle }}
                    >
                      <div className="space-y-4">
                        <div>
                          <div
                            className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider mb-1"
                            style={{ color: theme.accentText }}
                          >
                            {smart.appointmentPicker.badge}
                          </div>
                          <h3
                            className="text-xl sm:text-2xl font-extrabold tracking-tight"
                            style={{ color: theme.inkPrimary }}
                          >
                            {smart.appointmentPicker.title}
                          </h3>
                          <p
                            className="text-xs sm:text-sm mt-1 leading-relaxed"
                            style={{ color: theme.inkMuted }}
                          >
                            {smart.appointmentPicker.subtitle}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label
                              className="block text-xs font-bold mb-1.5"
                              style={{ color: theme.inkPrimary }}
                            >
                              1. Service / Visit Type:
                            </label>
                            <select
                              value={currentSlotType}
                              onChange={(e) => setSelectedSlotType(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold bg-white"
                              style={{ borderColor: theme.borderSubtle, color: theme.inkPrimary }}
                            >
                              {slotTypes.map((st: string, i: number) => (
                                <option key={i} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              className="block text-xs font-bold mb-1.5"
                              style={{ color: theme.inkPrimary }}
                            >
                              2. Preferred Day &amp; Time Window:
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                              {timeWindows.map((tw: string, i: number) => {
                                const active = currentTimeWindow === tw;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setSelectedTimeWindow(tw)}
                                    className="w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-all"
                                    style={{
                                      borderColor: active ? theme.accentBg : theme.borderSubtle,
                                      backgroundColor: active ? theme.accentSoftBg : theme.canvasBg,
                                      color: theme.inkPrimary,
                                    }}
                                  >
                                    <span>📅 {tw}</span>
                                    {active && (
                                      <span
                                        className="text-[11px] font-bold"
                                        style={{ color: theme.accentText }}
                                      >
                                        Selected
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 space-y-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTap1Choice(currentSlotType);
                            setTap2Choice(currentTimeWindow);
                            setFunnelStep(3);
                            scrollToSection("funnel-card");
                          }}
                          className="w-full py-3.5 px-5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm cursor-pointer"
                          style={{ backgroundColor: theme.accentBg }}
                        >
                          {smart.appointmentPicker.ctaText || "Confirm My Appointment Window →"}
                        </button>

                        {smart.smsDirect?.enabled !== false && (
                          <a
                            href={smsDirectHref}
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 hover:bg-stone-50 transition-colors"
                            style={{
                              borderColor: theme.borderSubtle,
                              color: theme.inkPrimary,
                            }}
                          >
                            <span>
                              {smart.smsDirect?.buttonLabel ||
                                `💬 Text ${cfg.brandName || site.businessName} Directly`}
                            </span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

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

        {/* 8B. AI LOCAL SEO & BUYER COST GUIDES (AUTO-BLOG) */}
        {(() => {
          const blog = cfg.intelligentModules?.seoBlog;
          const posts = Array.isArray(blog?.posts) ? blog.posts : [];
          if (!blog || blog.enabled === false || posts.length === 0) return null;

          return (
            <section
              id="local-seo-guides"
              className="py-10 sm:py-20 px-4 sm:px-8 lg:px-12 border-t scroll-mt-20"
              style={{ backgroundColor: theme.canvasBg, borderColor: theme.borderSubtle }}
            >
              <div className="max-w-[1240px] mx-auto space-y-8 sm:space-y-10">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div
                      className="text-[11px] sm:text-xs font-bold uppercase tracking-wider"
                      style={{ color: theme.accentText }}
                    >
                      {blog.sectionKicker ||
                        `LOCAL ${(cfg.category || site.category || "SERVICE").toUpperCase()} & COST GUIDES IN ${(cfg.city || site.city).toUpperCase()}`}
                    </div>
                    <h2
                      className="text-2xl sm:text-4xl font-extrabold tracking-tight"
                      style={{ color: theme.inkPrimary }}
                    >
                      {blog.sectionHeading ||
                        `Expert ${cfg.category || site.category} Guides for ${cfg.city || site.city} Residents`}
                    </h2>
                    <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.inkMuted }}>
                      {blog.sectionSubtitle}
                    </p>
                  </div>

                  {/* 1-Click AI Local SEO Article Generator Bar (For Owner / Agency Preview) */}
                  {!isLiveHostedMode && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 w-full lg:w-auto">
                      <input
                        type="text"
                        value={customBlogTopic}
                        onChange={(e) => setCustomBlogTopic(e.target.value)}
                        placeholder={`Optional topic (e.g. "${cfg.category} cost in ${cfg.city || site.city}")`}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white min-w-[230px]"
                      />
                      <button
                        type="button"
                        disabled={generatingBlogPost}
                        onClick={handleGenerateBlogArticle}
                        className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${generatingBlogPost ? "animate-spin" : ""}`} />
                        <span>
                          {generatingBlogPost
                            ? "AI Writing Local Guide…"
                            : "✨ + Generate AI SEO Article"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {posts.map((post: any, idx: number) => {
                    const isExpanded = expandedBlogIdx === idx;
                    return (
                      <article
                        key={post.id || idx}
                        className="bg-white rounded-2xl p-5 sm:p-6 border flex flex-col justify-between shadow-2xs"
                        style={{ borderColor: theme.borderSubtle }}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                            <span
                              className="px-2.5 py-1 rounded-md"
                              style={{
                                backgroundColor: theme.accentSoftBg,
                                color: theme.accentText,
                              }}
                            >
                              {post.categoryTag || `${cfg.city || site.city} Guide`}
                            </span>
                            <span style={{ color: theme.inkMuted }}>
                              {post.readTime || "3 min read"}
                            </span>
                          </div>

                          <h3
                            className="text-base sm:text-lg font-extrabold leading-snug"
                            style={{ color: theme.inkPrimary }}
                          >
                            {post.title}
                          </h3>

                          <p
                            className="text-xs sm:text-sm leading-relaxed"
                            style={{ color: theme.inkMuted }}
                          >
                            {post.summary}
                          </p>

                          {isExpanded && (
                            <div
                              className="pt-3 border-t space-y-3 text-xs sm:text-sm leading-relaxed"
                              style={{ borderColor: theme.borderSubtle, color: theme.inkPrimary }}
                            >
                              {(post.contentParagraphs || []).map((para: string, pIdx: number) => (
                                <p key={pIdx} style={{ color: theme.inkMuted }}>
                                  {para}
                                </p>
                              ))}

                              {Array.isArray(post.keyTakeaways) && post.keyTakeaways.length > 0 && (
                                <div
                                  className="p-3.5 rounded-xl space-y-1.5"
                                  style={{ backgroundColor: theme.sectionAltBg }}
                                >
                                  <div
                                    className="text-[11px] font-extrabold uppercase tracking-wider"
                                    style={{ color: theme.inkPrimary }}
                                  >
                                    Key Takeaways for {cfg.city || site.city}:
                                  </div>
                                  {post.keyTakeaways.map((kt: string, kIdx: number) => (
                                    <div
                                      key={kIdx}
                                      className="text-xs flex items-start gap-2"
                                      style={{ color: theme.inkPrimary }}
                                    >
                                      <span style={{ color: theme.accentText }}>✓</span>
                                      <span>{kt}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div
                          className="pt-4 mt-4 border-t flex items-center justify-between gap-2"
                          style={{ borderColor: theme.borderSubtle }}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedBlogIdx(isExpanded ? null : idx)}
                            className="text-xs font-bold hover:underline cursor-pointer"
                            style={{ color: theme.accentText }}
                          >
                            {isExpanded ? "Show Less ▲" : "Read Full Guide ▼"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTap1Choice(post.title);
                              setFunnelStep(2);
                              scrollToSection("funnel-card");
                            }}
                            className="text-xs font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            style={{ color: theme.inkPrimary }}
                          >
                            <span>{post.ctaLabel || "Get Quote →"}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

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
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 text-center"
                >
                  Own {cfg.brandName || site.businessName}? Claim This Website →
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* 10. MOBILE STICKY BOTTOM CALL, ESTIMATE & CLAIM YOUR SITE BAR */}
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t px-3 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] flex flex-col gap-2"
          style={{ borderColor: theme.borderSubtle }}
        >
          {!isLiveHostedMode && (
            <button
              type="button"
              onClick={() => setClaimModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                {claimSuccess || site.claimRequested
                  ? "Website Claimed — View Activation Details →"
                  : "Claim Your Site Now ($0 Build Fee) →"}
              </span>
            </button>
          )}
          <div className="flex items-center gap-2">
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

        {/* 11. BUILT-IN AUTOMATED WEBSITE CHATBOT (AUTO-APPEARS ON ARRIVAL + WEB AUDIO CHIME + INTERACTIVE VISITOR QUESTIONS) */}
        <WebsiteAutomatedChatbot
          site={site}
          theme={theme}
          phoneDisplay={phoneDisplay}
          phoneHref={phoneHref}
          onLeadCaptured={(updatedSite) => setSite(updatedSite)}
        />
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

                {/* Package & Total Due Summary + Live 1 / 3 / 12 Month Switcher */}
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <div className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                        Selected Hosting &amp; Growth Package ({claimBillingMonths}{" "}
                        {claimBillingMonths === 1 ? "Month" : "Months"})
                      </div>
                      <div className="font-bold text-sm text-white">
                        {selectedPlanObj.name} — ${discountedPlanMonthly}/mo
                        {claimBillingMonths > 1
                          ? ` × ${claimBillingMonths} months ($${hostingTermTotal})`
                          : ""}
                      </div>
                      {selectedAddonObjs.length > 0 && (
                        <div className="text-slate-300 text-[11px]">
                          Add-Ons: {selectedAddonObjs.map((a) => `${a.name} (${a.priceLabel})`).join(" · ")}
                        </div>
                      )}
                      <div className="text-emerald-400 text-[11px] font-semibold">
                        ✓ Custom Website &amp; 4-Tap Estimate Funnel Build: $0.00 (FREE)
                        {hostingTermSavings > 0 ? ` · Multi-Month Discount: -$${hostingTermSavings} Saved` : ""}
                      </div>
                    </div>
                    <div className="sm:text-right border-t sm:border-t-0 border-slate-800 pt-2.5 sm:pt-0 shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Total Due Today ({claimBillingMonths} {claimBillingMonths === 1 ? "Mo" : "Mos"})
                      </div>
                      <div className="text-2xl font-extrabold text-amber-400 font-mono">
                        ${claimDueToday}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        (${hostingTermTotal} hosting for {claimBillingMonths} mo
                        {claimBillingMonths > 1 ? "s" : ""}
                        {addonsMonthlyTotal > 0 ? ` + $${addonsMonthlyTotal}/mo add-ons` : ""}
                        {claimOneTimeTotal > 0 ? ` + $${claimOneTimeTotal} one-time` : ""})
                      </div>
                    </div>
                  </div>

                  {/* Quick 1 Month / 3 Months / 12 Months Switcher on Payment Screen (Great for Bank Transfer & Crypto) */}
                  {!paymentConfirmed && (
                    <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300">
                        Paying via Bank Transfer or Crypto? Pre-pay <strong>3 or 12 months</strong> to save up to 20%:
                      </span>
                      <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 gap-1 shrink-0">
                        {BILLING_DURATIONS.map((dur) => {
                          const active = claimBillingMonths === dur.months;
                          return (
                            <button
                              key={dur.months}
                              type="button"
                              onClick={() => setClaimBillingMonths(dur.months)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                active
                                  ? "bg-amber-400 text-slate-950"
                                  : "text-slate-300 hover:text-white"
                              }`}
                            >
                              {dur.label}
                              {dur.discountPct > 0 ? ` (-${dur.discountPct}%)` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                        Open Your Website Admin Panel (Password: {site.siteConfig?.adminPassword || site.siteConfig?.adminPin || "owner2026"})
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
                            Open Secure Lemon Squeezy Card Checkout (${claimDueToday}) →
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
                          Instant Crypto Payment (${claimDueToday} USD Equivalent)
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

                  {/* Step 1: Select Hosting Duration (1 Month, 3 Months, 12 Months) & Hosting Tier */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        1. Choose Hosting Duration &amp; Care Plan (Website Build is $0 Free)
                      </label>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        💡 Save up to 20% with 3 or 12 months (Best for Bank &amp; Crypto)
                      </span>
                    </div>

                    {/* 1 Month / 3 Months / 12 Months Duration Selector */}
                    <div className="grid grid-cols-3 gap-2">
                      {BILLING_DURATIONS.map((dur) => {
                        const active = claimBillingMonths === dur.months;
                        return (
                          <button
                            key={dur.months}
                            type="button"
                            onClick={() => setClaimBillingMonths(dur.months)}
                            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                              active
                                ? "border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/20"
                                : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                                {dur.label}
                              </span>
                              {dur.discountPct > 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap">
                                  Save {dur.discountPct}%
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  Monthly
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-600 leading-snug">
                              {dur.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Hosting Plan Tier Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(Object.values(HOSTING_PLANS) as Array<(typeof HOSTING_PLANS)[keyof typeof HOSTING_PLANS]>).map(
                        (plan) => {
                          const active = claimHostingPlan === plan.id;
                          const planDiscountedMo = Math.round(
                            plan.monthlyPrice * (1 - selectedDurationObj.discountPct / 100)
                          );
                          const planTermTotal = planDiscountedMo * claimBillingMonths;
                          const planSavings =
                            plan.monthlyPrice * claimBillingMonths - planTermTotal;

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
                                  <div className="text-right">
                                    {selectedDurationObj.discountPct > 0 && (
                                      <span className="text-[11px] line-through text-slate-400 font-mono mr-1.5">
                                        ${plan.monthlyPrice}/mo
                                      </span>
                                    )}
                                    <span className="text-sm font-extrabold text-slate-900 font-mono">
                                      ${planDiscountedMo}/mo
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs font-bold text-slate-900">{plan.name}</div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">{plan.desc}</p>
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-700 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                <span>
                                  {claimBillingMonths === 1
                                    ? "Billed monthly · $0 Build Fee"
                                    : `$${planTermTotal} for ${claimBillingMonths} mos (Save $${planSavings})`}
                                </span>
                                <span className="shrink-0">{active ? "✓ Selected" : "Select"}</span>
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
                      {hostingTermSavings > 0 && (
                        <span className="ml-2 text-[11px] font-bold text-emerald-700">
                          (Saving ${hostingTermSavings} on {claimBillingMonths}-Mo Plan)
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-900 font-mono">
                      Due Today ({claimBillingMonths} {claimBillingMonths === 1 ? "Mo" : "Mos"}): ${claimDueToday}
                      <span className="text-[11px] font-normal text-slate-500 ml-1">
                        (${hostingTermTotal} hosting
                        {addonsMonthlyTotal > 0 ? ` + $${addonsMonthlyTotal}/mo add-ons` : ""}
                        {claimOneTimeTotal > 0 ? ` + $${claimOneTimeTotal} one-time` : ""})
                      </span>
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
