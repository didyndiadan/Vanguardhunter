import React, { useState } from "react";
import {
  X,
  Palette,
  Upload,
  Layout,
  Briefcase,
  MessageSquare,
  Globe,
  Download,
  CheckCircle2,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Phone,
  Image as ImageIcon,
  ShieldCheck,
  Server,
  Save,
  RefreshCw,
  Mic,
  Volume2,
} from "lucide-react";
import {
  STUDIO_VOICE_PERSONAS,
  getStudioVoicePersona,
  speakWithStudioVoice,
} from "@/lib/studio-voices";

export interface WebsiteThemePalette {
  id: string;
  name: string;
  badge: string;
  bgCanvas: string;
  bgElevated: string;
  bgSubtle: string;
  bgDarkSection: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  border: string;
  topBarBg: string;
  topBarText: string;
}

export const WEBSITE_COLOR_THEMES: Record<string, WebsiteThemePalette> = {
  kinetic_crimson: {
    id: "kinetic_crimson",
    name: "Kinetic Crimson & Carbon Athletic",
    badge: "Fitness · Gyms · Athletic Training",
    bgCanvas: "#F8FAFC",
    bgElevated: "#FFFFFF",
    bgSubtle: "#FFF1F2",
    bgDarkSection: "#090D16",
    textPrimary: "#090D16",
    textSecondary: "#1E293B",
    textMuted: "#475569",
    accent: "#E11D48",
    accentHover: "#BE123C",
    accentSoft: "#FFE4E6",
    border: "#FECDD3",
    topBarBg: "#090D16",
    topBarText: "#FFF1F2",
  },
  valley_craft: {
    id: "valley_craft",
    name: "Warm Walnut & Sandstone",
    badge: "Remodeling · Craft · Builders",
    bgCanvas: "#FAF6F0",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F2ECE1",
    bgDarkSection: "#1E1915",
    textPrimary: "#141210",
    textSecondary: "#4A433B",
    textMuted: "#787067",
    accent: "#7C4A15",
    accentHover: "#61380D",
    accentSoft: "#F5E9DA",
    border: "#E6DEC8",
    topBarBg: "#181411",
    topBarText: "#F5EFE6",
  },
  clinical_slate: {
    id: "clinical_slate",
    name: "Clinical Teal & Alabaster",
    badge: "Dental · Medical · Clinics",
    bgCanvas: "#F8FAFC",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EFF6FF",
    bgDarkSection: "#0F172A",
    textPrimary: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    accent: "#0D9488",
    accentHover: "#0F766E",
    accentSoft: "#CCFBF1",
    border: "#E2E8F0",
    topBarBg: "#0F172A",
    topBarText: "#F8FAFC",
  },
  emerald_botanical: {
    id: "emerald_botanical",
    name: "Forest Emerald & Warm Sage",
    badge: "Landscaping · Eco · Wellness",
    bgCanvas: "#F6FAF7",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EBF5EE",
    bgDarkSection: "#0B1E13",
    textPrimary: "#0F2417",
    textSecondary: "#2F4F3A",
    textMuted: "#5C7A66",
    accent: "#15803D",
    accentHover: "#166534",
    accentSoft: "#DCFCE7",
    border: "#D5E6DA",
    topBarBg: "#0B1E13",
    topBarText: "#ECFDF5",
  },
  crimson_culinary: {
    id: "crimson_culinary",
    name: "Bordeaux Terracotta & Cream",
    badge: "Restaurants · Culinary · Dining",
    bgCanvas: "#FDFBF9",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F9F1EC",
    bgDarkSection: "#24110E",
    textPrimary: "#1F1210",
    textSecondary: "#523833",
    textMuted: "#84655E",
    accent: "#B91C1C",
    accentHover: "#991B1B",
    accentSoft: "#FEE2E2",
    border: "#ECDAD5",
    topBarBg: "#24110E",
    topBarText: "#FEF2F2",
  },
  midnight_sapphire: {
    id: "midnight_sapphire",
    name: "Cobalt Sapphire & Cool Ice",
    badge: "Plumbing · HVAC · Auto · Tech",
    bgCanvas: "#F8FAFF",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EEF2FF",
    bgDarkSection: "#091128",
    textPrimary: "#0B132B",
    textSecondary: "#2D3A5C",
    textMuted: "#627094",
    accent: "#1D4ED8",
    accentHover: "#1E40AF",
    accentSoft: "#DBEAFE",
    border: "#DCE4F7",
    topBarBg: "#091128",
    topBarText: "#EFF6FF",
  },
  executive_heritage: {
    id: "executive_heritage",
    name: "Obsidian & Champagne Gold",
    badge: "Law · Financial · Real Estate",
    bgCanvas: "#FAF9F5",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F3F0E6",
    bgDarkSection: "#12161F",
    textPrimary: "#111622",
    textSecondary: "#3A4152",
    textMuted: "#697082",
    accent: "#9A6F1A",
    accentHover: "#7C5812",
    accentSoft: "#FBF3DC",
    border: "#E5DFCE",
    topBarBg: "#0F1420",
    topBarText: "#FAF5E8",
  },
  culinary_linen: {
    id: "culinary_linen",
    name: "Warm Espresso & Linen",
    badge: "Boutique · Hospitality · Design",
    bgCanvas: "#FBF8F4",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F3EDE4",
    bgDarkSection: "#211B18",
    textPrimary: "#1A1614",
    textSecondary: "#4D433E",
    textMuted: "#7D716A",
    accent: "#8C3B2B",
    accentHover: "#6E2C1F",
    accentSoft: "#F9E7E3",
    border: "#E6DDD3",
    topBarBg: "#1C1614",
    topBarText: "#FAF6F0",
  },
  plum_aesthetics: {
    id: "plum_aesthetics",
    name: "Velvet Plum & Rose Quartz",
    badge: "Salons · MedSpas · Beauty",
    bgCanvas: "#FDF9FC",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F7EEF5",
    bgDarkSection: "#241022",
    textPrimary: "#21111E",
    textSecondary: "#54384F",
    textMuted: "#876881",
    accent: "#86198F",
    accentHover: "#701A75",
    accentSoft: "#FAE8FF",
    border: "#EAD8E6",
    topBarBg: "#241022",
    topBarText: "#FDF4FF",
  },
  industrial_orange: {
    id: "industrial_orange",
    name: "Safety Copper & Charcoal",
    badge: "Roofing · Mechanical · Trades",
    bgCanvas: "#FAF9F7",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F4F1EC",
    bgDarkSection: "#18181B",
    textPrimary: "#18181B",
    textSecondary: "#3F3F46",
    textMuted: "#71717A",
    accent: "#C2410C",
    accentHover: "#9A3412",
    accentSoft: "#FFEDD5",
    border: "#E4E2DD",
    topBarBg: "#18181B",
    topBarText: "#FAFAFA",
  },
  solar_teal: {
    id: "solar_teal",
    name: "Ocean Cyan & Pure Alabaster",
    badge: "Solar · Pools · Cleaning",
    bgCanvas: "#F7FCFD",
    bgElevated: "#FFFFFF",
    bgSubtle: "#ECFEFF",
    bgDarkSection: "#082F49",
    textPrimary: "#082F49",
    textSecondary: "#1E4E68",
    textMuted: "#557C93",
    accent: "#0284C7",
    accentHover: "#0369A1",
    accentSoft: "#E0F2FE",
    border: "#D5ECF2",
    topBarBg: "#082F49",
    topBarText: "#F0F9FF",
  },
  nordic_indigo: {
    id: "nordic_indigo",
    name: "Royal Indigo & Cool Stone",
    badge: "Commercial · B2B · Advisory",
    bgCanvas: "#F9FAFB",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EEF2FF",
    bgDarkSection: "#111827",
    textPrimary: "#111827",
    textSecondary: "#374151",
    textMuted: "#6B7280",
    accent: "#4338CA",
    accentHover: "#3730A3",
    accentSoft: "#E0E7FF",
    border: "#E5E7EB",
    topBarBg: "#111827",
    topBarText: "#F9FAFB",
  },
};

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

export const UNIVERSAL_SHOWCASE_IMAGES: Record<string, string> = {
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

export function resolvePreviewVisualsForBusiness(
  category = "",
  businessName = "",
  themeIdOverride?: string,
  finishedWork?: any[],
  scrapedImages?: string[],
  variationSeed = 0,
  avoidUrls?: Set<string>,
  city = ""
): {
  theme: WebsiteThemePalette;
  images: string[];
  nicheLabel: string;
} {
  const uniqueSelection = selectUniqueVisualsForBusiness({
    category,
    businessName,
    city,
    variationSeed,
    count: 3,
    localAssetsMap: UNIVERSAL_SHOWCASE_IMAGES,
    avoidUrls,
  });

  const resolvedThemeId =
    themeIdOverride && WEBSITE_COLOR_THEMES[themeIdOverride]
      ? themeIdOverride
      : uniqueSelection.recommendedThemeId;
  const theme = WEBSITE_COLOR_THEMES[resolvedThemeId] || WEBSITE_COLOR_THEMES.valley_craft;

  const usedUrls = new Set<string>();
  const imgsFromWork = Array.isArray(finishedWork)
    ? finishedWork
        .map((fw, i) => {
          const customUrl = String(fw?.customImageUrl || "").trim();
          if (
            customUrl &&
            /^(https?:\/\/|data:image\/)/i.test(customUrl) &&
            !usedUrls.has(customUrl) &&
            (customUrl.startsWith("data:image/") || !avoidUrls || !avoidUrls.has(customUrl))
          ) {
            usedUrls.add(customUrl);
            if (avoidUrls) avoidUrls.add(customUrl);
            return customUrl;
          }
          const fallbackUrl =
            uniqueSelection.images.find((u) => !usedUrls.has(u)) ||
            uniqueSelection.images[i % Math.max(1, uniqueSelection.images.length)];
          if (fallbackUrl) {
            usedUrls.add(fallbackUrl);
            return fallbackUrl;
          }
          return "";
        })
        .filter(Boolean)
    : [];

  const finalImages =
    imgsFromWork.length >= 3 ? imgsFromWork.slice(0, 3) : uniqueSelection.images.slice(0, 3);
  const extraScraped = Array.isArray(scrapedImages)
    ? scrapedImages.filter(
        (u) => typeof u === "string" && /^https?:\/\//i.test(u) && !finalImages.includes(u)
      )
    : [];

  return {
    theme,
    images: Array.from(new Set([...finalImages, ...extraScraped.slice(0, 3)])),
    nicheLabel: uniqueSelection.nichePool.nicheLabel,
  };
}

export const IMAGE_PRESET_OPTIONS = [
  { value: "fitness_strength", label: "Fitness: Strength & Weights Workout (People Training)" },
  { value: "fitness_group", label: "Fitness: Group Workout Class & Coaching" },
  { value: "fitness_coaching", label: "Fitness: 1-on-1 Personal Training & Turf Sled" },
  { value: "fitness_cardio_functional", label: "Fitness: Functional Conditioning & Battle Ropes" },
  { value: "medical_consultation", label: "Medical & Dental: Doctor Consulting With Patient" },
  { value: "dental_medical", label: "Medical & Dental: Modern Clinical Suite" },
  { value: "dental_network", label: "Medical & Dental: Healthcare Team" },
  { value: "restaurant_dining", label: "Restaurant: Chef Plating & Guests Dining" },
  { value: "restaurant_culinary", label: "Restaurant: Signature Culinary Spread" },
  { value: "restaurant_catering_banquet", label: "Restaurant: Private Dining & Catering Banquet" },
  { value: "salon_styling", label: "Salon & MedSpa: Stylist Working With Client" },
  { value: "salon_spa_facial_treatment", label: "Salon & MedSpa: Facial & Aesthetic Glow Treatment" },
  { value: "salon_wellness", label: "Salon & MedSpa: Luxury Aesthetic Studio" },
  { value: "auto_diagnostic", label: "Auto Repair: Master Mechanic Digital Inspection" },
  { value: "auto_brake_tire_alignment", label: "Auto Repair: Brake, Tire & Wheel Alignment" },
  { value: "auto_mechanical", label: "Auto Repair: Precision Service Bay" },
  { value: "hvac_dispatch", label: "Home Services: Technician Reviewing Upfront Quote" },
  { value: "plumbing_hvac", label: "Home Services: Plumbing, Water Heater & HVAC" },
  { value: "electrical_plumbing_specialist", label: "Home Services: Electrical & Tankless Specialist" },
  { value: "roofing_exterior", label: "Roofing & Architectural Exterior" },
  { value: "landscaping_outdoor", label: "Landscaping & Outdoor Living" },
  { value: "commercial_solar", label: "Commercial Solar & Clean Energy" },
  { value: "legal_advisory", label: "Law Firm & Executive Advisory" },
  { value: "kitchen", label: "Custom Kitchen Remodeling" },
  { value: "bathroom", label: "Primary Spa Bathroom Remodel" },
  { value: "remodel_custom_living_carpentry", label: "Custom Living Space & Interior Carpentry" },
  { value: "exterior", label: "Whole-Home Exterior & Deck" },
  { value: "commercial", label: "Commercial Facility & Services" },
  { value: "b2b_intelligence", label: "Corporate & Technology Office" },
];

interface WebsiteOwnerAdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  site: any;
  onSiteUpdated: (updatedSite: any) => void;
  initialUnlocked?: boolean;
}

export const WebsiteOwnerAdminDrawer: React.FC<WebsiteOwnerAdminDrawerProps> = ({
  isOpen,
  onClose,
  site,
  onSiteUpdated,
  initialUnlocked = false,
}) => {
  const cfg = (site?.siteConfig || {}) as any;
  const expectedPin = String(cfg.adminPassword || cfg.adminPin || "owner2026");
  const isDefaultPasswordActive = !cfg.adminPasswordChanged && (expectedPin === "owner2026" || expectedPin === "2026");

  // Auth state for business owners opening /site/:siteId?admin=1
  const [isUnlocked, setIsUnlocked] = useState<boolean>(initialUnlocked);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<
    | "brand_colors"
    | "smart_modules"
    | "hero_funnel"
    | "services_work"
    | "reviews_faq"
    | "leads_inbox"
    | "hosting_export"
  >("brand_colors");

  // Intelligent Smart Modules state
  const [intelligentModules, setIntelligentModules] = useState<any>(
    cfg.intelligentModules || {
      industryProfile: "local_service",
      industryLabel: `${site?.category || "Local Business"} Conversion Suite`,
      intelligenceReason:
        "Intelligently configured for this business type to maximize local Google rankings, phone calls, and direct bookings.",
      promoVoucher: {
        enabled: true,
        badge: "NEW CLIENT SPECIAL",
        headline: "$50 OFF Your First Service or Priority Booking",
        subtext: "Mention this online voucher or claim below for priority scheduling.",
        code: "VIP50",
        ctaLabel: "Claim Voucher",
      },
      priceEstimator: {
        enabled: true,
        title: "Instant Ballpark Price & Service Estimator",
        subtitle: "Select a service tier below to see transparent local pricing ranges",
        tiers: [
          {
            label: "Diagnostic / Initial Visit",
            range: "$89 – $175",
            duration: "Same-Day Available",
            includes: "On-site evaluation, upfront written quote & options",
          },
          {
            label: "Standard Service / Repair",
            range: "$240 – $680",
            duration: "Most Completed Same Day",
            includes: "Commercial-grade parts, licensed labor & workmanship warranty",
          },
          {
            label: "Full System / Major Project",
            range: "$1,450 – $4,800+",
            duration: "Flexible Financing Available",
            includes: "Turnkey installation, priority crew & full warranty",
          },
        ],
      },
      appointmentPicker: {
        enabled: true,
        title: "Check Today's Open Arrival & Booking Windows",
        subtitle: "Pick a convenient time window to lock in your priority callback",
        slotTypes: ["Urgent / Same-Day", "Standard Service", "Free Written Quote"],
        availableWindows: ["Today · Next Open Slot", "Tomorrow · 8am–11am", "Tomorrow · 1pm–4pm", "This Week · Flexible"],
        ctaLabel: "Reserve This Window",
      },
      smsDirect: {
        enabled: true,
        buttonLabel: "Text Us Directly",
        prefillMessage: `Hi ${cfg.brandName || site?.businessName || "there"}, I'm visiting your website and would like a quick quote or availability check.`,
      },
      seoBlog: {
        enabled: true,
        sectionTitle: `${cfg.city || site?.city || "Local"} Local Cost Guides & Expert Advice`,
        sectionSubtitle: `Practical answers, transparent pricing guides, and local tips from ${cfg.brandName || site?.businessName || "our team"}.`,
        articles: [],
      },
    }
  );
  const [customBlogTopic, setCustomBlogTopic] = useState<string>("");
  const [generatingBlogPost, setGeneratingBlogPost] = useState<boolean>(false);

  // Editable config state
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    site?.themeId || cfg.themeId || "valley_craft"
  );
  const [customAccentColor, setCustomAccentColor] = useState<string>(cfg.customAccentColor || "");
  const [customLogoUrl, setCustomLogoUrl] = useState<string>(cfg.customLogoUrl || "");
  const [emblemType, setEmblemType] = useState<string>(cfg.emblemType || "shield");

  const [brandName, setBrandName] = useState<string>(cfg.brandName || site?.businessName || "");
  const [phoneDisplay, setPhoneDisplay] = useState<string>(cfg.phoneDisplay || site?.phone || "");
  const [emailDisplay, setEmailDisplay] = useState<string>(cfg.emailDisplay || site?.email || "");
  const [city, setCity] = useState<string>(cfg.city || site?.city || "");
  const [hoursText, setHoursText] = useState<string>(cfg.hoursText || "Mon–Sat, 8 am to 6 pm");
  const [brandSubline, setBrandSubline] = useState<string>(
    cfg.brandSubline || "Upfront pricing. Fast response."
  );
  const [announcementBar, setAnnouncementBar] = useState<string>(cfg.announcementBar || "");

  // Hero & Funnel
  const [heroKicker, setHeroKicker] = useState<string>(cfg.heroKicker || "");
  const [heroHeadline, setHeroHeadline] = useState<string>(cfg.heroHeadline || "");
  const [heroSubheadline, setHeroSubheadline] = useState<string>(cfg.heroSubheadline || "");
  const [heroSecondaryCta, setHeroSecondaryCta] = useState<string>(
    cfg.heroSecondaryCta || "Get Instant Quote"
  );
  const [funnelTitle, setFunnelTitle] = useState<string>(
    cfg.funnelConfig?.title || "How can we help you?"
  );
  const [funnelStep1Question, setFunnelStep1Question] = useState<string>(
    cfg.funnelConfig?.step1Question || "1. Which service do you need?"
  );
  const [step1Options, setStep1Options] = useState<Array<{ label: string; desc: string }>>(
    Array.isArray(cfg.funnelConfig?.step1Options) ? cfg.funnelConfig.step1Options : []
  );

  // Built-in Automated Chatbot Settings
  const [chatbotEnabled, setChatbotEnabled] = useState<boolean>(
    cfg.chatbotConfig?.enabled !== false
  );
  const [chatbotSoundEnabled, setChatbotSoundEnabled] = useState<boolean>(
    cfg.chatbotConfig?.soundEnabled !== false
  );
  const [chatbotSpokenVoiceEnabled, setChatbotSpokenVoiceEnabled] = useState<boolean>(
    Boolean(cfg.chatbotConfig?.spokenVoiceEnabled)
  );
  const [chatbotVoicePersona, setChatbotVoicePersona] = useState<string>(
    cfg.chatbotConfig?.voicePersona || "Kore"
  );
  const [chatbotAgentName, setChatbotAgentName] = useState<string>(
    cfg.chatbotConfig?.agentName && !/automated|ai\b|bot\b/i.test(cfg.chatbotConfig.agentName)
      ? cfg.chatbotConfig.agentName
      : `${cfg.brandName || site?.businessName || "Live"} Team`
  );
  const [chatbotGreeting, setChatbotGreeting] = useState<string>(
    cfg.chatbotConfig?.greeting && !/automated assistant|ai assistant/i.test(cfg.chatbotConfig.greeting)
      ? cfg.chatbotConfig.greeting
      : `👋 Hi there! Welcome to ${cfg.brandName || site?.businessName || "our website"} in ${cfg.city || site?.city || "your area"}. How can we help you today?`
  );

  // Services & Showcase
  const [services, setServices] = useState<any[]>(
    Array.isArray(cfg.services) ? cfg.services : []
  );
  const [finishedWork, setFinishedWork] = useState<any[]>(
    Array.isArray(cfg.finishedWork) ? cfg.finishedWork : []
  );

  // Reviews & FAQs
  const [reviews, setReviews] = useState<any[]>(Array.isArray(cfg.reviews) ? cfg.reviews : []);
  const [faqs, setFaqs] = useState<any[]>(Array.isArray(cfg.faqs) ? cfg.faqs : []);
  const [serviceAreasText, setServiceAreasText] = useState<string>(
    Array.isArray(cfg.serviceAreas) ? cfg.serviceAreas.join(", ") : city
  );

  // Hosting & Admin Settings
  const [hostingMode, setHostingMode] = useState<"preview" | "live_hosted">(
    cfg.hostingMode === "live_hosted" ? "live_hosted" : "preview"
  );
  const [customDomain, setCustomDomain] = useState<string>(cfg.customDomain || "");
  const [adminPin, setAdminPin] = useState<string>(expectedPin === "2026" && !cfg.adminPasswordChanged ? "owner2026" : expectedPin);
  const [newPasswordInput, setNewPasswordInput] = useState<string>(
    expectedPin === "2026" && !cfg.adminPasswordChanged ? "owner2026" : expectedPin
  );

  // Image Regeneration state
  const [regeneratingImages, setRegeneratingImages] = useState<boolean>(false);
  const [regeneratingCardIdx, setRegeneratingCardIdx] = useState<number | null>(null);
  const [customImageScenePrompt, setCustomImageScenePrompt] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !site) return null;

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = pinInput.trim();
    if (!entered) {
      setPinError("Please enter your Business Owner Admin Password.");
      return;
    }
    if (
      entered === expectedPin ||
      entered === adminPin ||
      (!cfg.adminPasswordChanged && (entered === "owner2026" || entered === "2026"))
    ) {
      setIsUnlocked(true);
      setPinError("");
      return;
    }
    try {
      const res = await fetch(`/api/website-builder/public/${site.siteId}/admin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: entered, password: entered }),
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        setIsUnlocked(true);
        setPinError("");
        return;
      }
      setPinError(
        data.error ||
          (isDefaultPasswordActive
            ? 'Incorrect password. Default Business Owner Password is "owner2026".'
            : "Incorrect Business Owner Admin Password.")
      );
    } catch {
      setPinError(
        isDefaultPasswordActive
          ? 'Incorrect password. Default Business Owner Password is "owner2026".'
          : "Incorrect Business Owner Admin Password."
      );
    }
  };

  const handleRegenerateImages = async (cardIndex?: number) => {
    setRegeneratingImages(true);
    setRegeneratingCardIdx(typeof cardIndex === "number" ? cardIndex : null);
    setSaveToast(null);
    try {
      const res = await fetch(`/api/website-builder/public/${site.siteId}/regenerate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: adminPin || expectedPin || "owner2026",
          password: adminPin || expectedPin || "owner2026",
          cardIndex: typeof cardIndex === "number" ? cardIndex : undefined,
          customPrompt: customImageScenePrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate images");

      if (Array.isArray(data.finishedWork)) {
        setFinishedWork(data.finishedWork);
      }
      if (data.site) {
        onSiteUpdated(data.site);
      }
      setSaveToast(
        typeof cardIndex === "number"
          ? `✨ Showcase Photo #${cardIndex + 1} regenerated with a fresh unique image!`
          : "✨ All 3 Showcase Photos regenerated with unique industry images!"
      );
      setTimeout(() => setSaveToast(null), 4500);
    } catch (err: any) {
      setSaveToast(`Error: ${err.message}`);
    } finally {
      setRegeneratingImages(false);
      setRegeneratingCardIdx(null);
    }
  };

  const handleUpdatePasswordOnly = async () => {
    const cleanNewPw = newPasswordInput.trim();
    if (!cleanNewPw || cleanNewPw.length < 4) {
      setSaveToast("Error: Admin password must be at least 4 characters.");
      return;
    }
    setAdminPin(cleanNewPw);
    setSaving(true);
    setSaveToast(null);
    try {
      const res = await fetch(`/api/website-builder/public/${site.siteId}/admin-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: expectedPin,
          password: expectedPin,
          newPassword: cleanNewPw,
          themeId: selectedThemeId,
          siteConfigUpdates: {
            ...cfg,
            adminPin: cleanNewPw,
            adminPassword: cleanNewPw,
            adminPasswordChanged: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      onSiteUpdated(data.site);
      setSaveToast(`🔑 Business Owner Admin Password changed to "${cleanNewPw}"!`);
      setTimeout(() => setSaveToast(null), 4500);
    } catch (err: any) {
      setSaveToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setSaveToast("Logo image should be under 2.5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleShowcaseImageUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const next = [...finishedWork];
        next[idx] = { ...next[idx], customImageUrl: reader.result };
        setFinishedWork(next);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiBlogArticle = async () => {
    setGeneratingBlogPost(true);
    setSaveToast(null);
    try {
      const res = await fetch(`/api/website-builder/public/${site.siteId}/generate-blog-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: adminPin || expectedPin || "owner2026",
          password: adminPin || expectedPin || "owner2026",
          customTopic: customBlogTopic.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate AI blog article");
      if (data.site?.siteConfig?.intelligentModules) {
        setIntelligentModules(data.site.siteConfig.intelligentModules);
      }
      if (data.site) {
        onSiteUpdated(data.site);
      }
      setCustomBlogTopic("");
      setSaveToast(`✨ New Local SEO Guide published: "${data.article?.title || "Article"}"!`);
      setTimeout(() => setSaveToast(null), 4500);
    } catch (err: any) {
      setSaveToast(`Error: ${err.message}`);
    } finally {
      setGeneratingBlogPost(false);
    }
  };

  const handleSaveAll = async (overrideHostingMode?: "preview" | "live_hosted") => {
    setSaving(true);
    setSaveToast(null);
    const nextHostingMode = overrideHostingMode || hostingMode;

    const updatedSiteConfig = {
      ...cfg,
      themeId: selectedThemeId,
      customAccentColor: customAccentColor.trim(),
      customLogoUrl: customLogoUrl.trim(),
      emblemType,
      brandName: brandName.trim(),
      phoneDisplay: phoneDisplay.trim(),
      emailDisplay: emailDisplay.trim(),
      city: city.trim(),
      hoursText: hoursText.trim(),
      brandSubline: brandSubline.trim(),
      announcementBar: announcementBar.trim(),
      heroKicker: heroKicker.trim(),
      heroHeadline: heroHeadline.trim(),
      heroSubheadline: heroSubheadline.trim(),
      heroPrimaryCta: `Call ${phoneDisplay.trim()}`,
      heroSecondaryCta: heroSecondaryCta.trim(),
      funnelConfig: {
        ...(cfg.funnelConfig || {}),
        title: funnelTitle.trim(),
        step1Question: funnelStep1Question.trim(),
        step1Options: step1Options.filter((o) => o.label.trim()),
      },
      chatbotConfig: {
        ...(cfg.chatbotConfig || {}),
        enabled: chatbotEnabled,
        soundEnabled: chatbotSoundEnabled,
        spokenVoiceEnabled: chatbotSpokenVoiceEnabled,
        voicePersona: chatbotVoicePersona,
        agentName: chatbotAgentName.trim(),
        greeting: chatbotGreeting.trim(),
      },
      services,
      finishedWork,
      reviews,
      faqs,
      intelligentModules,
      serviceAreas: serviceAreasText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      hostingMode: nextHostingMode,
      customDomain: customDomain.trim(),
      adminPin: (newPasswordInput.trim() || adminPin.trim() || "owner2026"),
      adminPassword: (newPasswordInput.trim() || adminPin.trim() || "owner2026"),
      adminPasswordChanged:
        Boolean(cfg.adminPasswordChanged) ||
        (Boolean(newPasswordInput.trim()) && newPasswordInput.trim() !== "owner2026"),
    };

    try {
      const res = await fetch(`/api/website-builder/public/${site.siteId}/admin-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: expectedPin,
          password: expectedPin,
          newPassword: newPasswordInput.trim() || adminPin.trim() || "owner2026",
          themeId: selectedThemeId,
          siteConfigUpdates: updatedSiteConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save changes");

      onSiteUpdated(data.site);
      setSaveToast("Website updated & published live!");
      setTimeout(() => setSaveToast(null), 4000);
    } catch (err: any) {
      setSaveToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const publicSiteUrl = `${window.location.origin}/site/${site.siteId}`;
  const clientAdminUrl = `${window.location.origin}/site/${site.siteId}?admin=1`;
  const liveCleanUrl = `${window.location.origin}/site/${site.siteId}?live=1`;
  const exportHtmlUrl = `/api/website-builder/public/${site.siteId}/export-html`;
  const submissions = Array.isArray(site.funnelSubmissions) ? site.funnelSubmissions : [];

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-3xl bg-[#0F131A] text-slate-100 h-full flex flex-col border-l border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Admin Header */}
        <div className="px-5 py-4 bg-[#141923] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Layout className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">
                  Website Admin CMS & Hosting Control
                </h2>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Owner Password: {adminPin}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {brandName} · Edit logo, brand colors, services, leads & live hosting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isUnlocked && (
              <button
                onClick={() => handleSaveAll()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saving ? "Saving..." : "Save & Publish Live"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Save Toast Banner */}
        {saveToast && (
          <div className="px-5 py-2.5 bg-emerald-950/90 border-b border-emerald-500/30 text-emerald-200 text-xs font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {saveToast}
            </span>
            <button onClick={() => setSaveToast(null)} className="text-emerald-400 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Password Lock Screen if not yet unlocked */}
        {!isUnlocked ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <form
              onSubmit={handleVerifyPin}
              className="w-full max-w-md bg-[#161C28] border border-slate-800 rounded-2xl p-6 space-y-4"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Unlock {brandName} Business Owner Admin
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the single Business Owner Admin Password to edit logo, regenerate photos, customize services, or change your admin password.
                </p>
              </div>
              {isDefaultPasswordActive && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                  <div className="text-xs text-amber-200">
                    Default Owner Password: <code className="font-mono font-bold text-amber-300">owner2026</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPinInput("owner2026")}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold cursor-pointer"
                  >
                    Use Default
                  </button>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Business Owner Admin Password
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={isDefaultPasswordActive ? "Enter owner2026" : "Enter your custom admin password"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                />
                {pinError && <p className="text-xs text-rose-400 mt-1.5">{pinError}</p>}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Unlock Admin Controls →
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="px-5 pt-3 bg-[#141923] border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "brand_colors", label: "Logo & Colors", icon: Palette },
                { id: "smart_modules", label: "✨ Smart Features & AI Blog", icon: Sparkles },
                { id: "hero_funnel", label: "Headline & 4-Tap Funnel", icon: Layout },
                { id: "services_work", label: "Services & Photos", icon: Briefcase },
                { id: "reviews_faq", label: "Reviews & FAQ", icon: MessageSquare },
                {
                  id: "leads_inbox",
                  label: `Leads (${submissions.length})`,
                  icon: Phone,
                },
                { id: "hosting_export", label: "Hosting & Download", icon: Globe },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                      active
                        ? "border-amber-400 text-amber-300 bg-amber-500/5"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB 1: LOGO, COLORS & BUSINESS INFO */}
              {activeTab === "brand_colors" && (
                <div className="space-y-6">
                  {/* Quick Action Strip: Regenerate Images & Business Owner Admin Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-gradient-to-br from-amber-500/15 to-[#161C28] border border-amber-500/35 rounded-2xl p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Unique Showcase Photos
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Images unrelated or not unique? Regenerate all 3 website photos with AI / niche imagery.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRegenerateImages()}
                          disabled={regeneratingImages}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${regeneratingImages ? "animate-spin" : ""}`} />
                          {regeneratingImages ? "Regenerating..." : "✨ Regenerate Images"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("services_work")}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          Edit Cards
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#161C28] border border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            Business Owner Password
                          </span>
                          <span className="text-[10px] font-mono text-amber-300">
                            {isDefaultPasswordActive ? "Default: owner2026" : "Custom Active"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Single password for business owner to unlock this Admin panel. Change it anytime below:
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPasswordInput}
                          onChange={(e) => {
                            setNewPasswordInput(e.target.value);
                            setAdminPin(e.target.value);
                          }}
                          placeholder="owner2026"
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                        />
                        <button
                          type="button"
                          onClick={handleUpdatePasswordOnly}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                        >
                          Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload & Emblem Card */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          1. Business Logo & Header Emblem
                        </h3>
                        <p className="text-xs text-slate-400">
                          Upload the client's custom logo image or select an industry vector emblem.
                        </p>
                      </div>
                      {customLogoUrl && (
                        <button
                          onClick={() => setCustomLogoUrl("")}
                          className="text-xs text-rose-400 hover:underline cursor-pointer"
                        >
                          Remove Custom Logo
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {customLogoUrl ? (
                        <div className="h-16 px-4 rounded-xl bg-white border border-slate-700 flex items-center justify-center shrink-0">
                          <img
                            src={customLogoUrl}
                            alt="Custom Logo"
                            className="max-h-12 w-auto object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xs text-slate-400 shrink-0">
                          Vector Icon
                        </div>
                      )}

                      <div className="flex-1 w-full space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            Upload Logo File (PNG / JPG / SVG)
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoFileUpload}
                              className="hidden"
                            />
                          </label>
                          <select
                            value={emblemType}
                            onChange={(e) => setEmblemType(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                          >
                            <option value="fitness">Emblem: Fitness / Gym Dumbbell</option>
                            <option value="roof">Emblem: Home / Roofing / Remodel</option>
                            <option value="medical">Emblem: Medical / Dental Cross</option>
                            <option value="culinary">Emblem: Restaurant / Culinary</option>
                            <option value="wellness">Emblem: Salon / Spa / Wellness</option>
                            <option value="legal">Emblem: Law / Financial Pillar</option>
                            <option value="auto">Emblem: Automotive Service</option>
                            <option value="wrench">Emblem: Plumbing / HVAC / Trades</option>
                            <option value="shield">Emblem: Commercial Shield</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={customLogoUrl}
                          onChange={(e) => setCustomLogoUrl(e.target.value)}
                          placeholder="Or paste direct Logo Image URL (https://...)"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 11 Brand Color Palettes + Custom Accent Color */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        2. Brand Color Palette (11 Distinct Industry Themes + Custom Hex)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Each website gets its own distinct color identity. Click any palette below or pick a custom brand color.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {Object.values(WEBSITE_COLOR_THEMES).map((th) => {
                        const isSelected = selectedThemeId === th.id;
                        return (
                          <button
                            key={th.id}
                            type="button"
                            onClick={() => {
                              setSelectedThemeId(th.id);
                              setCustomAccentColor("");
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? "bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/40"
                                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                <span
                                  className="w-6 h-6 rounded-full border border-white/20 shadow"
                                  style={{ backgroundColor: th.topBarBg }}
                                />
                                <span
                                  className="w-6 h-6 rounded-full border border-white/40 shadow"
                                  style={{ backgroundColor: th.accent }}
                                />
                                <span
                                  className="w-6 h-6 rounded-full border border-slate-400/30 shadow"
                                  style={{ backgroundColor: th.bgCanvas }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">
                                  {th.name}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {th.badge}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Brand Hex Override */}
                    <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          Custom Brand Accent Color (Optional Override)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Match the exact hex color from the client's truck, sign, or logo.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={
                            customAccentColor ||
                            WEBSITE_COLOR_THEMES[selectedThemeId]?.accent ||
                            "#7C4A15"
                          }
                          onChange={(e) => setCustomAccentColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customAccentColor}
                          onChange={(e) => setCustomAccentColor(e.target.value)}
                          placeholder="#1D4ED8 (Optional)"
                          className="w-36 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                        />
                        {customAccentColor && (
                          <button
                            type="button"
                            onClick={() => setCustomAccentColor("")}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Core Business Contact Details */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      3. Business Name, Phone, Hours & Top Bar
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Business Name</label>
                        <input
                          type="text"
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Phone Number (Click-to-Call)
                        </label>
                        <input
                          type="text"
                          value={phoneDisplay}
                          onChange={(e) => setPhoneDisplay(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">City / Market</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Operating Hours</label>
                        <input
                          type="text"
                          value={hoursText}
                          onChange={(e) => setHoursText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">
                          Top Announcement Bar Text
                        </label>
                        <input
                          type="text"
                          value={announcementBar}
                          onChange={(e) => setAnnouncementBar(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INTELLIGENT SMART FEATURES & AI LOCAL SEO BLOG */}
              {activeTab === "smart_modules" && (
                <div className="space-y-6">
                  {/* Industry Intelligence Profile Banner */}
                  <div className="bg-gradient-to-br from-emerald-950/60 via-[#161C28] to-amber-950/30 border border-emerald-500/35 rounded-2xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Industry Intelligence: {intelligentModules?.industryLabel || "Smart Conversion Suite"}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setIntelligentModules({
                            ...intelligentModules,
                            promoVoucher: { ...(intelligentModules.promoVoucher || {}), enabled: true },
                            priceEstimator: { ...(intelligentModules.priceEstimator || {}), enabled: true },
                            appointmentPicker: { ...(intelligentModules.appointmentPicker || {}), enabled: true },
                            smsDirect: { ...(intelligentModules.smsDirect || {}), enabled: true },
                            seoBlog: { ...(intelligentModules.seoBlog || {}), enabled: true },
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer"
                      >
                        Enable All 4 Smart Features
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {intelligentModules?.intelligenceReason ||
                        "Our builder automatically analyzed this business's industry and enabled the highest-converting combination of features. You can toggle any or both conversion tools below and click Save & Publish Live."}
                    </p>

                    {/* 4 Feature Toggles Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {[
                        {
                          key: "priceEstimator",
                          title: "1. Interactive Price / Service Estimator",
                          desc: "Best for contractors, dental, auto & service quotes",
                        },
                        {
                          key: "appointmentPicker",
                          title: "2. Live Appointment / Slot Picker",
                          desc: "Best for clinics, salons, restaurants & dispatch",
                        },
                        {
                          key: "promoVoucher",
                          title: "3. Instant Promo Voucher Banner",
                          desc: "Captures hesitant visitors with a claimable offer",
                        },
                        {
                          key: "seoBlog",
                          title: "4. AI Local SEO & Cost Guides (Auto-Blog)",
                          desc: "Ranks on Google for local pricing & question searches",
                        },
                      ].map((feat) => {
                        const isOn = Boolean(intelligentModules?.[feat.key]?.enabled);
                        return (
                          <div
                            key={feat.key}
                            onClick={() =>
                              setIntelligentModules({
                                ...intelligentModules,
                                [feat.key]: {
                                  ...(intelligentModules?.[feat.key] || {}),
                                  enabled: !isOn,
                                },
                              })
                            }
                            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                              isOn
                                ? "bg-emerald-950/40 border-emerald-500/40 text-white"
                                : "bg-slate-900/70 border-slate-800 text-slate-400"
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">{feat.title}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{feat.desc}</div>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                                isOn
                                  ? "bg-emerald-500 text-slate-950"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {isOn ? "ACTIVE" : "OFF"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feature 4: AI Local SEO & Cost Guides (Auto-Blog) + 1-Click Generator */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          AI Local SEO & Cost Guides (Auto-Blog)
                        </div>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          1-Click Local SEO Article Generator ({Array.isArray(intelligentModules?.seoBlog?.articles) ? intelligentModules.seoBlog.articles.length : 0} Published)
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Instead of a dead manual blog, generate high-converting local cost & buyer guides tailored to {brandName} in {city}.
                        </p>
                      </div>
                    </div>

                    {/* 1-Click Generator Input + Button */}
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={customBlogTopic}
                        onChange={(e) => setCustomBlogTopic(e.target.value)}
                        placeholder={`Optional topic (e.g. "How much does ${services[0]?.name || "service"} cost in ${city}?") or leave blank for AI`}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateAiBlogArticle}
                        disabled={generatingBlogPost}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingBlogPost ? "animate-spin" : ""}`} />
                        {generatingBlogPost ? "Writing SEO Guide..." : "✨ Generate New Local SEO Article"}
                      </button>
                    </div>

                    {/* Existing Articles List */}
                    <div className="space-y-3">
                      {(Array.isArray(intelligentModules?.seoBlog?.articles)
                        ? intelligentModules.seoBlog.articles
                        : []
                      ).map((art: any, idx: number) => (
                        <div
                          key={art.id || idx}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                              {art.categoryBadge || "Local Guide"} · {art.readTime || "2 min read"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextArticles = (intelligentModules.seoBlog?.articles || []).filter(
                                  (_: any, i: number) => i !== idx
                                );
                                setIntelligentModules({
                                  ...intelligentModules,
                                  seoBlog: {
                                    ...(intelligentModules.seoBlog || {}),
                                    articles: nextArticles,
                                  },
                                });
                              }}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              title="Remove article"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={art.title || ""}
                            onChange={(e) => {
                              const nextArticles = [...(intelligentModules.seoBlog?.articles || [])];
                              nextArticles[idx] = { ...nextArticles[idx], title: e.target.value };
                              setIntelligentModules({
                                ...intelligentModules,
                                seoBlog: { ...(intelligentModules.seoBlog || {}), articles: nextArticles },
                              });
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                          />
                          <textarea
                            rows={2}
                            value={art.summary || ""}
                            onChange={(e) => {
                              const nextArticles = [...(intelligentModules.seoBlog?.articles || [])];
                              nextArticles[idx] = { ...nextArticles[idx], summary: e.target.value };
                              setIntelligentModules({
                                ...intelligentModules,
                                seoBlog: { ...(intelligentModules.seoBlog || {}), articles: nextArticles },
                              });
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature 3: Promo Voucher Customizer */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Promo Voucher / New Client Offer Banner
                        </h3>
                        <p className="text-xs text-slate-400">
                          Customize the special offer and voucher code shown on the website.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Offer Badge
                        </label>
                        <input
                          type="text"
                          value={intelligentModules?.promoVoucher?.badge || ""}
                          onChange={(e) =>
                            setIntelligentModules({
                              ...intelligentModules,
                              promoVoucher: {
                                ...(intelligentModules.promoVoucher || {}),
                                badge: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Voucher Headline
                        </label>
                        <input
                          type="text"
                          value={intelligentModules?.promoVoucher?.headline || ""}
                          onChange={(e) =>
                            setIntelligentModules({
                              ...intelligentModules,
                              promoVoucher: {
                                ...(intelligentModules.promoVoucher || {}),
                                headline: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Promo Code
                        </label>
                        <input
                          type="text"
                          value={intelligentModules?.promoVoucher?.code || ""}
                          onChange={(e) =>
                            setIntelligentModules({
                              ...intelligentModules,
                              promoVoucher: {
                                ...(intelligentModules.promoVoucher || {}),
                                code: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Subtext
                        </label>
                        <input
                          type="text"
                          value={intelligentModules?.promoVoucher?.subtext || ""}
                          onChange={(e) =>
                            setIntelligentModules({
                              ...intelligentModules,
                              promoVoucher: {
                                ...(intelligentModules.promoVoucher || {}),
                                subtext: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feature 1: Interactive Price Estimator Tiers */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Interactive Price & Service Estimator Tiers
                      </h3>
                      <p className="text-xs text-slate-400">
                        Edit the ballpark pricing tiers visitors can click through before requesting a quote.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={intelligentModules?.priceEstimator?.title || ""}
                      onChange={(e) =>
                        setIntelligentModules({
                          ...intelligentModules,
                          priceEstimator: {
                            ...(intelligentModules.priceEstimator || {}),
                            title: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                    />
                    <div className="space-y-2.5">
                      {(Array.isArray(intelligentModules?.priceEstimator?.tiers)
                        ? intelligentModules.priceEstimator.tiers
                        : []
                      ).map((tier: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2"
                        >
                          <input
                            type="text"
                            value={tier.label || ""}
                            onChange={(e) => {
                              const nextTiers = [...(intelligentModules.priceEstimator?.tiers || [])];
                              nextTiers[idx] = { ...nextTiers[idx], label: e.target.value };
                              setIntelligentModules({
                                ...intelligentModules,
                                priceEstimator: {
                                  ...(intelligentModules.priceEstimator || {}),
                                  tiers: nextTiers,
                                },
                              });
                            }}
                            placeholder="Tier Name"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-semibold"
                          />
                          <input
                            type="text"
                            value={tier.range || ""}
                            onChange={(e) => {
                              const nextTiers = [...(intelligentModules.priceEstimator?.tiers || [])];
                              nextTiers[idx] = { ...nextTiers[idx], range: e.target.value };
                              setIntelligentModules({
                                ...intelligentModules,
                                priceEstimator: {
                                  ...(intelligentModules.priceEstimator || {}),
                                  tiers: nextTiers,
                                },
                              });
                            }}
                            placeholder="Price Range (e.g. $150 - $350)"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-emerald-400 font-bold"
                          />
                          <input
                            type="text"
                            value={tier.includes || ""}
                            onChange={(e) => {
                              const nextTiers = [...(intelligentModules.priceEstimator?.tiers || [])];
                              nextTiers[idx] = { ...nextTiers[idx], includes: e.target.value };
                              setIntelligentModules({
                                ...intelligentModules,
                                priceEstimator: {
                                  ...(intelligentModules.priceEstimator || {}),
                                  tiers: nextTiers,
                                },
                              });
                            }}
                            placeholder="What's included"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HERO & 4-TAP FUNNEL */}
              {activeTab === "hero_funnel" && (
                <div className="space-y-6">
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">Hero Section Copy</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Top Category Kicker
                        </label>
                        <input
                          type="text"
                          value={heroKicker}
                          onChange={(e) => setHeroKicker(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Main Hero Headline
                        </label>
                        <textarea
                          rows={2}
                          value={heroHeadline}
                          onChange={(e) => setHeroHeadline(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Hero Subheadline
                        </label>
                        <textarea
                          rows={3}
                          value={heroSubheadline}
                          onChange={(e) => setHeroSubheadline(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Secondary Action Button Label
                        </label>
                        <input
                          type="text"
                          value={heroSecondaryCta}
                          onChange={(e) => setHeroSecondaryCta(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4-Tap Lead Funnel Editor */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Interactive 4-Tap Lead Funnel Options
                        </h3>
                        <p className="text-xs text-slate-400">
                          Customize the services visitors tap when requesting a quote or appointment.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setStep1Options([
                            ...step1Options,
                            { label: "New Service Option", desc: "Fast, professional service" },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Option
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Funnel Box Title</label>
                        <input
                          type="text"
                          value={funnelTitle}
                          onChange={(e) => setFunnelTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Step 1 Question Prompt
                        </label>
                        <input
                          type="text"
                          value={funnelStep1Question}
                          onChange={(e) => setFunnelStep1Question(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {step1Options.map((opt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl"
                        >
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const next = [...step1Options];
                                next[idx] = { ...next[idx], label: e.target.value };
                                setStep1Options(next);
                              }}
                              placeholder="Service Name"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-semibold"
                            />
                            <input
                              type="text"
                              value={opt.desc}
                              onChange={(e) => {
                                const next = [...step1Options];
                                next[idx] = { ...next[idx], desc: e.target.value };
                                setStep1Options(next);
                              }}
                              placeholder="Short sub-description"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setStep1Options(step1Options.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Built-In Automated Website Chatbot Settings */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Built-In Automated Website Chatbot &amp; Arrival Sound
                        </h3>
                        <p className="text-xs text-slate-400">
                          Automatically pops up at the bottom of the website when a visitor arrives, plays a chime sound, and asks interactive lead-capture questions.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chatbotEnabled}
                          onChange={(e) => setChatbotEnabled(e.target.checked)}
                        />
                        <span>Enable Chatbot on Website</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Chat Team / Display Name
                        </label>
                        <input
                          type="text"
                          value={chatbotAgentName}
                          onChange={(e) => setChatbotAgentName(e.target.value)}
                          placeholder="e.g. Force Fitness Team"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chatbotSoundEnabled}
                            onChange={(e) => setChatbotSoundEnabled(e.target.checked)}
                          />
                          <span>🔊 Play Audible Notification Chime When Chatbot Appears</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Automated Welcome Message
                      </label>
                      <textarea
                        rows={2}
                        value={chatbotGreeting}
                        onChange={(e) => setChatbotGreeting(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>

                    {/* 6-Persona AI Receptionist Spoken Voice Studio */}
                    <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-purple-400" />
                            <span>AI Receptionist Spoken Voice Persona (6 Distinct Voices)</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Choose which studio voice persona greets visitors and speaks replies out loud inside the live website chatbot.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const sample =
                              chatbotGreeting ||
                              `Hi there! Welcome to ${brandName || site.businessName}. How can we help you today?`;
                            speakWithStudioVoice(sample, chatbotVoicePersona);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Test {chatbotVoicePersona} Voice</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {STUDIO_VOICE_PERSONAS.map((vp) => {
                          const active = chatbotVoicePersona === vp.id;
                          return (
                            <button
                              key={vp.id}
                              type="button"
                              onClick={() => {
                                setChatbotVoicePersona(vp.id);
                                const sample =
                                  chatbotGreeting ||
                                  `Hi there! Welcome to ${brandName || site.businessName}. How can we help you today?`;
                                speakWithStudioVoice(sample, vp.id);
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                active
                                  ? "bg-purple-500/20 border-purple-400 text-white shadow-xs"
                                  : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-white">
                                  🎙️ {vp.shortName}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-semibold">
                                  {vp.lang}
                                </span>
                              </div>
                              <div className="text-[11px] font-semibold text-purple-300 mt-0.5">
                                {vp.roleBadge}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                {vp.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-white">
                            Auto-Speak Chatbot Replies Out Loud
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Automatically read bot answers out loud in {getStudioVoicePersona(chatbotVoicePersona).label}&apos;s voice (visitors can also toggle Voice ON/OFF anytime).
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChatbotSpokenVoiceEnabled(!chatbotSpokenVoiceEnabled)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                            chatbotSpokenVoiceEnabled
                              ? "bg-purple-500 text-white"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {chatbotSpokenVoiceEnabled ? "🎙️ Auto-Speak ON" : "Auto-Speak OFF"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SERVICES & SHOWCASE PHOTOS */}
              {activeTab === "services_work" && (
                <div className="space-y-6">
                  {/* AI & Industry Unique Image Regenerator */}
                  <div className="bg-gradient-to-br from-amber-500/15 via-[#161C28] to-[#161C28] border border-amber-500/35 rounded-2xl p-5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          Unique Business Photo Regenerator
                        </div>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          Images Unrelated or Not Unique? Regenerate Instant AI / Niche Photos
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Generate fresh, 100% unique showcase images tailored to <strong>{brandName}</strong> ({cfg.category || site.category}) that stay permanently embedded when deployed to Vercel.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRegenerateImages()}
                        disabled={regeneratingImages}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-md transition cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regeneratingImages && regeneratingCardIdx === null ? "animate-spin" : ""}`} />
                        {regeneratingImages && regeneratingCardIdx === null
                          ? "Generating 3 Unique Photos..."
                          : "✨ Regenerate All 3 Images"}
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={customImageScenePrompt}
                        onChange={(e) => setCustomImageScenePrompt(e.target.value)}
                        placeholder={`Optional custom scene prompt (e.g. "${cfg.category || site.category || "Specialist"} team serving client in ${city}")`}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-xs text-white"
                      />
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map((cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            disabled={regeneratingImages}
                            onClick={() => handleRegenerateImages(cIdx)}
                            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-amber-300 cursor-pointer disabled:opacity-50"
                          >
                            {regeneratingImages && regeneratingCardIdx === cIdx
                              ? "Regenerating..."
                              : `↻ Photo #${cIdx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Showcase / Portfolio Cards */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Showcase Cards & Photos
                        </h3>
                        <p className="text-xs text-slate-400">
                          Change photos, regenerate individual card images, upload real business photos, or edit project descriptions.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFinishedWork([
                            ...finishedWork,
                            {
                              title: "Featured Service Highlight",
                              location: city,
                              duration: "Same-Week Availability",
                              scope: "Delivered with upfront pricing and guaranteed quality.",
                              imageType: "commercial",
                              customImageUrl: "",
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Card
                      </button>
                    </div>

                    <div className="space-y-4">
                      {finishedWork.map((item, idx) => {
                        const previewThumb =
                          item.customImageUrl ||
                          UNIVERSAL_SHOWCASE_IMAGES[item.imageType] ||
                          UNIVERSAL_SHOWCASE_IMAGES.commercial;
                        return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              {previewThumb && (
                                <img
                                  src={previewThumb}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                                />
                              )}
                              <span className="text-xs font-bold text-amber-400">
                                Showcase Card #{idx + 1}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={regeneratingImages}
                                onClick={() => handleRegenerateImages(idx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3 h-3 ${regeneratingImages && regeneratingCardIdx === idx ? "animate-spin" : ""}`} />
                                {regeneratingImages && regeneratingCardIdx === idx
                                  ? "Regenerating..."
                                  : "Regenerate Photo"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setFinishedWork(finishedWork.filter((_, i) => i !== idx))
                                }
                                className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={item.title || ""}
                              onChange={(e) => {
                                const next = [...finishedWork];
                                next[idx] = { ...next[idx], title: e.target.value };
                                setFinishedWork(next);
                              }}
                              placeholder="Card Title"
                              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-semibold"
                            />
                            <input
                              type="text"
                              value={item.duration || ""}
                              onChange={(e) => {
                                const next = [...finishedWork];
                                next[idx] = { ...next[idx], duration: e.target.value };
                                setFinishedWork(next);
                              }}
                              placeholder="Badge (e.g. Same-Day Service)"
                              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={item.scope || ""}
                            onChange={(e) => {
                              const next = [...finishedWork];
                              next[idx] = { ...next[idx], scope: e.target.value };
                              setFinishedWork(next);
                            }}
                            placeholder="Description of service or work"
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Industry Stock Photo Preset
                              </label>
                              <select
                                value={item.imageType || "commercial"}
                                onChange={(e) => {
                                  const next = [...finishedWork];
                                  next[idx] = { ...next[idx], imageType: e.target.value };
                                  setFinishedWork(next);
                                }}
                                className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                              >
                                {IMAGE_PRESET_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Or Custom Photo Upload / URL
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={item.customImageUrl || ""}
                                  onChange={(e) => {
                                    const next = [...finishedWork];
                                    next[idx] = { ...next[idx], customImageUrl: e.target.value };
                                    setFinishedWork(next);
                                  }}
                                  placeholder="https://... or upload ->"
                                  className="flex-1 px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                                />
                                <label className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0">
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleShowcaseImageUpload(idx, e)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              {Array.isArray(cfg.scrapedImages) && cfg.scrapedImages.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-[10px] text-amber-300 font-medium mb-1">
                                    Or click a photo extracted from client&apos;s original website:
                                  </div>
                                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    {cfg.scrapedImages.map((sUrl: string, sIdx: number) => (
                                      <button
                                        key={sIdx}
                                        type="button"
                                        onClick={() => {
                                          const next = [...finishedWork];
                                          next[idx] = { ...next[idx], customImageUrl: sUrl };
                                          setFinishedWork(next);
                                        }}
                                        className={`w-12 h-9 rounded border overflow-hidden shrink-0 cursor-pointer ${
                                          item.customImageUrl === sUrl
                                            ? "border-amber-400 ring-1 ring-amber-400"
                                            : "border-slate-700 opacity-80 hover:opacity-100"
                                        }`}
                                        title="Use this photo from client's original website"
                                      >
                                        <img
                                          src={sUrl}
                                          alt=""
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    ))}
                                    {item.customImageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...finishedWork];
                                          next[idx] = { ...next[idx], customImageUrl: "" };
                                          setFinishedWork(next);
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-white underline px-1.5 shrink-0"
                                      >
                                        Use HD Preset
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Core Services Packages */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">Core Service Packages</h3>
                        <p className="text-xs text-slate-400">
                          Add, edit, or remove service packages displayed on the website.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setServices([
                            ...services,
                            {
                              index: `0${services.length + 1}`,
                              title: "New Service Package",
                              timeline: "Upfront Pricing",
                              description: "Professional service tailored to your needs.",
                              deliverables: ["Upfront written quote", "Dedicated specialist"],
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Service
                      </button>
                    </div>

                    <div className="space-y-3">
                      {services.map((srv, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-400">
                              Service #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => setServices(services.filter((_, i) => i !== idx))}
                              className="text-xs text-rose-400 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={srv.title || ""}
                              onChange={(e) => {
                                const next = [...services];
                                next[idx] = { ...next[idx], title: e.target.value };
                                setServices(next);
                              }}
                              placeholder="Service Title"
                              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-semibold"
                            />
                            <input
                              type="text"
                              value={srv.timeline || ""}
                              onChange={(e) => {
                                const next = [...services];
                                next[idx] = { ...next[idx], timeline: e.target.value };
                                setServices(next);
                              }}
                              placeholder="Timeline / Badge"
                              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={srv.description || ""}
                            onChange={(e) => {
                              const next = [...services];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setServices(next);
                            }}
                            placeholder="Service description"
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: REVIEWS, AREAS & FAQ */}
              {activeTab === "reviews_faq" && (
                <div className="space-y-6">
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white">
                      Neighborhoods & Service Areas (Comma-Separated)
                    </h3>
                    <input
                      type="text"
                      value={serviceAreasText}
                      onChange={(e) => setServiceAreasText(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  {/* Customer Reviews */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Customer Testimonials</h3>
                      <button
                        type="button"
                        onClick={() =>
                          setReviews([
                            ...reviews,
                            {
                              quote: "Outstanding service from start to finish!",
                              author: "Happy Customer",
                              neighborhood: city,
                              project: "Service Client",
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Review
                      </button>
                    </div>
                    <div className="space-y-3">
                      {reviews.map((rev, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2"
                        >
                          <textarea
                            rows={2}
                            value={rev.quote || ""}
                            onChange={(e) => {
                              const next = [...reviews];
                              next[idx] = { ...next[idx], quote: e.target.value };
                              setReviews(next);
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={rev.author || ""}
                              onChange={(e) => {
                                const next = [...reviews];
                                next[idx] = { ...next[idx], author: e.target.value };
                                setReviews(next);
                              }}
                              placeholder="Author"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={rev.project || ""}
                              onChange={(e) => {
                                const next = [...reviews];
                                next[idx] = { ...next[idx], project: e.target.value };
                                setReviews(next);
                              }}
                              placeholder="Service / Project"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                            />
                            <button
                              type="button"
                              onClick={() => setReviews(reviews.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FAQs */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Frequently Asked Questions</h3>
                      <button
                        type="button"
                        onClick={() =>
                          setFaqs([...faqs, { q: "New question?", a: "Helpful answer here." }])
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add FAQ
                      </button>
                    </div>
                    <div className="space-y-3">
                      {faqs.map((faq, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={faq.q || ""}
                              onChange={(e) => {
                                const next = [...faqs];
                                next[idx] = { ...next[idx], q: e.target.value };
                                setFaqs(next);
                              }}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={faq.a || ""}
                            onChange={(e) => {
                              const next = [...faqs];
                              next[idx] = { ...next[idx], a: e.target.value };
                              setFaqs(next);
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CAPTURED LEADS INBOX */}
              {activeTab === "leads_inbox" && (
                <div className="space-y-4">
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Captured 4-Tap Website Leads ({submissions.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Every customer who completes the 4-Tap Estimate/Booking box appears here immediately.
                        </p>
                      </div>
                    </div>

                    {submissions.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-xs text-slate-400">
                        No leads submitted yet. Test the 4-Tap Funnel on the website to see instant lead capture here!
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {submissions.map((sub: any, i: number) => (
                          <div
                            key={sub.id || i}
                            className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">
                                  {sub.name || "Website Lead"}
                                </span>
                                <span className="text-xs font-mono text-emerald-400">
                                  {sub.phone}
                                </span>
                              </div>
                              <div className="text-xs text-slate-300">
                                <span className="font-semibold text-amber-300">{sub.step1}</span>
                                {" · "}
                                <span>{sub.step2}</span>
                                {" · "}
                                <span className="text-slate-400">{sub.step3}</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {sub.submittedAt
                                  ? new Date(sub.submittedAt).toLocaleString()
                                  : "Just now"}
                              </div>
                            </div>
                            {sub.phone && (
                              <a
                                href={`tel:${sub.phone}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                              >
                                <Phone className="w-3.5 h-3.5" /> Call Lead
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: HOSTING, DOMAIN & DOWNLOAD HUB */}
              {activeTab === "hosting_export" && (
                <div className="space-y-6">
                  {/* Option A: Instant Auto-Hosting on Platform */}
                  <div className="bg-gradient-to-br from-emerald-950/50 to-[#161C28] border border-emerald-500/30 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Option 1 · Recommended (Zero Setup)
                          </div>
                          <h3 className="text-base font-bold text-white mt-0.5">
                            Instant Cloud Auto-Hosting (Built-In)
                          </h3>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            You do <strong>not</strong> need external hosting unless you want to. Every website is already live-hosted in the cloud with its database, 4-Tap Lead Funnel, and this Admin CMS Panel built right in.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Preview Banner vs Live Production Mode */}
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          Website Mode:{" "}
                          <span
                            className={
                              hostingMode === "live_hosted"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }
                          >
                            {hostingMode === "live_hosted"
                              ? "LIVE PRODUCTION SITE (Pitch Banner Hidden)"
                              : "PITCH PREVIEW MODE (Shows 'Claim Website' Top Bar)"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          When the client buys/claims the website, switch to <strong>Live Production Mode</strong> so the top pitch bar disappears and it acts as their permanent live website.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next =
                            hostingMode === "live_hosted" ? "preview" : "live_hosted";
                          setHostingMode(next);
                          handleSaveAll(next);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                          hostingMode === "live_hosted"
                            ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        {hostingMode === "live_hosted"
                          ? "Switch Back to Pitch Mode"
                          : "Activate Live Production Mode →"}
                      </button>
                    </div>

                    {/* Custom Domain Input & DNS Guide */}
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                      <label className="block text-xs font-bold text-white">
                        Connect Client's Custom Domain (e.g. www.{brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customDomain}
                          onChange={(e) => setCustomDomain(e.target.value)}
                          placeholder="www.clientdomain.com"
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveAll()}
                          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                        >
                          Save Domain
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                        <strong>How to point their domain:</strong> In GoDaddy / Namecheap / Cloudflare, add a <strong>CNAME</strong> record for <code>www</code> pointing to <code>{window.location.hostname}</code> (or use Cloudflare URL Rewrite / Domain Forwarding to <code>{liveCleanUrl}</code>).
                      </div>
                    </div>
                  </div>

                  {/* Option B: Download Standalone HTML Bundle */}
                  <div className="bg-[#161C28] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                          <Download className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                            Option 2 · Self-Host Anywhere
                          </div>
                          <h3 className="text-base font-bold text-white mt-0.5">
                            Download Standalone Production Website (HTML)
                          </h3>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Prefer to host on Netlify, Vercel, Hostinger, cPanel, or hand the file to the client? Download the complete, self-contained <code>index.html</code> with their exact color theme, logo, services, and lead capture pre-wired to sync leads back to this dashboard.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={exportHtmlUrl}
                        download={`${site.siteId}-production-website.html`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition"
                      >
                        <Download className="w-4 h-4" />
                        Download Standalone Website (.html)
                      </a>
                      <a
                        href={liveCleanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Clean Live URL
                      </a>
                    </div>
                  </div>

                  {/* Client Admin Handover Credentials & Single Password Management */}
                  <div className="bg-[#161C28] border border-amber-500/30 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Business Owner Admin Password & Portal Access
                        </h3>
                        <p className="text-xs text-slate-400">
                          Every created website starts with a single default password (<code className="text-amber-300 font-mono font-bold">owner2026</code>) for the business owner, and can be changed right here inside Admin at any time.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="text-[11px] text-slate-400">
                          Business Owner Admin Portal Link
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-amber-300 truncate">{clientAdminUrl}</code>
                          <button
                            type="button"
                            onClick={() => copyText("adminUrl", clientAdminUrl)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 cursor-pointer"
                          >
                            {copiedKey === "adminUrl" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              "creds",
                              `Website Admin Portal for ${brandName}:\nLive Website: ${liveCleanUrl}\nAdmin Edit Link: ${clientAdminUrl}\nBusiness Owner Admin Password: ${newPasswordInput || adminPin}`
                            )
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                        >
                          {copiedKey === "creds"
                            ? "✓ Copied Owner Login Pack!"
                            : "Copy Owner Login Link + Password"}
                        </button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            Change Business Owner Password
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400">
                            Current: {adminPin}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newPasswordInput}
                            onChange={(e) => {
                              setNewPasswordInput(e.target.value);
                              setAdminPin(e.target.value);
                            }}
                            placeholder="Enter new owner password"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                          />
                          <button
                            type="button"
                            onClick={handleUpdatePasswordOnly}
                            disabled={saving}
                            className="py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                          >
                            Update Password
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Default single password for all newly created sites is <code className="text-amber-300 font-mono">owner2026</code> until changed here.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
