/**
 * business-scrapers.ts
 *
 * Multi-source business directory scraper.
 * Runs all sources in parallel, deduplicates, then enriches each with a
 * real contact email scraped from the business website.
 *
 * API-backed sources (Foursquare, TomTom, HERE) read keys from the DB pool
 * managed via the CRM admin UI — no Replit Secrets required.
 * Multiple accounts per provider are supported and rotated round-robin.
 */

import { getAllKeys } from "./api-key-pools";

export interface ScrapedBusiness {
  businessName: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  category: string;
  source: string;
  email: string;
  /** 1-10: how strong the fit is for an AI agent / automation pitch, based on real website scan. Filled in during enrichment. */
  aiOpportunityScore?: number;
  /** Short, real, human-readable reason derived from what was (or wasn't) found on their site. Filled in during enrichment. */
  aiOpportunityNote?: string;
}

// ─── Shared HTTP fetch ────────────────────────────────────────────────────────

/** Fetch a URL with realistic browser headers; throws on timeout or non-2xx. */
async function browserFetch(url: string, timeoutMs = 14000): Promise<string> {
  const res = await Promise.race([
    fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Referer": "https://www.google.com/",
      },
    }),
    new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), timeoutMs)),
  ]) as Response;
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

// ─── Structured data extraction ───────────────────────────────────────────────

/** Pull every JSON-LD / schema.org block out of raw HTML. */
function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const d = JSON.parse(m[1].trim());
      out.push(...(Array.isArray(d) ? d : [d]));
    } catch {}
  }
  return out;
}

const BUSINESS_TYPES = new Set([
  "LocalBusiness","Restaurant","Store","FoodEstablishment","HealthAndBeautyBusiness",
  "EntertainmentBusiness","HomeAndConstructionBusiness","LodgingBusiness","TouristAttraction",
  "AutomotiveBusiness","FinancialService","LegalService","MedicalBusiness","Dentist",
  "Physician","RealEstateAgent","TravelAgency","SportsClub","BeautySalon","HairSalon",
  "Plumber","Electrician","HVACBusiness","AccountingService","InsuranceAgency","Hotel",
  "Motel","GroceryStore","ClothingStore","ElectronicsStore","HomeGoodsStore","PetStore",
  "ShoeStore","SportingGoodsStore","ToyStore","BookStore","Florist","Bakery","CafeOrCoffeeShop",
  "BarOrPub","FastFoodRestaurant","IceCreamShop","Brewery","Winery","NightClub",
  "MovieTheater","AmusementPark","Aquarium","Zoo","Museum","Library","Gym",
  "MartialArtsOrSportsFacility","TennisComplex","GolfCourse","BowlingAlley",
  "ChildCare","Preschool","School","CollegeOrUniversity","Language","Tutoring",
  "AutoDealer","AutoRepair","AutoBodyShop","CarWash","GasStation","Locksmith",
  "MovingCompany","StorageUnit","PhotoStudio","PrintingShop","TailoringShop",
  "VeterinaryCare","Dentist","Hospital","MedicalClinic","Pharmacy","BodyCare",
  "DaySpa","NailSalon","TattooParlor","MassageTherapy","Chiropractor","Optician",
]);

function schemaTypeLooksLikeBusiness(t: string): boolean {
  if (!t) return false;
  if (BUSINESS_TYPES.has(t)) return true;
  return t.includes("Business") || t.includes("Service") || t.includes("Store") ||
    t.includes("Shop") || t.includes("Salon") || t.includes("Clinic");
}

const EARLY_SKIP_WEBSITE = /^https?:\/\/(?:www\.)?(yelp\.com|manta\.com|hotfrog\.|yell\.com|foursquare\.com|yellowpages\.|bing\.com|google\.com|facebook\.com|instagram\.com|twitter\.com|linkedin\.com|tripadvisor\.com|bbb\.org|thumbtack\.com|bark\.com|superpages\.com|cylex\.)/i;

function cleanWebsiteUrl(raw: string): string {
  if (!raw) return "";
  const decoded = raw.trim().replace(/&amp;/g, "&");
  if (!decoded || EARLY_SKIP_WEBSITE.test(decoded)) return "";
  try {
    const u = new URL(decoded.startsWith("http") ? decoded : `https://${decoded}`);
    if (EARLY_SKIP_WEBSITE.test(u.toString())) return "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    return u.toString();
  } catch {
    return "";
  }
}

/** Convert JSON-LD schemas to ScrapedBusiness objects. */
function schemasToBusinesses(
  schemas: any[], category: string, city: string, country: string, source: string
): ScrapedBusiness[] {
  return schemas
    .filter(s => s && s.name && schemaTypeLooksLikeBusiness(String(s["@type"] ?? "")))
    .map(s => ({
      businessName: String(s.name).trim(),
      phone: String(s.telephone ?? s.phone ?? "").trim(),
      website: cleanWebsiteUrl(String(s.url ?? s.sameAs ?? "").trim()),
      address: typeof s.address === "string"
        ? s.address
        : [s.address?.streetAddress, s.address?.addressLocality].filter(Boolean).join(", "),
      city,
      country,
      category,
      source,
      email: String(s.email ?? "").trim(),
    }))
    .filter(b => b.businessName.length >= 2);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

function dedup(list: ScrapedBusiness[]): ScrapedBusiness[] {
  const byKey = new Map<string, ScrapedBusiness>();
  for (const b of list) {
    const key = normalizeName(b.businessName);
    if (!key || key.length < 2) continue;
    const cleanSite = cleanWebsiteUrl(b.website);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...b, website: cleanSite });
    } else {
      if (!existing.website && cleanSite) existing.website = cleanSite;
      if (!existing.email && b.email) existing.email = b.email;
      if (!existing.phone && b.phone) existing.phone = b.phone;
      if (!existing.address && b.address) existing.address = b.address;
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const scoreA = (a.email ? 4 : 0) + (a.website ? 2 : 0) + (a.phone ? 1 : 0);
    const scoreB = (b.email ? 4 : 0) + (b.website ? 2 : 0) + (b.phone ? 1 : 0);
    return scoreB - scoreA;
  });
}

// ─── SCRAPER 1: Yelp ─────────────────────────────────────────────────────────

async function scrapeYelp(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(category)}&find_loc=${encodeURIComponent(`${city}, ${country}`)}&ns=1&sortby=recommended`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "yelp");

  // Strategy 2 — Yelp's server-side hypernova JSON comment block
  const hypernovaMatch = html.match(/data-hypernova-key="yelpfrontend_[^"]*BizListingApp"[^>]*><!--([\s\S]*?)--><\/div>/i);
  if (hypernovaMatch) {
    try {
      const parsed = JSON.parse(hypernovaMatch[1]);
      const listProps =
        parsed?.legacyProps?.searchAppProps?.searchPageProps?.mainContentComponentsListProps ??
        parsed?.searchPageProps?.mainContentComponentsListProps ?? [];
      for (const item of listProps) {
        const biz = item?.bizListingProps ?? item?.bizListing;
        if (!biz?.name) continue;
        businesses.push({
          businessName: biz.name,
          phone: biz.phone ?? "",
          website: biz.websiteUrl ?? biz.bizUrl ?? "",
          address: [biz.address1, biz.city].filter(Boolean).join(", "),
          city, country, category, source: "yelp", email: "",
        });
      }
    } catch {}
  }

  // Strategy 3 — window.__YELP_STATE__
  const stateMatch = html.match(/window\.__YELP_STATE__\s*=\s*(\{[\s\S]+?\});\s*(?:window\.|<\/script>)/);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      const bizList: any[] =
        state?.search?.mapState?.businessList ??
        state?.bizs?.businesses ?? [];
      for (const biz of bizList) {
        if (!biz?.name) continue;
        businesses.push({
          businessName: biz.name,
          phone: biz.phone ?? "",
          website: biz.website?.url ?? biz.websiteUrl ?? "",
          address: biz.formattedAddress ?? "",
          city, country, category, source: "yelp", email: "",
        });
      }
    } catch {}
  }

  // Strategy 4 — Raw HTML business-name links
  const cardRe = /<h3[^>]*>\s*<span[^>]*>\s*(?:\d+\.\s*)?<\/span>\s*<a[^>]+href="\/biz\/([^"?]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const name = m[2].trim();
    if (name) businesses.push({ businessName: name, phone: "", website: `https://www.yelp.com/biz/${m[1]}`, address: "", city, country, category, source: "yelp", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 2: Yellow Pages (US + Canada) ───────────────────────────────────

async function scrapeYellowPages(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const isCA = /\b(canada|ontario|british columbia|alberta|quebec|manitoba|nova scotia|new brunswick|newfoundland|saskatchewan|prince edward)\b/i.test(country);
  const domain = isCA ? "yellowpages.ca" : "yellowpages.com";
  const businesses: ScrapedBusiness[] = [];

  function parseYPHtml(html: string) {
    businesses.push(...schemasToBusinesses(extractJsonLd(html), category, city, country, "yellowpages"));
    const sections = html.split(/<div[^>]+class="[^"]*v-card[^"]*"/i).slice(1);
    for (const sec of sections) {
      const name =
        (/<a[^>]+class="[^"]*business-name[^"]*"[^>]*>(?:<span[^>]*>)?([^<]{2,80})(?:<\/span>)?<\/a>/i.exec(sec))?.[1]?.trim() ??
        (/<h2[^>]*>[\s\S]{0,20}<a[^>]*>([^<]{2,80})<\/a>/i.exec(sec))?.[1]?.trim();
      if (!name) continue;
      const phone =
        (/<div[^>]+class="[^"]*(?:phones|phone primary)[^"]*"[^>]*>[\s\S]*?([+\d][(\d\s\-)\.]{6,18}\d)/i.exec(sec))?.[1]?.trim() ?? "";
      const rawWebsite =
        (/<a[^>]+class="[^"]*track-visit-website[^"]*"[^>]+href="([^"]+)"/i.exec(sec))?.[1]?.trim() ??
        (/rel="noopener nofollow"[^>]+href="([^"]+)"/i.exec(sec))?.[1]?.trim() ?? "";
      const website = cleanWebsiteUrl(rawWebsite);
      const address =
        (/<span[^>]+class="[^"]*street-address[^"]*"[^>]*>([^<]+)<\/span>/i.exec(sec))?.[1]?.trim() ?? "";
      businesses.push({ businessName: name, phone, website, address, city, country, category, source: "yellowpages", email: "" });
    }
  }

  // Scrape up to 5 pages in parallel
  const pages = Math.min(Math.max(Math.ceil(count / 10), 2), 5);
  const urls = Array.from({ length: pages }, (_, i) => {
    const base = `https://www.${domain}/search?search_terms=${encodeURIComponent(category)}&geo_location_terms=${encodeURIComponent(city)}`;
    return i === 0 ? base : `${base}&page=${i + 1}`;
  });

  const results = await Promise.allSettled(urls.map(u => browserFetch(u)));
  for (const r of results) {
    if (r.status === "fulfilled") parseYPHtml(r.value);
  }

  return dedup(businesses).slice(0, Math.max(count * 3, 45));
}

// ─── SCRAPER 3: Google Local / GMB (tbm=lcl gives the My Business results tab) ─

async function scrapeGoogleLocal(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const q = `${category} in ${city} ${country}`;
  const businesses: ScrapedBusiness[] = [];

  // ── Pass 1: tbm=lcl — Google's local/GMB results tab ──────────────────────
  // This is the same data shown in the "Places" section and pulls directly from
  // Google My Business profiles (name, address, phone, website, rating).
  const lclUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=lcl&num=20&hl=en`;
  const lclHtml = await browserFetch(lclUrl);

  // JSON-LD is sometimes embedded in local results
  businesses.push(...schemasToBusinesses(extractJsonLd(lclHtml), category, city, country, "google-gmb"));

  // The local results page embeds business data in JS callback blobs like:
  //   AF_initDataCallback({key:'ds:1', data:[[["Business Name","address","phone",...]],...}
  // We extract all strings that look like business names near phone/address patterns.
  const afBlocks = lclHtml.matchAll(/AF_initDataCallback\(\{[^}]+data:([\s\S]+?)\}\);/g);
  for (const block of afBlocks) {
    try {
      // Pull quoted strings of plausible business-name length from the blob
      const names = [...block[1].matchAll(/"([A-Z][^"]{2,60})"/g)]
        .map(x => x[1])
        .filter(n => /^[A-Z]/.test(n) && !/^https?:/.test(n) && n.split(" ").length <= 8);
      // Pull phone numbers
      const phones = [...block[1].matchAll(/"(\+?[\d\s\-().]{7,20})"/g)].map(x => x[1].trim());
      // Pull website-like URLs
      const sites = [...block[1].matchAll(/"(https?:\/\/[^"]{4,100})"/g)].map(x => x[1]);
      for (let i = 0; i < names.length; i++) {
        businesses.push({
          businessName: names[i],
          phone: phones[i] ?? "",
          website: sites[i] ?? "",
          address: "",
          city, country, category,
          source: "google-gmb",
          email: "",
        });
      }
    } catch {}
  }

  // Known GMB card HTML patterns for the local results page
  // <div class="rllt__details"> <div class="dbg0pd">Name</div> ... </div>
  const lclCardRe = /<div[^>]+class="[^"]*rllt__details[^"]*"[^>]*>([\s\S]{20,500}?)<\/div>\s*<\/div>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = lclCardRe.exec(lclHtml)) !== null) {
    const card = lm[1];
    const name = (/<div[^>]+class="[^"]*(?:dbg0pd|OSrXXb|NsNu7e|uMdZh)[^"]*"[^>]*>([^<]{2,80})<\/div>/i.exec(card))?.[1]?.trim();
    const phone = (/(\+?[\d\s\-().]{7,20})/.exec(
      (/<span[^>]+class="[^"]*(?:rllt__wrapped-text|LrzXr)[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1] ?? ""
    ))?.[1]?.trim() ?? "";
    const website = (/<a[^>]+href="(https?:\/\/[^"]{4,100})"[^>]*class="[^"]*(?:yYlJEf|rllt__link)[^"]*"/i.exec(card))?.[1] ?? "";
    if (name) {
      businesses.push({ businessName: name, phone, website, address: "", city, country, category, source: "google-gmb", email: "" });
    }
  }

  // ── Pass 2: regular search — local 3-pack JSON-LD + script blocks ──────────
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=20&hl=en`;
  const html = await browserFetch(url);
  businesses.push(...schemasToBusinesses(extractJsonLd(html), category, city, country, "google"));

  const bigJsonRe = /<script[^>]*>\s*(?:window\._sharedData\s*=\s*|AF_initDataCallback\(|var _pageData\s*=\s*)?(\{[\s\S]{200,}?\})\s*(?:;|\))\s*<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = bigJsonRe.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      const stringify = JSON.stringify(obj);
      const innerSchemas = extractJsonLd(`<script type="application/ld+json">${stringify}</script>`);
      businesses.push(...schemasToBusinesses(innerSchemas, category, city, country, "google"));
    } catch {}
  }

  // HTML fallback: known 3-pack class names
  const nameRe = /<(?:div|span|h3)[^>]+class="(?:OSrXXb|dbg0pd|qrShPb|uMdZh tNxQIb yl|fc9yUc|Zt0a5e|NsNu7e)[^"]*"[^>]*>([^<]{3,80})<\/(?:div|span|h3)>/gi;
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1].trim();
    if (name && name.length >= 3) {
      businesses.push({ businessName: name, phone: "", website: "", address: "", city, country, category, source: "google", email: "" });
    }
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 4: Manta (US SMB directory) ─────────────────────────────────────

async function scrapeManta(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const q = encodeURIComponent(`${category} ${city}`);
  const url = `https://www.manta.com/mb?search%5Bq%5D=${q}&search%5Blocation%5D=${encodeURIComponent(city)}`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "manta");

  // Manta card: <article class="... listing-card ..."> <h2 ...><a>Name</a></h2>
  const cards = html.split(/<article[^>]+class="[^"]*(?:listing-card|result-item)[^"]*"/i).slice(1);
  for (const card of cards) {
    if (businesses.length >= count * 2) break;
    const name =
      (/<h[23][^>]*>[\s\S]{0,30}<a[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim() ??
      (/<a[^>]+class="[^"]*(?:company-name|listing-name)[^"]*"[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim();
    if (!name) continue;

    const phone = (/<span[^>]+class="[^"]*phone[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ?? "";
    const website = (/<a[^>]+class="[^"]*(?:website|web-url)[^"]*"[^>]+href="([^"]+)"/i.exec(card))?.[1]?.trim() ?? "";
    businesses.push({ businessName: name, phone, website, address: "", city, country, category, source: "manta", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 5: Hotfrog (international) ──────────────────────────────────────

const HOTFROG_TLD: Record<string, string> = {
  "australia": "com.au", "au": "com.au",
  "united kingdom": "co.uk", "uk": "co.uk", "england": "co.uk",
  "scotland": "co.uk", "wales": "co.uk", "northern ireland": "co.uk",
  "canada": "ca", "ca": "ca",
  "new zealand": "co.nz", "nz": "co.nz",
  "south africa": "co.za", "za": "co.za",
  "india": "in", "ireland": "ie",
  "singapore": "sg", "malaysia": "my",
  "philippines": "ph", "nigeria": "ng",
};

async function scrapeHotfrog(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const tld = HOTFROG_TLD[country.toLowerCase()] ?? "com";
  const url = `https://www.hotfrog.${tld}/search/${encodeURIComponent(country)}/${encodeURIComponent(city)}/${encodeURIComponent(category)}`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "hotfrog");

  const cards = html.split(/<(?:div|article)[^>]+class="[^"]*(?:listing-card|result-item|business-card)[^"]*"/i).slice(1);
  for (const card of cards) {
    if (businesses.length >= count * 2) break;
    const name =
      (/<h[23][^>]*>[\s\S]{0,20}<a[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim() ??
      (/<a[^>]+class="[^"]*(?:company|business|title|name)[^"]*"[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim();
    if (!name) continue;

    const phone =
      (/<span[^>]+class="[^"]*phone[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ??
      (/href="tel:([^"]+)"/i.exec(card))?.[1]?.trim() ?? "";
    const website =
      (/<a[^>]+(?:class="[^"]*website[^"]*"|rel="nofollow")[^>]+href="(https?:\/\/[^"]+)"/i.exec(card))?.[1]?.trim() ?? "";
    businesses.push({ businessName: name, phone, website, address: "", city, country, category, source: "hotfrog", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 6: Yell.com (UK) ─────────────────────────────────────────────────

async function scrapeYell(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  if (!/\b(uk|united kingdom|england|scotland|wales|ireland|northern ireland)\b/i.test(country)) return [];
  const catSlug = category.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const citySlug = city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const url = `https://www.yell.com/s/${catSlug}/${citySlug}/`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "yell");

  const cards = html.split(/<article[^>]+class="[^"]*businessCapsule[^"]*"/i).slice(1);
  for (const card of cards) {
    if (businesses.length >= count * 2) break;
    const name =
      (/<a[^>]+class="[^"]*businessCapsule--title[^"]*"[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim() ??
      (/<h3[^>]*>[\s\S]{0,30}<a[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim();
    if (!name) continue;

    const phone =
      (/href="tel:([^"]+)"/i.exec(card))?.[1]?.trim() ??
      (/<span[^>]+class="[^"]*(?:phone|tel)[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ?? "";
    const website =
      (/<a[^>]+(?:class="[^"]*website[^"]*"|data-type="website")[^>]+href="(https?:\/\/[^"]+)"/i.exec(card))?.[1]?.trim() ?? "";
    businesses.push({ businessName: name, phone: phone.replace(/^tel:/, ""), website, address: "", city, country, category, source: "yell", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 7: Foursquare Places API v3 ─────────────────────────────────────
//
// Free tier: 1,000 calls/day per account, no credit card required.
// Add accounts at: Admin → Automation → Data Sources → Foursquare
// Multiple accounts rotate round-robin to multiply daily quota.

async function scrapeFoursquare(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const keys = await getAllKeys("foursquare");
  if (keys.length === 0) return [];

  const businesses: ScrapedBusiness[] = [];
  const perPage = 50;
  // Total pages = up to 10 per key (500 results/key); rotate key per page
  const totalPages = Math.min(Math.ceil(count / perPage), 10 * keys.length);

  const baseParams = new URLSearchParams({
    query: category,
    near: `${city}, ${country}`,
    limit: String(perPage),
    fields: "name,location,tel,website,email,categories",
  });

  for (let page = 0; page < totalPages && businesses.length < count; page++) {
    const apiKey = keys[page % keys.length];   // round-robin across accounts
    try {
      const url = new URL("https://api.foursquare.com/v3/places/search");
      baseParams.forEach((v, k) => url.searchParams.set(k, v));
      if (page > 0) url.searchParams.set("offset", String(page * perPage));

      const res = await Promise.race([
        fetch(url.toString(), {
          headers: { "Authorization": apiKey, "Accept": "application/json" },
        }),
        new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 15000)),
      ]) as Response;

      if (res.status === 429) { await new Promise(r => setTimeout(r, 1500)); continue; }
      if (!res.ok) continue;   // try next page / key

      const data = await res.json() as {
        results?: Array<{
          name?: string; tel?: string; website?: string; email?: string;
          location?: { formatted_address?: string; address?: string; locality?: string };
        }>
      };

      const results = data.results ?? [];
      for (const p of results) {
        if (!p.name) continue;
        businesses.push({
          businessName: p.name,
          phone:   p.tel     ?? "",
          website: p.website ?? "",
          email:   p.email   ?? "",
          address: p.location?.formatted_address ?? p.location?.address ?? "",
          city:    p.location?.locality ?? city,
          country, category, source: "foursquare_api",
        });
      }
    } catch { continue; }
  }

  return dedup(businesses).slice(0, count);
}

// ISO-3166-1 alpha-2 lookup for the most common country inputs.
// TomTom countrySet requires comma-separated ISO-2 codes.
const COUNTRY_TO_ISO2: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "angola": "AO",
  "argentina": "AR", "australia": "AU", "austria": "AT", "bahrain": "BH",
  "bangladesh": "BD", "belgium": "BE", "brazil": "BR", "bulgaria": "BG",
  "canada": "CA", "chile": "CL", "china": "CN", "colombia": "CO",
  "croatia": "HR", "cyprus": "CY", "czech": "CZ", "czechia": "CZ",
  "denmark": "DK", "egypt": "EG", "ethiopia": "ET", "finland": "FI",
  "france": "FR", "germany": "DE", "ghana": "GH", "greece": "GR",
  "hong kong": "HK", "hungary": "HU", "india": "IN", "indonesia": "ID",
  "iran": "IR", "iraq": "IQ", "ireland": "IE", "israel": "IL",
  "italy": "IT", "ivory coast": "CI", "côte d'ivoire": "CI",
  "japan": "JP", "jordan": "JO", "kenya": "KE", "kuwait": "KW",
  "lebanon": "LB", "libya": "LY", "malaysia": "MY", "mexico": "MX",
  "morocco": "MA", "mozambique": "MZ", "netherlands": "NL", "new zealand": "NZ",
  "nigeria": "NG", "norway": "NO", "pakistan": "PK", "peru": "PE",
  "philippines": "PH", "poland": "PL", "portugal": "PT", "qatar": "QA",
  "romania": "RO", "russia": "RU", "saudi arabia": "SA", "senegal": "SN",
  "singapore": "SG", "slovakia": "SK", "south africa": "ZA", "south korea": "KR",
  "spain": "ES", "sweden": "SE", "switzerland": "CH", "taiwan": "TW",
  "tanzania": "TZ", "thailand": "TH", "tunisia": "TN", "turkey": "TR",
  "turkiye": "TR", "uganda": "UG", "ukraine": "UA",
  "united arab emirates": "AE", "uae": "AE", "dubai": "AE",
  "united kingdom": "GB", "uk": "GB", "england": "GB", "britain": "GB",
  "united states": "US", "usa": "US", "us": "US", "america": "US",
  "venezuela": "VE", "vietnam": "VN", "zimbabwe": "ZW",
};

function countryToIso2(country: string): string {
  const key = country.toLowerCase().trim();
  // Direct match
  if (COUNTRY_TO_ISO2[key]) return COUNTRY_TO_ISO2[key];
  // Partial match — e.g. "United Kingdom of ..." → "GB"
  for (const [k, v] of Object.entries(COUNTRY_TO_ISO2)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // Already an ISO-2 code?
  if (/^[A-Z]{2}$/i.test(key)) return key.toUpperCase();
  // Fallback: pass as-is and let TomTom handle it
  return country;
}

// ─── SCRAPER 8b: TomTom Search API v2 ────────────────────────────────────────
//
// Free tier: 2,500 requests/day per account, no credit card required.
// Add accounts at: Admin → Automation → Data Sources → TomTom
// Pagination uses `ofs` (NOT `offset`); countrySet takes ISO-3166-1 alpha-2.

async function scrapeTomTom(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const keys = await getAllKeys("tomtom");
  if (keys.length === 0) return [];

  const iso2 = countryToIso2(country);
  const businesses: ScrapedBusiness[] = [];
  const perPage = 100;
  const totalPages = Math.min(Math.ceil(count / perPage), 5 * keys.length);

  for (let page = 0; page < totalPages && businesses.length < count; page++) {
    const apiKey = keys[page % keys.length];
    try {
      const ofs = page * perPage;
      const q = encodeURIComponent(`${category} ${city}`);
      const url =
        `https://api.tomtom.com/search/2/poiSearch/${q}.json` +
        `?key=${apiKey}&countrySet=${iso2}&limit=${perPage}&ofs=${ofs}&language=en-GB`;

      const res = await Promise.race([
        fetch(url, { headers: { "User-Agent": "DevStudio-BusinessHunter/1.0" } }),
        new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 15000)),
      ]) as Response;

      if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
      if (!res.ok) continue;

      const data = await res.json() as {
        results?: Array<{
          poi?: { name?: string; phone?: string; url?: string };
          address?: { freeformAddress?: string; municipality?: string };
        }>
      };

      const results = data.results ?? [];
      if (results.length === 0) break;

      for (const r of results) {
        const name = r.poi?.name;
        if (!name) continue;
        businesses.push({
          businessName: name,
          phone:   r.poi?.phone ?? "",
          website: r.poi?.url   ?? "",
          email:   "",
          address: r.address?.freeformAddress ?? "",
          city:    r.address?.municipality ?? city,
          country, category, source: "tomtom_api",
        });
      }
    } catch { continue; }
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 8c: HERE Discover API ───────────────────────────────────────────
//
// Free tier: 1,000 calls/day per account, no credit card required.
// Add accounts at: Admin → Automation → Data Sources → HERE
// Signup: https://developer.here.com → Create app → copy API key.

async function scrapeHere(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const keys = await getAllKeys("here");
  if (keys.length === 0) return [];

  // Geocode city → lat,lon using Nominatim (same as OSM scraper — free, no key)
  let lat: number, lon: number;
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${city}, ${country}`)}`;
    const geoRes = await Promise.race([
      fetch(geoUrl, { headers: { "User-Agent": "DevStudio-BusinessHunter/1.0" } }),
      new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 10000)),
    ]) as Response;
    const geo = await geoRes.json() as Array<{ lat: string; lon: string }>;
    if (!geo.length) return [];
    lat = parseFloat(geo[0].lat);
    lon = parseFloat(geo[0].lon);
  } catch { return []; }

  const businesses: ScrapedBusiness[] = [];
  const perPage = 100;
  // Run each key as a separate offset block in parallel for speed
  const pagesPerKey = Math.min(Math.ceil(count / (perPage * keys.length)), 3);

  const requests = keys.flatMap((apiKey, ki) =>
    Array.from({ length: pagesPerKey }, (_, pi) => ({ apiKey, offset: (ki * pagesPerKey + pi) * perPage }))
  );

  const settled = await Promise.allSettled(
    requests.map(({ apiKey, offset }) => {
      const url =
        `https://discover.search.hereapi.com/v1/discover` +
        `?at=${lat},${lon}&q=${encodeURIComponent(category)}&limit=${perPage}&offset=${offset}&lang=en&apiKey=${apiKey}`;
      return Promise.race([
        fetch(url, { headers: { "User-Agent": "DevStudio-BusinessHunter/1.0" } }),
        new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 15000)),
      ]) as Promise<Response>;
    })
  );

  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value.ok) continue;
    try {
      const data = await r.value.json() as {
        items?: Array<{
          title?: string;
          address?: { label?: string; city?: string };
          contacts?: Array<{
            phone?: Array<{ value?: string }>;
            www?:   Array<{ value?: string }>;
            email?: Array<{ value?: string }>;
          }>;
        }>
      };
      for (const item of data.items ?? []) {
        if (!item.title) continue;
        const contacts = item.contacts?.[0] ?? {};
        businesses.push({
          businessName: item.title,
          phone:   contacts.phone?.[0]?.value ?? "",
          website: contacts.www?.[0]?.value   ?? "",
          email:   contacts.email?.[0]?.value ?? "",
          address: item.address?.label ?? "",
          city:    item.address?.city  ?? city,
          country, category, source: "here_api",
        });
      }
    } catch {}
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 8: Bing Local ────────────────────────────────────────────────────

async function scrapeBingLocal(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const q = `${category} near ${city} ${country}`;
  const url = `https://www.bing.com/local/search?q=${encodeURIComponent(q)}&setlang=en-US`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "bing");

  // Bing local card blocks
  const cards = html.split(/<div[^>]+class="[^"]*(?:b_localListItemHolder|loc_detail)[^"]*"/i).slice(1);
  for (const card of cards) {
    if (businesses.length >= count * 2) break;
    const name =
      (/<h2[^>]+class="[^"]*b_entityTitle[^"]*"[^>]*>([^<]{2,80})<\/h2>/i.exec(card))?.[1]?.trim() ??
      (/<span[^>]+class="[^"]*nc_tc[^"]*"[^>]*>([^<]{2,80})<\/span>/i.exec(card))?.[1]?.trim();
    if (!name) continue;

    const phone =
      (/href="tel:([^"]+)"/i.exec(card))?.[1]?.trim() ??
      (/<span[^>]+class="[^"]*b_phone[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ?? "";
    const website =
      (/<a[^>]+href="(https?:\/\/(?!www\.bing\.|www\.microsoft\.)[^"]+)"[^>]*>\s*(?:Website|Visit|Go to)/i.exec(card))?.[1]?.trim() ?? "";
    businesses.push({ businessName: name, phone: phone.replace(/^tel:/, ""), website, address: "", city, country, category, source: "bing", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 9: TripAdvisor ───────────────────────────────────────────────────

async function scrapeTripAdvisor(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const q = `${category} ${city} ${country}`;
  const url = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}&searchSessionId=x&sid=x&blockRedirect=true`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "tripadvisor");

  // TripAdvisor search result cards: <div class="result-title">
  const nameRe = /<div[^>]+class="[^"]*(?:result-title|listing_title|property_title)[^"]*"[^>]*>[\s\S]{0,60}?<a[^>]*>([^<]{2,80})<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1].trim().replace(/^\d+\.\s*/, "");
    if (name.length >= 2) {
      businesses.push({ businessName: name, phone: "", website: "", address: "", city, country, category, source: "tripadvisor", email: "" });
    }
  }

  // Also try: restaurant/attraction listing pages for the city
  const cityUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(`${category} in ${city}`)}&geo=1`;
  try {
    const html2 = await browserFetch(cityUrl);
    businesses.push(...schemasToBusinesses(extractJsonLd(html2), category, city, country, "tripadvisor"));
    let m2: RegExpExecArray | null;
    const re2 = /<a[^>]+class="[^"]*(?:BMQDV|property_title|listing_title)[^"]*"[^>]*>([^<]{2,80})<\/a>/gi;
    while ((m2 = re2.exec(html2)) !== null) {
      const name = m2[1].trim().replace(/^\d+\.\s*/, "");
      if (name.length >= 2) businesses.push({ businessName: name, phone: "", website: "", address: "", city, country, category, source: "tripadvisor", email: "" });
    }
  } catch {}

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 10: BBB — Better Business Bureau (US/Canada) ────────────────────

async function scrapeBBB(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  // BBB is primarily US/Canada
  if (!/\b(usa|us|united states|america|canada)\b/i.test(country || "usa")) return [];
  const url = `https://www.bbb.org/search?find_text=${encodeURIComponent(category)}&find_loc=${encodeURIComponent(city)}`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "bbb");

  // BBB result cards
  const cards = html.split(/<div[^>]+class="[^"]*(?:result-card|SearchResults_result)[^"]*"/i).slice(1);
  for (const card of cards) {
    if (businesses.length >= count * 2) break;
    const name =
      (/<a[^>]+class="[^"]*(?:result-business-name|BusinessName)[^"]*"[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim() ??
      (/<h3[^>]*>[\s\S]{0,20}<a[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim();
    if (!name) continue;
    const phone = (/<span[^>]+class="[^"]*phone[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ?? "";
    const website = (/<a[^>]+href="(https?:\/\/(?!www\.bbb\.org)[^"]+)"[^>]*>(?:Visit Website|Website)/i.exec(card))?.[1] ?? "";
    const address = (/<address[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ?? "";
    businesses.push({ businessName: name, phone, website, address, city, country, category, source: "bbb", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 11: Thumbtack (US service businesses) ────────────────────────────

async function scrapeThumbtrack(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  if (!/\b(usa|us|united states|america)\b/i.test(country || "usa")) return [];
  const catSlug = category.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const citySlug = city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const url = `https://www.thumbtack.com/k/${catSlug}/${citySlug}/`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "thumbtack");

  // Thumbtack Next.js data
  const nextMatch = /<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/i.exec(html);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const pros: any[] =
        data?.props?.pageProps?.pros ??
        data?.props?.pageProps?.initialSearchState?.pros ??
        data?.props?.pageProps?.data?.pros ?? [];
      for (const pro of pros) {
        if (!pro?.name) continue;
        businesses.push({
          businessName: pro.name,
          phone: pro.phone ?? "",
          website: pro.website ?? pro.websiteUrl ?? "",
          address: pro.location?.address ?? "",
          city, country, category, source: "thumbtack", email: pro.email ?? "",
        });
      }
    } catch {}
  }

  // HTML fallback: pro card names
  const nameRe = /<span[^>]+class="[^"]*(?:provider-name|pro-name|ProName)[^"]*"[^>]*>([^<]{2,80})<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1].trim();
    if (name.length >= 2) businesses.push({ businessName: name, phone: "", website: "", address: "", city, country, category, source: "thumbtack", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 12: Cylex (international business directory) ────────────────────

async function scrapeCylex(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  // Cylex has country-specific domains
  const domain = (/\b(uk|united kingdom|england)\b/i.test(country)) ? "cylex.co.uk"
    : (/\b(canada)\b/i.test(country)) ? "cylex.ca"
    : (/\b(australia)\b/i.test(country)) ? "cylex.com.au"
    : (/\b(germany|deutschland)\b/i.test(country)) ? "cylex.de"
    : "cylex.us.com";
  const url = `https://www.${domain}/results/${encodeURIComponent(city)}/${encodeURIComponent(category)}.html`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "cylex");

  // Cylex listing cards
  const cards = html.split(/<(?:div|li)[^>]+class="[^"]*(?:m-result|result-item|module-provider)[^"]*"/i).slice(1);
  for (const card of cards) {
    if (businesses.length >= count * 2) break;
    const name =
      (/<h2[^>]*>[\s\S]{0,20}<a[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim() ??
      (/<a[^>]+class="[^"]*(?:company-name|entry-name)[^"]*"[^>]*>([^<]{2,80})<\/a>/i.exec(card))?.[1]?.trim();
    if (!name) continue;
    const phone = (/href="tel:([^"]+)"/i.exec(card))?.[1]?.trim() ?? "";
    const website = (/<a[^>]+(?:class="[^"]*website[^"]*"|rel="nofollow external")[^>]+href="(https?:\/\/(?!www\.cylex)[^"]+)"/i.exec(card))?.[1] ?? "";
    const address = (/<span[^>]+class="[^"]*(?:address|street)[^"]*"[^>]*>([^<]{5,100})<\/span>/i.exec(card))?.[1]?.trim() ?? "";
    businesses.push({ businessName: name, phone: phone.replace(/^tel:/, ""), website, address, city, country, category, source: "cylex", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 13: SuperPages (US) ─────────────────────────────────────────────

async function scrapeSuperPages(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  if (!/\b(usa|us|united states|america)\b/i.test(country || "usa")) return [];
  const businesses: ScrapedBusiness[] = [];

  function parseSPHtml(html: string) {
    businesses.push(...schemasToBusinesses(extractJsonLd(html), category, city, country, "superpages"));
    const cards = html.split(/<div[^>]+class="[^"]*(?:v-card|srp-listing|search-result-item)[^"]*"/i).slice(1);
    for (const card of cards) {
      const name =
        (/<a[^>]+class="[^"]*business-name[^"]*"[^>]*>(?:<span[^>]*>)?([^<]{2,80})(?:<\/span>)?<\/a>/i.exec(card))?.[1]?.trim() ??
        (/<span[^>]+class="[^"]*business-name[^"]*"[^>]*>([^<]{2,80})<\/span>/i.exec(card))?.[1]?.trim();
      if (!name) continue;
      const phone =
        (/<a[^>]+href="tel:([^"]+)"/i.exec(card))?.[1]?.trim() ??
        (/<span[^>]+class="[^"]*call-number[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ??
        (/<div[^>]+class="[^"]*phones[^"]*"[^>]*>[\s\S]{0,50}?([+\d][(\d\s\-)\.]{6,18}\d)/i.exec(card))?.[1]?.trim() ?? "";
      const rawWebsite =
        (/<a[^>]+class="[^"]*(?:track-visit-website|weblink-button)[^"]*"[^>]+href="([^"]+)"/i.exec(card))?.[1]?.trim() ?? "";
      const website = cleanWebsiteUrl(rawWebsite);
      const address = (/<span[^>]+class="[^"]*street-address[^"]*"[^>]*>([^<]+)<\/span>/i.exec(card))?.[1]?.trim() ?? "";
      businesses.push({ businessName: name, phone, website, address, city, country, category, source: "superpages", email: "" });
    }
  }

  const pages = Math.min(Math.max(Math.ceil(count / 15), 2), 4);
  const urls = Array.from({ length: pages }, (_, i) => {
    const base = `https://www.superpages.com/search?search_terms=${encodeURIComponent(category)}&geo_location_terms=${encodeURIComponent(city)}`;
    return i === 0 ? base : `${base}&page=${i + 1}`;
  });
  const results = await Promise.allSettled(urls.map(u => browserFetch(u)));
  for (const r of results) {
    if (r.status === "fulfilled") parseSPHtml(r.value);
  }

  return dedup(businesses).slice(0, Math.max(count * 3, 45));
}

// ─── SCRAPER 14: Bark.com (global service marketplace) ───────────────────────

async function scrapeBark(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const countryCode = (/\b(uk|united kingdom|england|scotland|wales)\b/i.test(country)) ? "gb"
    : (/\b(canada)\b/i.test(country)) ? "ca"
    : (/\b(australia)\b/i.test(country)) ? "au"
    : (/\b(ireland)\b/i.test(country)) ? "ie"
    : "us";
  const catSlug = category.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const citySlug = city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const url = `https://www.bark.com/en/${countryCode}/near-me/${catSlug}/${citySlug}/`;
  const html = await browserFetch(url);
  const businesses: ScrapedBusiness[] = schemasToBusinesses(extractJsonLd(html), category, city, country, "bark");

  // Bark Next.js data
  const nextMatch = /<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/i.exec(html);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const pros: any[] =
        data?.props?.pageProps?.profiles ??
        data?.props?.pageProps?.professionals ??
        data?.props?.pageProps?.sellers ?? [];
      for (const pro of pros) {
        const name = pro?.name ?? pro?.display_name ?? pro?.businessName;
        if (!name) continue;
        businesses.push({
          businessName: String(name),
          phone: pro.phone ?? "",
          website: pro.website ?? pro.url ?? "",
          address: pro.location ?? pro.address ?? "",
          city, country, category, source: "bark", email: pro.email ?? "",
        });
      }
    } catch {}
  }

  // HTML fallback
  const nameRe = /<(?:h[23]|span)[^>]+class="[^"]*(?:profile-name|seller-name|pro-name)[^"]*"[^>]*>([^<]{2,80})<\/(?:h[23]|span)>/gi;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1].trim();
    if (name.length >= 2) businesses.push({ businessName: name, phone: "", website: "", address: "", city, country, category, source: "bark", email: "" });
  }

  return dedup(businesses).slice(0, count);
}

// ─── Email extraction from websites ──────────────────────────────────────────

const SKIP_EMAIL = /noreply|no-reply|donotreply|unsubscribe|privacy|legal|abuse|spam|webmaster|admin@|sentry\.io|cloudflare|wix\.com|squarespace|shopify|wordpress|example\.com|test@|@yelp\.|@manta\.|@hotfrog\.|@yell\.|foursquare|@tripadvisor\.|@bbb\.|@thumbtack\.|@bark\.|@superpages\.|@cylex\.|@yellowpages\.|@domain\.com|@mystore\.com|@yourdomain\.com|@yourcompany\.com|@company\.com|@yoursite\.com|@website\.com|@email\.com|user@domain|name@domain|@mydomain\.com|@sample\.com|@placeholder|@dummy|@fake|you@|@somewhere\.com|@site\.com|sentry-next\.wixpress|@wixpress\.com|godaddy\.com|@squareup\.com|@mailinator\.com|@yopmail/i;

// Directory domains whose URLs we should NOT try to scrape for a business email
const SKIP_WEBSITE = /^https?:\/\/(?:www\.)?(yelp\.com|manta\.com|hotfrog\.|yell\.com|foursquare\.com|yellowpages\.|bing\.com|google\.com|facebook\.com|instagram\.com|twitter\.com|linkedin\.com|tripadvisor\.com|bbb\.org|thumbtack\.com|bark\.com|superpages\.com|cylex\.)/i;

// ─── AI-agent opportunity scanner ─────────────────────────────────────────────

/** Known live-chat / conversational-AI widget signatures — if present, the business already has automation. */
const CHAT_WIDGET_RE = /intercom|drift\.com|tawk\.to|tidio|crisp\.chat|livechatinc|zopim|zdassets\.com\/zendesk|hubspot.*conversations|manychat|chatbot\.com|freshchat|gorgias-chat|chatra|smartsupp|olark|purechat|liveperson/i;
/** Known booking / scheduling widget signatures — indicates some workflow automation already exists. */
const BOOKING_WIDGET_RE = /calendly\.com|acuityscheduling|squareup\.com\/appointments|setmore|booksy\.com|schedulicity|simplybook|appointy|square-online-booking/i;
/** Signs of an online ordering / e-commerce checkout flow already in place. */
const ORDER_WIDGET_RE = /toasttab\.com|clover\.com\/online-ordering|square-online|doordash\.com\/merchant|ubereats\.com|grubhub|shopify\.com\/checkouts/i;
/** A real <form> element (vs. just a mailto/phone link) suggests some lead-capture already exists. */
const FORM_RE = /<form[\s>]/i;

/**
 * Scan a business's homepage HTML for signals of whether they'd benefit from
 * an AI agent (chatbot / booking assistant / auto-responder). This replaces
 * a hardcoded guess with a real, verifiable read of what's actually on their site.
 */
function analyzeAIOpportunity(html: string): { score: number; note: string } {
  const hasChat = CHAT_WIDGET_RE.test(html);
  const hasBooking = BOOKING_WIDGET_RE.test(html);
  const hasOrdering = ORDER_WIDGET_RE.test(html);
  const hasForm = FORM_RE.test(html);

  if (hasChat) {
    return { score: 2, note: "Already running a live-chat widget — lower priority for an AI agent pitch." };
  }
  if (hasBooking || hasOrdering) {
    return { score: 4, note: hasBooking ? "Has online booking but no chat/AI assistant — could upsell an AI booking agent." : "Has online ordering but no chat assistant — room for an AI agent upsell." };
  }
  if (!hasForm) {
    return { score: 9, note: "No chat widget, no booking tool, no contact form — purely phone/email. Strong AI agent opportunity." };
  }
  return { score: 7, note: "Has a basic contact form but no chat, booking, or AI assistant — good AI agent opportunity." };
}

function decodeCfEmail(hex: string): string {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < hex.length; i += 2) {
      email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    }
    return email.trim().toLowerCase();
  } catch {
    return "";
  }
}

function extractEmailFromHtml(rawHtml: string): string {
  // Decode common HTML entities used to obfuscate emails
  const html = rawHtml
    .replace(/&#64;|&#x40;|&commat;/gi, "@")
    .replace(/&#46;|&#x2e;|&period;/gi, ".");

  // Priority 1: explicit mailto: href links (most reliable — real contact emails)
  const mailtoRe = /href=["']mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let mm: RegExpExecArray | null;
  while ((mm = mailtoRe.exec(html)) !== null) {
    const e = mm[1].toLowerCase();
    if (!SKIP_EMAIL.test(e) && !/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|ttf)$/i.test(e)) {
      return e;
    }
  }

  // Priority 2: Cloudflare email protection (data-cfemail or /cdn-cgi/l/email-protection#)
  const cfRe = /(?:data-cfemail=["']|email-protection#)([0-9a-fA-F]{10,120})/gi;
  while ((mm = cfRe.exec(html)) !== null) {
    const decoded = decodeCfEmail(mm[1]);
    if (decoded.includes("@") && !SKIP_EMAIL.test(decoded)) {
      return decoded;
    }
  }

  // Priority 3: email addresses anywhere in the HTML
  const emails = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,12}/g) ?? [];
  for (const raw of emails) {
    const e = raw.toLowerCase();
    if (SKIP_EMAIL.test(e)) continue;
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|ico|mp4|pdf)$/i.test(e)) continue;
    return e;
  }
  return "";
}

async function scrapeEmailFromSiteInner(rawUrl: string): Promise<{ email: string; aiOpportunityScore: number; aiOpportunityNote: string }> {
  const fallback = { email: "", aiOpportunityScore: 5, aiOpportunityNote: "Website could not be scanned — need unverified." };
  const cleaned = cleanWebsiteUrl(rawUrl);
  if (!cleaned || SKIP_WEBSITE.test(cleaned)) return fallback;
  const fullUrl = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;

  const fetchWithBrowserHeaders = async (u: string): Promise<Response | null> => {
    try {
      const r = await Promise.race([
        fetch(u, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        }),
        new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 5500)),
      ]) as Response;
      if (r.ok) return r;
    } catch {}
    return null;
  };

  const tryFetch = async (u: string): Promise<{ email: string; html: string } | null> => {
    let r = await fetchWithBrowserHeaders(u);
    if (!r && u.startsWith("http://")) {
      r = await fetchWithBrowserHeaders(u.replace(/^http:\/\//i, "https://"));
    } else if (!r && u.startsWith("https://")) {
      r = await fetchWithBrowserHeaders(u.replace(/^https:\/\//i, "http://"));
    }
    if (!r) return null;
    try {
      const html = await r.text();
      const email = extractEmailFromHtml(html);
      return { email, html };
    } catch { return null; }
  };

  // Try main page first — this is also what we analyze for AI-opportunity signals.
  const main = await tryFetch(fullUrl);
  if (main) {
    const { score, note } = analyzeAIOpportunity(main.html);
    if (main.email) return { email: main.email, aiOpportunityScore: score, aiOpportunityNote: note };

    // Discover real contact/about links from homepage HTML + standard paths
    try {
      const base = new URL(fullUrl.startsWith("http://") ? fullUrl.replace(/^http:\/\//i, "https://") : fullUrl);
      const origin = base.origin;
      const candidateUrls = new Set<string>();

      const linkRe = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = linkRe.exec(main.html)) !== null) {
        const href = lm[1].trim();
        const label = lm[2].replace(/<[^>]+>/g, "").trim();
        if (/(contact|about|connect|touch|reach|location|office|team)/i.test(href + " " + label)) {
          try {
            const resolved = new URL(href, origin);
            if (resolved.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) {
              candidateUrls.add(resolved.toString());
            }
          } catch {}
        }
      }

      for (const path of ["/contact", "/contact-us", "/about", "/about-us"]) {
        candidateUrls.add(`${origin}${path}`);
      }

      for (const subUrl of Array.from(candidateUrls).slice(0, 4)) {
        const found = await tryFetch(subUrl);
        if (found?.email) return { email: found.email, aiOpportunityScore: score, aiOpportunityNote: note };
      }
    } catch {}

    return { email: "", aiOpportunityScore: score, aiOpportunityNote: note };
  }

  return fallback;
}

/**
 * Wraps scrapeEmailFromSiteInner with a hard overall budget. A single slow/hanging
 * site could otherwise burn 4 sequential fetches (main + 3 sub-pages) at up to 5s
 * each — this caps the worst case per business so one bad domain can't stall an
 * entire hunt batch.
 */
async function scrapeEmailFromSite(rawUrl: string): Promise<{ email: string; aiOpportunityScore: number; aiOpportunityNote: string }> {
  const fallback = { email: "", aiOpportunityScore: 5, aiOpportunityNote: "Website could not be scanned — need unverified." };
  try {
    return await Promise.race([
      scrapeEmailFromSiteInner(rawUrl),
      new Promise<typeof fallback>(resolve => setTimeout(() => resolve(fallback), 12000)),
    ]);
  } catch {
    return fallback;
  }
}

// ─── SCRAPER 15: Google Maps (free — parses embedded place data) ──────────────

/**
 * Scrapes Google Maps search results by extracting business names embedded in
 * place URLs and any JSON-LD blocks present on the page.
 * No API key required. Runs alongside all other directory scrapers.
 */
async function scrapeGoogleMaps(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  const q = `${category} in ${city}${country ? ", " + country : ""}`;
  const businesses: ScrapedBusiness[] = [];

  // 1. Check rotational Google Maps Places API key pool first
  try {
    const gmapsKeys = await getAllKeys("google_maps");
    if (gmapsKeys.length > 0) {
      for (let i = 0; i < gmapsKeys.length && businesses.length < count; i++) {
        const apiKey = gmapsKeys[i % gmapsKeys.length];
        try {
          const placesRes = await Promise.race([
            fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri",
              },
              body: JSON.stringify({ textQuery: q, maxResultCount: Math.min(count, 20) }),
            }),
            new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 12000)),
          ]) as Response;

          if (placesRes.ok) {
            const data = await placesRes.json() as {
              places?: Array<{
                displayName?: { text?: string };
                formattedAddress?: string;
                nationalPhoneNumber?: string;
                internationalPhoneNumber?: string;
                websiteUri?: string;
              }>;
            };
            for (const p of data.places ?? []) {
              const name = p.displayName?.text?.trim();
              if (!name) continue;
              businesses.push({
                businessName: name,
                phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? "",
                website: cleanWebsiteUrl(p.websiteUri ?? ""),
                address: p.formattedAddress ?? "",
                city,
                country,
                category,
                source: "google_maps_api",
                email: "",
              });
            }
          }
        } catch {}
      }
      if (businesses.length >= count) {
        return dedup(businesses).slice(0, count);
      }
    }
  } catch {}

  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=en`;
    const html = await browserFetch(url, 22000);

    // JSON-LD structured data (sometimes present in Maps pages)
    businesses.push(...schemasToBusinesses(extractJsonLd(html), category, city, country, "google_maps"));

    // Primary: extract business names from embedded place URLs.
    // Google Maps embeds links like /maps/place/Business+Name/@lat,lng or /maps/place/Name-ChIJ...
    const placeRe = /\/maps\/place\/([A-Za-z0-9%+\-_.~!*'(),]+)(?:\/@|\/data|-[A-Z0-9]{10,})/g;
    const nameSeen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = placeRe.exec(html)) !== null) {
      try {
        const raw = decodeURIComponent(m[1]).replace(/\+/g, " ").trim();
        if (raw.length >= 3 && raw.length <= 80 && !nameSeen.has(raw) && /[A-Za-z]/.test(raw)) {
          nameSeen.add(raw);
          businesses.push({
            businessName: raw,
            phone: "", website: "", address: "", city, country, category,
            source: "google_maps", email: "",
          });
        }
      } catch { /* skip malformed URL segment */ }
    }

    // Secondary: pull phone-like strings and website URLs from the page HTML
    // and heuristically assign them to businesses in order.
    const phoneRe = /"(\+?[\d()\-\s.]{8,20})"/g;
    const phones: string[] = [];
    while ((m = phoneRe.exec(html)) !== null) {
      const p = m[1].replace(/\s+/g, " ").trim();
      if (/\d{7,}/.test(p)) phones.push(p);
    }

    const websiteRe = /"(https?:\/\/(?!(?:maps|www)\.google\.com|goo\.gl|googleapis\.com)[^\s"]{6,80})"/g;
    const websites: string[] = [];
    while ((m = websiteRe.exec(html)) !== null) {
      const w = m[1];
      if (!/\.(png|jpg|gif|ico|svg|css|js|woff|ttf)(\?|$)/i.test(w) && !websites.includes(w)) {
        websites.push(w);
      }
    }

    let pi = 0, wi = 0;
    for (const b of businesses) {
      if (!b.phone && phones[pi]) { b.phone = phones[pi]; pi++; }
      if (!b.website && websites[wi]) { b.website = websites[wi]; wi++; }
    }
  } catch { /* Google Maps blocks aggressively — best-effort, silent fail */ }

  return dedup(businesses).slice(0, count);
}

// ─── SCRAPER 16: OpenStreetMap (free, public API — not subject to anti-bot blocking) ──

/**
 * OpenStreetMap's Nominatim (geocoding) + Overpass (POI query) are public,
 * script-friendly APIs meant for programmatic use — unlike the directory sites
 * above, they don't 403/429 requests from cloud IPs. This is real business data
 * (name, phone, website, address) contributed by OSM mappers, so coverage varies
 * by area, but it's a reliable, unblockable source to add to the mix.
 */
async function scrapeOpenStreetMap(category: string, city: string, country: string, count: number): Promise<ScrapedBusiness[]> {
  try {
    // 1. Geocode the city to a bounding box via Nominatim (free, no key).
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${city}, ${country}`)}`;
    const geoRes = await Promise.race([
      fetch(geoUrl, { headers: { "User-Agent": "DevStudio-BusinessHunter/1.0 (contact via app)" } }),
      new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 12000)),
    ]) as Response;
    if (!geoRes.ok) return [];
    const geoData = await geoRes.json() as Array<{ boundingbox: [string, string, string, string] }>;
    if (!geoData.length) return [];
    const [south, north, west, east] = geoData[0].boundingbox.map(Number);

    // 2. Map the free-text category to multiple OSM tag filters — nwr covers
    //    node (point POI), way (building footprint), relation (compound venue).
    //    Using multiple filters for the same category improves recall significantly.
    const cat = category.toLowerCase();
    const tagMap: Array<[RegExp, string[]]> = [
      [/restaurant|food|dining|eatery|fast.?food|takeaway/,
        [`nwr["amenity"="restaurant"]`, `nwr["amenity"="fast_food"]`, `nwr["amenity"="food_court"]`, `nwr["cuisine"]`]],
      [/cafe|coffee/, [`nwr["amenity"="cafe"]`, `nwr["shop"="coffee"]`]],
      [/bar|pub|lounge|nightclub/,
        [`nwr["amenity"="bar"]`, `nwr["amenity"="pub"]`, `nwr["amenity"="nightclub"]`, `nwr["amenity"="biergarten"]`]],
      [/salon|hair|barber|barbershop/,
        [`nwr["shop"="hairdresser"]`, `nwr["shop"="barber"]`, `nwr["amenity"="hairdresser"]`]],
      [/beauty|spa|nail|wellness|massage|wax/,
        [`nwr["shop"="beauty"]`, `nwr["leisure"="spa"]`, `nwr["shop"="massage"]`, `nwr["shop"="nail_salon"]`]],
      [/dentist|dental/,
        [`nwr["amenity"="dentist"]`, `nwr["healthcare"="dentist"]`]],
      [/doctor|clinic|medical|health|gp\b|physician|hospital/,
        [`nwr["amenity"="clinic"]`, `nwr["amenity"="doctors"]`, `nwr["amenity"="hospital"]`, `nwr["healthcare"]`]],
      [/pharmacy|chemist|drug/,
        [`nwr["amenity"="pharmacy"]`, `nwr["shop"="chemist"]`]],
      [/optician|optometrist|eye|vision/,
        [`nwr["shop"="optician"]`, `nwr["healthcare"="optometrist"]`]],
      [/physiotherapy|chiro|chiropract/,
        [`nwr["healthcare"="physiotherapist"]`, `nwr["healthcare"="chiropractor"]`]],
      [/veterinar|vet\b|animal/,
        [`nwr["amenity"="veterinary"]`, `nwr["shop"="pet"]`]],
      [/gym|fitness|crossfit|yoga|pilates|martial|karate/,
        [`nwr["leisure"="fitness_centre"]`, `nwr["leisure"="sports_centre"]`, `nwr["leisure"="yoga"]`, `nwr["sport"="yoga"]`]],
      [/hotel|motel|lodg|hostel/,
        [`nwr["tourism"="hotel"]`, `nwr["tourism"="motel"]`, `nwr["tourism"="hostel"]`, `nwr["tourism"="guest_house"]`]],
      [/auto|car.?repair|mechanic|garage|tyre|tire/,
        [`nwr["shop"="car_repair"]`, `nwr["shop"="tyres"]`, `nwr["amenity"="car_repair"]`]],
      [/car.?dealer|car.?sale|car.?show/,
        [`nwr["shop"="car"]`, `nwr["shop"="car_dealer"]`]],
      [/car.?wash/, [`nwr["amenity"="car_wash"]`, `nwr["shop"="car_wash"]`]],
      [/real.?estate|estate.?agent|property|mortgage|realtor/,
        [`nwr["office"="estate_agent"]`, `nwr["office"="real_estate_agent"]`]],
      [/lawyer|attorney|legal|solicitor/,
        [`nwr["office"="lawyer"]`, `nwr["office"="solicitor"]`]],
      [/accountant|accounting|cpa\b|bookkeeping/,
        [`nwr["office"="accountant"]`, `nwr["office"="tax_advisor"]`]],
      [/insurance/, [`nwr["office"="insurance"]`]],
      [/consultant|consulting/, [`nwr["office"="consulting"]`, `nwr["office"="company"]`]],
      [/financial|finance|investment|wealth/,
        [`nwr["office"="financial_advisor"]`, `nwr["amenity"="bank"]`]],
      [/bakery|bread|pastry/, [`nwr["shop"="bakery"]`, `nwr["amenity"="bakery"]`]],
      [/florist|flower/, [`nwr["shop"="florist"]`]],
      [/grocery|supermarket|convenience/, [`nwr["shop"="supermarket"]`, `nwr["shop"="convenience"]`, `nwr["shop"="grocery"]`]],
      [/clothing|fashion|boutique|tailor/,
        [`nwr["shop"="clothes"]`, `nwr["shop"="fashion"]`, `nwr["shop"="tailor"]`]],
      [/catering|event|wedding/, [`nwr["shop"="catering"]`, `nwr["amenity"="event_venue"]`]],
      [/school|tutor|education/, [`nwr["amenity"="school"]`, `nwr["office"="educational_institution"]`]],
      [/childcare|nursery|daycare/, [`nwr["amenity"="childcare"]`, `nwr["amenity"="kindergarten"]`]],
      [/hotel|accommodation/, [`nwr["tourism"="hotel"]`, `nwr["tourism"="guest_house"]`]],
      [/plumber|plumbing/, [`nwr["craft"="plumber"]`]],
      [/electrician|electrical/, [`nwr["craft"="electrician"]`]],
      [/tattoo/, [`nwr["shop"="tattoo"]`]],
      [/photog|studio/, [`nwr["shop"="photo"]`, `nwr["leisure"="dance"]`]],
      [/cleaning|laundry|dry.?clean/,
        [`nwr["shop"="laundry"]`, `nwr["shop"="dry_cleaning"]`, `nwr["shop"="cleaning"]`]],
      [/restaurant|cafe|bar|food|coffee/, [`nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|food_court)$"]`]],
    ];

    // Collect all matching tag filters (may be multiple for broad categories)
    let tags: string[] = [];
    for (const [re, t] of tagMap) {
      if (re.test(cat)) { tags = t; break; }
    }
    // Fallback: generic local business / shop
    if (!tags.length) tags = [`nwr["shop"]`, `nwr["office"]`, `nwr["amenity"~"^(restaurant|cafe|bar|pub|shop)$"]`];

    // 3. Run one Overpass query per tag filter in parallel, then merge.
    //    Each query uses nwr (node+way+relation) with a generous element limit.
    const limit = Math.min(Math.max(count * 5, 300), 1000);
    const overpassQueries = tags.slice(0, 4).map(tag =>
      `[out:json][timeout:30];(${tag}(${south},${west},${north},${east}););out body ${limit};`
    );

    const overpassResults = await Promise.allSettled(
      overpassQueries.map(q =>
        Promise.race([
          fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            headers: { "Content-Type": "text/plain", "User-Agent": "DevStudio-BusinessHunter/1.0" },
            body: q,
          }),
          new Promise<never>((_, rj) => setTimeout(() => rj(new Error("timeout")), 30000)),
        ]) as Promise<Response>
      )
    );

    const allElements: ScrapedBusiness[] = [];
    for (const r of overpassResults) {
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      try {
        const data = await r.value.json() as { elements: Array<{ tags?: Record<string, string> }> };
        for (const el of data.elements ?? []) {
          const t = el.tags ?? {};
          const name = t.name;
          if (!name || name.length < 2) continue;
          const website = t.website ?? t["contact:website"] ?? t["url"] ?? "";
          const phone   = t.phone   ?? t["contact:phone"]   ?? t["contact:mobile"] ?? "";
          const email   = t.email   ?? t["contact:email"]   ?? "";
          const address = [t["addr:housenumber"], t["addr:street"], t["addr:city"]].filter(Boolean).join(" ");
          allElements.push({ businessName: name, phone, website, address, city, country, category, source: "openstreetmap", email });
        }
      } catch {}
    }

    return dedup(allElements).slice(0, Math.max(count * 3, 45));
  } catch {
    return [];
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export interface ScrapeResult {
  businesses: ScrapedBusiness[];
  /** Which sources returned at least one result */
  sources: string[];
  /** Per-source errors for diagnostics */
  errors: Record<string, string>;
}

/**
 * Run all 8 directory scrapers in parallel, merge + deduplicate results,
 * then enrich each business with a real contact email scraped from its website.
 */
/**
 * Run all 14 directory scrapers in parallel, merge + deduplicate results,
 * then enrich each business with a real contact email scraped from its website.
 *
 * Sources:
 *  1  Yelp              6  Yell.com (UK)      11 Thumbtack (US)
 *  2  Yellow Pages      7  Foursquare API*    12 Cylex (intl)
 *  3  Google GMB        8  Bing Local         13 SuperPages (US)
 *  4  Manta             9  TripAdvisor        14 Bark.com (global)
 *  5  Hotfrog          10  BBB (US/CA)        15 OpenStreetMap
 *                                             16 TomTom API*
 * * API-backed sources (key optional, huge volume when set)
 */
export async function scrapeBusinessDirectories(
  category: string,
  city: string,
  country: string,
  count: number
): Promise<ScrapeResult> {
  // No artificial cap — caller decides how many it wants
  const needed = count;

  const scrapers: Array<[string, () => Promise<ScrapedBusiness[]>]> = [
    ["yelp",         () => scrapeYelp(category, city, country, needed)],
    ["yellowpages",  () => scrapeYellowPages(category, city, country, needed)],
    ["google",       () => scrapeGoogleLocal(category, city, country, needed)],
    ["google_maps",  () => scrapeGoogleMaps(category, city, country, needed)],
    ["manta",        () => scrapeManta(category, city, country, needed)],
    ["hotfrog",      () => scrapeHotfrog(category, city, country, needed)],
    ["yell",         () => scrapeYell(category, city, country, needed)],
    ["foursquare",   () => scrapeFoursquare(category, city, country, needed)],
    ["tomtom",       () => scrapeTomTom(category, city, country, needed)],
    ["here",         () => scrapeHere(category, city, country, needed)],
    ["bing",         () => scrapeBingLocal(category, city, country, needed)],
    ["tripadvisor",  () => scrapeTripAdvisor(category, city, country, needed)],
    ["bbb",          () => scrapeBBB(category, city, country, needed)],
    ["thumbtack",    () => scrapeThumbtrack(category, city, country, needed)],
    ["cylex",        () => scrapeCylex(category, city, country, needed)],
    ["superpages",   () => scrapeSuperPages(category, city, country, needed)],
    ["bark",         () => scrapeBark(category, city, country, needed)],
    ["openstreetmap", () => scrapeOpenStreetMap(category, city, country, needed)],
  ];

  const settled = await Promise.allSettled(scrapers.map(([, fn]) => fn()));

  const all: ScrapedBusiness[] = [];
  const sources: string[] = [];
  const errors: Record<string, string> = {};

  scrapers.forEach(([name], i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      if (r.value.length > 0) {
        all.push(...r.value);
        sources.push(name);
      }
    } else {
      errors[name] = String((r.reason as Error)?.message ?? r.reason);
    }
  });

  // Cross-source dedup by name, then also by email to avoid duplicate outreach
  const nameDeduped = dedup(all);
  const emailSeen = new Set<string>();
  const deduped = nameDeduped.filter(b => {
    if (!b.email) return true; // keep — email will be found during enrichment
    const key = b.email.toLowerCase();
    if (emailSeen.has(key)) return false;
    emailSeen.add(key);
    return true;
  });

  // With 18 sources each contributing up to `needed` results, `deduped` can run
  // to hundreds of entries even for a small request (e.g. count=10 × 18 sources
  // ≈ up to 180 candidates before dedup shrinks it). Every one of those gets a
  // real website fetch below, so scraping ALL of them for one city/category is
  // what actually produces the "endless hunting" — cap the enrichment work to a
  // generous multiple of what was asked for instead of the full candidate pool.
  // Entries that already have an email from their source (no fetch needed) are
  // prioritized first so we never do wasted network work to keep a business
  // that would have been free.
  const withEmail = deduped.filter(b => b.email);
  const withoutEmailWithSite = deduped.filter(b => !b.email && b.website);
  const enrichCap = Math.max(needed * 5, 60);
  const toEnrich = withoutEmailWithSite.slice(0, Math.max(enrichCap - withEmail.length, 0));
  const workingSet = [...withEmail, ...toEnrich];

  // Enrich with emails + AI-opportunity scan — 20 concurrent for speed
  const CONCURRENCY = 20;
  for (let i = 0; i < workingSet.length; i += CONCURRENCY) {
    await Promise.all(
      workingSet.slice(i, i + CONCURRENCY).map(async biz => {
        if (biz.website) {
          const result = await scrapeEmailFromSite(biz.website);
          if (!biz.email && result.email) biz.email = result.email;
          biz.aiOpportunityScore = result.aiOpportunityScore;
          biz.aiOpportunityNote = result.aiOpportunityNote;
        }
      })
    );
  }

  // Final dedup by email after enrichment (multiple businesses may share a domain)
  const finalEmailSeen = new Set<string>();
  const finalBusinesses = deduped.filter(b => {
    if (!b.email) return true;
    const key = b.email.toLowerCase();
    if (finalEmailSeen.has(key)) return false;
    finalEmailSeen.add(key);
    return true;
  });

  return { businesses: finalBusinesses, sources, errors };
}
