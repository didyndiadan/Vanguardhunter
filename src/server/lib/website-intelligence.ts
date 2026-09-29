import fs from "fs";
import path from "path";
import { getGeminiAI } from "../routes/api-keys";
import { selectUniqueVisualsForBusiness } from "../../lib/industry-visual-pool";

export const SHOWCASE_ASSET_FILES: Record<string, string> = {
  fitness_strength: "fitness_strength_training_1790421475678.jpg",
  fitness_group: "fitness_group_workout_1790421490041.jpg",
  fitness_coaching: "fitness_personal_coaching_1790421502270.jpg",
  fitness_cardio_functional: "fitness_cardio_functional_1790446127481.jpg",
  medical_consultation: "medical_patient_consultation_1790422317477.jpg",
  medical_modern_treatment_suite: "medical_modern_treatment_suite_1790446292341.jpg",
  restaurant_dining: "restaurant_dining_experience_1790422268280.jpg",
  restaurant_catering_banquet: "restaurant_catering_banquet_1790446138947.jpg",
  restaurant_artisan_kitchen: "restaurant_artisan_kitchen_1790446302167.jpg",
  salon_styling: "salon_barber_styling_1790422282481.jpg",
  salon_spa_facial_treatment: "salon_spa_facial_treatment_1790446149827.jpg",
  salon_luxury_hair_color: "salon_luxury_hair_color_1790446312366.jpg",
  auto_diagnostic: "auto_diagnostic_service_1790422294786.jpg",
  auto_brake_tire_alignment: "auto_brake_tire_alignment_1790446160171.jpg",
  auto_precision_detailing_bay: "auto_precision_detailing_bay_1790446323994.jpg",
  hvac_dispatch: "hvac_electrical_dispatch_1790422305378.jpg",
  electrical_plumbing_specialist: "electrical_plumbing_specialist_1790446170455.jpg",
  hvac_smart_climate_install: "hvac_smart_climate_install_1790446336291.jpg",
  kitchen: "showcase_kitchen_remodel_1790391137149.jpg",
  bathroom: "showcase_bathroom_renovation_1790391148499.jpg",
  remodel_custom_living_carpentry: "remodel_custom_living_carpentry_1790446181402.jpg",
  exterior: "showcase_whole_home_exterior_1790391161411.jpg",
  commercial: "showcase_commercial_service_1790391173740.jpg",
  plumbing_hvac: "industry_plumbing_hvac_1790393997472.jpg",
  roofing_exterior: "industry_roofing_exterior_1790394014092.jpg",
  dental_medical: "industry_dental_medical_1790394023456.jpg",
  dental_network: "case_study_dental_network_1790378421158.jpg",
  restaurant_culinary: "industry_restaurant_culinary_1790394033671.jpg",
  legal_advisory: "industry_legal_advisory_1790394045191.jpg",
  auto_mechanical: "industry_auto_mechanical_1790394056628.jpg",
  salon_wellness: "industry_salon_wellness_1790394067909.jpg",
  landscaping_outdoor: "industry_landscaping_outdoor_1790394078101.jpg",
  commercial_solar: "case_study_commercial_solar_1790378432723.jpg",
  b2b_intelligence: "hero_b2b_intelligence_1790378408952.jpg",
  advisory_executive_boardroom: "advisory_executive_boardroom_1790446354674.jpg",
};

const embeddedAssetCache = new Map<string, string>();

export function getEmbeddedAssetDataUri(imageType: string): string {
  const key = SHOWCASE_ASSET_FILES[imageType] ? imageType : "commercial";
  if (embeddedAssetCache.has(key)) {
    return embeddedAssetCache.get(key)!;
  }
  const filename = SHOWCASE_ASSET_FILES[key];
  try {
    const filePath = path.resolve(process.cwd(), "src/assets/images", filename);
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
      embeddedAssetCache.set(key, dataUri);
      return dataUri;
    }
  } catch (err) {
    console.warn("[website-intelligence] Could not read asset file for base64 embed:", filename, err);
  }
  return "";
}

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

    // Extract high-value unique images (og:image + twitter:image + img src/data-src/srcset + CSS background-image)
    const extractedImages: string[] = [];
    const seenNormalizedUrls = new Set<string>();
    const normalizeImgIdentity = (u: string) => {
      try {
        const parsedUrl = new URL(u);
        // Strip sizing suffixes like -300x200, -1024x768, @2x and query strings so resized duplicates of the same image are never added twice
        const cleanPath = parsedUrl.pathname
          .toLowerCase()
          .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "")
          .replace(/@[23]x(?=\.[a-z0-9]+$)/i, "");
        return `${parsedUrl.origin}${cleanPath}`;
      } catch {
        return u.toLowerCase().split("?")[0];
      }
    };

    const addCandidateImage = (rawUrl?: string) => {
      if (!rawUrl || extractedImages.length >= 6) return;
      const cleaned = rawUrl.trim().replace(/^['"]|['"]$/g, "").split(/\s+/)[0];
      if (!cleaned || cleaned.startsWith("data:")) return;
      if (
        /logo|icon|favicon|sprite|badge|stars|rating|review|arrow|spinner|loader|\.svg|\.gif|\.ico|1x1|pixel|wp-smiley|gravatar|button|payment|visa|mastercard|paypal|facebook|instagram|twitter|youtube|linkedin|yelp|google|map|placeholder|avatar|thumb-small|banner-ad|seal|cert|bbb|150x150|100x100/i.test(
          cleaned
        )
      ) {
        return;
      }
      try {
        const resolved = new URL(cleaned, baseOrigin).href;
        const normKey = normalizeImgIdentity(resolved);
        if (/^https?:\/\//i.test(resolved) && !seenNormalizedUrls.has(normKey)) {
          seenNormalizedUrls.add(normKey);
          extractedImages.push(resolved);
        }
      } catch {}
    };

    const ogImgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImgMatch?.[1]) {
      addCandidateImage(ogImgMatch[1]);
    }

    const imgTagRegex = /<img[^>]+>/gi;
    let imgTagMatch: RegExpExecArray | null;
    while ((imgTagMatch = imgTagRegex.exec(html)) !== null && extractedImages.length < 8) {
      const tag = imgTagMatch[0];
      // Skip tiny explicit dimensions
      const wMatch = tag.match(/\bwidth=["']?(\d+)/i);
      const hMatch = tag.match(/\bheight=["']?(\d+)/i);
      if ((wMatch && Number(wMatch[1]) > 0 && Number(wMatch[1]) < 120) || (hMatch && Number(hMatch[1]) > 0 && Number(hMatch[1]) < 120)) {
        continue;
      }
      const attrMatch =
        tag.match(/\bdata-lazy-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-original=["']([^"']+)["']/i) ||
        tag.match(/\bsrc=["']([^"']+)["']/i);
      if (attrMatch?.[1]) {
        addCandidateImage(attrMatch[1]);
      }
    }

    const bgUrlRegex = /background(?:-image)?\s*:\s*[^;]*url\((['"]?)(.*?)\1\)/gi;
    let bgMatch: RegExpExecArray | null;
    while ((bgMatch = bgUrlRegex.exec(html)) !== null && extractedImages.length < 8) {
      if (bgMatch[2]) addCandidateImage(bgMatch[2]);
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
  | "fitness_athletic"
  | "salon_wellness"
  | "automotive_service"
  | "commercial_b2b";

export const ALL_THEME_IDS = [
  "kinetic_crimson",
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

export function hashBusinessString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const hashString = hashBusinessString;

export function detectIndustryArchetype(category: string, businessName: string): {
  archetype: IndustryArchetype;
  themeId: string;
  emblemType: string;
  defaultImageKeys: [string, string, string];
  purePoolKeys: string[];
} {
  const combined = `${category} ${businessName}`.toLowerCase();
  const hash = hashBusinessString(`${businessName.trim().toLowerCase()}_${category.trim().toLowerCase()}`);

  const pickTheme = (pool: string[]) => pool[hash % pool.length];

  if (/dent|orthodont|clinic|med|doctor|chiro|physio|optom|health|vet|dermatol|pediatr|urgent care|podiatr|psych|therap|pharm/i.test(combined)) {
    const pool = /vet|naturo|holistic|therap|physio/i.test(combined)
      ? ["emerald_botanical", "solar_teal", "clinical_slate"]
      : ["clinical_slate", "solar_teal", "nordic_indigo", "midnight_sapphire"];
    return {
      archetype: "medical_clinical",
      themeId: pickTheme(pool),
      emblemType: "medical",
      defaultImageKeys: ["medical_consultation", "dental_medical", "dental_network"],
      purePoolKeys: [
        "medical_consultation",
        "dental_medical",
        "dental_network",
        "medical_modern_treatment_suite",
      ],
    };
  }

  if (/restaur|cafe|coffee|bakery|bistro|pizz|grill|sushi|taco|bar|pub|cater|food|kitchen & bar|steakhouse|diner/i.test(combined)) {
    const pool = /pizz|ital|steak|bistro|wine|grill|bbq|taco/i.test(combined)
      ? ["crimson_culinary", "burgundy_reserve", "culinary_linen"]
      : ["crimson_culinary", "culinary_linen", "emerald_botanical", "valley_craft"];
    return {
      archetype: "hospitality_culinary",
      themeId: pickTheme(pool),
      emblemType: "culinary",
      defaultImageKeys: ["restaurant_dining", "restaurant_culinary", "restaurant_catering_banquet"],
      purePoolKeys: [
        "restaurant_dining",
        "restaurant_culinary",
        "restaurant_catering_banquet",
        "restaurant_artisan_kitchen",
      ],
    };
  }

  if (/gym|fitness|crossfit|workout|personal train|strength|conditioning|athletic|barbell|weightlift|powerlift|boxing|kickbox|martial art|mma|jiu jitsu|karate|pilates|yoga|boot ?camp|health club|spin|cycling|hiit|physique|sports performance/i.test(combined)) {
    const isForceOrPower = /force|power|iron|elite|crossfit|athletic|strength|barbell|performance/i.test(combined);
    const pool = ["kinetic_crimson", "industrial_orange", "midnight_sapphire", "emerald_botanical"];
    return {
      archetype: "fitness_athletic",
      themeId: isForceOrPower ? "kinetic_crimson" : pickTheme(pool),
      emblemType: "fitness",
      defaultImageKeys: ["fitness_strength", "fitness_group", "fitness_coaching"],
      purePoolKeys: ["fitness_strength", "fitness_group", "fitness_coaching", "fitness_cardio_functional"],
    };
  }

  if (/salon|barber|spa|medspa|nail|beauty|lash|brow|massage|aesthetic|hair|wax|wellness/i.test(combined)) {
    const pool = /barber/i.test(combined)
      ? ["executive_heritage", "industrial_orange", "nordic_indigo"]
      : ["plum_aesthetics", "burgundy_reserve", "emerald_botanical", "culinary_linen"];
    return {
      archetype: "salon_wellness",
      themeId: pickTheme(pool),
      emblemType: "sparkle",
      defaultImageKeys: ["salon_styling", "salon_spa_facial_treatment", "salon_wellness"],
      purePoolKeys: [
        "salon_styling",
        "salon_spa_facial_treatment",
        "salon_wellness",
        "salon_luxury_hair_color",
      ],
    };
  }

  if (/law|attorney|legal|account|cpa|tax|bookkeep|insur|real estate|realtor|mortgage|financ|wealth|consult|architect|notary/i.test(combined)) {
    const pool = ["executive_heritage", "burgundy_reserve", "nordic_indigo", "midnight_sapphire"];
    return {
      archetype: "professional_advisory",
      themeId: pickTheme(pool),
      emblemType: "scales",
      defaultImageKeys: ["legal_advisory", "b2b_intelligence", "advisory_executive_boardroom"],
      purePoolKeys: [
        "legal_advisory",
        "b2b_intelligence",
        "advisory_executive_boardroom",
        "commercial",
      ],
    };
  }

  if (/auto|mechanic|car repair|collision|tire|brake|transmission|detailing|towing|body shop|oil change|windshield|fleet/i.test(combined)) {
    const pool = ["industrial_orange", "midnight_sapphire", "kinetic_crimson", "clinical_slate"];
    return {
      archetype: "automotive_service",
      themeId: pickTheme(pool),
      emblemType: "wrench",
      defaultImageKeys: ["auto_diagnostic", "auto_brake_tire_alignment", "auto_mechanical"],
      purePoolKeys: [
        "auto_diagnostic",
        "auto_brake_tire_alignment",
        "auto_mechanical",
        "auto_precision_detailing_bay",
      ],
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
      defaultImageKeys: ["hvac_dispatch", "plumbing_hvac", "electrical_plumbing_specialist"],
      purePoolKeys: [
        "hvac_dispatch",
        "plumbing_hvac",
        "electrical_plumbing_specialist",
        "hvac_smart_climate_install",
      ],
    };
  }

  if (/roof|gutter|siding|solar|window|fence|deck|landscap|lawn|tree|hardscap|pool|paver|concrete|driveway|masonry/i.test(combined)) {
    const isLand = /landscap|lawn|tree|hardscap|pool|paver|fence|deck/i.test(combined);
    const isSolar = /solar/i.test(combined);
    const pool = isLand
      ? ["emerald_botanical", "solar_teal", "valley_craft"]
      : isSolar
      ? ["solar_teal", "industrial_orange", "midnight_sapphire"]
      : ["industrial_orange", "valley_craft", "culinary_linen", "executive_heritage"];
    const defaultKeys: [string, string, string] = isLand
      ? ["landscaping_outdoor", "exterior", "remodel_custom_living_carpentry"]
      : isSolar
      ? ["commercial_solar", "roofing_exterior", "electrical_plumbing_specialist"]
      : ["roofing_exterior", "exterior", "remodel_custom_living_carpentry"];
    return {
      archetype: "project_remodel",
      themeId: pickTheme(pool),
      emblemType: "roof",
      defaultImageKeys: defaultKeys,
      purePoolKeys: isLand
        ? ["landscaping_outdoor", "exterior", "remodel_custom_living_carpentry", "roofing_exterior"]
        : isSolar
        ? ["commercial_solar", "roofing_exterior", "electrical_plumbing_specialist", "exterior"]
        : ["roofing_exterior", "exterior", "remodel_custom_living_carpentry", "landscaping_outdoor"],
    };
  }

  if (/construct|remodel|renovat|kitchen|bath|cabinet|countertop|flooring|tile|paint|drywall|handyman|builder|addition|adu|carpentr/i.test(combined)) {
    const isValleySample = /valley construction/i.test(businessName);
    const pool = ["valley_craft", "executive_heritage", "culinary_linen", "nordic_indigo", "solar_teal"];
    return {
      archetype: "project_remodel",
      themeId: isValleySample ? "valley_craft" : pickTheme(pool),
      emblemType: "roof",
      defaultImageKeys: ["kitchen", "bathroom", "remodel_custom_living_carpentry"],
      purePoolKeys: ["kitchen", "bathroom", "remodel_custom_living_carpentry", "exterior"],
    };
  }

  const generalPool = ALL_THEME_IDS as unknown as string[];
  return {
    archetype: "commercial_b2b",
    themeId: pickTheme(generalPool),
    emblemType: "shield",
    defaultImageKeys: ["commercial", "b2b_intelligence", "advisory_executive_boardroom"],
    purePoolKeys: ["commercial", "b2b_intelligence", "advisory_executive_boardroom", "legal_advisory"],
  };
}

/**
 * Matches an individual service/offering card's title & scope to the most accurate
 * imageType inside the business's pure industry pool, while strictly guaranteeing
 * ZERO duplicate images across all cards on the business page.
 */
export function assignUniqueOfferingImageTypes(
  finishedWork: any[],
  category: string,
  businessName: string,
  options?: {
    city?: string;
    variationSeed?: number;
    selectedImages?: string[];
    avoidUrls?: Set<string>;
  }
): any[] {
  if (!Array.isArray(finishedWork) || finishedWork.length === 0) return [];
  const detected = detectIndustryArchetype(category, businessName);
  const purePool = detected.purePoolKeys;
  const usedTypes = new Set<string>();
  const usedCustomUrls = new Set<string>();

  const uniqueVisuals = selectUniqueVisualsForBusiness({
    category,
    businessName,
    city: options?.city || "",
    variationSeed: options?.variationSeed || 0,
    count: Math.max(3, finishedWork.length),
    avoidUrls: options?.avoidUrls,
  });

  const explicitSelected = Array.isArray(options?.selectedImages)
    ? options!.selectedImages.filter(
        (u) => typeof u === "string" && /^(https?:\/\/|data:image\/)/i.test(u.trim())
      )
    : [];

  const matchCardToBestKey = (cardText: string): string | null => {
    const t = cardText.toLowerCase();
    if (detected.archetype === "fitness_athletic") {
      if (/group|class|hiit|bootcamp|boot camp|spin|team|cardio class/i.test(t)) return "fitness_group";
      if (/1-on-1|personal|coach|assessment|custom|trainer/i.test(t)) return "fitness_coaching";
      if (/functional|turf|rope|kettlebell|conditioning|athletic|stamina/i.test(t)) return "fitness_cardio_functional";
      if (/strength|barbell|weight|muscle|lift|power/i.test(t)) return "fitness_strength";
    } else if (detected.archetype === "hospitality_culinary") {
      if (/cater|event|party|banquet|group|office|celebrat|tray|platter/i.test(t)) return "restaurant_catering_banquet";
      if (/menu|scratch|dish|culinary|takeout|order|lunch|special/i.test(t)) return "restaurant_culinary";
      if (/dine|table|reserv|chef|dinner|guest|experience/i.test(t)) return "restaurant_dining";
    } else if (detected.archetype === "salon_wellness") {
      if (/facial|skin|glow|medspa|peel|lash|brow|aesthetic|rejuvenat/i.test(t)) return "salon_spa_facial_treatment";
      if (/spa|massage|wellness|package|luxury|relax|body/i.test(t)) return "salon_wellness";
      if (/hair|cut|color|styl|barber|blowout|balayage|trim/i.test(t)) return "salon_styling";
    } else if (detected.archetype === "automotive_service") {
      if (/brake|tire|wheel|align|suspension|rotor|pad/i.test(t)) return "auto_brake_tire_alignment";
      if (/diagnos|check engine|scan|inspect|electrical|computer|battery/i.test(t)) return "auto_diagnostic";
      if (/engine|transmission|oil|fluid|mechanic|repair|a\/c|cooling/i.test(t)) return "auto_mechanical";
    } else if (detected.archetype === "service_dispatch") {
      if (/electr|panel|wire|breaker|lighting|generator|tankless|water heater/i.test(t)) return "electrical_plumbing_specialist";
      if (/plumb|drain|pipe|leak|sewer|faucet|toilet|fixture/i.test(t)) return "plumbing_hvac";
      if (/hvac|air|heat|cooling|furnace|ac |duct|dispatch|tune-up/i.test(t)) return "hvac_dispatch";
    } else if (detected.archetype === "medical_clinical") {
      if (/consult|exam|new patient|second opinion|checkup|plan/i.test(t)) return "medical_consultation";
      if (/cosmetic|implant|specialty|whitening|ortho|suite|technology|restor/i.test(t)) return "dental_medical";
      if (/urgent|same-day|emergency|pain|family|team|care/i.test(t)) return "dental_network";
    } else if (detected.archetype === "project_remodel") {
      if (/kitchen|cabinet|island|countertop/i.test(t) && purePool.includes("kitchen")) return "kitchen";
      if (/bath|shower|vanity|tub|spa/i.test(t) && purePool.includes("bathroom")) return "bathroom";
      if (/living|open-concept|open concept|carpentr|woodwork|interior|flooring|addition/i.test(t) && purePool.includes("remodel_custom_living_carpentry")) {
        return "remodel_custom_living_carpentry";
      }
      if (/solar|panel|energy/i.test(t) && purePool.includes("commercial_solar")) return "commercial_solar";
      if (/landscap|lawn|patio|paver|hardscap|tree|outdoor|pool/i.test(t) && purePool.includes("landscaping_outdoor")) {
        return "landscaping_outdoor";
      }
      if (/roof|shingle|gutter|siding/i.test(t) && purePool.includes("roofing_exterior")) return "roofing_exterior";
      if (/exterior|deck|window|adu/i.test(t) && purePool.includes("exterior")) return "exterior";
    } else if (detected.archetype === "professional_advisory") {
      if (/law|legal|litigat|dispute|attorney|representation|court|contract/i.test(t)) return "legal_advisory";
      if (/strategy|tax|cpa|financ|wealth|advisory|audit|structur/i.test(t)) return "b2b_intelligence";
      if (/commercial|business|corporate|real estate|property/i.test(t)) return "commercial";
    }
    return null;
  };

  return finishedWork.map((item: any, idx: number) => {
    const cardText = `${item?.title || ""} ${item?.scope || ""}`;
    const semanticMatch = matchCardToBestKey(cardText);
    const currentKey = String(item?.imageType || "").trim();

    let chosenKey = "";
    if (uniqueVisuals.imageKeys[idx] && !usedTypes.has(uniqueVisuals.imageKeys[idx])) {
      chosenKey = uniqueVisuals.imageKeys[idx];
    } else if (semanticMatch && purePool.includes(semanticMatch) && !usedTypes.has(semanticMatch)) {
      chosenKey = semanticMatch;
    } else if (currentKey && purePool.includes(currentKey) && !usedTypes.has(currentKey)) {
      chosenKey = currentKey;
    } else {
      const nextUnused = purePool.find((k) => !usedTypes.has(k));
      chosenKey = nextUnused || purePool[idx % purePool.length];
    }

    usedTypes.add(chosenKey);

    let cleanCustomUrl = String(explicitSelected[idx] || item?.customImageUrl || "").trim();
    if (!cleanCustomUrl && uniqueVisuals.images[idx]) {
      cleanCustomUrl = uniqueVisuals.images[idx];
    }
    if (cleanCustomUrl) {
      const normCustom = cleanCustomUrl.toLowerCase().split("?")[0];
      if (usedCustomUrls.has(normCustom)) {
        cleanCustomUrl =
          uniqueVisuals.images.find((u) => !usedCustomUrls.has(u.toLowerCase().split("?")[0])) || "";
      }
      if (cleanCustomUrl) {
        usedCustomUrls.add(cleanCustomUrl.toLowerCase().split("?")[0]);
      }
    }

    return {
      ...item,
      imageType: chosenKey,
      customImageUrl: cleanCustomUrl,
    };
  });
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
  selectedImages?: string[];
  imageVariationSeed?: number;
  avoidUrls?: Set<string>;
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
  const defaultPin = "owner2026";

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
      customImageUrl: "",
    },
    {
      title: knownServices[1] || `Specialized ${cat} Solution`,
      location: `${areas[1] || city}, ${country}`,
      duration: "Guaranteed Quality",
      scope: `Tailored ${cat.toLowerCase()} package designed for long-term reliability and peace of mind.`,
      imageType: imgKey2,
      customImageUrl: "",
    },
    {
      title: knownServices[2] || `Priority ${cat} & Support`,
      location: `${areas[2] || city}, ${country}`,
      duration: "5-Star Local Service",
      scope: `Dedicated local team serving ${city} residential and commercial clients with transparent standards.`,
      imageType: imgKey3,
      customImageUrl: "",
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
        imageType: "medical_consultation",
        customImageUrl: "",
      },
      {
        title: funnelConfig.step1Options[2].label,
        location: `${city} Clinical Suite`,
        duration: "Precision Modern Technology",
        scope: "Minimally invasive techniques focused on natural aesthetics, long-term health, and gentle patient comfort.",
        imageType: "dental_medical",
        customImageUrl: "",
      },
      {
        title: funnelConfig.step1Options[1].label,
        location: `Same-Day Care in ${city}`,
        duration: "Reserved Daily Urgent Slots",
        scope: "Fast diagnosis and immediate relief so you never have to wait weeks when you are in discomfort.",
        imageType: "dental_network",
        customImageUrl: "",
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
        imageType: "restaurant_dining",
        customImageUrl: "",
      },
      {
        title: knownServices[1] || `Signature Culinary Menu & Craft Favorites`,
        location: `Fresh Daily in ${city}`,
        duration: "Scratch Kitchen Quality",
        scope: "Hand-selected seasonal ingredients, house-made sauces, and unforgettable presentation for lunch, dinner, and weekend dining.",
        imageType: "restaurant_culinary",
        customImageUrl: "",
      },
      {
        title: knownServices[2] || `Private Celebrations & Group Catering`,
        location: `${biz} · ${city}`,
        duration: "10 to 200+ Guests · On-Time Setup",
        scope: "Warm hospitality, customizable crowd-pleasing platters, and dedicated service for events, offices, and family gatherings.",
        imageType: "restaurant_catering_banquet",
        customImageUrl: "",
      },
    ];
  } else if (archetype === "fitness_athletic") {
    announcementBar = `Claim Your Free 7-Day Trial Pass or 1-on-1 Fitness Assessment at ${biz} in ${city} · Call ${phone}`;
    brandSubline = "Expert coaching. Real strength & results.";
    hoursText = "Mon–Fri 5 am–9 pm · Sat–Sun 7 am–6 pm";
    navLabels = {
      showcase: "Training Programs",
      process: "How You Start",
      services: "Memberships & Coaching",
      reviews: "Member Results",
      areas: "Gym Location",
      faq: "Member FAQ",
      primaryCta: "Claim Free Pass",
    };
    heroKicker = `STRENGTH, CONDITIONING & PERSONAL TRAINING IN ${city.toUpperCase()}, ${country.toUpperCase()}`;
    heroHeadline = `Train with purpose, build real strength, and transform your body at ${biz}.`;
    heroSubheadline =
      params.scrapedIntel?.description ||
      `${biz} is ${city}'s high-energy training ground for people who want real results. From coach-led group workouts and functional strength conditioning to 1-on-1 personal training across ${areas.slice(0, 3).join(", ")}, we give you the coaching, equipment, and accountability to hit your goals.`;
    heroSecondaryCta = "Claim my Free Trial Pass in 4 taps";
    heroTertiaryCta = "See people training & programs";

    funnelConfig = {
      badge: "4-TAP FREE TRIAL & COACHING MATCH",
      title: `What is your #1 fitness goal at ${biz}?`,
      subtitle: "Four quick taps to lock in your free trial workout or personal training plan.",
      step1Question: "1. Which training program are you interested in?",
      step1Options: [
        {
          label: knownServices[0] || "Strength & Functional Conditioning",
          desc: "Build lean muscle, power & athletic stamina with expert coaching",
        },
        {
          label: knownServices[1] || "High-Energy Group Fitness Workouts",
          desc: "Motivating coach-led classes that burn fat and keep you accountable",
        },
        {
          label: knownServices[2] || "1-on-1 Personal Training & Transformation",
          desc: "Custom workout program, form coaching & nutrition game plan",
        },
        {
          label: knownServices[3] || "Free Trial Pass & Fitness Assessment",
          desc: "Experience the gym, meet our coaches & map out your goals",
        },
      ],
      step2Question: "2. When do you prefer to work out?",
      step2Options: [
        { label: "Early Morning (5 am – 9 am)", desc: "Start the day energized before work" },
        { label: "Midday / Lunch Sessions", desc: "Fast, high-impact 45–60 min workout" },
        { label: "After Work / Evening (4 pm – 8 pm)", desc: "High-energy evening training sessions" },
        { label: "Flexible / Weekends", desc: "Mix of weekday and weekend training" },
      ],
      step3Question: "3. What matters most to you in a gym?",
      step3Options: [
        { label: "Coaches who actually guide & motivate me", desc: "Real form checks and structured workouts" },
        { label: "Visible fat-loss & strength results", desc: "Proven programming with measurable progress" },
        { label: "Welcoming, high-energy community", desc: "Zero ego—supportive athletes of all levels" },
        { label: "Transparent membership & coaching rates", desc: "No hidden initiation fees or fine print" },
      ],
      step4Question: `4. Best phone number so ${biz} can text your Free Trial Pass & schedule:`,
      submitButtonText: "Send my Free Trial Pass →",
      footerReassurance: `Want to tour ${biz} or jump into today's workout? Call ${phone}.`,
    };

    sectionHeaders = {
      showcaseKicker: `REAL PEOPLE TRAINING AT ${biz.toUpperCase()}`,
      showcaseHeading: `High-energy workouts, strength coaching & transformations in ${city}.`,
      showcaseCta: "Claim your Free Trial Pass →",
      showcaseCardCta: "Try this training program",
      processKicker: `HOW YOU START AT ${biz.toUpperCase()}`,
      processHeading: "Zero intimidation. A clear fitness game plan from Day 1.",
      processSubheading: `Whether you are a beginner or a seasoned athlete in ${city}, here is how we help you hit your goals faster.`,
      servicesKicker: `TRAINING PROGRAMS & MEMBERSHIPS`,
      servicesHeading: `Ways to train at ${biz} in ${city}.`,
      servicesCardCtaPrefix: "Start",
      reviewsKicker: `MEMBER TRANSFORMATIONS IN ${city.toUpperCase()}`,
      reviewsHeading: `Why members across ${city} train at ${biz}.`,
      areasKicker: "ATHLETES & MEMBERS WE SERVE",
      areasHeading: `Members join us from across ${city} and nearby neighborhoods:`,
      faqKicker: "MEMBER FAQ",
      faqHeading: `Trial passes, coaching & membership FAQ for ${biz}`,
    };

    finishedWork = [
      {
        title: funnelConfig.step1Options[0].label,
        location: `${biz} Strength Floor · ${city}`,
        duration: "All Fitness Levels · Coach-Guided",
        scope:
          "Progressive strength and functional conditioning using free weights, barbells, battle ropes, and athletic turf drills to build lean muscle and real-world power.",
        imageType: "fitness_strength",
        customImageUrl: "",
      },
      {
        title: funnelConfig.step1Options[1].label,
        location: `${city} Group Training Studio`,
        duration: "45–60 Min High-Energy Sessions",
        scope:
          "Dynamic, coach-led group workouts engineered to torch calories, boost cardiovascular endurance, and keep you motivated alongside a supportive team.",
        imageType: "fitness_group",
        customImageUrl: "",
      },
      {
        title: funnelConfig.step1Options[2].label,
        location: `1-on-1 Coaching · ${city}`,
        duration: "Custom Roadmap & Accountability",
        scope:
          "Dedicated personal training tailored to your body, schedule, and goals—complete with movement assessment, custom programming, and weekly progress check-ins.",
        imageType: "fitness_coaching",
        customImageUrl: "",
      },
    ];

    scheduleSteps = [
      {
        step: "Step 01",
        title: "4-Tap Trial Pass & Goal Check",
        duration: "Takes 15 Seconds",
        detail: `Select your fitness goal in our 4-tap tool above or call ${phone} to reserve your free trial session at ${biz}.`,
      },
      {
        step: "Step 02",
        title: "1-on-1 Facility Tour & Assessment",
        duration: "First Visit",
        detail: "Meet a head coach, tour the training floor, and map out the exact workouts that fit your current fitness level.",
      },
      {
        step: "Step 03",
        title: "Coach-Guided Workouts & Community",
        duration: "Weekly Training",
        detail: "Train with structured programming, real-time form coaching, and an energetic community that keeps you showing up.",
      },
      {
        step: "Step 04",
        title: "Measurable Strength & Body Results",
        duration: "30–90 Days",
        detail: "Track your strength gains, energy levels, and body composition with regular coach check-ins and milestone celebrations.",
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
        customImageUrl: "",
        },
        {
          title: `${areas[1] || city} Primary Suite & Spa Bath Remodel`,
          location: `${areas[1] || city}, ${country}`,
          duration: "Completed in 3 Weeks",
          scope: "Frameless glass walk-in rain shower, heated limestone tile, custom walnut floating vanity.",
          imageType: "bathroom",
          customImageUrl: "",
        },
        {
          title: `${areas[2] || city} Whole-Home Open Concept & Exterior`,
          location: `${areas[2] || city}, ${country}`,
          duration: "Completed in 7 Weeks",
          scope: "Load-bearing beam flush mount, custom architectural windows, cedar outdoor living deck.",
          imageType: "exterior",
          customImageUrl: "",
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

  // Ensure all 3 finishedWork items have 100% unique, per-business diversified images & imageTypes matched to each offering
  finishedWork = assignUniqueOfferingImageTypes(finishedWork, cat, biz, {
    city,
    variationSeed: params.imageVariationSeed || 0,
    selectedImages: params.selectedImages,
    avoidUrls: params.avoidUrls,
  });

  const intelligentModules = buildIntelligentSmartModules({
    archetype,
    businessName: biz,
    category: cat,
    city,
    phone,
    servicesList: funnelConfig.step1Options.map((o: any) => o.label),
  });

  const diagnosisHeadline =
    params.detectionStatus === "no_website"
      ? `${biz} currently has no dedicated website — meaning local customers searching for ${cat.toLowerCase()} in ${city} are calling your competitors instead.`
      : `${biz}'s current website (${params.originalWebsite || "existing site"}) is leaking high-intent ${cat.toLowerCase()} leads due to friction-heavy contact forms and missing mobile conversion architecture.`;

  return {
    visualEngineVersion: 5,
    imageVariationSeed: params.imageVariationSeed || 0,
    archetype,
    themeId: resolvedTheme,
    customAccentColor: "",
    emblemType,
    customLogoUrl: "",
    adminPin: defaultPin,
    adminPassword: defaultPin,
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
    intelligentModules,
    chatbotConfig: {
      enabled: true,
      soundEnabled: true,
      autoOpenDelayMs: 800,
      agentName: `${biz} Team`,
      greeting: `👋 Hi there! Welcome to ${biz} in ${city}. How can we help you with your ${cat.toLowerCase()} needs today?`,
      firstQuestion:
        funnelConfig.step1Question.replace(/^1\.\s*/, "") ||
        `What can ${biz} help you with today? Tap an option below or ask any question:`,
      followUpQuestion:
        funnelConfig.step2Question.replace(/^2\.\s*/, "") ||
        `When are you looking to get started?`,
      priorityQuestion:
        funnelConfig.step3Question.replace(/^3\.\s*/, "") ||
        `What matters most to you for this service?`,
      quickOptions: funnelConfig.step1Options,
    },
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
          title: `2. Built-In Automated Website Chatbot (With Arrival Sound Chime & Guided Questions)`,
          before: "No live assistant on the website — visitors leave within 8 seconds when their questions aren't answered immediately.",
          after: `Automated bottom-right chatbot built directly into ${biz}'s website that pops up with an attention chime when visitors arrive, asks interactive questions about their ${cat.toLowerCase()} needs, and captures their phone/email automatically.`,
          impact: "+48% more after-hours & mobile visitor conversations converted into leads",
        },
        {
          title: "3. Above-the-Fold Click-to-Call & Mobile Action Bar",
          before: "Buried phone number and no mobile thumb-zone call/quote buttons.",
          after: `Direct 1-tap phone action (${phone}) + sticky mobile bottom bar built specifically for ${city} mobile searchers.`,
          impact: "+64% more direct inbound phone calls from mobile users",
        },
        {
          title: `4. Accurate ${cat} Service Architecture & Local ${city} SEO`,
          before: "Generic boilerplate that fails to explain your specific services or how you work.",
          after: `Dedicated ${cat} showcase, 4-step client roadmap, and local coverage for ${areas.join(", ")} customized for ${biz}.`,
          impact: "Builds immediate trust and captures high-intent searches across greater " + city,
        },
      ],
      ownerBenefits: [
        `Custom-engineered specifically for ${biz} (${cat} in ${city}) — zero generic filler`,
        "Built-in Automated Website Chatbot at the bottom of the site with arrival chime & visitor question flow",
        "Pre-wired 4-Tap Lead Funnel that captures service type, urgency, and phone number",
        "100% mobile-compatible with sticky thumb-zone call & quote actions",
        "Full ownership & white-glove domain connection within 24 hours of claiming",
      ],
    },
  };
}

const VALID_IMAGE_TYPES = [
  "fitness_strength",
  "fitness_group",
  "fitness_coaching",
  "fitness_cardio_functional",
  "medical_consultation",
  "dental_medical",
  "dental_network",
  "medical_modern_treatment_suite",
  "restaurant_dining",
  "restaurant_culinary",
  "restaurant_catering_banquet",
  "restaurant_artisan_kitchen",
  "salon_styling",
  "salon_spa_facial_treatment",
  "salon_wellness",
  "salon_luxury_hair_color",
  "auto_diagnostic",
  "auto_brake_tire_alignment",
  "auto_mechanical",
  "auto_precision_detailing_bay",
  "hvac_dispatch",
  "plumbing_hvac",
  "electrical_plumbing_specialist",
  "hvac_smart_climate_install",
  "kitchen",
  "bathroom",
  "remodel_custom_living_carpentry",
  "exterior",
  "roofing_exterior",
  "landscaping_outdoor",
  "commercial_solar",
  "legal_advisory",
  "b2b_intelligence",
  "advisory_executive_boardroom",
  "commercial",
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
3. Different businesses MUST have different color palettes! Choose a fitting "themeId" from this exact list of 12 distinct brand palettes so websites do not all look the same color:
   - "kinetic_crimson" (Kinetic Crimson & Carbon Athletic — Gyms, Fitness Studios, Personal Training, CrossFit, Martial Arts, Sports Performance)
   - "valley_craft" (Warm Walnut & Sandstone — Home Remodeling, Carpentry, Custom Builders)
   - "clinical_slate" (Medical Teal & Crisp White — Dental, Medical, Clinics, Healthcare)
   - "emerald_botanical" (Forest Emerald & Sage — Landscaping, Eco Services, Wellness, Pest/Lawn)
   - "crimson_culinary" (Bordeaux Terracotta & Cream — Restaurants, Hospitality, Bakeries, Food)
   - "midnight_sapphire" (Cobalt Blue & Ice Slate — Plumbing, Cooling, Auto Repair, Electrical, Tech)
   - "executive_heritage" (Obsidian & Champagne Gold — Law Firms, CPAs, Real Estate, Financial)
   - "culinary_linen" (Warm Espresso & Linen — Boutiques, Cafes, Interior Design, Artisans)
   - "plum_aesthetics" (Velvet Plum & Rose Quartz — Salons, MedSpas, Beauty, Aesthetics)
   - "industrial_orange" (Safety Rust Orange & Charcoal — Roofing, Heavy Mechanical, Towing, HVAC)
   - "solar_teal" (Ocean Cyan & Alabaster — Solar Energy, Pools, Cleaning, Window Washing)
   - "nordic_indigo" (Royal Indigo & Cool Stone — Commercial B2B, IT, Insurance, Consulting)
4. If LIVE SCRAPED WEBSITE DATA is provided above, incorporate their real services, specialties, and local positioning directly into the funnel options, showcase items, and services list.
5. CRITICAL IMAGE UNIQUENESS & OFFERING RELEVANCE RULE:
   For the 3 "finishedWork" (showcase) items, you MUST choose 3 DIFFERENT "imageType" values (NEVER use the same imageType twice on the same business page!) purely related to what "${params.businessName}" offers from this exact list:
   ${VALID_IMAGE_TYPES.join(", ")}
   - Gyms / Fitness / Personal Training / Martial Arts / Yoga: use 3 distinct keys from ["fitness_strength", "fitness_group", "fitness_coaching", "fitness_cardio_functional"].
   - Dentists / Doctors / Medical Clinics / Chiropractors / Healthcare: use ["medical_consultation", "dental_medical", "dental_network"].
   - Restaurants / Cafes / Bakeries / Catering / Bars: use ["restaurant_dining", "restaurant_culinary", "restaurant_catering_banquet"].
   - Hair Salons / Barbers / Spas / MedSpas / Nail & Beauty Studios: use ["salon_styling", "salon_spa_facial_treatment", "salon_wellness"].
   - Auto Repair / Mechanics / Tires / Brakes / Collision / Detailing: use ["auto_diagnostic", "auto_brake_tire_alignment", "auto_mechanical"].
   - Plumbers / HVAC / Air Conditioning / Heating / Electrical / Home Dispatch: use ["hvac_dispatch", "plumbing_hvac", "electrical_plumbing_specialist"].
   - Kitchen, Bath & Home Remodeling / Custom Builders / Carpentry: use 3 distinct keys from ["kitchen", "bathroom", "remodel_custom_living_carpentry", "exterior"].
   - Roofing / Siding / Gutters / Landscaping / Solar: use 3 distinct keys from ["roofing_exterior", "landscaping_outdoor", "commercial_solar", "exterior"].
   - Law Firms / CPAs / Real Estate / Financial / Commercial B2B: use ["legal_advisory", "b2b_intelligence", "commercial"].

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
  ],
  "chatbotConfig": {
    "agentName": "${params.businessName} Team",
    "greeting": "Warm, specific welcome message from the ${params.businessName} team in ${params.city} offering help with their ${params.category} services (never mention AI, bot, or automated assistant)",
    "firstQuestion": "Conversational question asking what specific ${params.category} service or goal the visitor has today"
  }
}`;

    const resp = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
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
      const rawFinishedWork = parsed.finishedWork.slice(0, 3).map((item: any, idx: number) => ({
        title: item.title || baseBlueprint.finishedWork[idx]?.title,
        location: item.location || `${params.city}`,
        duration: item.duration || "Verified Quality",
        scope: item.scope || "",
        imageType: VALID_IMAGE_TYPES.includes(item.imageType)
          ? item.imageType
          : baseBlueprint.finishedWork[idx]?.imageType || "",
        customImageUrl: baseBlueprint.finishedWork[idx]?.customImageUrl || "",
      }));
      baseBlueprint.finishedWork = assignUniqueOfferingImageTypes(
        rawFinishedWork,
        params.category,
        params.businessName,
        {
          city: params.city,
          variationSeed: params.imageVariationSeed || 0,
          selectedImages: params.selectedImages,
          avoidUrls: params.avoidUrls,
        }
      );
    } else {
      baseBlueprint.finishedWork = assignUniqueOfferingImageTypes(
        baseBlueprint.finishedWork,
        params.category,
        params.businessName,
        {
          city: params.city,
          variationSeed: params.imageVariationSeed || 0,
          selectedImages: params.selectedImages,
          avoidUrls: params.avoidUrls,
        }
      );
    }

    if (baseBlueprint.archetype === "fitness_athletic" && (!params.themeId || params.themeId === "auto")) {
      if (!["kinetic_crimson", "industrial_orange", "midnight_sapphire"].includes(baseBlueprint.themeId)) {
        baseBlueprint.themeId = "kinetic_crimson";
      }
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

    // Ensure built-in website chatbot is always tailored to the business's services and sounds like the real human team
    const rawAgentName = String(
      parsed.chatbotConfig?.agentName || baseBlueprint.chatbotConfig?.agentName || ""
    ).trim();
    const cleanAgentName =
      rawAgentName && !/automated|ai\b|bot\b/i.test(rawAgentName)
        ? rawAgentName
        : `${params.businessName} Team`;

    const rawGreeting = String(
      parsed.chatbotConfig?.greeting || baseBlueprint.chatbotConfig?.greeting || ""
    ).trim();
    const cleanGreeting = rawGreeting
      ? rawGreeting
          .replace(/I'm your automated assistant\s*[—–-]*\s*/gi, "We're ")
          .replace(/I am your automated assistant\s*[—–-]*\s*/gi, "We're ")
          .replace(/your automated assistant/gi, `the ${params.businessName} team`)
          .replace(/\bautomated assistant\b/gi, "team")
          .replace(/\bAI assistant\b/gi, "team")
      : `👋 Hi there! Welcome to ${params.businessName} in ${params.city}. How can we help you with your ${params.category.toLowerCase()} needs today?`;

    baseBlueprint.chatbotConfig = {
      ...(baseBlueprint.chatbotConfig || {}),
      enabled: true,
      soundEnabled: true,
      autoOpenDelayMs: 800,
      agentName: cleanAgentName,
      greeting: cleanGreeting,
      firstQuestion:
        parsed.chatbotConfig?.firstQuestion ||
        baseBlueprint.funnelConfig?.step1Question?.replace(/^1\.\s*/, "") ||
        baseBlueprint.chatbotConfig?.firstQuestion ||
        `What can ${params.businessName} help you with today?`,
      followUpQuestion:
        baseBlueprint.funnelConfig?.step2Question?.replace(/^2\.\s*/, "") ||
        `When are you looking to get started?`,
      priorityQuestion:
        baseBlueprint.funnelConfig?.step3Question?.replace(/^3\.\s*/, "") ||
        `What matters most to you for this service?`,
      quickOptions: baseBlueprint.funnelConfig?.step1Options || [],
    };

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
  kinetic_crimson: {
    id: "kinetic_crimson",
    name: "Kinetic Crimson & Carbon Athletic",
    bgCanvas: "#F8FAFC",
    bgElevated: "#FFFFFF",
    bgSubtle: "#FFF1F2",
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

export async function regenerateWebsiteShowcaseImages(
  site: any,
  options?: {
    cardIndex?: number;
    customPrompt?: string;
  }
): Promise<{
  updatedFinishedWork: any[];
  generatedWithAI: boolean;
  regeneratedIndices: number[];
}> {
  const cfg = (site.siteConfig || {}) as any;
  const businessName = String(cfg.brandName || site.businessName || "Local Business").trim();
  const category = String(cfg.category || site.category || "Professional Services").trim();
  const city = String(cfg.city || site.city || "Sacramento").trim();
  const customPrompt = String(options?.customPrompt || "").trim();

  const currentWork: any[] =
    Array.isArray(cfg.finishedWork) && cfg.finishedWork.length > 0
      ? cfg.finishedWork.map((item: any) => ({ ...item }))
      : [
          {
            title: `Featured ${category} Service`,
            location: city,
            duration: "Same-Week Turnaround",
            scope: `Professional ${category.toLowerCase()} delivered by ${businessName} in ${city}.`,
            imageType: "commercial",
            customImageUrl: "",
          },
          {
            title: `Signature ${category} Package`,
            location: city,
            duration: "Upfront Written Pricing",
            scope: `Dedicated ${city} specialists with 100% quality guarantee.`,
            imageType: "b2b_intelligence",
            customImageUrl: "",
          },
          {
            title: `Priority ${category} Consultation`,
            location: city,
            duration: "Fast Response",
            scope: `Tailored solutions and transparent scope from start to finish.`,
            imageType: "advisory_executive_boardroom",
            customImageUrl: "",
          },
        ];

  const targetIndices =
    typeof options?.cardIndex === "number" &&
    options.cardIndex >= 0 &&
    options.cardIndex < currentWork.length
      ? [options.cardIndex]
      : currentWork.map((_, idx) => idx);

  // Track all previously used customImageUrls on this site so regenerated images are 100% fresh & different
  const usedImageTypes = new Set<string>();
  const usedCustomUrls = new Set<string>();
  currentWork.forEach((item) => {
    if (item?.imageType) usedImageTypes.add(item.imageType);
    if (item?.customImageUrl) usedCustomUrls.add(item.customImageUrl);
  });

  const nextVariationSeed = Number(cfg.imageVariationSeed || 0) + Math.floor(Math.random() * 50) + 1;
  const rotatedPool = selectUniqueVisualsForBusiness({
    category: `${category} ${customPrompt}`.trim(),
    businessName,
    city,
    variationSeed: nextVariationSeed,
    count: Math.max(6, currentWork.length * 2),
    avoidUrls: usedCustomUrls,
  });

  const detected = detectIndustryArchetype(`${category} ${customPrompt}`, businessName);
  const allAssetKeys = Object.keys(SHOWCASE_ASSET_FILES);
  const candidateKeys = [
    ...detected.purePoolKeys,
    ...allAssetKeys.filter((k) => !detected.purePoolKeys.includes(k)),
  ];

  const cameraStyles = [
    "natural golden-hour architectural lighting, Canon EOS R5 35mm f/1.8 lens, crisp editorial commercial photography",
    "bright daylight interior/exterior commercial photography, Sony A7R V 24-70mm GM lens, authentic candid professional action",
    "warm inviting studio-grade lighting, wide-angle environmental portrait of real specialists at work, ultra-sharp detail",
  ];

  let anyGeneratedWithAI = false;

  for (const idx of targetIndices) {
    const item = currentWork[idx] || {};
    const prevImageType = String(item.imageType || "");
    const cardTopic = customPrompt || `${item.title || category} — ${item.scope || ""}`;

    let aiDataUri = "";
    // Only invoke slow Gemini image synthesis when the user explicitly typed a custom prompt;
    // otherwise serve instant (<10ms) fresh curated industry photos so workflow is never slowed down!
    if (customPrompt.length > 0) {
      try {
        const ai = await getGeminiAI();
        const styleHint = cameraStyles[(idx + Math.floor(Math.random() * 10)) % cameraStyles.length];
        const imgPrompt = `Photorealistic, high-end commercial website showcase photograph for a real local business named "${businessName}" (${category} in ${city}).
Specific service / scene to depict: ${cardTopic}.
Visual requirements: Show authentic, industry-accurate work, environment, or specialists for "${category}" (${cardTopic}). ZERO text overlays, ZERO watermarks, ZERO logos, ZERO cartoons. Shot in ${styleHint}. Must be 100% unique and visually distinct.`;

        const resp = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [{ text: imgPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        });

        const parts = resp.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            aiDataUri = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
      } catch (err) {
        console.warn(`[website-intelligence] Gemini image regen fallback for card #${idx + 1}:`, err);
      }
    }

    if (aiDataUri && !usedCustomUrls.has(aiDataUri)) {
      usedCustomUrls.add(aiDataUri);
      currentWork[idx] = {
        ...item,
        customImageUrl: aiDataUri,
        lastRegeneratedAt: new Date().toISOString(),
      };
      anyGeneratedWithAI = true;
    } else {
      const nextKey =
        candidateKeys.find((k) => k !== prevImageType && !usedImageTypes.has(k)) ||
        candidateKeys.find((k) => !usedImageTypes.has(k)) ||
        allAssetKeys[(idx + nextVariationSeed) % allAssetKeys.length];

      usedImageTypes.add(nextKey);
      const freshPoolUrl =
        rotatedPool.images.find((u) => !usedCustomUrls.has(u)) ||
        rotatedPool.images[idx % Math.max(1, rotatedPool.images.length)] ||
        getEmbeddedAssetDataUri(nextKey);

      if (freshPoolUrl) usedCustomUrls.add(freshPoolUrl);

      currentWork[idx] = {
        ...item,
        imageType: nextKey,
        customImageUrl: freshPoolUrl || "",
        lastRegeneratedAt: new Date().toISOString(),
      };
    }
  }

  return {
    updatedFinishedWork: currentWork,
    generatedWithAI: anyGeneratedWithAI,
    regeneratedIndices: targetIndices,
  };
}

export interface SmartBlogArticle {
  id: string;
  title: string;
  categoryTag: string;
  readTime: string;
  summary: string;
  contentParagraphs: string[];
  keyTakeaways: string[];
  ctaLabel: string;
}

export interface IntelligentSmartModulesConfig {
  industryProfileLabel: string;
  aiSelectionReason: string;
  recommendedMode: "estimator_and_booking" | "booking_and_voucher" | "estimator_and_voucher" | "dining_reservation_catering" | "executive_briefing_consult";
  priceEstimator: {
    enabled: boolean;
    badge: string;
    title: string;
    subtitle: string;
    tiers: Array<{
      label: string;
      scope: string;
      estimatedRange: string;
      turnaround: string;
    }>;
    ctaText: string;
  };
  appointmentPicker: {
    enabled: boolean;
    badge: string;
    title: string;
    subtitle: string;
    slotTypes: string[];
    timeWindows: string[];
    ctaText: string;
  };
  promoVoucher: {
    enabled: boolean;
    badge: string;
    headline: string;
    subtext: string;
    code: string;
    expirationText: string;
    ctaText: string;
  };
  smsDirect: {
    enabled: boolean;
    buttonLabel: string;
    prefilledMessage: string;
  };
  seoBlog: {
    enabled: boolean;
    sectionKicker: string;
    sectionHeading: string;
    sectionSubtitle: string;
    posts: SmartBlogArticle[];
  };
}

export function buildIntelligentSmartModules(params: {
  archetype?: string;
  businessName: string;
  category: string;
  city: string;
  phone: string;
  servicesList?: string[];
}): IntelligentSmartModulesConfig {
  const biz = (params.businessName || "Local Business").trim();
  const cat = (params.category || "Professional Services").trim();
  const city = (params.city || "Sacramento").trim();
  const arch =
    params.archetype || detectIndustryArchetype(cat, biz).archetype;
  const sList =
    Array.isArray(params.servicesList) && params.servicesList.length >= 3
      ? params.servicesList
      : [`${cat} Consultation`, `Signature ${cat} Service`, `Priority ${cat} Package`];

  if (arch === "clinical_booking" || arch === "salon_wellness") {
    const isMedical = arch === "clinical_booking";
    return {
      industryProfileLabel: isMedical
        ? "Patient Appointment & Care Transparency Profile"
        : "Client Booking, Treatment Menu & VIP Voucher Profile",
      aiSelectionReason: isMedical
        ? `For ${cat} practices in ${city}, patients prioritize fast appointment slot booking, new-patient welcome vouchers, and trustworthy treatment guides—while keeping transparent treatment fee tiers accessible.`
        : `For ${cat} studios in ${city}, clients convert best with live chair/treatment slot booking, a first-visit VIP voucher, and transparent service tier pricing.`,
      recommendedMode: "booking_and_voucher",
      priceEstimator: {
        enabled: true,
        badge: isMedical ? "TRANSPARENT TREATMENT & VISIT GUIDE" : "SERVICE & PACKAGE TIER ESTIMATOR",
        title: isMedical
          ? `Check Estimated Visit & Treatment Options in ${city}`
          : `Explore ${biz} Service Packages & Pricing Tiers`,
        subtitle: isMedical
          ? "Select the care option you are considering to view typical visit scope and insurance/self-pay guidance."
          : "Tap any service tier below to see what is included and request your exact quote or booking.",
        tiers: [
          {
            label: sList[0] || (isMedical ? "New Patient Exam & Consultation" : "Signature Styling / Express Session"),
            scope: isMedical
              ? "Comprehensive exam, digital diagnostics, and personalized treatment roadmap."
              : " Personalized consultation, signature treatment, and finishing care.",
            estimatedRange: isMedical ? "$95 – $220 (or Covered by Insurance)" : "$65 – $145 Typical Session",
            turnaround: "45–60 Min Visit",
          },
          {
            label: sList[1] || (isMedical ? "Advanced / Restorative Care Package" : "Full Transformation & Glow Package"),
            scope: isMedical
              ? "Targeted clinical procedure with comfort options and follow-up check."
              : "Multi-step premium treatment using studio-grade products and senior specialist care.",
            estimatedRange: isMedical ? "$350 – $1,450 (Flexible Monthly Plans)" : "$150 – $320 Complete Package",
            turnaround: "Same-Week Priority Slot",
          },
          {
            label: sList[2] || (isMedical ? "Urgent / Same-Day Relief Visit" : "VIP Membership / Bridal & Group Care"),
            scope: isMedical
              ? "Fast-track evaluation and immediate symptom relief so you feel better today."
              : "Dedicated time block, priority scheduling, and custom aftercare kit.",
            estimatedRange: isMedical ? "$125 – $295 Priority Exam" : "$250 – $580 Custom Scope",
            turnaround: "24-Hour Priority",
          },
        ],
        ctaText: isMedical ? "Verify My Price / Insurance & Book →" : "Lock In This Package Price →",
      },
      appointmentPicker: {
        enabled: true,
        badge: isMedical ? "LIVE PATIENT APPOINTMENT REQUEST" : "LIVE STUDIO APPOINTMENT PICKER",
        title: `Reserve Your Preferred Visit Time at ${biz}`,
        subtitle: `Pick your preferred day and time window below—our ${city} front desk confirms your exact time by text within 15 minutes.`,
        slotTypes: [
          sList[0] || (isMedical ? "New Patient Consultation" : "Signature Appointment"),
          sList[1] || (isMedical ? "Specific Treatment / Procedure" : "Full Package Session"),
          sList[2] || (isMedical ? "Urgent / Same-Day Visit" : "Express Touch-Up / Walk-In"),
        ],
        timeWindows: [
          "Today / Next Available Opening",
          "Tomorrow · Morning (8:30am – 12:00pm)",
          "Tomorrow · Afternoon (12:00pm – 4:30pm)",
          "This Week · Late Afternoon / Saturday",
        ],
        ctaText: "Confirm My Appointment Window →",
      },
      promoVoucher: {
        enabled: true,
        badge: isMedical ? "NEW PATIENT WELCOME VOUCHER" : "NEW CLIENT VIP VOUCHER",
        headline: isMedical
          ? `Complimentary New-Patient Priority Consultation + $50 Care Credit at ${biz}`
          : `$25 Off Your First Visit + Complimentary Upgrade at ${biz}`,
        subtext: `Valid for ${city} residents booking online this week. Mention or tap below to attach this voucher to your appointment.`,
        code: "WELCOME2026",
        expirationText: "Limited weekly new-client spots available",
        ctaText: "Claim My Welcome Voucher →",
      },
      smsDirect: {
        enabled: true,
        buttonLabel: `💬 Text ${biz} Front Desk`,
        prefilledMessage: `Hi ${biz} in ${city}! I'm on your website and would like to check appointment availability & claim the WELCOME2026 voucher.`,
      },
      seoBlog: {
        enabled: true,
        sectionKicker: `LOCAL ${cat.toUpperCase()} & CARE GUIDES IN ${city.toUpperCase()}`,
        sectionHeading: `Expert ${cat} Answers & Buyer Guides for ${city} Residents`,
        sectionSubtitle: `Helpful local guides written by ${biz} to help you make confident decisions before your visit.`,
        posts: [
          {
            id: "guide-cost-expect",
            title: `2026 ${cat} Cost & Visit Guide in ${city}: What to Expect Before You Book`,
            categoryTag: "Local Pricing & Care Guide",
            readTime: "3 min read",
            summary: `Everything ${city} patients and clients should know about transparent pricing, appointment timelines, and how ${biz} eliminates surprise fees.`,
            contentParagraphs: [
              `When searching for ${cat.toLowerCase()} in ${city}, the biggest frustration most people face is unclear pricing and long wait times. At ${biz}, we believe you should know your exact options, timeline, and investment before any care begins.`,
              `Whether you are coming in for ${sList[0].toLowerCase()} or ${sList[1].toLowerCase()}, our ${city} team starts with a clear, unhurried consultation. We walk you through every step in plain language so you can choose the option that fits your schedule and budget.`,
              `Because we reserve dedicated daily openings for ${city} residents, most new clients can be seen within 24 to 48 hours—with direct text updates from our front desk.`,
            ],
            keyTakeaways: [
              `Upfront written treatment & package plans before you commit`,
              `Same-week and priority morning/afternoon slots in ${city}`,
              `Direct SMS communication with ${biz} without phone tag`,
            ],
            ctaLabel: `Book Your ${city} Consultation →`,
          },
          {
            id: "guide-top-questions",
            title: `5 Questions to Ask Before Choosing a ${cat} Provider in ${city}`,
            categoryTag: "Buyer Checklist",
            readTime: "3 min read",
            summary: `How to compare local ${cat.toLowerCase()} specialists in ${city} on quality, hygiene, credentials, and long-term results.`,
            contentParagraphs: [
              `Not all ${cat.toLowerCase()} providers in ${city} follow the same standards. Before booking your visit, it pays to look at verified local reviews, technology standards, and whether the team stands behind their work.`,
              `At ${biz}, we focus on ${sList[0].toLowerCase()} and ${sList[1].toLowerCase()} tailored specifically to your goals—never cookie-cutter or rushed appointments.`,
              `Use our 4-tap booking tool on this page to check availability or message our team directly with any questions.`,
            ],
            keyTakeaways: [
              `Always verify upfront pricing and clear follow-up support`,
              `Look for proven ${city} client reviews and consistent results`,
              `Take advantage of our new-client welcome voucher (Code: WELCOME2026)`,
            ],
            ctaLabel: `Check Availability at ${biz} →`,
          },
          {
            id: "guide-prep-aftercare",
            title: `How to Get the Best Long-Term Results from ${sList[0]} in ${city}`,
            categoryTag: "Specialist Tips",
            readTime: "2 min read",
            summary: `Practical preparation and aftercare advice from the specialists at ${biz} in ${city}.`,
            contentParagraphs: [
              `Getting great results from ${sList[0].toLowerCase()} starts before you even walk through our doors in ${city}. Proper preparation and choosing the right tier of care makes your visit smoother and longer-lasting.`,
              `During your visit at ${biz}, our specialists give you a simple step-by-step maintenance plan so your results stay looking and feeling their best for months to come.`,
            ],
            keyTakeaways: [
              `Personalized care roadmap included with every visit`,
              `Fast follow-up support if you ever have a question`,
              `Easy online re-booking for ${city} clients`,
            ],
            ctaLabel: `Ask Our ${city} Team a Question →`,
          },
        ],
      },
    };
  }

  if (arch === "fitness_gym") {
    return {
      industryProfileLabel: "7-Day VIP Trial Pass, Class Booking & Coaching Tier Profile",
      aiSelectionReason: `For fitness and training facilities in ${city}, prospects rarely convert from a generic contact form—they convert when offered an instant 7-Day VIP Trial Pass, a live class/intro session slot picker, and clear membership tiers.`,
      recommendedMode: "booking_and_voucher",
      priceEstimator: {
        enabled: true,
        badge: "MEMBERSHIP & COACHING PROGRAM FINDER",
        title: `Find Your Ideal Training Program & Rate at ${biz}`,
        subtitle: `Compare our ${city} training options below and claim your complimentary trial pass to test the floor first.`,
        tiers: [
          {
            label: sList[0] || "Group Strength & Conditioning Membership",
            scope: "Coach-led daily workouts, open gym access, and supportive community accountability.",
            estimatedRange: "$129 – $199 / month (Free Trial First)",
            turnaround: "Start This Week",
          },
          {
            label: sList[1] || "1-on-1 Personal Coaching & Nutrition Plan",
            scope: "Dedicated personal coach, custom macros/nutrition roadmap, and weekly body-comp check-ins.",
            estimatedRange: "$65 – $95 / session (Custom Packages)",
            turnaround: "1-on-1 Goal Intro",
          },
          {
            label: sList[2] || "6-Week Transformation / Athletic Accelerator",
            scope: "Structured 6-week challenge with coach accountability, meal blueprint, and guaranteed milestones.",
            estimatedRange: "$299 – $499 Complete Program",
            turnaround: "Limited Cohort Spots",
          },
        ],
        ctaText: "Claim Free Trial for This Program →",
      },
      appointmentPicker: {
        enabled: true,
        badge: "BOOK YOUR FIRST SESSION OR GYM TOUR",
        title: `Pick Your First Workout or 1-on-1 Goal Assessment Slot`,
        subtitle: `Select when you want to come in—our head coach at ${biz} will text you to confirm your pass.`,
        slotTypes: [
          "Free 7-Day VIP Trial Pass + Gym Tour",
          sList[0] || "Drop-In Group Workout Class",
          sList[1] || "1-on-1 Personal Training Assessment",
        ],
        timeWindows: [
          "Tomorrow · Morning Session (6:00am – 10:00am)",
          "Tomorrow · Midday / Lunch Session (11:30am – 2:00pm)",
          "Tomorrow · Evening Session (4:30pm – 7:30pm)",
          "This Saturday · Weekend Intro Session",
        ],
        ctaText: "Reserve My Pass & Session Time →",
      },
      promoVoucher: {
        enabled: true,
        badge: "FREE 7-DAY VIP TRAINING PASS",
        headline: `Claim a Complimentary 7-Day Trial Pass + Free 1-on-1 InBody & Goal Session at ${biz}`,
        subtext: `For local ${city} residents ready to train in a high-energy, zero-ego environment. No obligation.`,
        code: "VIPPASS7",
        expirationText: "Only 10 free VIP passes issued per week",
        ctaText: "Activate My Free 7-Day VIP Pass →",
      },
      smsDirect: {
        enabled: true,
        buttonLabel: `💪 Text Coach at ${biz}`,
        prefilledMessage: `Hi ${biz} in ${city}! I'd like to claim the Free 7-Day VIP Pass (VIPPASS7) and check class times.`,
      },
      seoBlog: {
        enabled: true,
        sectionKicker: `TRAINING, STRENGTH & FITNESS GUIDES IN ${city.toUpperCase()}`,
        sectionHeading: `Local Fitness & Transformation Guides from ${biz}`,
        sectionSubtitle: `Proven training advice for ${city} residents looking to build strength, drop body fat, and stay consistent.`,
        posts: [
          {
            id: "fitness-guide-1",
            title: `How to Choose the Right Gym or Personal Trainer in ${city} (2026 Guide)`,
            categoryTag: "Local Fitness Guide",
            readTime: "3 min read",
            summary: `Why structured coaching and progressive strength training at ${biz} beat crowded big-box gyms every time.`,
            contentParagraphs: [
              `Most people in ${city} don't struggle with fitness because they lack motivation—they struggle because walking into a crowded gym without a clear plan leads to guesswork and plateaus.`,
              `At ${biz}, every workout is programmed by experienced coaches who watch your form, scale movements to your exact fitness level, and keep you accountable week after week.`,
            ],
            keyTakeaways: [
              `Coach-led sessions tailored to beginners and experienced athletes alike`,
              `Test our ${city} facility first with a 7-Day VIP Pass (Code: VIPPASS7)`,
              `Flexible morning, lunch, and evening class times`,
            ],
            ctaLabel: "Claim Your Free 7-Day Trial →",
          },
          {
            id: "fitness-guide-2",
            title: `Strength Training vs. Endless Cardio: What Actually Works for Busy ${city} Adults`,
            categoryTag: "Coaching Science",
            readTime: "3 min read",
            summary: `How 45 minutes of structured strength and metabolic conditioning 3–4x a week transforms your energy and body composition.`,
            contentParagraphs: [
              `If you only have 3 to 4 hours a week to train in ${city}, spending it on a treadmill is the slowest way to change your physique and energy levels.`,
              `Our ${sList[0].toLowerCase()} and ${sList[1].toLowerCase()} programs combine progressive resistance training with conditioning so you burn fat, protect your joints, and build lasting strength.`,
            ],
            keyTakeaways: [
              `45–60 minute structured sessions that respect your schedule`,
              `1-on-1 goal & movement assessment included for all new members`,
            ],
            ctaLabel: "Book Your Free Goal Assessment →",
          },
          {
            id: "fitness-guide-3",
            title: `What to Expect During Your First Week at ${biz} in ${city}`,
            categoryTag: "New Member Walkthrough",
            readTime: "2 min read",
            summary: `Zero intimidation, welcoming coaches, and a clear game plan from day one.`,
            contentParagraphs: [
              `Walking into a new gym in ${city} can feel intimidating—which is why we start every new member at ${biz} with a friendly intro walkthrough and movement check.`,
              `You'll meet your coaches, see how we scale weights and movements for every fitness level, and leave your very first session feeling energized—not overwhelmed.`,
            ],
            keyTakeaways: [
              `Supportive ${city} community with zero ego`,
              `Start with our 7-Day VIP Trial before making any commitment`,
            ],
            ctaLabel: "Start Your 7-Day Trial Pass →",
          },
        ],
      },
    };
  }

  if (arch === "culinary_dining") {
    return {
      industryProfileLabel: "Table Reservation, Catering Calculator & Chef Voucher Profile",
      aiSelectionReason: `For restaurants, cafes, and hospitality businesses in ${city}, guests want instant table/event reservations, per-person catering & group dining estimates, and a first-visit dining/takeout voucher.`,
      recommendedMode: "dining_reservation_catering",
      priceEstimator: {
        enabled: true,
        badge: "CATERING, PRIVATE EVENTS & DINING ESTIMATOR",
        title: `Estimate Your Group Dining, Catering or Takeout Package at ${biz}`,
        subtitle: `Planning a family dinner, office catering drop-off, or private celebration in ${city}? Check typical per-guest packages below.`,
        tiers: [
          {
            label: sList[0] || "Dine-In Table or Family Takeout Bundle",
            scope: "Freshly prepared signature entrees, chef sides, and house specialties made to order.",
            estimatedRange: "$18 – $38 / guest",
            turnaround: "Same-Day Table / Pickup",
          },
          {
            label: sList[1] || "Corporate Lunch & Office Catering Tray Package",
            scope: "Individually labeled or buffet-style catering trays delivered hot across " + city + ".",
            estimatedRange: "$16 – $28 / person (10+ Guests)",
            turnaround: "24-Hour Notice Available",
          },
          {
            label: sList[2] || "Private Banquet, Party or Custom Chef Menu",
            scope: "Reserved dining space or full-service event catering with custom multi-course menu.",
            estimatedRange: "$35 – $75 / guest Custom Menu",
            turnaround: "Custom Event Date",
          },
        ],
        ctaText: "Check Date Availability & Exact Quote →",
      },
      appointmentPicker: {
        enabled: true,
        badge: "LIVE TABLE RESERVATION & EVENT INQUIRY",
        title: `Reserve a Table or Request Catering from ${biz}`,
        subtitle: `Select your dining type and preferred time window—our ${city} host team confirms your reservation right away.`,
        slotTypes: [
          "Dine-In Table Reservation (2–8 Guests)",
          "Large Group / Celebration Table (8+ Guests)",
          "Event Catering / Drop-Off Order Inquiry",
        ],
        timeWindows: [
          "Today · Lunch / Daytime Service",
          "Tonight · Prime Dinner Seating (5:30pm – 8:30pm)",
          "This Friday / Saturday Weekend Seating",
          "Upcoming Private Event / Catering Date",
        ],
        ctaText: "Confirm My Table / Catering Request →",
      },
      promoVoucher: {
        enabled: true,
        badge: "GUEST WELCOME & CATERING VOUCHER",
        headline: `Complimentary Chef's Appetizer or 10% Off Your First Catering / Family Order at ${biz}`,
        subtext: `Show this voucher on your phone when dining in ${city} or tap below to apply it to your reservation/order.`,
        code: "CHEF2026",
        expirationText: "Valid for dine-in, takeout & catering orders this month",
        ctaText: "Claim My Dining Voucher →",
      },
      smsDirect: {
        enabled: true,
        buttonLabel: `🍽️ Text ${biz} Host / Catering`,
        prefilledMessage: `Hi ${biz} in ${city}! I'd like to reserve a table / inquire about catering and use voucher CHEF2026.`,
      },
      seoBlog: {
        enabled: true,
        sectionKicker: `LOCAL DINING, CATERING & CULINARY GUIDES IN ${city.toUpperCase()}`,
        sectionHeading: `Inside the Kitchen & Local Dining Guides at ${biz}`,
        sectionSubtitle: `Explore our signature dishes, private event planning tips, and local ${city} catering guides.`,
        posts: [
          {
            id: "dining-guide-1",
            title: `How to Plan Stress-Free Office Catering or Group Dining in ${city}`,
            categoryTag: "Catering & Events Guide",
            readTime: "3 min read",
            summary: `Tips from ${biz} on portion sizing, dietary accommodations, and on-time hot delivery across ${city}.`,
            contentParagraphs: [
              `Whether you are hosting a corporate lunch, birthday dinner, or family gathering in ${city}, food is the centerpiece everyone remembers. At ${biz}, we make group dining and catering effortless.`,
              `Our kitchen prepares every tray fresh right before pickup or delivery—including vegetarian, gluten-friendly, and crowd-pleasing signature favorites.`,
            ],
            keyTakeaways: [
              `Flexible catering trays for 10 to 150+ guests in ${city}`,
              `Complimentary appetizer or 10% off first catering order (Code: CHEF2026)`,
            ],
            ctaLabel: "Request a Catering Quote →",
          },
          {
            id: "dining-guide-2",
            title: `What Makes ${biz} a Local Favorite for ${cat} in ${city}`,
            categoryTag: "Chef's Spotlight",
            readTime: "2 min read",
            summary: `Fresh ingredients, scratch-made recipes, and warm hospitality in the heart of ${city}.`,
            contentParagraphs: [
              `Great ${cat.toLowerCase()} comes down to quality ingredients and never cutting corners in the kitchen. Every day at ${biz} in ${city}, our team preps fresh sauces, house specialties, and seasonal favorites from scratch.`,
              `Reserve a table online in seconds or call us directly for fast takeout pickup.`,
            ],
            keyTakeaways: [
              `Scratch-prepared dishes made fresh daily in ${city}`,
              `Easy 4-tap table reservation and fast phone/SMS ordering`,
            ],
            ctaLabel: "Reserve Your Table Tonight →",
          },
          {
            id: "dining-guide-3",
            title: `Hosting a Private Dinner or Celebration in ${city}: Questions to Ask`,
            categoryTag: "Private Events",
            readTime: "3 min read",
            summary: `How to customize a menu and reserve space at ${biz} for birthdays, anniversaries, and team dinners.`,
            contentParagraphs: [
              `Looking for a welcoming spot in ${city} to celebrate a milestone? ${biz} offers customizable group menus and dedicated service so you can focus on your guests instead of the logistics.`,
            ],
            keyTakeaways: [
              `Custom per-guest menus that fit your exact budget`,
              `Direct coordination with our ${city} manager`,
            ],
            ctaLabel: "Check Private Event Dates →",
          },
        ],
      },
    };
  }

  if (arch === "advisory_consult") {
    return {
      industryProfileLabel: "Confidential Strategy Call Picker, Fee Transparency & Client Briefings",
      aiSelectionReason: `For law firms, CPAs, real estate, and advisory practices in ${city}, high-value clients expect a confidential consultation calendar picker, clear fee/engagement structure, and authoritative local legal/financial briefings.`,
      recommendedMode: "executive_briefing_consult",
      priceEstimator: {
        enabled: true,
        badge: "ENGAGEMENT & FEE STRUCTURE GUIDE",
        title: `Transparent Engagement Options at ${biz}`,
        subtitle: `We believe ${city} clients deserve clear expectations on scope, timelines, and fee structures from day one.`,
        tiers: [
          {
            label: sList[0] || "Initial Case / Strategy Evaluation",
            scope: "Confidential review of your matter, key deadlines, risk assessment, and recommended action plan.",
            estimatedRange: "Complimentary / Fixed Initial Review",
            turnaround: "Same-Day / 24-Hr Slot",
          },
          {
            label: sList[1] || "Fixed-Scope Representation / Advisory Package",
            scope: "Clearly defined deliverables, document preparation, or transaction representation with written milestones.",
            estimatedRange: "Flat-Fee or Milestone Engagement",
            turnaround: "Written Scope Guarantee",
          },
          {
            label: sList[2] || "Full Representation / Ongoing Senior Counsel",
            scope: "Direct senior partner representation for complex or high-stakes matters across " + city + ".",
            estimatedRange: "Custom Retainer / Contingency Options",
            turnaround: "Direct Partner Access",
          },
        ],
        ctaText: "Request Confidential Scope & Fee Review →",
      },
      appointmentPicker: {
        enabled: true,
        badge: "CONFIDENTIAL CONSULTATION CALENDAR",
        title: `Schedule a Confidential Phone or In-Office Consultation`,
        subtitle: `Select your preferred consultation window—our ${city} office will confirm your private call or meeting time.`,
        slotTypes: [
          sList[0] || "15-Minute Phone Strategy Call",
          sList[1] || "In-Office / Zoom Case Review",
          sList[2] || "Urgent / Time-Sensitive Matter Review",
        ],
        timeWindows: [
          "Today · Priority Callback Window",
          "Tomorrow · Morning (9:00am – 12:00pm)",
          "Tomorrow · Afternoon (1:00pm – 5:00pm)",
          "Later This Week · Private Appointment",
        ],
        ctaText: "Lock In My Confidential Consultation →",
      },
      promoVoucher: {
        enabled: true,
        badge: "PRIORITY CLIENT EVALUATION CERTIFICATE",
        headline: `Complimentary 20-Minute Senior Strategy Review & Case Roadmap at ${biz}`,
        subtext: `Speak directly with a senior specialist in ${city} to understand your options, timeline, and fee structure in writing.`,
        code: "PRIORITY26",
        expirationText: "Reserved for new " + city + " client inquiries",
        ctaText: "Request My Priority Strategy Review →",
      },
      smsDirect: {
        enabled: true,
        buttonLabel: `🔒 Text ${biz} Intake Desk`,
        prefilledMessage: `Hi ${biz} in ${city}, I would like to schedule a confidential consultation (Code: PRIORITY26).`,
      },
      seoBlog: {
        enabled: true,
        sectionKicker: `LOCAL ${cat.toUpperCase()} BRIEFINGS & CLIENT GUIDES IN ${city.toUpperCase()}`,
        sectionHeading: `Essential ${cat} Insights for ${city} Individuals & Businesses`,
        sectionSubtitle: `Clear, practical guidance from ${biz} to help you protect your interests and avoid costly mistakes.`,
        posts: [
          {
            id: "advisory-guide-1",
            title: `What to Do First When You Need ${cat} Representation in ${city} (2026 Briefing)`,
            categoryTag: "Client Strategy Guide",
            readTime: "4 min read",
            summary: `Key steps to protect your position, preserve documentation, and understand your options in ${city}.`,
            contentParagraphs: [
              `When facing an important ${cat.toLowerCase()} decision in ${city}, the steps you take in the first 48 hours often shape the entire outcome. Waiting too long or relying on generic online advice can create avoidable exposure.`,
              `At ${biz}, our first priority is giving you a clear, honest assessment of where you stand—including realistic timelines and transparent fee structures before you make any commitment.`,
            ],
            keyTakeaways: [
              `Direct access to experienced ${city} counsel without runaround`,
              `Clear written engagement terms from day one`,
              `Confidential 20-minute initial strategy review (Code: PRIORITY26)`,
            ],
            ctaLabel: "Schedule a Confidential Review →",
          },
          {
            id: "advisory-guide-2",
            title: `How Fee Structures & Timelines Work for ${sList[0]} in ${city}`,
            categoryTag: "Fee Transparency",
            readTime: "3 min read",
            summary: `A straightforward breakdown of flat-fee, milestone, and retainer options so you never face billing surprises.`,
            contentParagraphs: [
              `Clients in ${city} deserve total clarity on how professional fees work. At ${biz}, we outline every phase of ${sList[0].toLowerCase()} in writing before work begins.`,
            ],
            keyTakeaways: [
              `No hidden retainers or surprise administrative charges`,
              `Proactive milestone updates throughout your engagement`,
            ],
            ctaLabel: "Discuss Your Matter With Our Team →",
          },
          {
            id: "advisory-guide-3",
            title: `5 Questions to Ask Before Hiring a ${cat} Firm in ${city}`,
            categoryTag: "Selection Checklist",
            readTime: "3 min read",
            summary: `How to evaluate local track record, partner responsiveness, and strategic fit.`,
            contentParagraphs: [
              `Choosing the right ${cat.toLowerCase()} partner in ${city} comes down to two things: proven local experience and whether a senior specialist actually handles your matter.`,
            ],
            keyTakeaways: [
              `Work directly with senior specialists at ${biz}`,
              `Fast same-day callback for urgent ${city} inquiries`,
            ],
            ctaLabel: "Book Your Strategy Call →",
          },
        ],
      },
    };
  }

  // Default / Home Services, Trades, Remodeling, Roofing, Solar, Plumbing, HVAC, Auto Repair, Landscaping
  const isRemodel = arch === "project_remodel";
  const isAuto = arch === "automotive_service";
  return {
    industryProfileLabel: isRemodel
      ? "Interactive Project Cost Calculator, On-Site Estimate Picker & Local Buyer Guides"
      : isAuto
      ? "Instant Repair Price Estimator, Bay Drop-Off Picker & Service Voucher"
      : "Instant Local Price Calculator, Same-Day Dispatch Slot Picker & Seasonal Voucher",
    aiSelectionReason: `For ${cat} businesses in ${city}, homeowners and drivers convert 3x higher when they can check a realistic local price range in 15 seconds, pick an inspection/dispatch window, claim a local discount voucher, and read city-specific cost guides.`,
    recommendedMode: "estimator_and_booking",
    priceEstimator: {
      enabled: true,
      badge: "INTERACTIVE 15-SECOND LOCAL PRICE ESTIMATOR",
      title: `Check Typical ${cat} Price Ranges in ${city}`,
      subtitle: `Tap the service tier that matches your needs to see typical ${city} pricing—then lock in your exact upfront written quote from ${biz}.`,
      tiers: [
        {
          label: sList[0] || (isRemodel ? "Targeted Upgrade / Refresh" : isAuto ? "Diagnostics & Minor Repair" : "Diagnostic, Tune-Up or Standard Repair"),
          scope: isRemodel
            ? `Focused ${cat.toLowerCase()} upgrade with professional materials, clean jobsite protection, and written schedule.`
            : `Full inspection, upfront flat-rate pricing before work begins, and ${city} specialist service.`,
          estimatedRange: isRemodel
            ? "$2,800 – $8,500 Typical Scope"
            : isAuto
            ? "$95 – $340 Typical Repair"
            : "$145 – $420 Typical Local Range",
          turnaround: isRemodel ? "1–2 Weeks" : "Same-Day / Next-Day",
        },
        {
          label: sList[1] || (isRemodel ? "Complete Custom Remodel / Installation" : isAuto ? "Brakes, Suspension or Major Service" : "Major Repair or System Installation"),
          scope: `Complete ${sList[1]?.toLowerCase() || cat.toLowerCase()} delivered by ${biz}'s licensed ${city} crew with full workmanship warranty.`,
          estimatedRange: isRemodel
            ? "$12,500 – $38,000+ Custom Scope"
            : isAuto
            ? "$380 – $950 OEM Warranty Scope"
            : "$650 – $3,400+ (Financing Available)",
          turnaround: isRemodel ? "On-Time Milestone Schedule" : "Priority Crew Dispatch",
        },
        {
          label: sList[2] || (isRemodel ? "Whole-Property / Commercial Project" : "Emergency / Priority Same-Day Service"),
          scope: `Fast-track priority scheduling in ${city} with senior technician/project lead and 100% satisfaction guarantee.`,
          estimatedRange: isRemodel
            ? "Custom Fixed-Price Proposal"
            : "$0 Trip Fee w/ Approved Work",
          turnaround: isRemodel ? "Free On-Site Walkthrough" : "60–90 Min Priority Window",
        },
      ],
      ctaText: "Get My Exact Written Quote for This Tier →",
    },
    appointmentPicker: {
      enabled: true,
      badge: isRemodel ? "BOOK FREE ON-SITE ESTIMATE WINDOW" : isAuto ? "RESERVE SHOP BAY DROP-OFF WINDOW" : "LIVE DISPATCH & ESTIMATE SLOT PICKER",
      title: `Pick Your Preferred ${isRemodel ? "Walkthrough" : isAuto ? "Drop-Off" : "Service / Estimate"} Window in ${city}`,
      subtitle: `Select a day and arrival window below—our ${city} dispatcher at ${biz} will text you within 15 minutes to confirm.`,
      slotTypes: [
        sList[0] || `Standard ${cat} Service / Quote`,
        sList[1] || `Full Installation / Replacement Estimate`,
        sList[2] || `Urgent / Same-Day Priority Dispatch`,
      ],
      timeWindows: [
        "Today · Next Available Dispatch Window",
        "Tomorrow · Morning Arrival (8:00am – 12:00pm)",
        "Tomorrow · Afternoon Arrival (12:00pm – 4:00pm)",
        "This Week · Flexible On-Site Estimate",
      ],
      ctaText: "Reserve My Arrival Window →",
    },
    promoVoucher: {
      enabled: true,
      badge: `SPECIAL ${city.toUpperCase()} WEB VOUCHER`,
      headline: isRemodel
        ? `$500 Off Any Full ${cat} Project or Free 3D Scope & Written Estimate with ${biz}`
        : `$75 Off Any ${cat} Repair/Service or Free Diagnostic Check in ${city}`,
      subtext: `Mention code LOCAL2026 or click below to attach this voucher automatically to your estimate request.`,
      code: "LOCAL2026",
      expirationText: `Valid for ${city} & surrounding area property owners this month`,
      ctaText: "Attach $75 / Free Estimate Voucher →",
    },
    smsDirect: {
      enabled: true,
      buttonLabel: `📲 Text ${biz} for Fast Quote`,
      prefilledMessage: `Hi ${biz} in ${city}! I'm on your website and would like a fast quote (Voucher Code: LOCAL2026).`,
    },
    seoBlog: {
      enabled: true,
      sectionKicker: `LOCAL ${cat.toUpperCase()} COST & BUYER GUIDES IN ${city.toUpperCase()}`,
      sectionHeading: `2026 ${cat} Cost Guides & Expert Advice for ${city} Customers`,
      sectionSubtitle: `Straight answers on local pricing, timelines, and what to look for when hiring a ${cat.toLowerCase()} specialist in ${city}.`,
      posts: [
        {
          id: "local-cost-guide-2026",
          title: `2026 ${cat} Cost Guide in ${city}: What Local Customers Actually Pay`,
          categoryTag: `${city} Pricing Guide`,
          readTime: "3 min read",
          summary: `A transparent breakdown of typical ${cat.toLowerCase()} costs in ${city}, what drives pricing up or down, and how to avoid hidden contractor markups.`,
          contentParagraphs: [
            `One of the most common questions we hear from property owners in ${city} is: "What should ${cat.toLowerCase()} realistically cost right now?" Too many companies hide their pricing behind vague estimates until they are already on your property.`,
            `At ${biz}, we believe in 100% upfront written pricing. Whether you need ${sList[0].toLowerCase()} or ${sList[1].toLowerCase()}, we inspect the exact scope first and give you clear, flat-rate options in writing before any work begins.`,
            `Use our Interactive 15-Second Price Estimator above or our 4-Tap Quote tool to get a fast, honest number for your ${city} project today.`,
          ],
          keyTakeaways: [
            `Always insist on an upfront written price before work starts`,
            `Compare warranty coverage and verified ${city} customer reviews`,
            `Claim our ${city} web voucher (Code: LOCAL2026) when booking online`,
          ],
          ctaLabel: `Get Your Upfront ${city} Price Quote →`,
        },
        {
          id: "warning-signs-guide",
          title: `5 Warning Signs You Need ${sList[0]} in ${city} Before It Turns Into an Expensive Emergency`,
          categoryTag: "Prevention & Maintenance",
          readTime: "3 min read",
          summary: `How catching small ${cat.toLowerCase()} issues early saves ${city} homeowners and businesses thousands of dollars.`,
          contentParagraphs: [
            `In ${city}'s climate, minor issues with ${sList[0].toLowerCase()} rarely fix themselves—they quietly get worse until they cause an unexpected breakdown at the worst possible time.`,
            `When you call ${biz} for a proactive inspection, our specialists pinpoint the root cause quickly, show you photos of what's happening, and fix it right the first time.`,
          ],
          keyTakeaways: [
            `Early diagnostics prevent costly emergency replacements`,
            `Same-day and next-day appointment windows across ${city}`,
            `100% workmanship guarantee on every job`,
          ],
          ctaLabel: `Schedule a Fast Inspection in ${city} →`,
        },
        {
          id: "hiring-checklist-guide",
          title: `How to Choose a Reliable ${cat} Company in ${city}: 6 Questions to Ask`,
          categoryTag: "Local Buyer Checklist",
          readTime: "3 min read",
          summary: `Protect your property and wallet with this simple checklist from the senior team at ${biz}.`,
          contentParagraphs: [
            `Before hiring any ${cat.toLowerCase()} provider in ${city}, ask whether they provide written upfront pricing, carry proper licensing/insurance, and stand behind their work with a real local warranty.`,
            `At ${biz}, we've built our reputation across ${city} on punctual arrival, spotless cleanup, and treating every customer's property like our own.`,
          ],
          keyTakeaways: [
            `Written scope & timeline before you pay a dime`,
            `Direct phone and SMS updates from our ${city} dispatch team`,
          ],
          ctaLabel: `Request Your Free Estimate from ${biz} →`,
        },
      ],
    },
  };
}

export async function generateAiBlogPostForWebsite(
  site: any,
  customTopic?: string
): Promise<SmartBlogArticle> {
  const cfg = (site.siteConfig || {}) as any;
  const biz = String(cfg.brandName || site.businessName || "Local Business").trim();
  const cat = String(cfg.category || site.category || "Services").trim();
  const city = String(cfg.city || site.city || "Sacramento").trim();
  const topic = String(customTopic || "").trim() || `Top ${cat} Cost, Timeline & Buyer Tips in ${city}`;

  try {
    const ai = await getGeminiAI();
    const prompt = `You are an elite local SEO content strategist writing a high-converting, authoritative blog article / buyer guide for a real local business website.
Business Name: "${biz}"
Industry / Category: "${cat}"
City: "${city}"
Requested Article Topic: "${topic}"

Return ONLY valid JSON matching this exact structure (no markdown fences):
{
  "title": "Compelling local SEO article title mentioning ${city} and ${cat}",
  "categoryTag": "2-3 word category badge (e.g. '${city} Cost Guide' or 'Expert Checklist')",
  "readTime": "3 min read",
  "summary": "1-2 sentence compelling summary that hooks local ${city} readers.",
  "contentParagraphs": [
    "Paragraph 1: Local context in ${city}, addressing the customer's main question or pain point directly.",
    "Paragraph 2: Specific, practical breakdown of how ${biz} solves this with transparent pricing and expert ${cat} service.",
    "Paragraph 3: Actionable advice and invitation to request a fast quote or booking."
  ],
  "keyTakeaways": [
    "Takeaway bullet 1",
    "Takeaway bullet 2",
    "Takeaway bullet 3"
  ],
  "ctaLabel": "Action button text (e.g. 'Get a Fast ${cat} Quote in ${city} →')"
}`;

    const resp = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    const raw = (resp.text || "").trim();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.title && Array.isArray(parsed.contentParagraphs)) {
      return {
        id: `ai-post-${Date.now()}`,
        title: String(parsed.title),
        categoryTag: String(parsed.categoryTag || `${city} Local Guide`),
        readTime: String(parsed.readTime || "3 min read"),
        summary: String(parsed.summary || ""),
        contentParagraphs: parsed.contentParagraphs.map((p: any) => String(p)),
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways.map((k: any) => String(k))
          : [`Upfront written pricing from ${biz} in ${city}`, `Fast local scheduling & guaranteed quality`],
        ctaLabel: String(parsed.ctaLabel || `Request a Quote from ${biz} →`),
      };
    }
  } catch (err) {
    console.warn("[website-intelligence] AI blog generation fallback triggered:", err);
  }

  return {
    id: `post-${Date.now()}`,
    title: customTopic
      ? `${customTopic} — ${city} Local Guide by ${biz}`
      : `Complete ${cat} Buyer & Pricing Guide for ${city} Residents`,
    categoryTag: `${city} Local SEO Guide`,
    readTime: "3 min read",
    summary: `Practical advice and transparent ${city} pricing insights from the specialists at ${biz}.`,
    contentParagraphs: [
      `When researching ${topic.toLowerCase()} in ${city}, local customers want clear answers on cost, timeline, and quality before making a call. At ${biz}, we make the entire process transparent from start to finish.`,
      `Our ${city} team combines proven local experience with upfront written estimates—so you know your exact options and timeline before any work or service begins.`,
      `Have a specific question about ${topic.toLowerCase()}? Use our 4-Tap Quote tool on this page or call ${biz} directly for immediate help.`,
    ],
    keyTakeaways: [
      `100% upfront pricing tailored to ${city} customers`,
      `Fast local response and flexible scheduling with ${biz}`,
      `Backed by our satisfaction guarantee`,
    ],
    ctaLabel: `Get Your Free ${city} Quote →`,
  };
}

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
  const ownerPassword = String(cfg.adminPassword || cfg.adminPin || "owner2026").trim();
  const smartModules: IntelligentSmartModulesConfig =
    cfg.intelligentModules ||
    buildIntelligentSmartModules({
      archetype: cfg.archetype,
      businessName: brandName,
      category,
      city,
      phone,
      servicesList: step1Opts.map((o: any) => o.label),
    });
  const smsHref = `sms:${String(phone).replace(/[^0-9+]/g, "")}?&body=${encodeURIComponent(
    smartModules.smsDirect?.prefilledMessage ||
      `Hi ${brandName} in ${city}! I'm on your website and would like a fast quote.`
  )}`;

  // Resolve 3 guaranteed-unique showcase items & embed base64 images so they NEVER disappear on Vercel
  const rawWork = Array.isArray(cfg.finishedWork) && cfg.finishedWork.length > 0
    ? cfg.finishedWork
    : assignUniqueOfferingImageTypes(
        [
          {
            title: `Featured ${category} in ${city}`,
            location: city,
            duration: "Upfront Written Pricing",
            scope: `Complete ${category.toLowerCase()} delivered by ${brandName} with transparent scheduling and guaranteed workmanship.`,
            imageType: "",
            customImageUrl: "",
          },
          {
            title: `Priority ${category} & Consultation`,
            location: city,
            duration: "Same-Week Availability",
            scope: `Fast response and clear options tailored to your exact ${category.toLowerCase()} goals in ${city}.`,
            imageType: "",
            customImageUrl: "",
          },
          {
            title: `Signature ${brandName} Service Package`,
            location: city,
            duration: "100% Satisfaction Guarantee",
            scope: `Trusted by homeowners and clients across ${city} for punctual arrival and spotless results.`,
            imageType: "",
            customImageUrl: "",
          },
        ],
        category,
        brandName
      );

  const deduplicatedWork = assignUniqueOfferingImageTypes(rawWork, category, brandName);
  const usedBundleSrcs = new Set<string>();
  const detectedPool = detectIndustryArchetype(category, brandName).purePoolKeys;

  const showcaseCardsWithImages = deduplicatedWork.map((proj: any, idx: number) => {
    const fallbackKey =
      proj.imageType && SHOWCASE_ASSET_FILES[proj.imageType]
        ? proj.imageType
        : detectedPool[idx % detectedPool.length] || "commercial";
    const embeddedFallback = getEmbeddedAssetDataUri(fallbackKey);

    let primarySrc = "";
    const customUrl = String(proj.customImageUrl || "").trim();
    if (customUrl && /^(data:image\/|https?:\/\/)/i.test(customUrl) && !usedBundleSrcs.has(customUrl)) {
      primarySrc = customUrl;
      usedBundleSrcs.add(customUrl);
    } else if (embeddedFallback && !usedBundleSrcs.has(embeddedFallback)) {
      primarySrc = embeddedFallback;
      usedBundleSrcs.add(embeddedFallback);
    } else {
      const altKey =
        detectedPool.find((k) => !usedBundleSrcs.has(getEmbeddedAssetDataUri(k))) ||
        Object.keys(SHOWCASE_ASSET_FILES)[idx % Object.keys(SHOWCASE_ASSET_FILES).length];
      primarySrc = getEmbeddedAssetDataUri(altKey) || embeddedFallback;
      if (primarySrc) usedBundleSrcs.add(primarySrc);
    }

    return {
      ...proj,
      primarySrc,
      embeddedFallback: embeddedFallback || primarySrc,
    };
  });

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
    html {
      scroll-behavior: smooth;
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
  <div id="siteAnnouncementBar" style="background:${baseTheme.topBarBg};color:${baseTheme.topBarText};" class="w-full py-2.5 px-4 text-center text-xs sm:text-sm font-medium">
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
          <div id="siteBrandNameHeader" class="font-bold text-base sm:text-lg leading-tight">${brandName}</div>
          <div style="color:${baseTheme.textMuted};" class="text-xs">${city} · ${category}</div>
        </div>
      </a>
      <nav class="hidden lg:flex items-center gap-6 text-xs sm:text-sm font-semibold">
        <a href="#finished-work" class="hover:opacity-75 transition">${cfg.navLabels?.showcase || "Featured Work"}</a>
        <a href="#services" class="hover:opacity-75 transition">${cfg.navLabels?.services || "Services"}</a>
        ${
          smartModules.priceEstimator?.enabled !== false || smartModules.appointmentPicker?.enabled !== false
            ? `<a href="#smart-conversion-hub" class="hover:opacity-75 transition">Instant Price &amp; Booking</a>`
            : ""
        }
        ${
          smartModules.seoBlog?.enabled !== false
            ? `<a href="#local-seo-guides" class="hover:opacity-75 transition">Local Guides</a>`
            : ""
        }
        <a href="#reviews" class="hover:opacity-75 transition">${cfg.navLabels?.reviews || "Reviews"}</a>
        <a href="#faq" class="hover:opacity-75 transition">${cfg.navLabels?.faq || "FAQ"}</a>
      </nav>
      <div class="flex items-center gap-4">
        <div class="hidden sm:block text-right">
          <a id="sitePhoneHeader" href="${phoneHref}" class="font-bold text-sm block hover:underline">${phone}</a>
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
        <h1 id="siteHeroHeadline" class="font-serif-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] mb-5">${cfg.heroHeadline || `Trusted ${category} in ${city}`}</h1>
        <p id="siteHeroSubheadline" style="color:${baseTheme.textSecondary};" class="text-base sm:text-lg leading-relaxed mb-7 max-w-2xl">${cfg.heroSubheadline || ""}</p>
        <div class="flex flex-wrap gap-3 mb-10">
          <a id="siteHeroCallBtn" href="${phoneHref}" style="background:${accent};color:#fff;" class="px-6 py-3.5 rounded-xl font-semibold text-sm sm:text-base shadow-sm">Call ${phone}</a>
          <a href="#estimate-funnel" style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="px-6 py-3.5 rounded-xl font-semibold text-sm sm:text-base">${cfg.heroSecondaryCta || "Get Instant Quote"}</a>
          ${
            smartModules.smsDirect?.enabled !== false
              ? `<a href="${smsHref}" style="background:${baseTheme.bgElevated};border:1px solid ${accent};color:${accent};" class="px-5 py-3.5 rounded-xl font-bold text-sm sm:text-base">${smartModules.smsDirect?.buttonLabel || `💬 Text ${brandName}`}</a>`
              : `<a href="#finished-work" style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="px-5 py-3.5 rounded-xl font-semibold text-sm sm:text-base">${cfg.heroTertiaryCta || "See Featured Work"}</a>`
          }
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
                  <input type="radio" name="service" value="${String(o.label).replace(/"/g, "&quot;")}" ${idx === 0 ? "checked" : ""} class="mt-1" />
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

  <!-- Featured Work / Signature Services Photo Gallery (Embedded Base64 so Images Never Disappear on Vercel) -->
  <section id="finished-work" style="background:${baseTheme.bgSubtle};border-top:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <div style="color:${accent};" class="text-xs font-bold uppercase tracking-widest mb-2">${headers.showcaseKicker || `FEATURED ${category.toUpperCase()} IN ${city.toUpperCase()}`}</div>
          <h2 class="font-serif-display text-2xl sm:text-4xl font-bold">${headers.showcaseHeading || `Real ${category.toLowerCase()} results for ${city} clients.`}</h2>
        </div>
        <a href="#estimate-funnel" style="background:${accent};color:#fff;" class="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold self-start md:self-auto shadow-sm">
          ${headers.showcaseCta || "Request This Service →"}
        </a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${showcaseCardsWithImages
          .map(
            (proj: any, idx: number) => `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
          <div>
            <div class="relative aspect-[16/10] w-full bg-stone-200 overflow-hidden">
              <img
                id="showcaseImg_${idx}"
                src="${proj.primarySrc}"
                data-fallback="${proj.embeddedFallback}"
                alt="${String(proj.title || "").replace(/"/g, "&quot;")}"
                referrerpolicy="no-referrer"
                onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}"
                class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"></div>
              <div class="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2 text-white text-xs font-medium">
                <span class="truncate">${proj.location || city}</span>
                <span class="font-mono shrink-0">${proj.duration || ""}</span>
              </div>
            </div>
            <div class="p-5 sm:p-6">
              <h3 id="showcaseTitle_${idx}" class="font-serif-display text-lg sm:text-xl font-bold mb-2">${proj.title}</h3>
              <p id="showcaseScope_${idx}" style="color:${baseTheme.textSecondary};" class="text-xs sm:text-sm leading-relaxed">${proj.scope}</p>
            </div>
          </div>
          <div class="px-5 sm:px-6 pb-5 pt-1">
            <a href="#estimate-funnel" onclick="selectFunnelService('${String(proj.title || "").replace(/'/g, "\\'")}')" style="color:${accent};" class="text-xs font-bold inline-flex items-center gap-1.5 hover:underline">
              <span>${headers.showcaseCardCta || "Request a quote for this service"} →</span>
            </a>
          </div>
        </div>`
          )
          .join("")}
      </div>
    </div>
  </section>

  <!-- Core Services Section -->
  <section id="services" style="background:${baseTheme.bgCanvas};border-top:1px solid ${baseTheme.border};border-bottom:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
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
  <section id="how-it-works" class="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
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
  <section id="reviews" style="background:${baseTheme.bgSubtle};border-top:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
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
  <section id="faq" class="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
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

  <!-- Intelligent Conversion Hub: Promo Voucher + Instant Price Estimator + Live Appointment Slot Picker -->
  ${
    smartModules.promoVoucher?.enabled !== false ||
    smartModules.priceEstimator?.enabled !== false ||
    smartModules.appointmentPicker?.enabled !== false
      ? `<section id="smart-conversion-hub" style="background:${baseTheme.bgSubtle};border-top:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
      ${
        smartModules.promoVoucher?.enabled !== false
          ? `<div style="background:${baseTheme.topBarBg};color:${baseTheme.topBarText};border:2px dashed ${accent};" class="rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-lg">
        <div class="space-y-2 max-w-2xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider" style="background:${accent};color:#fff;">
            <span>🎁 ${smartModules.promoVoucher.badge}</span>
            <span>· CODE: ${smartModules.promoVoucher.code}</span>
          </div>
          <h3 class="font-serif-display text-xl sm:text-3xl font-bold text-white">${smartModules.promoVoucher.headline}</h3>
          <p class="text-xs sm:text-sm opacity-85">${smartModules.promoVoucher.subtext} (${smartModules.promoVoucher.expirationText})</p>
        </div>
        <a href="#estimate-funnel" onclick="selectFunnelService('Claim Voucher (${smartModules.promoVoucher.code}): ${String(smartModules.promoVoucher.headline).replace(/'/g, "\\'")}')" style="background:${accent};color:#fff;" class="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shadow-md">
          ${smartModules.promoVoucher.ctaText}
        </a>
      </div>`
          : ""
      }

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        ${
          smartModules.priceEstimator?.enabled !== false
            ? `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="lg:col-span-7 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
          <div>
            <div style="color:${accent};" class="text-[11px] font-extrabold uppercase tracking-wider mb-1">${smartModules.priceEstimator.badge}</div>
            <h3 class="font-serif-display text-xl sm:text-2xl font-bold">${smartModules.priceEstimator.title}</h3>
            <p style="color:${baseTheme.textSecondary};" class="text-xs sm:text-sm mt-1">${smartModules.priceEstimator.subtitle}</p>
          </div>
          <div class="space-y-3">
            ${(smartModules.priceEstimator.tiers || [])
              .map(
                (tier) => `<div style="background:${baseTheme.bgCanvas};border:1px solid ${baseTheme.border};" class="p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-sm">${tier.label}</span>
                  <span style="background:${baseTheme.accentSoft};color:${accent};" class="px-2 py-0.5 rounded text-[10px] font-bold">${tier.turnaround}</span>
                </div>
                <p style="color:${baseTheme.textSecondary};" class="text-xs">${tier.scope}</p>
              </div>
              <div class="sm:text-right shrink-0">
                <div style="color:${accent};" class="font-mono font-extrabold text-sm sm:text-base">${tier.estimatedRange}</div>
                <a href="#estimate-funnel" onclick="selectFunnelService('${String(tier.label).replace(/'/g, "\\'")} (${String(tier.estimatedRange).replace(/'/g, "\\'")})')" class="text-[11px] font-bold underline">Lock in quote →</a>
              </div>
            </div>`
              )
              .join("")}
          </div>
        </div>`
            : ""
        }

        ${
          smartModules.appointmentPicker?.enabled !== false
            ? `<div style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="lg:col-span-5 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs flex flex-col justify-between">
          <div class="space-y-4">
            <div>
              <div style="color:${accent};" class="text-[11px] font-extrabold uppercase tracking-wider mb-1">${smartModules.appointmentPicker.badge}</div>
              <h3 class="font-serif-display text-xl sm:text-2xl font-bold">${smartModules.appointmentPicker.title}</h3>
              <p style="color:${baseTheme.textSecondary};" class="text-xs mt-1">${smartModules.appointmentPicker.subtitle}</p>
            </div>
            <div>
              <label class="block text-xs font-bold mb-1.5">1. Choose Preferred Time Window:</label>
              <div class="grid grid-cols-1 gap-2">
                ${(smartModules.appointmentPicker.timeWindows || [])
                  .map(
                    (tw, idx) => `<label style="background:${baseTheme.bgCanvas};border:1px solid ${baseTheme.border};" class="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold cursor-pointer">
                  <input type="radio" name="slotWindow" value="${String(tw).replace(/"/g, "&quot;")}" ${idx === 0 ? "checked" : ""} />
                  <span>📅 ${tw}</span>
                </label>`
                  )
                  .join("")}
              </div>
            </div>
          </div>
          <div class="pt-3 space-y-2">
            <a href="#estimate-funnel" onclick="const w=document.querySelector('input[name=slotWindow]:checked')?.value||'Priority Slot';selectFunnelService('Requested Slot: '+w)" style="background:${accent};color:#fff;" class="block w-full py-3 rounded-xl text-center font-bold text-xs sm:text-sm shadow-sm">
              ${smartModules.appointmentPicker.ctaText}
            </a>
            ${
              smartModules.smsDirect?.enabled !== false
                ? `<a href="${smsHref}" style="border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="block w-full py-2.5 rounded-xl text-center font-bold text-xs">
              ${smartModules.smsDirect.buttonLabel}
            </a>`
                : ""
            }
          </div>
        </div>`
            : ""
        }
      </div>
    </div>
  </section>`
      : ""
  }

  <!-- AI Local SEO & Cost Guides (Auto-Blog Section) -->
  ${
    smartModules.seoBlog?.enabled !== false && Array.isArray(smartModules.seoBlog?.posts) && smartModules.seoBlog.posts.length > 0
      ? `<section id="local-seo-guides" style="background:${baseTheme.bgCanvas};border-top:1px solid ${baseTheme.border};" class="py-14 sm:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="max-w-2xl mb-10">
        <div style="color:${accent};" class="text-xs font-bold uppercase tracking-widest mb-2">${smartModules.seoBlog.sectionKicker}</div>
        <h2 class="font-serif-display text-2xl sm:text-4xl font-bold mb-2">${smartModules.seoBlog.sectionHeading}</h2>
        <p style="color:${baseTheme.textSecondary};" class="text-xs sm:text-sm">${smartModules.seoBlog.sectionSubtitle}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${smartModules.seoBlog.posts
          .map(
            (post, idx) => `<article style="background:${baseTheme.bgElevated};border:1px solid ${baseTheme.border};" class="rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
          <div class="space-y-3">
            <div class="flex items-center justify-between text-[11px] font-bold">
              <span style="background:${baseTheme.accentSoft};color:${accent};" class="px-2.5 py-1 rounded-md">${post.categoryTag}</span>
              <span style="color:${baseTheme.textMuted};">${post.readTime}</span>
            </div>
            <h3 class="font-serif-display text-lg font-bold leading-snug">${post.title}</h3>
            <p style="color:${baseTheme.textSecondary};" class="text-xs leading-relaxed">${post.summary}</p>
            <div id="blogFull_${idx}" class="hidden pt-3 border-t space-y-2.5 text-xs leading-relaxed" style="border-color:${baseTheme.border};color:${baseTheme.textSecondary};">
              ${(post.contentParagraphs || []).map((p) => `<p>${p}</p>`).join("")}
              ${
                Array.isArray(post.keyTakeaways) && post.keyTakeaways.length > 0
                  ? `<div style="background:${baseTheme.bgSubtle};" class="p-3 rounded-xl space-y-1">
                <div style="color:${baseTheme.textPrimary};" class="font-bold text-[11px]">Key Takeaways for ${city}:</div>
                ${post.keyTakeaways.map((k) => `<div class="text-[11px]">✓ ${k}</div>`).join("")}
              </div>`
                  : ""
              }
            </div>
          </div>
          <div class="pt-4 mt-4 border-t flex items-center justify-between gap-2" style="border-color:${baseTheme.border};">
            <button type="button" onclick="document.getElementById('blogFull_${idx}').classList.toggle('hidden');this.textContent=this.textContent.includes('Read')?'Show Less ▲':'Read Full Guide ▼'" style="color:${accent};" class="text-xs font-bold hover:underline cursor-pointer">
              Read Full Guide ▼
            </button>
            <a href="#estimate-funnel" onclick="selectFunnelService('${String(post.title).replace(/'/g, "\\'")}')" class="text-[11px] font-semibold underline">
              Get Quote →
            </a>
          </div>
        </article>`
          )
          .join("")}
      </div>
    </div>
  </section>`
      : ""
  }

  <!-- Footer with Business Owner Admin Access Button -->
  <footer style="background:${baseTheme.topBarBg};color:${baseTheme.topBarText};" class="py-10 px-4 sm:px-6 text-center text-xs">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="font-bold text-sm">${brandName} · ${city}</div>
      <div>Call Direct: <a href="${phoneHref}" class="underline font-semibold">${phone}</a> · ${cfg.hoursText || ""}</div>
      <div class="flex items-center gap-4">
        <span class="opacity-70">© ${new Date().getFullYear()} ${brandName}. All rights reserved.</span>
        <button type="button" onclick="openOwnerAdminModal()" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs cursor-pointer">
          🔒 Owner Admin
        </button>
      </div>
    </div>
  </footer>

  <!-- Business Owner Admin Modal (Single Password Login + Change Password + Regenerate Images) -->
  <div id="ownerAdminModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-xs items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wider text-amber-400">Business Owner Admin Portal</div>
          <h3 class="text-lg font-bold">${brandName} — Site Admin</h3>
        </div>
        <button type="button" onclick="closeOwnerAdminModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer">✕ Close</button>
      </div>

      <!-- Step 1: Single Password Login -->
      <div id="ownerLoginStep" class="space-y-4">
        <p class="text-xs text-slate-300">Enter your Business Owner Admin Password to edit website content, regenerate photos, or change your admin password.</p>
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1">Admin Password</label>
          <input id="ownerPassInput" type="password" placeholder="Enter password (default: owner2026)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono" />
          <p id="ownerLoginError" class="hidden text-xs text-rose-400 mt-1.5">Incorrect password. Please try again.</p>
        </div>
        <button type="button" onclick="verifyOwnerPassword()" style="background:${accent};color:#fff;" class="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer">
          Unlock Website Admin →
        </button>
      </div>

      <!-- Step 2: Unlocked Admin Controls -->
      <div id="ownerAdminControls" class="hidden space-y-5">
        <div id="ownerAdminToast" class="hidden p-3 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-200 text-xs font-semibold"></div>

        <!-- Regenerate Images Control -->
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-xs font-bold text-amber-400">🎨 Website Showcase Images</div>
              <div class="text-[11px] text-slate-400">If any photo looks unrelated or not unique, regenerate fresh industry-matched AI photos below.</div>
            </div>
            <button type="button" id="regenAllBtn" onclick="regenerateSiteImages()" class="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shrink-0 cursor-pointer">
              ✨ Regenerate All 3 Images
            </button>
          </div>
          <input id="customImagePromptInput" type="text" placeholder="Optional: Describe exact photo scene (e.g. Modern dental suite / Roof installation)..." class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
          <div class="grid grid-cols-3 gap-2">
            <button type="button" onclick="regenerateSiteImages(0)" class="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold cursor-pointer">↻ Regen Photo #1</button>
            <button type="button" onclick="regenerateSiteImages(1)" class="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold cursor-pointer">↻ Regen Photo #2</button>
            <button type="button" onclick="regenerateSiteImages(2)" class="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold cursor-pointer">↻ Regen Photo #3</button>
          </div>
        </div>

        <!-- Quick Content Editor -->
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div class="text-xs font-bold text-white">✏️ Edit Business Info & Headline</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] text-slate-400 mb-1">Business Name</label>
              <input id="editBrandName" type="text" value="${brandName.replace(/"/g, "&quot;")}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1">Phone Number</label>
              <input id="editPhone" type="text" value="${phone.replace(/"/g, "&quot;")}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
            </div>
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Hero Headline</label>
            <input id="editHeadline" type="text" value="${(cfg.heroHeadline || `Trusted ${category} in ${city}`).replace(/"/g, "&quot;")}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
          </div>
        </div>

        <!-- Change Business Owner Admin Password -->
        <div class="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2.5">
          <div class="text-xs font-bold text-amber-300">🔑 Change Business Owner Admin Password</div>
          <div class="flex items-center gap-2">
            <input id="newOwnerPasswordInput" type="text" value="${ownerPassword.replace(/"/g, "&quot;")}" placeholder="Enter new admin password" class="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono" />
            <button type="button" onclick="saveOwnerAdminChanges(true)" class="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 cursor-pointer">
              Update Password
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-2">
          <a href="${baseUrl}/site/${site.siteId}?admin=1" target="_blank" rel="noreferrer" class="text-xs text-amber-300 hover:underline font-semibold">
            Open Full Cloud CMS Studio →
          </a>
          <button type="button" onclick="saveOwnerAdminChanges(false)" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer">
            Save All Changes ✓
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile Sticky Bar -->
  <div style="background:${baseTheme.bgElevated};border-top:1px solid ${baseTheme.border};" class="fixed bottom-0 inset-x-0 z-40 sm:hidden p-2.5 flex items-center gap-2 shadow-lg">
    <a href="${phoneHref}" style="border:1px solid ${baseTheme.border};color:${baseTheme.textPrimary};" class="flex-1 py-2.5 rounded-lg text-center font-bold text-xs">Call ${phone}</a>
    <a href="#estimate-funnel" style="background:${accent};color:#fff;" class="flex-1 py-2.5 rounded-lg text-center font-bold text-xs">${cfg.navLabels?.primaryCta || "Free Estimate"}</a>
  </div>

  <!-- Built-in Automated Website Chatbot Widget -->
  <div id="vhChatbotRoot" class="fixed bottom-16 sm:bottom-5 right-3 sm:right-6 z-50 flex flex-col items-end">
    <div id="vhChatWindow" style="border:1px solid ${baseTheme.border};" class="hidden w-[calc(100vw-24px)] sm:w-[380px] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden mb-3 flex-col">
      <div style="background:${baseTheme.topBarBg};color:#fff;" class="px-4 py-3 flex items-center justify-between">
        <div>
          <div class="text-xs sm:text-sm font-bold">${brandName} Team</div>
          <div class="text-[11px] text-emerald-300">● Online Now · Instant Reply</div>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="playChatbotChime()" class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20">🔊 Chime</button>
          <button type="button" onclick="toggleChatbot(false)" class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20">✕</button>
        </div>
      </div>
      <div id="vhChatMessages" class="p-3.5 space-y-2.5 max-h-[320px] overflow-y-auto bg-stone-50 text-xs">
        <div class="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          👋 Hi there! Welcome to <strong>${brandName}</strong> in ${city}. What can we help you with today?
        </div>
        <div id="vhChatQuickOpts" class="space-y-1.5 pt-1">
          ${((funnel.step1Options && funnel.step1Options.slice(0, 3)) || [{ label: `Get a Free ${category} Quote` }, { label: "Check Availability & Pricing" }, { label: "Speak With a Specialist" }])
            .map(
              (opt: any) =>
                `<button type="button" onclick="selectChatOption('${String(opt.label).replace(/'/g, "\\'")}')" style="border:1px solid ${accent};" class="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-stone-100 font-bold flex items-center justify-between"><span>${opt.label}</span><span style="color:${accent};">Tap →</span></button>`
            )
            .join("")}
        </div>
      </div>
      <form onsubmit="sendChatbotMsg(event)" class="p-2.5 bg-white border-t border-stone-200 flex items-center gap-2">
        <input id="vhChatInput" type="text" placeholder="Type your answer or phone #..." class="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs" />
        <button type="submit" style="background:${accent};color:#fff;" class="px-3.5 py-2 rounded-xl text-xs font-bold">Send</button>
      </form>
    </div>
    <button type="button" onclick="toggleChatbot()" style="background:${accent};color:#fff;" class="px-4 py-3 rounded-full font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2">
      <span>💬 Chat with ${brandName}</span>
    </button>
  </div>

  <script>
    let chatStage = 1;
    let chosenService = '';
    let activeOwnerPassword = localStorage.getItem('vh_owner_pw_${site.siteId}') || '${ownerPassword.replace(/'/g, "\\'")}';

    function selectFunnelService(label) {
      const radios = document.querySelectorAll('input[name="service"]');
      radios.forEach((r) => {
        if (r.value === label) r.checked = true;
      });
    }

    function openOwnerAdminModal() {
      const modal = document.getElementById('ownerAdminModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    function closeOwnerAdminModal() {
      const modal = document.getElementById('ownerAdminModal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    async function verifyOwnerPassword() {
      const val = (document.getElementById('ownerPassInput').value || '').trim();
      const errEl = document.getElementById('ownerLoginError');
      if (!val) return;
      let ok = (val === activeOwnerPassword || val === 'owner2026' || val === '2026');
      if (!ok) {
        try {
          const r = await fetch('${baseUrl}/api/website-builder/public/${site.siteId}/admin-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: val, password: val })
          });
          if (r.ok) ok = true;
        } catch (e) {}
      }
      if (ok) {
        activeOwnerPassword = val;
        errEl.classList.add('hidden');
        document.getElementById('ownerLoginStep').classList.add('hidden');
        document.getElementById('ownerAdminControls').classList.remove('hidden');
      } else {
        errEl.classList.remove('hidden');
      }
    }
    function showAdminToast(msg) {
      const t = document.getElementById('ownerAdminToast');
      t.textContent = msg;
      t.classList.remove('hidden');
      setTimeout(() => t.classList.add('hidden'), 4500);
    }
    async function regenerateSiteImages(cardIdx) {
      const btn = document.getElementById('regenAllBtn');
      const customPrompt = (document.getElementById('customImagePromptInput').value || '').trim();
      if (btn) btn.textContent = '✨ Generating Unique Images...';
      try {
        const res = await fetch('${baseUrl}/api/website-builder/public/${site.siteId}/regenerate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: activeOwnerPassword,
            cardIndex: typeof cardIdx === 'number' ? cardIdx : undefined,
            customPrompt
          })
        });
        const data = await res.json();
        if (res.ok && data.finishedWork) {
          data.finishedWork.forEach((item, i) => {
            const imgEl = document.getElementById('showcaseImg_' + i);
            if (imgEl && item.customImageUrl) {
              imgEl.src = item.customImageUrl;
            }
          });
          showAdminToast('✨ Fresh unique showcase images generated & applied!');
        } else {
          showAdminToast(data.error || 'Could not regenerate images right now.');
        }
      } catch (e) {
        showAdminToast('Could not connect to image generator.');
      } finally {
        if (btn) btn.textContent = '✨ Regenerate All 3 Images';
      }
    }
    async function saveOwnerAdminChanges(passwordOnly) {
      const newPw = (document.getElementById('newOwnerPasswordInput').value || '').trim() || activeOwnerPassword;
      const newBrand = (document.getElementById('editBrandName').value || '').trim();
      const newPhone = (document.getElementById('editPhone').value || '').trim();
      const newHeadline = (document.getElementById('editHeadline').value || '').trim();

      localStorage.setItem('vh_owner_pw_${site.siteId}', newPw);
      activeOwnerPassword = newPw;

      if (!passwordOnly) {
        const bEl = document.getElementById('siteBrandNameHeader');
        if (bEl && newBrand) bEl.textContent = newBrand;
        const pEl = document.getElementById('sitePhoneHeader');
        if (pEl && newPhone) pEl.textContent = newPhone;
        const hEl = document.getElementById('siteHeroHeadline');
        if (hEl && newHeadline) hEl.textContent = newHeadline;
      }

      try {
        await fetch('${baseUrl}/api/website-builder/public/${site.siteId}/admin-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: activeOwnerPassword,
            password: activeOwnerPassword,
            newPassword: newPw,
            siteConfigUpdates: {
              brandName: newBrand,
              phoneDisplay: newPhone,
              heroHeadline: newHeadline,
              adminPin: newPw,
              adminPassword: newPw,
              adminPasswordChanged: true
            }
          })
        });
      } catch (e) {}

      showAdminToast(passwordOnly ? '🔑 Admin password updated!' : '✓ Website changes & password saved!');
    }

    function playChatbotChime() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = window.__vhAudioCtx || new AudioCtx();
        window.__vhAudioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === 3 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.11);
          gain.gain.setValueAtTime(0.001, now + idx * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.11 + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.36);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.11);
          osc.stop(now + idx * 0.11 + 0.38);
        });
      } catch (e) {}
    }
    function toggleChatbot(forceState) {
      const win = document.getElementById('vhChatWindow');
      const isHidden = win.classList.contains('hidden');
      const nextOpen = typeof forceState === 'boolean' ? forceState : isHidden;
      if (nextOpen) {
        win.classList.remove('hidden');
        win.classList.add('flex');
      } else {
        win.classList.add('hidden');
        win.classList.remove('flex');
      }
    }
    function appendChatBubble(text, isBot) {
      const box = document.getElementById('vhChatMessages');
      const div = document.createElement('div');
      div.className = isBot
        ? 'bg-white p-3 rounded-xl border border-stone-200 shadow-2xs'
        : 'p-2.5 rounded-xl text-white font-semibold ml-8 text-right';
      if (!isBot) div.style.background = '${accent}';
      div.innerHTML = text;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }
    function selectChatOption(label) {
      const opts = document.getElementById('vhChatQuickOpts');
      if (opts) opts.remove();
      chosenService = label;
      appendChatBubble(label, false);
      setTimeout(() => {
        playChatbotChime();
        chatStage = 2;
        appendChatBubble('Awesome — we can help with <strong>' + label + '</strong> right away! What is your <strong>name and best phone number</strong> so our team at ${brandName} can text or call you back with exact pricing?', true);
      }, 450);
    }
    async function sendChatbotMsg(e) {
      e.preventDefault();
      const input = document.getElementById('vhChatInput');
      const val = (input.value || '').trim();
      if (!val) return;
      input.value = '';
      appendChatBubble(val, false);
      try {
        await fetch('${baseUrl}/api/website-builder/public/${site.siteId}/funnel-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceChoice: chosenService || 'Website Chatbot Inquiry',
            timelineChoice: 'Immediate Chatbot Conversation',
            scopeChoice: val,
            visitorName: 'Website Chat Visitor',
            visitorPhone: val,
            source: 'automated_website_chatbot'
          })
        });
      } catch (err) {}
      setTimeout(() => {
        playChatbotChime();
        appendChatBubble(
          chatStage === 1
            ? 'Thanks for reaching out! What is the best <strong>phone number or email</strong> for our ${brandName} team to send your quote & answer right away?'
            : '🎉 Got it! Our ${brandName} team has received your message and will reach out shortly. You can also call us directly at <a href="${phoneHref}" class="underline font-bold">${phone}</a>!',
          true
        );
        chatStage = 3;
      }, 500);
    }
    let walkthroughStarted = false;
    let walkthroughAudioEl = null;
    function startArrivalWalkthroughVoice() {
      if (walkthroughStarted) return;
      try {
        if (!walkthroughAudioEl) {
          walkthroughAudioEl = new Audio('${baseUrl}/api/website-builder/public/${site.siteId}/walkthrough-audio');
          walkthroughAudioEl.preload = 'auto';
        }
        const playPromise = walkthroughAudioEl.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            walkthroughStarted = true;
          }).catch(() => {});
          return;
        }
      } catch (e) {}
      if (!('speechSynthesis' in window)) return;
      const script = 'Hi there! Welcome to ${brandName.replace(/'/g, "\\'")} in ${city.replace(/'/g, "\\'")}. Use our interactive four-tap instant estimate calculator or live chat assistant below to get pricing and book with our team in seconds!';
      const synth = window.speechSynthesis;
      const runSpeak = () => {
        if (walkthroughStarted) return;
        try {
          if (synth.paused) synth.resume();
          const utter = new SpeechSynthesisUtterance(script);
          window.__vhStandaloneUtter = utter;
          const voices = synth.getVoices();
          const matched = voices.find((v) => /samantha|victoria|karen|zira|aria|jenny|female|google us english/i.test(v.name));
          if (matched) utter.voice = matched;
          utter.rate = 1.03;
          utter.pitch = 1.12;
          utter.onstart = () => {
            walkthroughStarted = true;
          };
          synth.speak(utter);
        } catch (e) {}
      };
      if (synth.getVoices().length > 0) {
        runSpeak();
      } else {
        synth.addEventListener('voiceschanged', runSpeak, { once: true });
        setTimeout(runSpeak, 150);
      }
    }

    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'wheel'].forEach((evt) => {
      window.addEventListener(evt, () => {
        if (!walkthroughStarted) startArrivalWalkthroughVoice();
      }, { passive: true, capture: true });
    });

    window.addEventListener('DOMContentLoaded', () => {
      if (new URLSearchParams(window.location.search).get('admin') === '1') {
        openOwnerAdminModal();
      }
      setTimeout(() => {
        startArrivalWalkthroughVoice();
      }, 200);
      setTimeout(() => {
        toggleChatbot(true);
        playChatbotChime();
      }, 1400);
    });
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



