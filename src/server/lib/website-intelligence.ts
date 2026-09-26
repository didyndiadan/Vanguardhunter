import { getGeminiAI } from "../routes/api-keys";

export interface ScrapedBusinessIntel {
  title: string;
  description: string;
  headings: string[];
  extractedServices: string[];
  extractedImages: string[];
  extractedPhones: string[];
  bodyExcerpt: string;
}

export async function scrapeBusinessWebsiteIntel(url?: string): Promise<ScrapedBusinessIntel | null> {
  if (!url || typeof url !== "string") return null;
  let targetUrl = url.trim();
  if (!targetUrl || /^(none|n\/a|no website|-|null)$/i.test(targetUrl) || targetUrl.length < 4) {
    return null;
  }
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const baseOrigin = new URL(targetUrl).origin;

    const cleanText = (s: string) =>
      s
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? cleanText(titleMatch[1]).slice(0, 140) : "";

    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const description = descMatch ? cleanText(descMatch[1]).slice(0, 300) : "";

    // Extract H1, H2, H3 headings
    const headings: string[] = [];
    const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = headingRegex.exec(html)) !== null && headings.length < 18) {
      const text = cleanText(hMatch[1]);
      if (text.length >= 4 && text.length <= 90 && !headings.includes(text)) {
        headings.push(text);
      }
    }

    // Extract list items that look like services
    const extractedServices: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(html)) !== null && extractedServices.length < 15) {
      const text = cleanText(liMatch[1]);
      if (
        text.length >= 5 &&
        text.length <= 55 &&
        !/^(home|about|contact|privacy|terms|blog|login|sign in|menu|faq|careers)$/i.test(text) &&
        !extractedServices.includes(text)
      ) {
        extractedServices.push(text);
      }
    }

    // Extract high-value images (og:image + large content images)
    const extractedImages: string[] = [];
    const ogImgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImgMatch?.[1]) {
      try {
        const resolved = new URL(ogImgMatch[1], baseOrigin).href;
        if (/^https?:\/\//i.test(resolved) && !/logo|icon|sprite|avatar|1x1|pixel/i.test(resolved)) {
          extractedImages.push(resolved);
        }
      } catch {}
    }

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRegex.exec(html)) !== null && extractedImages.length < 6) {
      const rawSrc = imgMatch[1];
      if (!rawSrc || rawSrc.startsWith("data:")) continue;
      if (/logo|icon|favicon|sprite|badge|stars|arrow|spinner|loader|svg|gif|1x1|pixel|wp-smiley|gravatar/i.test(rawSrc)) {
        continue;
      }
      try {
        const resolved = new URL(rawSrc, baseOrigin).href;
        if (/^https?:\/\//i.test(resolved) && !extractedImages.includes(resolved)) {
          extractedImages.push(resolved);
        }
      } catch {}
    }

    // Strip scripts/styles for body excerpt
    const stripped = cleanText(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    ).slice(0, 1400);

    const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
    const extractedPhones = Array.from(new Set(stripped.match(phoneRegex) || [])).slice(0, 3);

    return {
      title,
      description,
      headings,
      extractedServices,
      extractedImages,
      extractedPhones,
      bodyExcerpt: stripped,
    };
  } catch {
    return null;
  }
}

export type IndustryArchetype =
  | "project_remodel"
  | "service_dispatch"
  | "medical_clinical"
  | "professional_advisory"
  | "hospitality_culinary"
  | "salon_wellness"
  | "automotive_service"
  | "commercial_b2b";

export const ALL_THEME_IDS = [
  "valley_craft",
  "clinical_slate",
  "emerald_botanical",
  "crimson_culinary",
  "midnight_sapphire",
  "executive_heritage",
  "culinary_linen",
  "plum_aesthetics",
  "industrial_orange",
  "solar_teal",
  "nordic_indigo",
  "burgundy_reserve",
] as const;

function hashBusinessString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function detectIndustryArchetype(category: string, businessName: string): {
  archetype: IndustryArchetype;
  themeId: string;
  emblemType: string;
  defaultImageKeys: [string, string, string];
} {
  const combined = `${category} ${businessName}`.toLowerCase();
  const hash = hashBusinessString(`${businessName.trim().toLowerCase()}_${category.trim().toLowerCase()}`);

  const pickTheme = (pool: string[]) => pool[hash % pool.length];

  if (/dent|orthodont|clinic|med|doctor|chiro|physio|optom|health|vet|dermatol|pediatr|urgent care|podiatr|psych|therap|pharm/i.test(combined)) {
    const pool = /vet|naturo|holistic|therap|physio/i.test(combined)
      ? ["emerald_botanical", "solar_teal", "clinical_slate"]
      : ["clinical_slate", "solar_teal", "nordic_indigo", "Midnight_sapphire".toLowerCase()];
    return {
      archetype: "medical_clinical",
      themeId: pickTheme(pool),
      emblemType: "medical",
      defaultImageKeys: ["dental_medical", "dental_network", "salon_wellness"],
    };
  }

  if (/restaur|cafe|coffee|bakery|bistro|pizz|grill|sushi|taco|bar|pub|cater|food|kitchen & bar|steakhouse|diner/i.test(combined)) {
    const pool = /pizz|ital|steak|bistro|wine|grill|bbq|taco/i.test(combined)
      ? ["crimson_culinary", "burgundy_reserve", "culinary_linen"]
      : ["culinary_linen", "crimson_culinary", "emerald_botanical", "valley_craft"];
    return {
      archetype: "hospitality_culinary",
      themeId: pickTheme(pool),
      emblemType: "culinary",
      defaultImageKeys: ["restaurant_culinary", "commercial", "kitchen"],
    };
  }

  if (/salon|barber|spa|medspa|nail|beauty|lash|brow|massage|aesthetic|hair|wax|yoga|pilates|gym|fitness|crossfit|wellness/i.test(combined)) {
    const pool = /gym|fitness|crossfit|barber/i.test(combined)
      ? ["industrial_orange", "nordic_indigo", "executive_heritage"]
      : ["plum_aesthetics", "burgundy_reserve", "emerald_botanical", "culinary_linen"];
    return {
      archetype: "salon_wellness",
      themeId: pickTheme(pool),
      emblemType: "sparkle",
      defaultImageKeys: ["salon_wellness", "dental_medical", "bathroom"],
    };
  }

  if (/law|attorney|legal|account|cpa|tax|bookkeep|insur|real estate|realtor|mortgage|financ|wealth|consult|architect|notary/i.test(combined)) {
    const pool = ["executive_heritage", "burgundy_reserve", "nordic_indigo", "midnight_sapphire"];
    return {
      archetype: "professional_advisory",
      themeId: pickTheme(pool),
      emblemType: "scales",
      defaultImageKeys: ["legal_advisory", "b2b_intelligence", "commercial"],
    };
  }

  if (/auto|mechanic|car repair|collision|tire|brake|transmission|detailing|towing|body shop|oil change|windshield|fleet/i.test(combined)) {
    const pool = ["industrial_orange", "midnight_sapphire", "crimson_culinary", "clinical_slate"];
    return {
      archetype: "automotive_service",
      themeId: pickTheme(pool),
      emblemType: "wrench",
      defaultImageKeys: ["auto_mechanical", "plumbing_hvac", "commercial"],
    };
  }

  if (/plumb|hvac|air condition|heating|electr|locksmith|pest|termite|appliance|garage door|drain|water heater|septic|cleaning|maid|carpet|junk|moving|pressure wash/i.test(combined)) {
    const pool = /plumb|water|cooling|air|clean|pool/i.test(combined)
      ? ["midnight_sapphire", "clinical_slate", "solar_teal"]
      : /pest|lawn|eco|carpet/i.test(combined)
      ? ["emerald_botanical", "solar_teal", "industrial_orange"]
      : ["industrial_orange", "midnight_sapphire", "valley_craft", "nordic_indigo"];
    return {
      archetype: "service_dispatch",
      themeId: pickTheme(pool),
      emblemType: "wrench",
      defaultImageKeys: ["plumbing_hvac", "commercial", "exterior"],
    };
  }

  if (/roof|gutter|siding|solar|window|fence|deck|landscap|lawn|tree|hardscap|pool|paver|concrete|driveway|masonry/i.test(combined)) {
    const isLand = /landscap|lawn|tree|hardscap|pool|paver|fence|deck/i.test(combined);
    const isSolar = /solar/i.test(combined);
    const pool = isLand
      ? ["emerald_botanical", "solar_teal", "valley_craft"]
      : isSolar
      ? ["solar_teal", "industrial_orange", "midnight_sapphire"]
      : ["culinary_linen", "industrial_orange", "valley_craft", "executive_heritage"];
    return {
      archetype: "project_remodel",
      themeId: pickTheme(pool),
      emblemType: "roof",
      defaultImageKeys: isLand
        ? ["landscaping_outdoor", "exterior", "roofing_exterior"]
        : isSolar
        ? ["commercial_solar", "roofing_exterior", "exterior"]
        : ["roofing_exterior", "exterior", "landscaping_outdoor"],
    };
  }

  if (/construct|remodel|renovat|kitchen|bath|cabinet|countertop|flooring|tile|paint|drywall|handyman|builder|addition|adu|carpentr/i.test(combined)) {
    const isValleySample = /valley construction/i.test(businessName);
    const pool = ["valley_craft", "executive_heritage", "culinary_linen", "nordic_indigo", "solar_teal"];
    return {
      archetype: "project_remodel",
      themeId: isValleySample ? "valley_craft" : pickTheme(pool),
      emblemType: "roof",
      defaultImageKeys: ["kitchen", "bathroom", "exterior"],
    };
  }

  const generalPool = ALL_THEME_IDS as unknown as string[];
  return {
    archetype: "commercial_b2b",
    themeId: pickTheme(generalPool),
    emblemType: "shield",
    defaultImageKeys: ["commercial", "b2b_intelligence", "legal_advisory"],
  };
}

export interface BlueprintInputParams {
  businessName: string;
  ownerName?: string;
  category: string;
  city: string;
  country?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  servicesList?: string[];
  businessDescription?: string;
  originalWebsite?: string;
  detectionStatus: "no_website" | "bad_website" | "upgrade_ready";
  originalScore?: number;
  themeId?: string;
  scrapedIntel?: ScrapedBusinessIntel | null;
}

export function buildAccurateBusinessBlueprint(params: BlueprintInputParams) {
  const biz = params.businessName.trim() || "Local Business";
  const city = params.city.trim() || "Sacramento";
  const country = (params.country || "CA").trim();
  const cat = params.category.trim() || "Professional Services";
  const phone =
    params.phone?.trim() ||
    params.scrapedIntel?.extractedPhones?.[0] ||
    "(916) 291-1047";
  const email =
    params.email?.trim() ||
    `info@${biz.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 22) || "business"}.com`;

  const detected = detectIndustryArchetype(cat, biz);
  const archetype = detected.archetype;
  const resolvedTheme =
    params.themeId && params.themeId !== "auto" ? params.themeId : detected.themeId;
  const emblemType = detected.emblemType;
  const [imgKey1, imgKey2, imgKey3] = detected.defaultImageKeys;
  const scrapedImgs = params.scrapedIntel?.extractedImages || [];
  const defaultPin = String(1000 + (hashString(biz.toLowerCase()) % 9000));

  const citySuburbs: Record<string, string[]> = {
    sacramento: ["Sacramento", "Elk Grove", "Roseville", "Folsom", "Rocklin", "Carmichael", "Davis"],
    austin: ["Austin", "Round Rock", "Cedar Park", "West Lake Hills", "Georgetown", "Pflugerville", "Lakeway"],
    miami: ["Miami", "Coral Gables", "Brickell", "Miami Beach", "Doral", "Aventura", "Coconut Grove"],
    dallas: ["Dallas", "Plano", "Frisco", "Highland Park", "McKinney", "Southlake", "Richardson"],
    losangeles: ["Los Angeles", "Santa Monica", "Beverly Hills", "Pasadena", "Culver City", "Burbank", "Encino"],
    london: ["Central London", "Kensington", "Chelsea", "Canary Wharf", "Richmond", "Islington", "Greenwich"],
    newyork: ["Manhattan", "Brooklyn", "Queens", "Upper East Side", "Midtown", "Tribeca", "SoHo"],
    chicago: ["Chicago", "Naperville", "Evanston", "Oak Brook", "Schaumburg", "Lincoln Park", "Hinsdale"],
    houston: ["Houston", "The Woodlands", "Sugar Land", "Katy", "Memorial", "River Oaks", "Pearland"],
    phoenix: ["Phoenix", "Scottsdale", "Tempe", "Chandler", "Gilbert", "Paradise Valley", "Mesa"],
  };
  const cityKey = city.toLowerCase().replace(/[^a-z]/g, "");
  const areas = citySuburbs[cityKey] || [
    city,
    `Downtown ${city}`,
    `North ${city}`,
    `West ${city}`,
    `South ${city}`,
    `Greater ${city} Area`,
  ];

  // Extract real services if provided or scraped
  const knownServices = [
    ...(params.servicesList || []),
    ...(params.scrapedIntel?.extractedServices || []),
    ...(params.scrapedIntel?.headings || []).filter((h) => h.length > 5 && h.length < 45),
  ]
    .map((s) => s.trim())
    .filter((s, idx, arr) => s && arr.indexOf(s) === idx)
    .slice(0, 6);

  const ratingStr = params.rating ? `${Number(params.rating).toFixed(1)} ★` : "4.9 ★";
  const reviewLabel = params.reviewCount
    ? `Across ${params.reviewCount}+ verified ${city} reviews`
    : `Top-rated ${cat.toLowerCase()} in ${city}`;

  // Default archetype-specific sections & funnel
  let announcementBar = `Serving ${city} & surrounding communities · Call ${phone}`;
  let brandSubline = "Fast response. Upfront pricing.";
  let hoursText = "Mon–Sat, 8 am to 7 pm";
  let navLabels = {
    showcase: "Featured Work",
    process: "How We Work",
    services: "Services",
    reviews: "Reviews",
    areas: "Service Areas",
    faq: "FAQ",
    primaryCta: "Free Estimate",
  };
  let heroKicker = `${cat.toUpperCase()} IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
  let heroHeadline = `Trusted ${cat.toLowerCase()} in ${city}, with clear pricing and zero surprises.`;
  let heroSubheadline =
    params.businessDescription ||
    params.scrapedIntel?.description ||
    `${biz} delivers dependable, high-craft ${cat.toLowerCase()} across ${areas.slice(0, 3).join(", ")} and nearby. Get a clear plan, upfront pricing, and direct communication from start to finish.`;
  let heroSecondaryCta = "Get my instant quote";
  let heroTertiaryCta = "Explore our work & services";

  let funnelConfig: any = {
    badge: "INSTANT QUOTE",
    title: `How can ${biz} help you?`,
    subtitle: "Four quick taps. No long forms to fill out.",
    step1Question: `1. Which ${cat.toLowerCase()} service do you need?`,
    step1Options: [
      { label: knownServices[0] || `Primary ${cat} Service`, desc: `Complete ${cat.toLowerCase()} tailored to your needs` },
      { label: knownServices[1] || "Repair, Upgrade or Maintenance", desc: "Fast turnaround by certified specialists" },
      { label: knownServices[2] || "Priority / Same-Week Service", desc: "Expedited scheduling & on-site assessment" },
      { label: knownServices[3] || "Custom Consultation & Price Check", desc: "Clear written options before you decide" },
    ],
    step2Question: "2. How soon do you need service?",
    step2Options: [
      { label: "As soon as possible / Urgent", desc: "Priority scheduling this week" },
      { label: "Within 1 to 2 weeks", desc: "Ready to lock in a convenient time" },
      { label: "Within 30 days", desc: "Planning ahead & comparing options" },
      { label: "Just looking for pricing first", desc: "Want a straightforward ballpark quote" },
    ],
    step3Question: "3. What is most important to you?",
    step3Options: [
      { label: "Upfront transparent pricing", desc: "Know the exact cost before we begin" },
      { label: "Fast, on-time arrival & completion", desc: "Reliable schedule that respects your time" },
      { label: "Top-rated local expertise & warranty", desc: "Done right the first time, fully backed" },
      { label: "Direct specialist communication", desc: "Speak directly with an experienced pro" },
    ],
    step4Question: "4. Best phone number for your quote or confirmation:",
    submitButtonText: "Send my request now",
    footerReassurance: `Prefer to speak right now? Call ${phone} (${hoursText}).`,
  };

  let sectionHeaders = {
    showcaseKicker: `FEATURED ${cat.toUpperCase()} IN ${city.toUpperCase()}`,
    showcaseHeading: `Real ${cat.toLowerCase()} results delivered for ${city} clients.`,
    showcaseCta: "Request a similar service →",
    showcaseCardCta: "Get pricing for this service",
    processKicker: `HOW ${biz.toUpperCase()} WORKS`,
    processHeading: "A straightforward process from first call to final sign-off.",
    processSubheading: `Here is how ${biz} makes ${cat.toLowerCase()} in ${city} simple, predictable, and stress-free.`,
    servicesKicker: `SPECIALIZED ${cat.toUpperCase()} SERVICES`,
    servicesHeading: `What ${biz} offers in ${city}.`,
    servicesCardCtaPrefix: "Request",
    reviewsKicker: `VERIFIED ${city.toUpperCase()} CLIENT REVIEWS`,
    reviewsHeading: `Why neighbors in ${city} trust ${biz}.`,
    areasKicker: "LOCAL SERVICE COVERAGE",
    areasHeading: `Serving ${city} and surrounding neighborhoods:`,
    faqKicker: "STRAIGHT ANSWERS",
    faqHeading: `Common questions for ${biz}`,
  };

  let finishedWork = [
    {
      title: knownServices[0] || `Signature ${cat} in ${areas[0]}`,
      location: `${areas[0]}, ${country}`,
      duration: "On-Schedule Delivery",
      scope: `Complete ${cat.toLowerCase()} executed by ${biz} with upfront pricing and verified quality control.`,
      imageType: imgKey1,
      customImageUrl: scrapedImgs[0] || "",
    },
    {
      title: knownServices[1] || `Specialized ${cat} Solution`,
      location: `${areas[1] || city}, ${country}`,
      duration: "Guaranteed Quality",
      scope: `Tailored ${cat.toLowerCase()} package designed for long-term reliability and peace of mind.`,
      imageType: imgKey2,
      customImageUrl: scrapedImgs[1] || "",
    },
    {
      title: knownServices[2] || `Priority ${cat} & Support`,
      location: `${areas[2] || city}, ${country}`,
      duration: "5-Star Local Service",
      scope: `Dedicated local team serving ${city} residential and commercial clients with transparent standards.`,
      imageType: imgKey3,
      customImageUrl: scrapedImgs[2] || "",
    },
  ];

  let scheduleSteps = [
    {
      step: "Step 01",
      title: "Fast Assessment & Upfront Quote",
      duration: "Day 1",
      detail: `Share your needs via our 4-tap tool or call ${phone}. ${biz} gives you clear options and transparent pricing upfront.`,
    },
    {
      step: "Step 02",
      title: "Confirmed Appointment Window",
      duration: "Locked Schedule",
      detail: `We lock in a specific appointment time that fits your calendar and arrive prepared with everything needed.`,
    },
    {
      step: "Step 03",
      title: "Precision Execution & Care",
      duration: "Active Service",
      detail: `Our experienced ${cat.toLowerCase()} specialists complete the work to the highest standard while keeping you informed.`,
    },
    {
      step: "Step 04",
      title: "Final Review & Satisfaction Guarantee",
      duration: "Completion",
      detail: `We review the completed work with you to ensure 100% satisfaction and stand behind our service.`,
    },
  ];

  let services = [
    {
      index: "01",
      title: funnelConfig.step1Options[0].label,
      timeline: "Upfront Written Pricing",
      description: `Comprehensive ${funnelConfig.step1Options[0].label.toLowerCase()} delivered by ${biz} for clients across ${city}.`,
      deliverables: ["Clear upfront scope & cost", "Experienced local specialists", "100% satisfaction commitment"],
    },
    {
      index: "02",
      title: funnelConfig.step1Options[1].label,
      timeline: "Fast Turnaround",
      description: `Targeted ${funnelConfig.step1Options[1].label.toLowerCase()} designed to solve your issue quickly and reliably.`,
      deliverables: ["Prompt arrival window", "High-grade materials & equipment", "Direct communication"],
    },
    {
      index: "03",
      title: funnelConfig.step1Options[2].label,
      timeline: "Priority Scheduling",
      description: `Dedicated ${cat.toLowerCase()} support and consultation tailored to your exact goals in ${city}.`,
      deliverables: ["Personalized recommendations", "Zero hidden fees", "Ongoing local support"],
    },
  ];

  // Now customize deeply per Industry Archetype!
  if (archetype === "medical_clinical") {
    announcementBar = `Accepting new patients in ${city} · Same-week appointments & insurance verification`;
    brandSubline = "Gentle care. Transparent treatment plans.";
    hoursText = "Mon–Fri 8 am–6 pm, Sat 9 am–2 pm";
    navLabels = {
      showcase: "Treatments",
      process: "Patient Experience",
      services: "Care Menu",
      reviews: "Patient Reviews",
      areas: "Location & Areas",
      faq: "Patient FAQ",
      primaryCta: "Book Visit",
    };
    heroKicker = `PATIENT-FIRST ${cat.toUpperCase()} IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Modern ${cat.toLowerCase()} in ${city}, with appointments that run on time.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `At ${biz}, we welcome patients and families across ${areas.slice(0, 3).join(", ")} with gentle clinical technology, clear out-of-pocket cost checks before treatment begins, and reserved same-week visits.`;
    heroSecondaryCta = "Book my appointment in 4 taps";
    heroTertiaryCta = "Explore treatments & care";

    funnelConfig = {
      badge: "4-TAP APPOINTMENT REQUEST",
      title: "Schedule your visit",
      subtitle: "Four quick taps. No clipboard paperwork.",
      step1Question: "1. What type of visit are you looking for?",
      step1Options: [
        { label: knownServices[0] || "New Patient Exam & Consultation", desc: "Comprehensive evaluation, digital imaging & care plan" },
        { label: knownServices[1] || "Same-Day Urgent / Pain Relief Visit", desc: "Priority clinical slot reserved for immediate care" },
        { label: knownServices[2] || "Specialty / Cosmetic Treatment", desc: "Tailored aesthetic or restorative procedure" },
        { label: knownServices[3] || "Second Opinion & Cost Check", desc: "Honest review of your options & insurance coverage" },
      ],
      step2Question: "2. When would you prefer to come in?",
      step2Options: [
        { label: "Today or Tomorrow (Urgent)", desc: "Check our next reserved urgent slot" },
        { label: "This Week", desc: "Morning or afternoon appointment" },
        { label: "Next 1 to 2 Weeks", desc: "Flexible scheduling window" },
        { label: "Weekend or Early Morning", desc: "Convenient hours around work/school" },
      ],
      step3Question: "3. How do you plan to cover your visit?",
      step3Options: [
        { label: "PPO / Private Insurance", desc: "We verify your benefits before your visit" },
        { label: "Self-Pay / Transparent Package", desc: "Clear upfront pricing with zero surprise bills" },
        { label: "Flexible Monthly Payment Plan", desc: "0% financing options available" },
        { label: "Not sure — help me check", desc: "Our front desk will verify everything for you" },
      ],
      step4Question: "4. Your phone number so our care coordinator can confirm your slot:",
      submitButtonText: "Request my appointment",
      footerReassurance: `Prefer to book by phone? Call ${phone} (${hoursText}).`,
    };

    sectionHeaders = {
      showcaseKicker: `CLINICAL EXCELLENCE AT ${biz.toUpperCase()}`,
      showcaseHeading: `Modern treatments designed around your comfort and health.`,
      showcaseCta: "Check appointment availability →",
      showcaseCardCta: "Book this visit type",
      processKicker: "YOUR VISIT EXPERIENCE · ZERO ANXIETY",
      processHeading: "Clear answers and upfront costs before any treatment begins.",
      processSubheading: `We built ${biz} in ${city} for patients who value punctual appointments, gentle care, and complete financial clarity.`,
      servicesKicker: `TREATMENTS & CLINICAL SERVICES IN ${city.toUpperCase()}`,
      servicesHeading: "Comprehensive care under one roof.",
      servicesCardCtaPrefix: "Schedule",
      reviewsKicker: `VERIFIED PATIENT STORIES IN ${city.toUpperCase()}`,
      reviewsHeading: `What patients in ${city} say about their care at ${biz}.`,
      areasKicker: "PATIENTS WE SERVE",
      areasHeading: `Welcoming patients from ${city} and nearby neighborhoods:`,
      faqKicker: "PATIENT QUESTIONS",
      faqHeading: "Insurance, scheduling & comfort FAQ",
    };

    finishedWork = [
      {
        title: funnelConfig.step1Options[0].label,
        location: `${biz} · ${city}`,
        duration: "45–60 Min Visit · Upfront Benefit Check",
        scope: "Full digital diagnostics, unhurried one-on-one doctor consultation, and a clear written treatment roadmap.",
        imageType: "dental_medical",
        customImageUrl: scrapedImgs[0] || "",
      },
      {
        title: funnelConfig.step1Options[2].label,
        location: `${city} Clinical Suite`,
        duration: "Precision Modern Technology",
        scope: "Minimally invasive techniques focused on natural aesthetics, long-term health, and gentle patient comfort.",
        imageType: "dental_network",
        customImageUrl: scrapedImgs[1] || "",
      },
      {
        title: funnelConfig.step1Options[1].label,
        location: `Same-Day Care in ${city}`,
        duration: "Reserved Daily Urgent Slots",
        scope: "Fast diagnosis and immediate relief so you never have to wait weeks when you are in discomfort.",
        imageType: "salon_wellness",
        customImageUrl: scrapedImgs[2] || "",
      },
    ];

    scheduleSteps = [
      {
        step: "Step 01",
        title: "4-Tap Booking & Insurance Check",
        duration: "Before You Arrive",
        detail: `Pick your visit type online or call ${phone}. Our team verifies your benefits in advance so there is zero lobby guesswork.`,
      },
      {
        step: "Step 02",
        title: "On-Time Welcome & Digital Diagnostics",
        duration: "Minute 1–20",
        detail: "We respect your schedule with minimal wait times and comfortable, low-radiation digital imaging.",
      },
      {
        step: "Step 03",
        title: "1-on-1 Doctor Review & Clear Options",
        duration: "Transparent Plan",
        detail: "We walk you through what we see on screen and show exact out-of-pocket costs before you say yes to any procedure.",
      },
      {
        step: "Step 04",
        title: "Gentle Care & Easy Follow-Up",
        duration: "Ongoing Health",
        detail: "Relaxed, comfort-focused treatment with direct text/phone check-ins after your visit.",
      },
    ];
  } else if (archetype === "hospitality_culinary") {
    announcementBar = `Fresh daily menu, reservations & private catering across ${city} · Call ${phone}`;
    brandSubline = "Scratch kitchen. Warm hospitality.";
    hoursText = "Open Daily, 11 am to 10 pm";
    navLabels = {
      showcase: "Signature Dishes",
      process: "Our Kitchen",
      services: "Dining & Catering",
      reviews: "Guest Reviews",
      areas: "Location & Delivery",
      faq: "Guest FAQ",
      primaryCta: "Reserve / Order",
    };
    heroKicker = `${cat.toUpperCase()} & HOSPITALITY IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Crafted fresh daily in ${city}, for table dining, takeout & events.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `Experience ${biz} in ${city}. From our signature house-made favorites to custom group catering across ${areas.slice(0, 3).join(", ")}, every dish is prepared to order with peak-season ingredients.`;
    heroSecondaryCta = "Reserve a table or catering quote";
    heroTertiaryCta = "See signature menu highlights";

    funnelConfig = {
      badge: "RESERVATIONS & CATERING",
      title: `Plan your visit or order with ${biz}`,
      subtitle: "Four quick taps. Instant confirmation.",
      step1Question: "1. How would you like to dine with us?",
      step1Options: [
        { label: knownServices[0] || "Table Reservation (Dine-In)", desc: "Reserve a table for lunch, dinner or weekend gathering" },
        { label: knownServices[1] || "Event & Office Catering Package", desc: "Custom trays & boxed meals for 10 to 200+ guests" },
        { label: knownServices[2] || "Private Party / Group Buyout", desc: "Hosted celebratory dining with custom chef menu" },
        { label: knownServices[3] || "Large Takeout / Family Order", desc: "Prepared hot and ready for pickup on your schedule" },
      ],
      step2Question: "2. How many guests are we serving?",
      step2Options: [
        { label: "2 to 4 Guests", desc: "Intimate table or family meal" },
        { label: "5 to 12 Guests", desc: "Large table or small group celebration" },
        { label: "15 to 50 Guests", desc: "Office catering or private event" },
        { label: "50+ Guests", desc: "Full-scale event catering & service" },
      ],
      step3Question: "3. When is your preferred date?",
      step3Options: [
        { label: "Today / Tonight", desc: "Immediate availability check" },
        { label: "This Weekend", desc: "Prime evening or brunch seating" },
        { label: "Upcoming Weekday", desc: "Lunch, dinner or office drop-off" },
        { label: "Future Event Date", desc: "Planning ahead for a special occasion" },
      ],
      step4Question: "4. Your phone number so we can text your confirmation or catering quote:",
      submitButtonText: "Confirm my request",
      footerReassurance: `Calling for today's specials or immediate pickup? Call ${phone}.`,
    };

    sectionHeaders = {
      showcaseKicker: `FROM THE KITCHEN AT ${biz.toUpperCase()}`,
      showcaseHeading: `Signature favorites & catering spreads loved in ${city}.`,
      showcaseCta: "Reserve or price catering →",
      showcaseCardCta: "Inquire about this option",
      processKicker: "THE STANDARD AT " + biz.toUpperCase(),
      processHeading: "Fresh ingredients, scratch preparation, and effortless hosting.",
      processSubheading: `Whether you are joining us for dinner in ${city} or feeding 50 people at your office, ${biz} delivers consistent culinary craft.`,
      servicesKicker: "DINING, TAKEOUT & CATERING",
      servicesHeading: `Ways to enjoy ${biz}.`,
      servicesCardCtaPrefix: "Book",
      reviewsKicker: `LOCAL DINER & CATERING REVIEWS IN ${city.toUpperCase()}`,
      reviewsHeading: `What guests in ${city} say about ${biz}.`,
      areasKicker: "NEIGHBORHOODS & CATERING DELIVERY",
      areasHeading: `Welcoming guests & delivering catering across ${city}:`,
      faqKicker: "GUEST INFORMATION",
      faqHeading: "Reservations, dietary options & catering FAQ",
    };

    finishedWork = [
      {
        title: knownServices[0] || `${biz} Chef's Signature Dining Experience`,
        location: `Dine-In & Takeout · ${city}`,
        duration: "Prepared Fresh to Order",
        scope: "House-crafted specialties using locally sourced ingredients, vibrant seasonal pairings, and bold signature flavors.",
        imageType: "restaurant_culinary",
        customImageUrl: scrapedImgs[0] || "",
      },
      {
        title: knownServices[1] || `Corporate & Event Catering Packages`,
        location: `Delivered Across ${city}`,
        duration: "10 to 200+ Guests · On-Time Setup",
        scope: "Customizable crowd-pleasing platters, dietary-friendly labels, and punctual hot delivery with serving ware included.",
        imageType: "commercial",
        customImageUrl: scrapedImgs[1] || "",
      },
      {
        title: knownServices[2] || `Private Celebrations & Group Dining`,
        location: `${biz} · ${city}`,
        duration: "Custom Prix-Fixe or Buffet",
        scope: "Warm hospitality and dedicated service for birthdays, rehearsal dinners, and team gatherings.",
        imageType: "restaurant_culinary",
        customImageUrl: scrapedImgs[2] || "",
      },
    ];
  } else if (archetype === "salon_wellness") {
    announcementBar = `Book your appointment at ${biz} in ${city} · Same-week openings available`;
    brandSubline = "Bespoke styling & rejuvenation.";
    hoursText = "Tue–Sun, 9 am to 7 pm";
    navLabels = {
      showcase: "Signature Services",
      process: "The Experience",
      services: "Service Menu",
      reviews: "Client Reviews",
      areas: "Location",
      faq: "FAQ",
      primaryCta: "Book Appointment",
    };
    heroKicker = `${cat.toUpperCase()} STUDIO IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Look and feel your best, with personalized care that never feels rushed.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `${biz} is ${city}'s destination for elevated ${cat.toLowerCase()}. Every appointment begins with a personalized consultation and transparent pricing before we begin.`;
    heroSecondaryCta = "Book my appointment in 4 taps";
    heroTertiaryCta = "Explore signature services";

    funnelConfig = {
      badge: "4-TAP APPOINTMENT BOOKING",
      title: "Book your session",
      subtitle: "Four quick taps to reserve your spot.",
      step1Question: "1. Which service would you like to book?",
      step1Options: [
        { label: knownServices[0] || `Signature ${cat} Transformation`, desc: "Full consultation & customized treatment" },
        { label: knownServices[1] || "Express Refresh & Maintenance", desc: "High-impact session tailored to your schedule" },
        { label: knownServices[2] || "Luxury Package / Full Session", desc: "Complete multi-step pampering & results" },
        { label: knownServices[3] || "New Client Consultation", desc: "1-on-1 assessment & custom plan" },
      ],
      step2Question: "2. When would you like to come in?",
      step2Options: [
        { label: "Today or Tomorrow", desc: "Check our next open chair/suite" },
        { label: "This Week (Thu–Sun)", desc: "Prime weekend or evening slot" },
        { label: "Next Week", desc: "Flexible morning or afternoon time" },
        { label: "Specific Special Date", desc: "Prep for an upcoming event" },
      ],
      step3Question: "3. What matters most for your appointment?",
      step3Options: [
        { label: "Low-maintenance, natural-looking results", desc: "Designed to look great for weeks" },
        { label: "Upfront package pricing", desc: "Know the exact total before we start" },
        { label: "Senior specialist / master stylist", desc: "Experienced hands and honest advice" },
        { label: "Relaxing, unhurried studio atmosphere", desc: "Quiet luxury with zero rushing" },
      ],
      step4Question: "4. Your phone number to confirm your appointment slot via text:",
      submitButtonText: "Request my appointment time",
      footerReassurance: `Want to check today's walk-in availability? Call ${phone}.`,
    };

    sectionHeaders = {
      showcaseKicker: `SIGNATURE WORK AT ${biz.toUpperCase()}`,
      showcaseHeading: `Tailored ${cat.toLowerCase()} transformations in ${city}.`,
      showcaseCta: "Book your session →",
      showcaseCardCta: "Book this service",
      processKicker: "THE STUDIO STANDARD",
      processHeading: "Personalized consultation, premium products, and transparent pricing.",
      processSubheading: `Here is what to expect when you visit ${biz} in ${city}.`,
      servicesKicker: "SERVICE MENU & PACKAGES",
      servicesHeading: `Our core services at ${biz}.`,
      servicesCardCtaPrefix: "Book",
      reviewsKicker: `CLIENT LOVE IN ${city.toUpperCase()}`,
      reviewsHeading: `Why clients across ${city} recommend ${biz}.`,
      areasKicker: "CLIENTS WE SERVE",
      areasHeading: `Conveniently located for clients across ${city}:`,
      faqKicker: "STUDIO FAQ",
      faqHeading: "Booking, pricing & preparation questions",
    };
  } else if (archetype === "professional_advisory") {
    announcementBar = `Confidential consultations for ${city} clients · Direct senior specialist access`;
    brandSubline = "Clear strategy. Decisive execution.";
    hoursText = "Mon–Fri, 8:30 am to 6 pm";
    navLabels = {
      showcase: "Practice Focus",
      process: "Our Roadmap",
      services: "Capabilities",
      reviews: "Client Reviews",
      areas: "Jurisdictions",
      faq: "FAQ",
      primaryCta: "Free Consultation",
    };
    heroKicker = `DEDICATED ${cat.toUpperCase()} IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Clear strategy and decisive representation when it matters most.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `${biz} advises individuals, families, and businesses across ${areas.slice(0, 3).join(", ")}. You speak directly with a senior professional on day one, backed by a written roadmap and transparent fee structure.`;
    heroSecondaryCta = "Request confidential review";
    heroTertiaryCta = "Review our practice areas";

    funnelConfig = {
      badge: "CONFIDENTIAL EVALUATION",
      title: "Request your strategy review",
      subtitle: "Four taps. Direct senior review.",
      step1Question: "1. What matter do you need guidance on?",
      step1Options: [
        { label: knownServices[0] || `Primary ${cat} Representation`, desc: "Comprehensive strategy, filing & execution" },
        { label: knownServices[1] || "Urgent Dispute, Audit or Deadline", desc: "Immediate protective action & counsel" },
        { label: knownServices[2] || "Transaction, Contract or Structuring", desc: "Fixed-scope review and precision drafting" },
        { label: knownServices[3] || "Second-Opinion Strategy Call", desc: "Confidential 15-minute review of your options" },
      ],
      step2Question: "2. What is the urgency of your matter?",
      step2Options: [
        { label: "Immediate / Active Deadline", desc: "Needs senior attention within 24 hours" },
        { label: "Within the Next 2 Weeks", desc: "Ready to retain or begin planning" },
        { label: "Within 1 to 3 Months", desc: "Proactive structuring & preparation" },
        { label: "Exploratory Consultation", desc: "Understanding rights, risks & fee options" },
      ],
      step3Question: "3. What is your top priority in selecting a firm?",
      step3Options: [
        { label: "Direct access to a senior partner", desc: "Never handed off to junior staff" },
        { label: "Transparent fixed or milestone fees", desc: "Clear engagement terms in writing" },
        { label: "Proven track record in " + city, desc: "Deep local and regulatory experience" },
        { label: "Fast, proactive communication", desc: "Same-day updates on every milestone" },
      ],
      step4Question: "4. Best phone number for a confidential callback:",
      submitButtonText: "Request confidential callback",
      footerReassurance: `Need immediate assistance? Call our ${city} office at ${phone}.`,
    };

    sectionHeaders = {
      showcaseKicker: `REPRESENTATIVE FOCUS AT ${biz.toUpperCase()}`,
      showcaseHeading: `Proven counsel and strategic outcomes for ${city} clients.`,
      showcaseCta: "Schedule a confidential review →",
      showcaseCardCta: "Discuss a similar matter",
      processKicker: "OUR CLIENT ROADMAP",
      processHeading: "No legal or financial jargon—just a clear plan from day one.",
      processSubheading: `How ${biz} protects your interests and keeps you informed at every stage.`,
      servicesKicker: `PRACTICE AREAS & ADVISORY CAPABILITIES`,
      servicesHeading: `How ${biz} represents you.`,
      servicesCardCtaPrefix: "Consult on",
      reviewsKicker: `CLIENT TESTIMONIALS IN ${city.toUpperCase()}`,
      reviewsHeading: `What clients in ${city} say about working with ${biz}.`,
      areasKicker: "COMMUNITIES WE SERVE",
      areasHeading: `Advising clients across ${city} and surrounding jurisdictions:`,
      faqKicker: "CLIENT FAQ",
      faqHeading: "Consultations, fees & representation questions",
    };
  } else if (archetype === "automotive_service") {
    announcementBar = `Certified auto repair & diagnostics in ${city} · Upfront digital inspections`;
    brandSubline = "Honest diagnostics. Same-day turnaround.";
    hoursText = "Mon–Sat, 7:30 am to 6 pm";
    navLabels = {
      showcase: "Shop Capabilities",
      process: "Digital Inspection",
      services: "Auto Services",
      reviews: "Driver Reviews",
      areas: "Areas Served",
      faq: "FAQ",
      primaryCta: "Get Repair Quote",
    };
    heroKicker = `TRUSTED ${cat.toUpperCase()} IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Honest auto care in ${city}, backed by photo inspections before you approve a dime.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `Skip the dealership markup and guesswork. ${biz} serves drivers across ${areas.slice(0, 3).join(", ")} with factory-grade diagnostics, upfront written quotes, and same-day turnaround on most repairs.`;
    heroSecondaryCta = "Price my repair or service";
    heroTertiaryCta = "See our shop capabilities";

    funnelConfig = {
      badge: "4-TAP REPAIR & SERVICE QUOTE",
      title: "What does your vehicle need?",
      subtitle: "Four quick taps for an upfront quote or bay reservation.",
      step1Question: "1. What service or issue are you experiencing?",
      step1Options: [
        { label: knownServices[0] || "Check Engine Light / Diagnostics", desc: "Full computer scan + photo inspection report" },
        { label: knownServices[1] || "Brakes, Suspension or Tires", desc: "OEM-grade safety repair with warranty" },
        { label: knownServices[2] || "A/C, Electrical or Engine Repair", desc: "Master technician troubleshooting & fix" },
        { label: knownServices[3] || "Scheduled Maintenance / Oil & Fluids", desc: "Fast factory-interval service" },
      ],
      step2Question: "2. How soon do you need your vehicle back on the road?",
      step2Options: [
        { label: "Today / Urgent Drop-Off", desc: "Vehicle is unsafe or needs immediate bay" },
        { label: "Within 2 to 3 Days", desc: "Reserve a scheduled morning drop-off" },
        { label: "This Week", desc: "Flexible drop-off window" },
        { label: "Price Quote / Second Opinion First", desc: "Compare against a dealership estimate" },
      ],
      step3Question: "3. What matters most to you?",
      step3Options: [
        { label: "Digital photos before approving work", desc: "See exactly what needs fixing and why" },
        { label: "Same-day turnaround", desc: "Get back on the road without delays" },
        { label: "Upfront written price guarantee", desc: "Zero surprise charges at pickup" },
        { label: "Parts & labor warranty", desc: "Backed nationwide for peace of mind" },
      ],
      step4Question: "4. Your phone number so our service advisor can text your quote:",
      submitButtonText: "Get my repair quote",
      footerReassurance: `Need immediate towing or bay availability? Call ${phone}.`,
    };
  } else if (archetype === "service_dispatch") {
    announcementBar = `Same-day ${cat.toLowerCase()} dispatch across ${city} · Upfront flat-rate pricing`;
    brandSubline = "On-time arrival. Priced before we start.";
    hoursText = "Mon–Sat 7 am–8 pm + Emergency Dispatch";
    navLabels = {
      showcase: "Recent Jobs",
      process: "How We Work",
      services: "Services",
      reviews: "Reviews",
      areas: "Service Area",
      faq: "FAQ",
      primaryCta: "Fast Estimate",
    };
    heroKicker = `LICENSED ${cat.toUpperCase()} IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Fast, clean ${cat.toLowerCase()} in ${city}, priced upfront in writing before work begins.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `When you call ${biz}, you get a real arrival window, a uniformed technician who protects your property, and a clear flat-rate quote before any tool is lifted across ${areas.slice(0, 3).join(", ")}.`;
    heroSecondaryCta = "Get my 4-tap estimate";
    heroTertiaryCta = "See recent installations & repairs";
  } else if (archetype === "project_remodel") {
    announcementBar = `Free on-site estimates across the ${city} area · ${hoursText}`;
    brandSubline = "Free estimates. No pressure.";
    navLabels = {
      showcase: "Finished Work",
      process: "Why Us",
      services: "Services",
      reviews: "Reviews",
      areas: "Areas",
      faq: "FAQ",
      primaryCta: "Free estimate",
    };
    if (/kitchen|bath|remodel|renovat|construct/i.test(`${cat} ${biz}`)) {
      heroKicker = `KITCHEN & HOME REMODELING IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
      heroHeadline = `A kitchen you love, on a schedule you can see.`;
      heroSubheadline =
        params.scrapedIntel?.description ||
        `We remodel kitchens, bathrooms and whole homes in ${areas.slice(0, 3).join(", ")} and nearby. You get the plan, the timeline and updates as the work moves, from the first walkthrough to the final inspection.`;
      funnelConfig.title = "What are we remodeling?";
      funnelConfig.step1Question = "1. What space are we remodeling?";
      funnelConfig.step1Options = [
        { label: knownServices[0] || "Kitchen Remodeling", desc: "Custom cabinetry, islands, stone countertops & lighting" },
        { label: knownServices[1] || "Bathroom Renovation", desc: "Walk-in showers, vanities, tilework & plumbing fixtures" },
        { label: knownServices[2] || "Whole-Home or Addition", desc: "Open-concept layouts, structural framing & full finishes" },
        { label: knownServices[3] || "ADU, Deck or Exterior", desc: "Backyard cottages, outdoor kitchens & siding" },
      ];
      finishedWork = [
        {
          title: `${areas[0]} Custom Kitchen & Island Transformation`,
          location: `${areas[0]}, ${country}`,
          duration: "Completed in 4.5 Weeks (On Schedule)",
          scope: "Rift-cut white oak cabinetry, Taj Mahal quartzite island, under-cabinet lighting & plumbing.",
          imageType: "kitchen",
          customImageUrl: scrapedImgs[0] || "",
        },
        {
          title: `${areas[1] || city} Primary Suite & Spa Bath Remodel`,
          location: `${areas[1] || city}, ${country}`,
          duration: "Completed in 3 Weeks",
          scope: "Frameless glass walk-in rain shower, heated limestone tile, custom walnut floating vanity.",
          imageType: "bathroom",
          customImageUrl: scrapedImgs[1] || "",
        },
        {
          title: `${areas[2] || city} Whole-Home Open Concept & Exterior`,
          location: `${areas[2] || city}, ${country}`,
          duration: "Completed in 7 Weeks",
          scope: "Load-bearing beam flush mount, custom architectural windows, cedar outdoor living deck.",
          imageType: "exterior",
          customImageUrl: scrapedImgs[2] || "",
        },
      ];
    }
  }

  // Sync services array with funnelConfig.step1Options if not already customized
  services = funnelConfig.step1Options.slice(0, 3).map((opt: any, i: number) => ({
    index: `0${i + 1}`,
    title: opt.label,
    timeline: i === 0 ? "Upfront Written Scope" : i === 1 ? "Priority Turnaround" : "Full Guarantee",
    description: `${opt.desc}. Delivered by ${biz} for clients across ${city} and ${areas[1] || "nearby areas"} with transparent pricing and dedicated quality control.`,
    deliverables: [
      "Clear upfront written estimate",
      `Dedicated ${city} specialist team`,
      "100% satisfaction & quality guarantee",
    ],
  }));

  const diagnosisHeadline =
    params.detectionStatus === "no_website"
      ? `${biz} currently has no dedicated website — meaning local customers searching for ${cat.toLowerCase()} in ${city} are calling your competitors instead.`
      : `${biz}'s current website (${params.originalWebsite || "existing site"}) is leaking high-intent ${cat.toLowerCase()} leads due to friction-heavy contact forms and missing mobile conversion architecture.`;

  return {
    archetype,
    themeId: resolvedTheme,
    customAccentColor: "",
    emblemType,
    customLogoUrl: "",
    adminPin: defaultPin,
    hostingMode: "preview" as "preview" | "live_hosted",
    customDomain: "",
    announcementBar,
    brandName: biz,
    brandSubline,
    phoneDisplay: phone,
    emailDisplay: email,
    hoursText,
    city,
    country,
    category: cat,
    navLabels,
    sectionHeaders,
    heroKicker,
    heroHeadline,
    heroSubheadline,
    heroPrimaryCta: `Call ${phone}`,
    heroSecondaryCta,
    heroTertiaryCta,
    trustStats: [
      { value: ratingStr, label: reviewLabel },
      { value: "100%", label: "Upfront transparent pricing & clear scope" },
      { value: "Same-Day", label: `Fast response across ${city}` },
    ],
    funnelConfig,
    services,
    scheduleSteps,
    finishedWork,
    reviews: [
      {
        quote: `We contacted ${biz} in ${city} for ${funnelConfig.step1Options[0].label.toLowerCase()}. They gave us clear pricing right away, showed up on time, and the results exceeded our expectations.`,
        author: "Mark & Lauren T.",
        neighborhood: `${areas[0]} Client`,
        project: funnelConfig.step1Options[0].label,
      },
      {
        quote: `Using the 4-tap tool on ${biz}'s website took 15 seconds. They called me back within 20 minutes and handled our ${funnelConfig.step1Options[1].label.toLowerCase()} without a single hiccup.`,
        author: "David R.",
        neighborhood: `${areas[1] || city}`,
        project: funnelConfig.step1Options[1].label,
      },
      {
        quote: `Zero surprise charges and genuinely professional service. The price quoted upfront was the exact price we paid, and everyone at ${biz} treated us with respect.`,
        author: "Sarah Jenkins",
        neighborhood: `${areas[2] || city}`,
        project: funnelConfig.step1Options[2].label,
      },
    ],
    serviceAreas: areas,
    faqs: [
      {
        q: `How quickly can I get a quote or appointment with ${biz} in ${city}?`,
        a: `Use our 4-tap tool at the top of this page or call ${phone}. We respond promptly with clear availability and upfront pricing for your ${cat.toLowerCase()} needs.`,
      },
      {
        q: `Do you provide upfront pricing before work or service begins?`,
        a: `Yes. At ${biz}, we always explain your options and provide a transparent scope and price before starting so you never face surprise charges.`,
      },
      {
        q: `What makes ${biz} different from other ${cat.toLowerCase()} providers in ${city}?`,
        a: `We combine ${ratingStr} local reputation with punctual scheduling, direct communication, and a 4-tap instant booking/quote experience that respects your time.`,
      },
      {
        q: `Which neighborhoods around ${city} do you serve?`,
        a: `We proudly serve ${areas.join(", ")}, and surrounding communities across the greater ${city} region.`,
      },
    ],
    scrapedImages: scrapedImgs,
    transformationSummary: {
      detectionStatus: params.detectionStatus,
      originalWebsite: params.originalWebsite || "None (No Website Listed)",
      originalScore: params.originalScore ?? (params.detectionStatus === "no_website" ? 0 : 38),
      newScore: 98,
      diagnosisHeadline,
      estimatedMissedLeadsPerMonth: "18–35 high-intent local customers/month",
      estimatedMonthlyRevenueLift: "+$14,500 – $42,000 / month",
      whatChanged: [
        {
          title: `1. Custom 4-Tap ${cat} Lead Funnel (Hero Right)`,
          before:
            params.detectionStatus === "no_website"
              ? `Customers searching Google for ${cat.toLowerCase()} in ${city} find no website to request a quote or book after hours.`
              : `Visitors on ${params.originalWebsite || "your old site"} face generic text and high-friction contact forms that over 88% of mobile users abandon.`,
          after: `Interactive 4-tap micro-funnel tailored specifically to ${biz}'s ${cat.toLowerCase()} services (${funnelConfig.step1Options.map((o: any) => o.label).slice(0, 3).join(", ")}) that captures phone leads in 12 seconds.`,
          impact: "3.8x higher visitor-to-lead conversion rate",
        },
        {
          title: "2. Above-the-Fold Click-to-Call & Mobile Action Bar",
          before: "Buried phone number and no mobile thumb-zone call/quote buttons.",
          after: `Direct 1-tap phone action (${phone}) + sticky mobile bottom bar built specifically for ${city} mobile searchers.`,
          impact: "+64% more direct inbound phone calls from mobile users",
        },
        {
          title: `3. Accurate ${cat} Service Architecture & Process`,
          before: "Generic boilerplate that fails to explain your specific services or how you work.",
          after: `Dedicated ${cat} showcase, 4-step client roadmap, and service packages customized for ${biz}.`,
          impact: "Builds immediate trust and eliminates buyer hesitation before they call",
        },
        {
          title: `4. Hyper-Local ${city} & Suburb SEO Signals`,
          before: `Missing local search authority for ${areas.slice(1, 4).join(", ")}.`,
          after: `Structured local coverage for ${areas.join(", ")} embedded directly into headings and FAQ schema.`,
          impact: `Captures high-intent ${cat.toLowerCase()} searches across greater ${city}`,
        },
      ],
      ownerBenefits: [
        `Custom-engineered specifically for ${biz} (${cat} in ${city}) — zero generic filler`,
        "Pre-wired 4-Tap Lead Funnel that captures service type, urgency, and phone number",
        "100% mobile-compatible with sticky thumb-zone call & quote actions",
        "Full ownership & white-glove domain connection within 24 hours of claiming",
      ],
    },
  };
}

const VALID_IMAGE_TYPES = [
  "kitchen",
  "bathroom",
  "exterior",
  "commercial",
  "plumbing_hvac",
  "roofing_exterior",
  "dental_medical",
  "dental_network",
  "restaurant_culinary",
  "legal_advisory",
  "auto_mechanical",
  "salon_wellness",
  "landscaping_outdoor",
  "commercial_solar",
  "b2b_intelligence",
];

export async function synthesizeWebsiteWithAI(
  params: BlueprintInputParams,
  baseBlueprint: any
): Promise<any> {
  try {
    const ai = await getGeminiAI();
    const scraped = params.scrapedIntel;

    const contextSummary = `
BUSINESS NAME: ${params.businessName}
INDUSTRY / CATEGORY: ${params.category}
DETECTED ARCHETYPE: ${baseBlueprint.archetype}
DEFAULT ASSIGNED COLOR THEME: ${baseBlueprint.themeId}
CITY / LOCATION: ${params.city}, ${params.country || "USA"}
ADDRESS: ${params.address || "Local area"}
PHONE: ${baseBlueprint.phoneDisplay}
OWNER / CONTACT: ${params.ownerName || "Business Owner"}
EXISTING WEBSITE: ${params.originalWebsite || "NONE (No website)"}
KNOWN SERVICES: ${(params.servicesList || []).join(", ") || "Infer accurate services from business name & category"}
BUSINESS DESCRIPTION / NOTES: ${params.businessDescription || "N/A"}
${
  scraped
    ? `LIVE SCRAPED WEBSITE DATA FROM ${params.originalWebsite}:
- Page Title: ${scraped.title}
- Meta Description: ${scraped.description}
- Headings on their site: ${scraped.headings.slice(0, 12).join(" | ")}
- Extracted service items: ${scraped.extractedServices.slice(0, 12).join(" | ")}
- Body excerpt: ${scraped.bodyExcerpt.slice(0, 700)}`
    : ""
}
`.trim();

    const aiPrompt = `You are an elite conversion architect and industry-accurate website builder.
Build a 100% accurate, non-generic website configuration specifically for this business based on its real name, industry/services, location, and scraped website intelligence.

CRITICAL ACCURACY RULES:
1. NEVER use construction/kitchen/remodeling terms unless the business actually does construction or remodeling.
2. Every headline, 4-tap funnel option, showcase card, process step, service package, review, and FAQ MUST accurately match "${params.businessName}" and its specific "${params.category}" services in ${params.city}.
3. Different businesses MUST have different color palettes! Choose a fitting "themeId" from this exact list of 11 distinct brand palettes so websites do not all look the same color:
   - "valley_craft" (Warm Walnut & Sandstone — Home Remodeling, Carpentry, Custom Builders)
   - "clinical_slate" (Medical Teal & Crisp White — Dental, Medical, Clinics, Healthcare)
   - "emerald_botanical" (Forest Emerald & Sage — Landscaping, Eco Services, Wellness, Pest/Lawn)
   - "crimson_culinary" (Bordeaux Terracotta & Cream — Restaurants, Hospitality, Bakeries, Food)
   - "midnight_sapphire" (Cobalt Blue & Ice Slate — Plumbing, Cooling, Auto Repair, Electrical, Tech)
   - "executive_heritage" (Obsidian & Champagne Gold — Law Firms, CPAs, Real Estate, Financial)
   - "culinary_linen" (Warm Espresso & Linen — Boutiques, Cafes, Interior Design, Artisans)
   - "plum_aesthetics" (Velvet Plum & Rose Quartz — Salons, MedSpas, Beauty, Aesthetics, Yoga)
   - "industrial_orange" (Safety Rust Orange & Charcoal — Roofing, Heavy Mechanical, Towing, HVAC)
   - "solar_teal" (Ocean Cyan & Alabaster — Solar Energy, Pools, Cleaning, Window Washing)
   - "nordic_indigo" (Royal Indigo & Cool Stone — Commercial B2B, IT, Insurance, Consulting)
4. If LIVE SCRAPED WEBSITE DATA is provided above, incorporate their real services, specialties, and local positioning directly into the funnel options, showcase items, and services list.
5. For each of the 3 "finishedWork" (showcase) items, pick the single most accurate "imageType" from this exact list:
   ${VALID_IMAGE_TYPES.join(", ")}
   - Use "dental_medical" or "dental_network" for dentists, doctors, clinics, chiropractors, healthcare, medspas.
   - Use "restaurant_culinary" for restaurants, cafes, bakeries, catering, food, bars.
   - Use "salon_wellness" for hair salons, barbers, spas, beauty, nail salons, fitness, yoga.
   - Use "legal_advisory" or "b2b_intelligence" for law firms, attorneys, CPAs, accountants, real estate, insurance, financial advisors, consultants.
   - Use "auto_mechanical" for auto repair, mechanics, tires, collision, detailing, towing.
   - Use "plumbing_hvac" for plumbers, HVAC, air conditioning, heating, electrical, drain cleaning, appliance repair.
   - Use "roofing_exterior" for roofing, gutters, siding, windows, exterior painting.
   - Use "landscaping_outdoor" for landscaping, lawn care, tree service, pools, hardscaping, fences, decks, pest control.
   - Use "commercial_solar" for solar installation & energy.
   - Use "kitchen", "bathroom", "exterior" ONLY for kitchen/bath/home remodeling or general contractors.
   - Use "commercial" for commercial cleaning, B2B services, retail, or general local services.

${contextSummary}

Return ONLY valid JSON matching this structure:
{
  "themeId": "${baseBlueprint.themeId}",
  "announcementBar": "Top bar text tailored to ${params.businessName} in ${params.city}",
  "brandSubline": "3-5 word trust reassurance under phone number",
  "hoursText": "Realistic operating hours for this business type",
  "heroKicker": "UPPERCASE SPECIFIC NICHE IN CITY, STATE",
  "heroHeadline": "Punchy, concrete 8-13 word headline promising the exact outcome customers of ${params.businessName} want (zero generic AI buzzwords)",
  "heroSubheadline": "2-sentence concrete value proposition naming ${params.businessName}, ${params.city}, nearby neighborhoods, and their specific ${params.category} services.",
  "heroSecondaryCta": "Action button text (e.g. Get my instant quote / Book my visit / Reserve & price catering)",
  "heroTertiaryCta": "Secondary button text (e.g. Explore our services / See signature treatments / View recent work)",
  "trustStats": [
    { "value": "4.9 ★", "label": "Specific local rating proof in ${params.city}" },
    { "value": "Short metric", "label": "Specific guarantee or speed proof for ${params.category}" },
    { "value": "Short metric", "label": "Specific credential or convenience proof" }
  ],
  "funnelConfig": {
    "badge": "SHORT UPPERCASE BADGE (e.g. 4-TAP INSTANT QUOTE or 4-TAP APPOINTMENT BOOKING)",
    "title": "Conversational question asking how ${params.businessName} can help",
    "subtitle": "Four quick taps. No long forms to fill out.",
    "step1Question": "1. Question asking which specific ${params.category} service they need",
    "step1Options": [
      { "label": "Specific Service 1 of ${params.businessName}", "desc": "Concrete 6-10 word description" },
      { "label": "Specific Service 2 of ${params.businessName}", "desc": "Concrete 6-10 word description" },
      { "label": "Specific Service 3 of ${params.businessName}", "desc": "Concrete 6-10 word description" },
      { "label": "Specific Service 4 of ${params.businessName}", "desc": "Concrete 6-10 word description" }
    ],
    "step2Question": "2. Question about timing/urgency or party/project size",
    "step2Options": [
      { "label": "Option 1", "desc": "Short concrete description" },
      { "label": "Option 2", "desc": "Short concrete description" },
      { "label": "Option 3", "desc": "Short concrete description" },
      { "label": "Option 4", "desc": "Short concrete description" }
    ],
    "step3Question": "3. Question about what matters most to them for this service",
    "step3Options": [
      { "label": "Priority 1", "desc": "Short concrete description" },
      { "label": "Priority 2", "desc": "Short concrete description" },
      { "label": "Priority 3", "desc": "Short concrete description" },
      { "label": "Priority 4", "desc": "Short concrete description" }
    ],
    "step4Question": "4. Your phone number so ${params.businessName} can text or call you right back:",
    "submitButtonText": "Action submit button text"
  },
  "sectionHeaders": {
    "showcaseKicker": "UPPERCASE KICKER FOR SHOWCASE SECTION",
    "showcaseHeading": "Heading for featured work / signature services / treatments",
    "showcaseCta": "CTA button label",
    "showcaseCardCta": "Card link text",
    "processKicker": "UPPERCASE KICKER FOR 4-STEP PROCESS",
    "processHeading": "Heading explaining how ${params.businessName} works from start to finish",
    "processSubheading": "1-2 sentence explanation of their stress-free customer process",
    "servicesKicker": "UPPERCASE KICKER FOR SERVICES",
    "servicesHeading": "Heading for core services of ${params.businessName}",
    "servicesCardCtaPrefix": "Action verb (e.g. Price / Book / Request)",
    "reviewsKicker": "UPPERCASE KICKER FOR REVIEWS",
    "reviewsHeading": "Heading for ${params.city} customer/patient/client reviews",
    "faqKicker": "STRAIGHT ANSWERS",
    "faqHeading": "Common questions for ${params.businessName}"
  },
  "finishedWork": [
    {
      "title": "Specific Showcase / Service / Case Study 1 for ${params.businessName}",
      "location": "${params.city} neighborhood or service tag",
      "duration": "Concrete turnaround / visit time / highlight metric",
      "scope": "20-28 word concrete description of what is included or what was delivered",
      "imageType": "one of the valid imageType keys matching this exact service"
    },
    {
      "title": "Specific Showcase / Service / Case Study 2 for ${params.businessName}",
      "location": "${params.city} neighborhood or service tag",
      "duration": "Concrete turnaround / visit time / highlight metric",
      "scope": "20-28 word concrete description of what is included or what was delivered",
      "imageType": "one of the valid imageType keys matching this exact service"
    },
    {
      "title": "Specific Showcase / Service / Case Study 3 for ${params.businessName}",
      "location": "${params.city} neighborhood or service tag",
      "duration": "Concrete turnaround / visit time / highlight metric",
      "scope": "20-28 word concrete description of what is included or what was delivered",
      "imageType": "one of the valid imageType keys matching this exact service"
    }
  ],
  "scheduleSteps": [
    { "step": "Step 01", "title": "Step 1 Title", "duration": "Timing badge", "detail": "Concrete explanation for ${params.businessName}" },
    { "step": "Step 02", "title": "Step 2 Title", "duration": "Timing badge", "detail": "Concrete explanation for ${params.businessName}" },
    { "step": "Step 03", "title": "Step 3 Title", "duration": "Timing badge", "detail": "Concrete explanation for ${params.businessName}" },
    { "step": "Step 04", "title": "Step 4 Title", "duration": "Timing badge", "detail": "Concrete explanation for ${params.businessName}" }
  ],
  "services": [
    {
      "index": "01",
      "title": "Core Service Package 1",
      "timeline": "Service window or pricing model badge",
      "description": "Concrete 2-sentence explanation of this service at ${params.businessName}.",
      "deliverables": ["Specific inclusion 1", "Specific inclusion 2", "Specific inclusion 3"]
    },
    {
      "index": "02",
      "title": "Core Service Package 2",
      "timeline": "Service window or pricing model badge",
      "description": "Concrete 2-sentence explanation of this service at ${params.businessName}.",
      "deliverables": ["Specific inclusion 1", "Specific inclusion 2", "Specific inclusion 3"]
    },
    {
      "index": "03",
      "title": "Core Service Package 3",
      "timeline": "Service window or pricing model badge",
      "description": "Concrete 2-sentence explanation of this service at ${params.businessName}.",
      "deliverables": ["Specific inclusion 1", "Specific inclusion 2", "Specific inclusion 3"]
    }
  ],
  "reviews": [
    { "quote": "Specific realistic review mentioning ${params.businessName} and a real ${params.category} service in ${params.city}.", "author": "FirstName L.", "neighborhood": "${params.city} Resident", "project": "Specific Service" },
    { "quote": "Specific realistic review about fast response and upfront pricing at ${params.businessName}.", "author": "FirstName L.", "neighborhood": "Nearby Neighborhood", "project": "Specific Service" },
    { "quote": "Specific realistic review praising quality and professionalism of ${params.businessName}.", "author": "FirstName L.", "neighborhood": "${params.city}", "project": "Specific Service" }
  ],
  "serviceAreas": ["${params.city}", "Real Nearby Suburb 1", "Real Nearby Suburb 2", "Real Nearby Suburb 3", "Real Nearby Suburb 4", "Real Nearby Suburb 5"],
  "faqs": [
    { "q": "Specific question 1 about ${params.businessName}'s ${params.category} services?", "a": "Clear, helpful answer." },
    { "q": "Specific question 2 about pricing, insurance, or estimates?", "a": "Clear, helpful answer." },
    { "q": "Specific question 3 about scheduling or turnaround time?", "a": "Clear, helpful answer." },
    { "q": "What areas around ${params.city} does ${params.businessName} serve?", "a": "Clear answer listing ${params.city} and nearby areas." }
  ]
}`;

    const resp = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: aiPrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(resp.text || "{}");

    if (
      (!params.themeId || params.themeId === "auto") &&
      parsed.themeId &&
      (ALL_THEME_IDS as readonly string[]).includes(parsed.themeId)
    ) {
      baseBlueprint.themeId = parsed.themeId;
    }

    if (parsed.announcementBar) baseBlueprint.announcementBar = parsed.announcementBar;
    if (parsed.brandSubline) baseBlueprint.brandSubline = parsed.brandSubline;
    if (parsed.hoursText) baseBlueprint.hoursText = parsed.hoursText;
    if (parsed.heroKicker) baseBlueprint.heroKicker = parsed.heroKicker;
    if (parsed.heroHeadline) baseBlueprint.heroHeadline = parsed.heroHeadline;
    if (parsed.heroSubheadline) baseBlueprint.heroSubheadline = parsed.heroSubheadline;
    if (parsed.heroSecondaryCta) baseBlueprint.heroSecondaryCta = parsed.heroSecondaryCta;
    if (parsed.heroTertiaryCta) baseBlueprint.heroTertiaryCta = parsed.heroTertiaryCta;

    if (Array.isArray(parsed.trustStats) && parsed.trustStats.length === 3) {
      baseBlueprint.trustStats = parsed.trustStats;
    }

    if (parsed.funnelConfig && typeof parsed.funnelConfig === "object") {
      baseBlueprint.funnelConfig = {
        ...baseBlueprint.funnelConfig,
        ...parsed.funnelConfig,
        step1Options:
          Array.isArray(parsed.funnelConfig.step1Options) && parsed.funnelConfig.step1Options.length >= 3
            ? parsed.funnelConfig.step1Options
            : baseBlueprint.funnelConfig.step1Options,
        step2Options:
          Array.isArray(parsed.funnelConfig.step2Options) && parsed.funnelConfig.step2Options.length >= 3
            ? parsed.funnelConfig.step2Options
            : baseBlueprint.funnelConfig.step2Options,
        step3Options:
          Array.isArray(parsed.funnelConfig.step3Options) && parsed.funnelConfig.step3Options.length >= 3
            ? parsed.funnelConfig.step3Options
            : baseBlueprint.funnelConfig.step3Options,
      };
    }

    if (parsed.sectionHeaders && typeof parsed.sectionHeaders === "object") {
      baseBlueprint.sectionHeaders = {
        ...baseBlueprint.sectionHeaders,
        ...parsed.sectionHeaders,
      };
    }

    if (Array.isArray(parsed.finishedWork) && parsed.finishedWork.length >= 3) {
      const scrapedImgs = params.scrapedIntel?.extractedImages || [];
      baseBlueprint.finishedWork = parsed.finishedWork.slice(0, 3).map((item: any, idx: number) => ({
        title: item.title || baseBlueprint.finishedWork[idx]?.title,
        location: item.location || `${params.city}`,
        duration: item.duration || "Verified Quality",
        scope: item.scope || "",
        imageType: VALID_IMAGE_TYPES.includes(item.imageType)
          ? item.imageType
          : baseBlueprint.finishedWork[idx]?.imageType || "commercial",
        customImageUrl: scrapedImgs[idx] || "",
      }));
    }

    if (Array.isArray(parsed.scheduleSteps) && parsed.scheduleSteps.length >= 3) {
      baseBlueprint.scheduleSteps = parsed.scheduleSteps.slice(0, 4);
    }

    if (Array.isArray(parsed.services) && parsed.services.length >= 3) {
      baseBlueprint.services = parsed.services.slice(0, 3);
    }

    if (Array.isArray(parsed.reviews) && parsed.reviews.length >= 3) {
      baseBlueprint.reviews = parsed.reviews.slice(0, 3);
    }

    if (Array.isArray(parsed.serviceAreas) && parsed.serviceAreas.length >= 3) {
      baseBlueprint.serviceAreas = parsed.serviceAreas;
    }

    if (Array.isArray(parsed.faqs) && parsed.faqs.length >= 3) {
      baseBlueprint.faqs = parsed.faqs.slice(0, 4);
    }

    // Update transformationSummary with the AI-refined services
    if (baseBlueprint.transformationSummary?.whatChanged?.[0]) {
      const topServices = (baseBlueprint.funnelConfig?.step1Options || [])
        .map((o: any) => o.label)
        .slice(0, 3)
        .join(", ");
      baseBlueprint.transformationSummary.whatChanged[0].after = `Interactive 4-tap micro-funnel built specifically around ${params.businessName}'s services (${topServices}) that captures phone leads in 12 seconds.`;
    }
  } catch (err) {
    console.warn("[website-intelligence] AI synthesis fallback to industry blueprint:", err);
  }

  return baseBlueprint;
}

export const THEME_PALETTE_MAP: Record<
  string,
  {
    id: string;
    name: string;
    bgCanvas: string;
    bgElevated: string;
    bgSubtle: string;
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
> = {
  valley_craft: {
    id: "valley_craft",
    name: "Warm Walnut & Sandstone",
    bgCanvas: "#FAF6F0",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F2ECE1",
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
    name: "Clinical Teal & Crisp Alabaster",
    bgCanvas: "#F8FAFC",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EFF6FF",
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
    bgCanvas: "#F6FAF7",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EBF5EE",
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
    name: "Bordeaux Terracotta & Warm Cream",
    bgCanvas: "#FDFBF9",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F9F1EC",
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
    bgCanvas: "#F8FAFF",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EEF2FF",
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
    name: "Obsidian Navy & Champagne Gold",
    bgCanvas: "#FAF9F5",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F3F0E6",
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
    name: "Warm Espresso & Artisan Linen",
    bgCanvas: "#FBF8F4",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F3EDE4",
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
    name: "Velvet Plum & Rose Alabaster",
    bgCanvas: "#FDF9FC",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F7EEF5",
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
    name: "Safety Copper Orange & Slate",
    bgCanvas: "#FAF9F7",
    bgElevated: "#FFFFFF",
    bgSubtle: "#F4F1EC",
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
    bgCanvas: "#F7FCFD",
    bgElevated: "#FFFFFF",
    bgSubtle: "#ECFEFF",
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
    bgCanvas: "#F9FAFB",
    bgElevated: "#FFFFFF",
    bgSubtle: "#EEF2FF",
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

export function exportStandaloneHtmlBundle(site: any, baseUrl: string): string {
  const cfg = (site.siteConfig || {}) as any;
  const baseTheme = THEME_PALETTE_MAP[site.themeId || cfg.themeId || "valley_craft"] || THEME_PALETTE_MAP.valley_craft;
  const accent = cfg.customAccentColor || baseTheme.accent;
  const brandName = cfg.brandName || site.businessName || "Local Business";
  const phone = cfg.phoneDisplay || site.phone || "(916) 291-1047";
  const phoneHref = `tel:${String(phone).replace(/[^0-9+]/g, "")}`;
  const city = cfg.city || site.city || "Sacramento";
  const category = cfg.category || site.category || "Services";
  const funnel = cfg.funnelConfig || {};
  const step1Opts = funnel.step1Options || [];
  const services = cfg.services || [];
  const scheduleSteps = cfg.scheduleSteps || [];
  const reviews = cfg.reviews || [];
  const faqs = cfg.faqs || [];
  const areas = cfg.serviceAreas || [city];
  const headers = cfg.sectionHeaders || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brandName} — ${category} in ${city}</title>
  <meta name="description" content="${(cfg.heroSubheadline || "").replace(/"/g, "&quot;")}" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --bg-canvas: ${baseTheme.bgCanvas};
      --bg-elevated: ${baseTheme.bgElevated};
      --bg-subtle: ${baseTheme.bgSubtle};
      --text-primary: ${baseTheme.textPrimary};
      --text-secondary: ${baseTheme.textSecondary};
      --text-muted: ${baseTheme.textMuted};
      --accent: ${accent};
      --accent-soft: ${baseTheme.accentSoft};
      --border-color: ${baseTheme.border};
    }
    body {
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding-bottom: 72px;
    }
    h1, h2, .font-serif-display {
      font-family: 'Fraunces', Georgia, serif;
    }
  </style>
</head>
<body>
  <!-- Top Announcement Bar -->
  <div style="background:${baseTheme.topBarBg};color:${baseTheme.topBarText};" class="w-full py-2.5 px-4 text-center text-xs sm:text-sm font-medium">
    ${cfg.announcementBar || `${brandName} · Serving ${city} & surrounding communities · ${cfg.hoursText || "Mon–Sat"}`}
  </div>

  <!-- Header -->
  <header style="background:${baseTheme.bgCanvas};border-bottom:1px solid ${baseTheme.border};" class="sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
      <a href="#" class="flex items-center gap-3 text-decoration-none">
        ${
          cfg.customLogoUrl
            ? `<img src="${cfg.customLogoUrl}" alt="${brandName}" class="h-11 w-auto object-contain rounded-lg" />`
            : `<div style="background:${baseTheme.bgSubtle};border:1px solid ${baseTheme.border};color:${accent};" class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg">${brandName.slice(0, 2).toUpperCase()}</div>`
        }
        <div>
          <div class="font-bold text-base sm:text-lg leading-tight">${brandName}</div>
          <div style="color:${baseTheme.textMuted};" class="text-xs">${city} · ${category}</div>
        </div>
      </a>
      <div class="flex items-center gap-4">
        <div class="hidden sm:block text-right">
          <a href="${phoneHref}" class="font-bold text-sm block hover:underline">${phone}</a>
          <span style="color:${baseTheme.textMuted};" class="text-[11px]">${cfg.brandSubline || "Fast response · Upfront pricing"}</span>
        </div>
        <a href="#estimate-funnel" style="background:${accent};color:#fff;" class="px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold shadow-sm hover:opacity-95 transition">
          ${cfg.navLabels?.primaryCta || "Free Estimate"}
        </a>
      </div>
    </div>
  </header>

  <!-- Hero + 4-Tap Funnel -->
  <section class="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
      <div class="lg:col-span-7">
        <div style="color:${accent};" class="text-xs font-bold uppercase tracking-widest mb-3">${cfg.heroKicker || `${category.toUpperCase()} IN ${city.toUpperCase()}`}</div>
        <h1 class="font-serif-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] mb-5">${cfg.heroHeadline || `Trusted ${category} in ${city}`}</h1>
        <p style="color:${baseTheme.textSecondary};" class="text-base sm:text-lg leading-relaxed mb-7 max-w-2xl">${cfg.heroSubheadline || ""}</p>
        <div class="flex flex-wrap gap-3 mb-10">
          <a href="${phoneHref}" style="background:${accent};color:#fff;" class="px-6 py-3.5 rounded-xl font-semibold text-sm sm:text-base shadow-sm">Call ${phone}</a>
          <a href="#estimate-funnel" style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="px-6 py-3.5 rounded-xl font-semibold text-sm sm:text-base">${cfg.heroSecondaryCta || "Get Instant Quote"}</a>
        </div>
        <div style="border-top:1px solid ${baseTheme.border};" class="grid grid-cols-3 gap-4 pt-6">
          ${(cfg.trustStats || [])
            .map(
              (st: any) => `<div>
            <div class="font-serif-display text-xl sm:text-2xl font-bold">${st.value}</div>
            <div style="color:${baseTheme.textMuted};" class="text-xs mt-1">${st.label}</div>
          </div>`
            )
            .join("")}
        </div>
      </div>

      <!-- 4-Tap Interactive Funnel Card -->
      <div id="estimate-funnel" class="lg:col-span-5">
        <div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-2xl p-6 sm:p-7 shadow-lg">
          <div style="color:${accent};" class="text-[11px] font-bold uppercase tracking-wider mb-1">${funnel.badge || "4-TAP INSTANT QUOTE"}</div>
          <h2 class="font-serif-display text-2xl font-bold mb-1">${funnel.title || `How can ${brandName} help you?`}</h2>
          <p style="color:${baseTheme.textMuted};" class="text-xs mb-5">${funnel.subtitle || "Four quick taps. No long forms."}</p>

          <form id="leadForm" onsubmit="submitLead(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold mb-2">${funnel.step1Question || "1. Select a service:"}</label>
              <div class="grid grid-cols-1 gap-2">
                ${step1Opts
                  .map(
                    (o: any, idx: number) => `<label style="border:1px solid ${baseTheme.border};background:${baseTheme.bgCanvas};" class="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:opacity-90">
                  <input type="radio" name="service" value="${o.label}" ${idx === 0 ? "checked" : ""} class="mt-1" />
                  <div>
                    <div class="text-sm font-semibold">${o.label}</div>
                    <div style="color:${baseTheme.textMuted};" class="text-xs">${o.desc}</div>
                  </div>
                </label>`
                  )
                  .join("")}
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold mb-1.5">Your Name</label>
              <input type="text" id="leadName" required placeholder="Your full name" style="border:1px solid ${baseTheme.border};" class="w-full px-3.5 py-2.5 rounded-xl text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold mb-1.5">${funnel.step4Question || "Best phone number for a fast callback/text:"}</label>
              <input type="tel" id="leadPhone" required placeholder="${phone}" style="border:1px solid ${baseTheme.border};" class="w-full px-3.5 py-2.5 rounded-xl text-sm" />
            </div>
            <button type="submit" style="background:${accent};color:#fff;" class="w-full py-3.5 rounded-xl font-bold text-sm shadow-md cursor-pointer">
              ${funnel.submitButtonText || "Request My Fast Quote →"}
            </button>
            <div id="leadSuccess" class="hidden p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
              Thank you! Your request has been sent to ${brandName}. Need immediate help? Call ${phone}.
            </div>
          </form>
        </div>
      </div>
    </div>
  </section>

  <!-- Core Services Section -->
  <section id="services" style="background:${baseTheme.bgSubtle};border-top:1px solid ${baseTheme.border};border-bottom:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div style="color:${accent};" class="text-xs font-bold uppercase tracking-widest mb-2">${headers.servicesKicker || "SERVICES & PACKAGES"}</div>
      <h2 class="font-serif-display text-2xl sm:text-4xl font-bold mb-10">${headers.servicesHeading || `How ${brandName} serves ${city}`}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${services
          .map(
            (srv: any) => `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs font-semibold mb-3">
              <span style="color:${accent};">${srv.index || "01"}</span>
              <span style="color:${baseTheme.textMuted};">${srv.timeline || ""}</span>
            </div>
            <h3 class="font-serif-display text-xl font-bold mb-2">${srv.title}</h3>
            <p style="color:${baseTheme.textSecondary};" class="text-sm leading-relaxed mb-4">${srv.description}</p>
            <ul class="space-y-1.5 mb-6">
              ${(srv.deliverables || [])
                .map((d: string) => `<li class="text-xs flex items-center gap-2"><span style="color:${accent};">✓</span> ${d}</li>`)
                .join("")}
            </ul>
          </div>
          <a href="#estimate-funnel" style="border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="block text-center py-2.5 rounded-xl text-xs font-semibold hover:opacity-80">
            ${headers.servicesCardCtaPrefix || "Request"} ${srv.title} →
          </a>
        </div>`
          )
          .join("")}
      </div>
    </div>
  </section>

  <!-- 4-Step Process -->
  <section class="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
    <div style="color:${accent};" class="text-xs font-bold uppercase tracking-widest mb-2">${headers.processKicker || "HOW IT WORKS"}</div>
    <h2 class="font-serif-display text-2xl sm:text-4xl font-bold mb-3">${headers.processHeading || `Working with ${brandName}`}</h2>
    <p style="color:${baseTheme.textSecondary};" class="text-sm sm:text-base mb-10 max-w-2xl">${headers.processSubheading || ""}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      ${scheduleSteps
        .map(
          (st: any) => `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-2xl p-5">
        <div class="flex items-center justify-between text-xs font-bold mb-2">
          <span style="color:${accent};">${st.step}</span>
          <span style="color:${baseTheme.textMuted};">${st.duration}</span>
        </div>
        <h3 class="font-bold text-base mb-2">${st.title}</h3>
        <p style="color:${baseTheme.textSecondary};" class="text-xs leading-relaxed">${st.detail}</p>
      </div>`
        )
        .join("")}
    </div>
  </section>

  <!-- Reviews -->
  <section style="background:${baseTheme.bgSubtle};border-top:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div style="color:${accent};" class="text-xs font-bold uppercase tracking-widest mb-2">${headers.reviewsKicker || `CLIENT REVIEWS IN ${city.toUpperCase()}`}</div>
      <h2 class="font-serif-display text-2xl sm:text-4xl font-bold mb-10">${headers.reviewsHeading || `What ${city} customers say about ${brandName}`}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${reviews
          .map(
            (r: any) => `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-2xl p-6">
          <div style="color:${accent};" class="text-sm font-bold mb-3">★★★★★</div>
          <p class="text-sm leading-relaxed mb-4">"${r.quote}"</p>
          <div class="text-xs font-bold">${r.author}</div>
          <div style="color:${baseTheme.textMuted};" class="text-[11px]">${r.neighborhood} · ${r.project}</div>
        </div>`
          )
          .join("")}
      </div>
    </div>
  </section>

  <!-- FAQ & Service Areas -->
  <section class="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
    <h2 class="font-serif-display text-2xl sm:text-3xl font-bold mb-6">${headers.faqHeading || `Frequently Asked Questions — ${brandName}`}</h2>
    <div class="space-y-4 mb-12">
      ${faqs
        .map(
          (f: any) => `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-xl p-5">
        <div class="font-bold text-sm sm:text-base mb-1.5">${f.q}</div>
        <div style="color:${baseTheme.textSecondary};" class="text-xs sm:text-sm leading-relaxed">${f.a}</div>
      </div>`
        )
        .join("")}
    </div>
    <div style="border-top:1px solid ${baseTheme.border};" class="pt-8 text-xs">
      <span class="font-bold">Areas Served around ${city}:</span>
      <span style="color:${baseTheme.textSecondary};"> ${areas.join(" · ")}</span>
    </div>
  </section>

  <!-- Footer -->
  <footer style="background:${baseTheme.topBarBg};color:${baseTheme.topBarText};" class="py-10 px-4 sm:px-6 text-center text-xs">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="font-bold text-sm">${brandName} · ${city}</div>
      <div>Call Direct: <a href="${phoneHref}" class="underline font-semibold">${phone}</a> · ${cfg.hoursText || ""}</div>
      <div class="opacity-70">© ${new Date().getFullYear()} ${brandName}. All rights reserved.</div>
    </div>
  </footer>

  <!-- Mobile Sticky Bar -->
  <div style="background:${baseTheme.bgElevated};border-top:1px solid ${baseTheme.border};" class="fixed bottom-0 inset-x-0 z-50 sm:hidden p-2.5 flex items-center gap-2 shadow-lg">
    <a href="${phoneHref}" style="border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="flex-1 py-2.5 rounded-lg text-center font-bold text-xs">Call ${phone}</a>
    <a href="#estimate-funnel" style="background:${accent};color:#fff;" class="flex-1 py-2.5 rounded-lg text-center font-bold text-xs">${cfg.navLabels?.primaryCta || "Free Estimate"}</a>
  </div>

  <script>
    async function submitLead(e) {
      e.preventDefault();
      const form = document.getElementById('leadForm');
      const service = form.querySelector('input[name="service"]:checked')?.value || 'Service Inquiry';
      const name = document.getElementById('leadName').value;
      const phone = document.getElementById('leadPhone').value;
      try {
        await fetch('${baseUrl}/api/website-builder/public/${site.siteId}/funnel-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step1: service, step2: 'Direct Website Inquiry', step3: 'Fast callback', name, phone })
        });
      } catch (err) {}
      document.getElementById('leadSuccess').classList.remove('hidden');
      form.reset();
    }
  </script>
</body>
</html>`;
}



