import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Globe,
  Sparkles,
  Lock,
  Unlock,
  ExternalLink,
  Send,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Phone,
  Mail,
  Zap,
  Shield,
  ArrowUpRight,
  Layers,
  Settings,
  Download,
  Palette,
  Server,
  CreditCard,
  Building2,
  Coins,
  MessageSquare,
  Volume2,
  Mic,
  Play,
  Square,
} from "lucide-react";
import { getAdminToken, getSaasToken, getCachedSaasUser } from "@/lib/saas-auth";
import {
  WebsiteOwnerAdminDrawer,
  WEBSITE_COLOR_THEMES,
  resolvePreviewVisualsForBusiness,
} from "@/components/WebsiteOwnerAdminDrawer";
import { playChatbotSound } from "@/components/WebsiteAutomatedChatbot";
import { WebsiteBuilderProgressSkeleton } from "@/components/ScrapingAndReportSkeletons";
import {
  STUDIO_VOICE_LIST,
  playStudioWavUrl,
  speakBrowserPersonaFallback,
  speakTextWithStudioPersona,
  startSiteWalkthroughAudio,
  stopAllStudioVoices,
  unlockStudioAudioOnUserGesture,
} from "@/lib/studio-voices";

interface GeneratedSiteRow {
  siteId: string;
  prospectId: string;
  businessName: string;
  ownerName: string;
  category: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  originalWebsite: string;
  detectionStatus: "no_website" | "bad_website" | "upgrade_ready";
  originalScore: number;
  themeId: string;
  siteConfig: any;
  siteUrl: string;
  pitchSubject: string;
  pitchBody: string;
  status: string;
  totalViews: number;
  funnelSubmissionsCount: number;
  funnelSubmissions: any[];
  claimRequested: boolean;
  claimData: any;
  createdAt: string;
}

interface CandidateRow {
  prospectId: string;
  businessName: string;
  ownerName: string;
  category: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  originalWebsite: string;
  detectionStatus: "no_website" | "bad_website" | "upgrade_ready";
  detectionReason: string;
  originalScore: number;
  builtSiteId: string | null;
  builtSiteUrl: string | null;
  builtSiteStatus: string | null;
  claimRequested: boolean;
}

interface PlanWebsiteQuotas {
  starter: number;
  growth: number;
  scale: number;
  enterprise: number;
}

interface BuilderAccessConfig {
  mode: "owner_only" | "high_level_plans" | "selected_users" | "all_users";
  ownerEmail: string;
  allowedUserEmails: string[];
  allowedPlanIds?: string[];
  planQuotas?: PlanWebsiteQuotas;
  autoDetectNoWebsite: boolean;
  autoDetectBadWebsite: boolean;
  badWebsiteScoreThreshold: number;
}

interface CallerWebsiteQuota {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  planId: string;
}

const PERSISTED_SITES_STORAGE_KEY = "vh_generated_websites_list_v1";
const DELETED_SITES_STORAGE_KEY = "vh_deleted_website_ids_v1";

function loadPersistedDeletedSiteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_SITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map(String).filter(Boolean));
      }
    }
  } catch {}
  return new Set<string>();
}

function savePersistedDeletedSiteIds(ids: Set<string>): void {
  try {
    localStorage.setItem(DELETED_SITES_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

function loadPersistedSitesFromStorage(): GeneratedSiteRow[] {
  try {
    const deleted = loadPersistedDeletedSiteIds();
    const raw = localStorage.getItem(PERSISTED_SITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => s && s.siteId && !deleted.has(String(s.siteId)));
      }
    }
  } catch {}
  return [];
}

function savePersistedSitesToStorage(list: GeneratedSiteRow[], paymentConfig?: any): void {
  try {
    const deleted = loadPersistedDeletedSiteIds();
    const clean = list.filter((s) => s && s.siteId && !deleted.has(String(s.siteId)));
    localStorage.setItem(PERSISTED_SITES_STORAGE_KEY, JSON.stringify(clean));
    for (const s of clean) {
      if (s?.siteId) {
        const payload = JSON.stringify({
          site: s,
          ...(paymentConfig ? { paymentConfig } : {}),
        });
        sessionStorage.setItem(`vh_site_cache_${s.siteId}`, payload);
        localStorage.setItem(`vh_site_cache_${s.siteId}`, payload);
      }
    }
  } catch {}
}

async function builderFetch(path: string, init?: RequestInit) {
  const token = getSaasToken() || getAdminToken();
  const cachedUser = getCachedSaasUser();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(cachedUser?.email ? { "X-User-Email": cachedUser.email } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function OwnerWebsiteBuilderPanel({
  externalLeads = [],
}: {
  externalLeads?: any[];
}) {
  const [, setLocation] = useLocation();
  const [subTab, setSubTab] = useState<"sites" | "voice" | "candidates" | "custom" | "payment" | "access">("sites");
  const [loading, setLoading] = useState(() => loadPersistedSitesFromStorage().length === 0);
  const [sites, setSites] = useState<GeneratedSiteRow[]>(() => loadPersistedSitesFromStorage());
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [accessConfig, setAccessConfig] = useState<BuilderAccessConfig>({
    mode: "all_users",
    ownerEmail: "jwandersonar@gmail.com",
    allowedUserEmails: ["jwandersonar@gmail.com"],
    allowedPlanIds: ["starter", "growth", "scale", "enterprise"],
    planQuotas: {
      starter: 3,
      growth: 15,
      scale: 100,
      enterprise: 999999,
    },
    autoDetectNoWebsite: true,
    autoDetectBadWebsite: true,
    badWebsiteScoreThreshold: 65,
  });
  const [callerQuota, setCallerQuota] = useState<CallerWebsiteQuota>({
    used: 0,
    limit: 3,
    remaining: 3,
    unlimited: false,
    planId: "starter",
  });
  const [isOwner, setIsOwner] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1-Click Deploy to Vercel Modal state
  const [vercelModalSite, setVercelModalSite] = useState<GeneratedSiteRow | null>(null);
  const [vercelToken, setVercelToken] = useState<string>(() => {
    try {
      return localStorage.getItem("vh_user_vercel_token") || "";
    } catch {
      return "";
    }
  });
  const [vercelProjectName, setVercelProjectName] = useState<string>("");
  const [vercelTeamId, setVercelTeamId] = useState<string>("");
  const [deployingVercel, setDeployingVercel] = useState<boolean>(false);
  const [lastVercelResult, setLastVercelResult] = useState<{
    siteId: string;
    deploymentUrl: string;
    projectName: string;
  } | null>(null);

  // Building state
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [candidateThemeOverrides, setCandidateThemeOverrides] = useState<Record<string, string>>({});
  const [candidateImageSeeds, setCandidateImageSeeds] = useState<Record<string, number>>({});

  // Custom build form state
  const [customBizName, setCustomBizName] = useState("");
  const [customOwnerName, setCustomOwnerName] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customServices, setCustomServices] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customCity, setCustomCity] = useState("Sacramento");
  const [customCountry, setCustomCountry] = useState("CA");
  const [customPhone, setCustomPhone] = useState("(916) 291-1047");
  const [customEmail, setCustomEmail] = useState("");
  const [customOrigWeb, setCustomOrigWeb] = useState("");
  const [customTheme, setCustomTheme] = useState("");

  // Email Pitch Modal state
  const [emailModalSite, setEmailModalSite] = useState<GeneratedSiteRow | null>(null);
  const [adminDrawerSite, setAdminDrawerSite] = useState<GeneratedSiteRow | null>(null);
  const [pitchToEmail, setPitchToEmail] = useState("");
  const [pitchSubject, setPitchSubject] = useState("");
  const [pitchBody, setPitchBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // AI Voice-Note Studio ($0 Free · 6 Distinct Voices) & Outbound AI Machine Phone Caller state for Website Builder Suite
  const [voiceTargetSiteId, setVoiceTargetSiteId] = useState<string>("");
  const [voiceBizName, setVoiceBizName] = useState<string>("Valley Construction and Renovation");
  const [voiceOwnerName, setVoiceOwnerName] = useState<string>("Marcus Vance");
  const [voiceCategory, setVoiceCategory] = useState<string>("Kitchen & Home Remodeling");
  const [voiceCity, setVoiceCity] = useState<string>("Sacramento");
  const [voicePhone, setVoicePhone] = useState<string>("(916) 291-1047");
  const [voiceEmail, setVoiceEmail] = useState<string>("estimates@valleyconstruction.com");
  const [voiceSiteUrl, setVoiceSiteUrl] = useState<string>("/site/valley-construction-sacramento");
  const [voicePitchMode, setVoicePitchMode] = useState<"website_claim" | "review_shield">("website_claim");
  const [selectedVoicePersona, setSelectedVoicePersona] = useState<string>("Kore");
  const [voiceScript, setVoiceScript] = useState<string>("");
  const [voiceWavDataUrl, setVoiceWavDataUrl] = useState<string | null>(null);
  const [voiceWavBase64, setVoiceWavBase64] = useState<string | null>(null);
  const [synthesizedPersonaId, setSynthesizedPersonaId] = useState<string | null>(null);
  const [generatingVoice, setGeneratingVoice] = useState<boolean>(false);
  const [speakingVoice, setSpeakingVoice] = useState<boolean>(false);
  const [sendingVoiceEmail, setSendingVoiceEmail] = useState<boolean>(false);
  const [placingMachineCall, setPlacingMachineCall] = useState<boolean>(false);
  const [checkingMachineCall, setCheckingMachineCall] = useState<boolean>(false);
  const [callerConfig, setCallerConfig] = useState<any>(null);
  const [newCallerKeyProvider, setNewCallerKeyProvider] = useState<"bland" | "retell" | "vapi">("bland");
  const [newCallerKeyLabel, setNewCallerKeyLabel] = useState<string>("");
  const [newCallerKeyValue, setNewCallerKeyValue] = useState<string>("");
  const [newCallerFromNum, setNewCallerFromNum] = useState<string>("");
  const [savingCallerKey, setSavingCallerKey] = useState<boolean>(false);
  const [lastMachineCallId, setLastMachineCallId] = useState<string | null>(null);
  const [lastMachineCallStatus, setLastMachineCallStatus] = useState<string | null>(null);
  const [lastMachineCallTranscript, setLastMachineCallTranscript] = useState<string | null>(null);

  // Claimed Payment Invoice Modal state (Bank Transfer + Lemon Card + Crypto)
  const [paymentModalSite, setPaymentModalSite] = useState<GeneratedSiteRow | null>(null);
  const [paymentToEmail, setPaymentToEmail] = useState("");
  const [paymentSubject, setPaymentSubject] = useState("");
  const [paymentBody, setPaymentBody] = useState("");
  const [sendingPaymentEmail, setSendingPaymentEmail] = useState(false);
  const [copiedPaymentMsg, setCopiedPaymentMsg] = useState(false);

  // Global Payment Methods Config state
  const [paymentConfig, setPaymentConfig] = useState<any>({
    autoSendInvoiceOnClaim: true,
    lemonEnabled: true,
    lemonCheckoutUrl: "https://insidex.lemonsqueezy.com/checkout",
    lemonNotes: "Instant Credit/Debit Card, Apple Pay & Google Pay checkout via Lemon Squeezy.",
    bankEnabled: true,
    bankName: "Mercury Business Bank / Chase Commercial",
    bankAccountName: "Update Design Agency LLC",
    bankAccountNumber: "980144281902",
    bankRoutingNumber: "021000021",
    bankSwiftIban: "CHASUS33 / US980144281902",
    zelleOrFasterPay: "jwandersonar@gmail.com",
    bankInstructions: "Please include your Business Name as the payment memo/reference so we can activate your domain immediately.",
    cryptoEnabled: true,
    cryptoWallets: [
      { symbol: "USDT", network: "TRC20 (Tron) / ERC20", address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" },
      { symbol: "USDC", network: "ERC20 / Solana / Base", address: "0x71C...8976F" },
      { symbol: "BTC", network: "Bitcoin Mainnet", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
    ],
  });
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);

  // whitelist input
  const [whitelistInput, setWhitelistInput] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [accData, sitesData, candData, payData, callerData] = await Promise.all([
        builderFetch("/api/website-builder/access"),
        builderFetch("/api/website-builder/sites").catch(() => ({ sites: [] })),
        builderFetch("/api/website-builder/candidates").catch(() => ({ candidates: [] })),
        builderFetch("/api/website-builder/payment-config").catch(() => ({ paymentConfig: null })),
        builderFetch("/api/crm/voice-caller/config").catch(() => ({ config: null })),
      ]);
      if (accData?.config) {
        setAccessConfig(accData.config);
        setWhitelistInput((accData.config.allowedUserEmails || []).join(", "));
      }
      if (accData?.quota) {
        setCallerQuota(accData.quota);
      }
      if (payData?.paymentConfig) {
        setPaymentConfig(payData.paymentConfig);
      }
      if (callerData?.config) {
        setCallerConfig(callerData.config);
      }
      setIsOwner(Boolean(accData?.isOwner));

      const deletedSet = loadPersistedDeletedSiteIds();
      if (Array.isArray(sitesData?.deletedSiteIds)) {
        for (const delId of sitesData.deletedSiteIds) {
          if (delId) deletedSet.add(String(delId));
        }
        savePersistedDeletedSiteIds(deletedSet);
      }

      const serverSites: GeneratedSiteRow[] = Array.isArray(sitesData?.sites) ? sitesData.sites : [];
      const localSites: GeneratedSiteRow[] = loadPersistedSitesFromStorage();
      const mergedById = new Map<string, GeneratedSiteRow>();

      for (const s of serverSites) {
        if (s?.siteId && !deletedSet.has(s.siteId)) {
          mergedById.set(s.siteId, s);
        }
      }

      const localOnlySites: GeneratedSiteRow[] = [];
      for (const ls of localSites) {
        if (ls?.siteId && !deletedSet.has(ls.siteId) && !mergedById.has(ls.siteId)) {
          mergedById.set(ls.siteId, ls);
          localOnlySites.push(ls);
        }
      }

      const finalSites = Array.from(mergedById.values());
      setSites(finalSites);
      savePersistedSitesToStorage(finalSites, payData?.paymentConfig || paymentConfig);

      if (localOnlySites.length > 0) {
        builderFetch("/api/website-builder/sync-sites", {
          method: "POST",
          body: JSON.stringify({ sites: localOnlySites }),
        }).catch(() => {});
      }

      if (finalSites.length > 0 && !voiceTargetSiteId) {
        const first = finalSites[0];
        setVoiceTargetSiteId(first.siteId);
        setVoiceBizName(first.businessName);
        setVoiceOwnerName(first.ownerName || "");
        setVoiceCategory(first.category || "Local Services");
        setVoiceCity(first.city || "Sacramento");
        setVoicePhone(first.phone || "");
        setVoiceEmail(first.email || "");
        setVoiceSiteUrl(`${window.location.origin}/site/${first.siteId}`);
      }
      if (Array.isArray(candData?.candidates)) setCandidates(candData.candidates);
    } catch (err: any) {
      console.error("Builder load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (sites.length > 0) {
      savePersistedSitesToStorage(sites, paymentConfig);
    }
  }, [sites, paymentConfig]);

  // Merge externalLeads + localStorage CRM prospects & AI Hunter leads with server candidates
  const mergedCandidates: CandidateRow[] = React.useMemo(() => {
    const byName = new Map<string, CandidateRow>();
    for (const c of candidates) {
      byName.set(c.businessName.trim().toLowerCase(), c);
    }
    const existingSitesByName = new Map(
      sites.map((s) => [s.businessName.trim().toLowerCase(), s])
    );

    const combinedLocalLeads: any[] = [...externalLeads];
    try {
      const savedProspectsRaw = localStorage.getItem("crm_prospects_v2");
      if (savedProspectsRaw) {
        const parsed = JSON.parse(savedProspectsRaw);
        if (Array.isArray(parsed)) combinedLocalLeads.push(...parsed);
      }
    } catch {}
    try {
      const savedHunterRaw = localStorage.getItem("crm_hunter_results_by_project_v1");
      if (savedHunterRaw) {
        const parsedMap = JSON.parse(savedHunterRaw);
        if (parsedMap && typeof parsedMap === "object") {
          for (const arr of Object.values(parsedMap)) {
            if (Array.isArray(arr)) combinedLocalLeads.push(...arr);
          }
        }
      }
    } catch {}

    for (const lead of combinedLocalLeads) {
      const name = (lead.businessName || lead.company || lead.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (byName.has(key)) continue;

      const rawWeb = (lead.website || "").trim();
      const hasNoWeb =
        !rawWeb || /^(none|n\/a|no website|-|null)$/i.test(rawWeb) || rawWeb.length < 4;
      const needScore10 = typeof lead.softwareNeedScore === "number" ? lead.softwareNeedScore : null;
      const score =
        lead.analysis?.websiteScore ??
        (needScore10 !== null ? Math.max(15, 100 - needScore10 * 7) : hasNoWeb ? 0 : 48);

      const detectionStatus: "no_website" | "bad_website" | "upgrade_ready" = hasNoWeb
        ? "no_website"
        : score < (accessConfig.badWebsiteScoreThreshold || 68)
        ? "bad_website"
        : "upgrade_ready";

      const matchedSite = existingSitesByName.get(key);

      byName.set(key, {
        prospectId: String(lead.id || `ext_${key}`),
        businessName: name,
        ownerName: lead.ownerName || "",
        category: lead.category || lead.industry || "Home Services",
        city: lead.city || lead.location || "Sacramento",
        country: lead.country || "USA",
        phone: lead.phone || "(916) 291-1047",
        email: lead.email || "",
        originalWebsite: hasNoWeb ? "" : rawWeb,
        detectionStatus,
        detectionReason: hasNoWeb
          ? "No Website Found on Google Maps / Directories — 100% Ready for Auto-Build"
          : lead.painPoint || `Outdated / Low-Converting Site (${score}/100) — Missing 4-Tap Instant Estimate Funnel`,
        originalScore: hasNoWeb ? 0 : score,
        builtSiteId: matchedSite?.siteId || lead.generatedSiteId || null,
        builtSiteUrl: matchedSite ? `/site/${matchedSite.siteId}` : lead.generatedSiteUrl || null,
        builtSiteStatus: matchedSite?.status || (lead.generatedSiteUrl ? "ready" : null),
        claimRequested: matchedSite?.claimRequested || false,
      });
    }

    const list = Array.from(byName.values());
    const order = { no_website: 0, bad_website: 1, upgrade_ready: 2 };
    list.sort((a, b) => order[a.detectionStatus] - order[b.detectionStatus]);
    return list;
  }, [candidates, externalLeads, sites, accessConfig.badWebsiteScoreThreshold]);

  const handleAutoBuildForCandidate = async (
    cand: CandidateRow,
    previewImagesOverride?: string[],
    seedOverride?: number
  ) => {
    const candKey = cand.prospectId || cand.businessName;
    const chosenTheme = candidateThemeOverrides[candKey];
    setBuildingId(candKey);
    setNotice(null);
    try {
      const res = await builderFetch("/api/website-builder/generate", {
        method: "POST",
        body: JSON.stringify({
          prospectId: cand.prospectId,
          businessName: cand.businessName,
          ownerName: cand.ownerName,
          category: cand.category,
          city: cand.city,
          country: cand.country,
          phone: cand.phone || "(916) 291-1047",
          email: cand.email,
          originalWebsite: cand.originalWebsite,
          originalScore: cand.originalScore,
          painPoint: cand.detectionReason,
          themeId: chosenTheme || undefined,
          selectedImages: Array.isArray(previewImagesOverride) ? previewImagesOverride.slice(0, 3) : undefined,
          imageVariationSeed: typeof seedOverride === "number" ? seedOverride : candidateImageSeeds[candKey] || 0,
        }),
      });
      if (res.site) {
        try {
          const payload = JSON.stringify({ site: res.site, paymentConfig });
          sessionStorage.setItem(`vh_site_cache_${res.site.siteId}`, payload);
          localStorage.setItem(`vh_site_cache_${res.site.siteId}`, payload);
        } catch {}
        setSites((prev) => [res.site, ...prev]);
        if (res.quota) setCallerQuota(res.quota);
        setNotice({
          type: "success",
          text: `Auto-built high-converting 4-Tap website for ${cand.businessName} with unique industry visuals & brand colors! Live at /site/${res.site.siteId}`,
        });
        setSubTab("sites");
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to generate website" });
    } finally {
      setBuildingId(null);
    }
  };

  const handleQuickChangeSiteTheme = async (site: GeneratedSiteRow, newThemeId: string) => {
    try {
      const nextCfg = { ...(site.siteConfig || {}), themeId: newThemeId, customAccentColor: "" };
      const res = await builderFetch(`/api/website-builder/sites/${site.siteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          themeId: newThemeId,
          siteConfig: nextCfg,
        }),
      });
      if (res.site) {
        setSites((prev) => prev.map((s) => (s.siteId === site.siteId ? { ...s, ...res.site } : s)));
        const themeObj = WEBSITE_COLOR_THEMES[newThemeId];
        setNotice({
          type: "success",
          text: `Updated ${site.businessName} brand palette to "${themeObj?.name || newThemeId}"!`,
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Could not update website theme" });
    }
  };

  const handleCustomBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBizName.trim()) return;
    setBuildingId("custom_form");
    setNotice(null);
    try {
      const res = await builderFetch("/api/website-builder/generate", {
        method: "POST",
        body: JSON.stringify({
          businessName: customBizName,
          ownerName: customOwnerName,
          category: customCategory || "Local Services",
          services: customServices,
          businessDescription: customDescription,
          city: customCity,
          country: customCountry,
          phone: customPhone,
          email: customEmail,
          originalWebsite: customOrigWeb,
          themeId: customTheme || undefined,
        }),
      });
      if (res.site) {
        setSites((prev) => [res.site, ...prev]);
        if (res.quota) setCallerQuota(res.quota);
        setCustomBizName("");
        setCustomServices("");
        setCustomDescription("");
        setNotice({
          type: "success",
          text: `Built accurate, service-matched website for ${res.site.businessName} (${res.site.category})!`,
        });
        setSubTab("sites");
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to build custom website" });
    } finally {
      setBuildingId(null);
    }
  };

  const handleRebuildExistingSite = async (site: GeneratedSiteRow) => {
    setBuildingId(site.siteId);
    setNotice(null);
    try {
      const res = await builderFetch("/api/website-builder/generate", {
        method: "POST",
        body: JSON.stringify({
          existingSiteId: site.siteId,
          prospectId: site.prospectId,
          businessName: site.businessName,
          ownerName: site.ownerName,
          category: site.category,
          city: site.city,
          country: site.country,
          phone: site.phone,
          email: site.email,
          originalWebsite: site.originalWebsite,
          originalScore: site.originalScore,
        }),
      });
      if (res.site) {
        setSites((prev) => {
          const updated = prev.some((s) => s.siteId === site.siteId)
            ? prev.map((s) => (s.siteId === site.siteId ? res.site : s))
            : [res.site, ...prev];
          savePersistedSitesToStorage(updated, paymentConfig);
          return updated;
        });
        setNotice({
          type: "success",
          text: `Rebuilt ${site.businessName} with accurate ${site.category} services, structure & images!`,
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Could not rebuild website" });
    } finally {
      setBuildingId(null);
    }
  };

  const [regeneratingImagesSiteId, setRegeneratingImagesSiteId] = useState<string | null>(null);
  const [generatingBlogSiteId, setGeneratingBlogSiteId] = useState<string | null>(null);

  const handleGenerateSiteBlogPost = async (site: GeneratedSiteRow) => {
    setGeneratingBlogSiteId(site.siteId);
    setNotice(null);
    try {
      const data = await builderFetch(
        `/api/website-builder/sites/${encodeURIComponent(site.siteId)}/generate-blog-post`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
      if (data?.site) {
        setSites((prev) =>
          prev.map((s) => (s.siteId === site.siteId ? { ...s, ...data.site } : s))
        );
        setNotice({
          type: "success",
          text: `✨ Published new AI Local SEO Guide for ${site.businessName}: "${data.article?.title || "Local Guide"}"!`,
        });
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "Could not generate AI Local SEO article",
      });
    } finally {
      setGeneratingBlogSiteId(null);
    }
  };

  const handleRegenerateSiteImages = async (site: GeneratedSiteRow) => {
    setRegeneratingImagesSiteId(site.siteId);
    setNotice(null);
    try {
      const ownerPw =
        site.siteConfig?.adminPassword || site.siteConfig?.adminPin || "owner2026";
      const data = await builderFetch(
        `/api/website-builder/sites/${encodeURIComponent(site.siteId)}/regenerate-images`,
        {
          method: "POST",
          body: JSON.stringify({
            pin: ownerPw,
            password: ownerPw,
          }),
        }
      );
      if (data?.site) {
        setSites((prev) =>
          prev.map((s) => (s.siteId === site.siteId ? { ...s, ...data.site } : s))
        );
        if (vercelModalSite?.siteId === site.siteId) {
          setVercelModalSite((prev) => (prev ? { ...prev, ...data.site } : prev));
        }
        setNotice({
          type: "success",
          text: `✨ Regenerated 3 unique showcase images for ${site.businessName}! (Ready for preview & Vercel deploy)`,
        });
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "Could not regenerate website images",
      });
    } finally {
      setRegeneratingImagesSiteId(null);
    }
  };

  const buildStandaloneReviewShieldPitch = (site: GeneratedSiteRow) => {
    const ownerFirst = (site.ownerName || "").trim().split(" ")[0] || "there";
    const shieldUrl = `${window.location.origin}/review/${site.siteId}`;
    const subject = `5-Star Google Review Shield & Bad-Review Blocker for ${site.businessName}`;
    const body = `Hi ${ownerFirst},

I noticed ${site.businessName} in ${site.city} and set up a custom interactive 5-Star Review Shield & Bad-Review Blocker for your team so you can test how it protects your Google Maps rating:

👉 Test Your Live 5-Star Review Shield Here:
${shieldUrl}

How it works when you click the link above (takes 10 seconds to test):
• Try tapping 5 Stars: It automatically fast-tracks happy customers straight to your public Google Maps review page.
• Try tapping 1, 2, or 3 Stars: Instead of letting an unhappy customer post a bad review on Google Maps, it intercepts them privately and sends their feedback straight to your phone so you can fix it first.

It also includes a ready-to-print QR Counter Stand for your front desk or service trucks. It works standalone with your current setup (no website changes needed).

Click the link above to test tapping 5 stars vs 2 stars—if you want to keep it active for ${site.businessName}, you can activate it right on the page!`;

    return { subject, body };
  };

  const handleOpenEmailModal = (site: GeneratedSiteRow) => {
    setEmailModalSite(site);
    setPitchToEmail(site.email || "");
    setPitchSubject(site.pitchSubject || `We built a new 4-Tap Lead Website for ${site.businessName}`);
    setPitchBody(site.pitchBody || "");
    setVoiceTargetSiteId(site.siteId);
    setVoiceBizName(site.businessName);
    setVoiceOwnerName(site.ownerName || "");
    setVoiceCategory(site.category || "Local Services");
    setVoiceCity(site.city || "");
    setVoicePhone(site.phone || "");
    setVoiceEmail(site.email || "");
    setVoiceSiteUrl(`${window.location.origin}/site/${site.siteId}`);
    setVoicePitchMode("website_claim");
  };

  const handleOpenReviewShieldPitchModal = (site: GeneratedSiteRow) => {
    setEmailModalSite(site);
    setPitchToEmail(site.email || "");
    const pitch = buildStandaloneReviewShieldPitch(site);
    setPitchSubject(pitch.subject);
    setPitchBody(pitch.body);
    setVoiceTargetSiteId(site.siteId);
    setVoiceBizName(site.businessName);
    setVoiceOwnerName(site.ownerName || "");
    setVoiceCategory(site.category || "Local Services");
    setVoiceCity(site.city || "");
    setVoicePhone(site.phone || "");
    setVoiceEmail(site.email || "");
    setVoiceSiteUrl(`${window.location.origin}/review/${site.siteId}`);
    setVoicePitchMode("review_shield");
  };

  const handleGenerateBuilderVoicePitch = async (
    overridePersona?: string,
    overrideMode?: "website_claim" | "review_shield",
    overrideBiz?: {
      siteId?: string;
      businessName: string;
      ownerName?: string;
      category?: string;
      city?: string;
      phone?: string;
      email?: string;
    },
    autoPlay = true,
    regenerateScript = true
  ) => {
    const persona = overridePersona || selectedVoicePersona;
    const mode = overrideMode || voicePitchMode;
    const bName = overrideBiz?.businessName || voiceBizName || "Your Business";
    const oName = overrideBiz?.ownerName ?? voiceOwnerName;
    const cat = overrideBiz?.category || voiceCategory || "Local Services";
    const cty = overrideBiz?.city || voiceCity || "Sacramento";
    const sId = overrideBiz?.siteId ?? voiceTargetSiteId;
    const linkUrl = sId
      ? `${window.location.origin}/${mode === "review_shield" ? "review" : "site"}/${sId}`
      : voiceSiteUrl;

    stopAllStudioVoices();
    setSpeakingVoice(false);
    setGeneratingVoice(true);
    setNotice(null);

    try {
      const data = await builderFetch("/api/crm/generate-voice-pitch", {
        method: "POST",
        body: JSON.stringify({
          businessName: bName,
          ownerName: oName,
          category: cat,
          city: cty,
          reportUrl: linkUrl,
          voiceName: persona,
          pitchMode: mode,
          customScript: regenerateScript ? "" : voiceScript,
          regenerateScriptForVoice: regenerateScript,
        }),
      });

      setVoiceScript(data.script || "");
      setSynthesizedPersonaId(persona);
      setVoiceWavDataUrl(data.wavDataUrl || null);
      setVoiceWavBase64(data.wavBase64 || null);

      const personaObj = STUDIO_VOICE_LIST.find((v) => v.id === persona);
      setNotice({
        type: "success",
        text: data.wavDataUrl
          ? `🎙️ Synthesized ${personaObj?.shortName || persona} Studio Voice Pitch for ${bName} (${data.engine})!`
          : `🎙️ Generated ${personaObj?.shortName || persona} Voice Pitch for ${bName} — playing neural audio!`,
      });

      if (autoPlay) {
        if (data.wavDataUrl) {
          playStudioWavUrl(
            data.wavDataUrl,
            () => setSpeakingVoice(true),
            () => setSpeakingVoice(false)
          );
        } else if (data.script) {
          speakBrowserPersonaFallback(
            data.script,
            persona,
            () => setSpeakingVoice(true),
            () => setSpeakingVoice(false)
          );
        }
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to generate AI voice pitch" });
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleOpenVoiceStudioForSite = (
    site: GeneratedSiteRow,
    mode: "website_claim" | "review_shield" = "website_claim"
  ) => {
    setVoiceTargetSiteId(site.siteId);
    setVoiceBizName(site.businessName);
    setVoiceOwnerName(site.ownerName || "");
    setVoiceCategory(site.category || "Local Services");
    setVoiceCity(site.city || "Sacramento");
    setVoicePhone(site.phone || "");
    setVoiceEmail(site.email || "");
    setVoiceSiteUrl(
      `${window.location.origin}/${mode === "review_shield" ? "review" : "site"}/${site.siteId}`
    );
    setVoicePitchMode(mode);
    setSubTab("voice");
    handleGenerateBuilderVoicePitch(
      selectedVoicePersona,
      mode,
      {
        siteId: site.siteId,
        businessName: site.businessName,
        ownerName: site.ownerName,
        category: site.category,
        city: site.city,
        phone: site.phone,
        email: site.email,
      },
      true,
      true
    );
  };

  const handleOpenVoiceStudioForCandidate = (cand: CandidateRow) => {
    setVoiceTargetSiteId(cand.builtSiteId || "");
    setVoiceBizName(cand.businessName);
    setVoiceOwnerName(cand.ownerName || "");
    setVoiceCategory(cand.category || "Local Services");
    setVoiceCity(cand.city || "Sacramento");
    setVoicePhone(cand.phone || "");
    setVoiceEmail(cand.email || "");
    setVoiceSiteUrl(
      cand.builtSiteId
        ? `${window.location.origin}/site/${cand.builtSiteId}`
        : `${window.location.origin}/site/valley-construction-sacramento`
    );
    setVoicePitchMode("website_claim");
    setSubTab("voice");
    handleGenerateBuilderVoicePitch(
      selectedVoicePersona,
      "website_claim",
      {
        siteId: cand.builtSiteId || "",
        businessName: cand.businessName,
        ownerName: cand.ownerName,
        category: cand.category,
        city: cand.city,
        phone: cand.phone,
        email: cand.email,
      },
      true,
      true
    );
  };

  const handlePlaceWebsiteMachineCall = async (overridePhone?: string, overrideBizName?: string) => {
    const dialNum = (overridePhone ?? voicePhone).trim();
    const targetBiz = overrideBizName || voiceBizName || "Business";
    if (!dialNum) {
      setNotice({
        type: "error",
        text: "Enter a valid business phone number (e.g. +19162911047) to launch the Outbound AI Machine Phone Call.",
      });
      return;
    }
    setPlacingMachineCall(true);
    setNotice(null);
    try {
      const res = await builderFetch("/api/crm/voice-caller/call", {
        method: "POST",
        body: JSON.stringify({
          phone: dialNum,
          businessName: targetBiz,
          ownerName: voiceOwnerName,
          category: voiceCategory,
          city: voiceCity,
          siteUrl: voiceSiteUrl,
          pitchMode: voicePitchMode,
          customScript: voiceScript,
        }),
      });
      setLastMachineCallId(res.callId);
      setLastMachineCallStatus(res.status || "ringing");
      setNotice({
        type: "success",
        text: `📞 Outbound AI Machine Caller (${String(res.provider || "AI").toUpperCase()}) is now ringing ${res.calledNumber} to pitch ${targetBiz}'s new 4-Tap Website!`,
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to place AI machine phone call" });
    } finally {
      setPlacingMachineCall(false);
    }
  };

  const handleCheckWebsiteMachineCallStatus = async () => {
    if (!lastMachineCallId) return;
    setCheckingMachineCall(true);
    try {
      const res = await builderFetch(
        `/api/crm/voice-caller/status/${encodeURIComponent(lastMachineCallId)}`
      );
      setLastMachineCallStatus(res.status || "in-progress");
      if (res.transcript) setLastMachineCallTranscript(res.transcript);
      setNotice({
        type: "success",
        text: `📞 Call Status: ${String(res.status || "in-progress").toUpperCase()}${
          res.durationSeconds ? ` · Duration: ${res.durationSeconds}s` : ""
        }`,
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Could not check call status" });
    } finally {
      setCheckingMachineCall(false);
    }
  };

  const handleAddWebsiteCallerKey = async () => {
    if (!newCallerKeyValue.trim()) return;
    setSavingCallerKey(true);
    try {
      const res = await builderFetch("/api/crm/voice-caller/config", {
        method: "PUT",
        body: JSON.stringify({
          newKey: {
            provider: newCallerKeyProvider,
            label: newCallerKeyLabel.trim() || `${newCallerKeyProvider.toUpperCase()} Key`,
            apiKey: newCallerKeyValue.trim(),
            fromNumber: newCallerFromNum.trim(),
          },
        }),
      });
      if (res.config) setCallerConfig(res.config);
      setNewCallerKeyValue("");
      setNewCallerKeyLabel("");
      setNotice({
        type: "success",
        text: `Added ${newCallerKeyProvider.toUpperCase()} API key to the Outbound AI Machine Caller rotational pool!`,
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to save AI Caller key" });
    } finally {
      setSavingCallerKey(false);
    }
  };

  const handleSendVoiceStudioEmail = async () => {
    if (!voiceEmail.trim()) {
      setNotice({
        type: "error",
        text: "Enter the business owner's email address to send the Claim Link + Attached .WAV Voice Note.",
      });
      return;
    }
    setSendingVoiceEmail(true);
    setNotice(null);
    try {
      const matchedSite =
        sites.find((s) => s.siteId === voiceTargetSiteId) ||
        sites.find((s) => s.businessName.toLowerCase() === voiceBizName.toLowerCase());
      const personaObj = STUDIO_VOICE_LIST.find((v) => v.id === selectedVoicePersona);

      if (matchedSite) {
        const pitch =
          voicePitchMode === "review_shield"
            ? buildStandaloneReviewShieldPitch(matchedSite)
            : {
                subject:
                  matchedSite.pitchSubject ||
                  `We built a new 4-Tap Lead Website for ${matchedSite.businessName}`,
                body: matchedSite.pitchBody || "",
              };
        const res = await builderFetch(
          `/api/website-builder/sites/${matchedSite.siteId}/send-email`,
          {
            method: "POST",
            body: JSON.stringify({
              toEmail: voiceEmail.trim(),
              subject: `🎙️ ${pitch.subject}`,
              body: pitch.body,
              wavBase64: voiceWavBase64,
              voiceScript,
              voiceLabel: personaObj?.label || selectedVoicePersona,
            }),
          }
        );
        setNotice({
          type: "success",
          text: `Sent Website Claim Email${
            voiceWavBase64 ? " + Attached .WAV Studio Voice Note" : ""
          } to ${res.sentTo} (${res.sentVia})!`,
        });
      } else {
        const res = await builderFetch("/api/crm/send-voice-email", {
          method: "POST",
          body: JSON.stringify({
            to: voiceEmail.trim(),
            businessName: voiceBizName,
            ownerName: voiceOwnerName,
            subject: `🎙️ We built a custom 4-Tap Website for ${voiceBizName} (Voice Note + Live Preview)`,
            script: voiceScript,
            wavBase64: voiceWavBase64,
            reportUrl: voiceSiteUrl,
          }),
        });
        setNotice({
          type: "success",
          text: `Sent AI Voice-Note Pitch + Live Website Preview Link to ${voiceEmail.trim()} via ${
            res.sentVia || "SMTP Pool"
          }!`,
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to send voice email" });
    } finally {
      setSendingVoiceEmail(false);
    }
  };

  const buildDefaultClaimedMessage = (site: GeneratedSiteRow) => {
    const claim = site.claimData || {};
    const ownerFirst = (claim.claimedByName || site.ownerName || "").trim().split(" ")[0] || "there";
    const planLabel =
      claim.selectedPlan || "VIP Hosting, Domain Care & Unlimited Edits ($97/mo · $0 Free Website Build)";
    const addons: string[] = Array.isArray(claim.selectedAddons)
      ? claim.selectedAddons
      : ["Custom Logo Design & Brand Polish (+$99 one-time)"];
    const monthly = Number(claim.monthlyTotal) || 97;
    const oneTime = Number(claim.oneTimeTotal) ?? 99;
    const dueToday = monthly + oneTime;
    const fullSiteUrl = `${window.location.origin}/site/${site.siteId}`;
    const wallets = Array.isArray(paymentConfig.cryptoWallets) ? paymentConfig.cryptoWallets : [];

    const subject = `Website Claim Confirmed for ${site.businessName} — Hosting Activation & Payment Options`;
    const body = `Hi ${ownerFirst},

Congratulations! Your custom website and 4-Tap Instant Estimate Funnel for ${site.businessName} is officially reserved for you:
${fullSiteUrl}

YOUR ACTIVATED PACKAGE SUMMARY:
• Custom Website & 4-Tap Estimate Funnel Build: FREE ($0.00 — $1,500 Value Waived)
• Selected Hosting & Care Plan: ${planLabel}
${addons.length > 0 ? `• Selected Growth Add-Ons: ${addons.join(", ")}\n` : ""}• Total Due Today to Activate Domain & Hosting: $${dueToday} USD ($${monthly}/mo${oneTime > 0 ? ` + $${oneTime} one-time setup` : ""})

==================================================
HOW TO COMPLETE YOUR PAYMENT (CHOOSE ANY OF THE 3 METHODS BELOW)
==================================================

OPTION 1: CREDIT / DEBIT CARD (VIA LEMON SQUEEZY — INSTANT ACTIVATION)
Pay securely by Visa, Mastercard, Amex, or Apple Pay:
👉 ${paymentConfig.lemonCheckoutUrl || "https://insidex.lemonsqueezy.com/checkout"}

OPTION 2: DIRECT BANK TRANSFER / WIRE / ZELLE
• Bank Name: ${paymentConfig.bankName}
• Account Name: ${paymentConfig.bankAccountName}
• Account Number: ${paymentConfig.bankAccountNumber}
• Routing / ABA: ${paymentConfig.bankRoutingNumber}
• SWIFT / IBAN: ${paymentConfig.bankSwiftIban}
• Zelle / Instant Pay: ${paymentConfig.zelleOrFasterPay}
• Memo / Reference: ${site.businessName}

OPTION 3: CRYPTOCURRENCY (USDT / USDC / BTC)
Send $${dueToday} USD equivalent to any of our verified wallets below:
${wallets.map((w: any) => `• ${w.symbol} (${w.network}): ${w.address}`).join("\n")}

==================================================
WHAT HAPPENS AS SOON AS PAYMENT IS COMPLETED:
1. We immediately connect your custom domain (or register your new .com domain) with full SSL security.
2. We activate your 4-Tap Estimate Lead notifications straight to your phone (${claim.claimedByPhone || site.phone}).
3. We unlock your full Website Owner Admin Panel (PIN: ${site.siteConfig?.adminPin || "2026"}) so you can upload your logo, edit services, or update photos anytime.

Simply reply to this message once you've completed payment via Card, Bank Transfer, or Crypto and we will have your domain live within the hour!`;

    return { subject, body };
  };

  const handleOpenPaymentModal = (site: GeneratedSiteRow) => {
    setPaymentModalSite(site);
    const claim = site.claimData || {};
    const msg =
      claim.invoiceEmailSubject && claim.invoiceEmailBody
        ? { subject: claim.invoiceEmailSubject, body: claim.invoiceEmailBody }
        : buildDefaultClaimedMessage(site);
    setPaymentToEmail(claim.claimedByEmail || site.email || "");
    setPaymentSubject(msg.subject);
    setPaymentBody(msg.body);
  };

  const handleSendPaymentEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalSite) return;
    setSendingPaymentEmail(true);
    setNotice(null);
    try {
      const res = await builderFetch(
        `/api/website-builder/sites/${paymentModalSite.siteId}/send-payment-email`,
        {
          method: "POST",
          body: JSON.stringify({
            toEmail: paymentToEmail,
            subject: paymentSubject,
            body: paymentBody,
          }),
        }
      );
      setNotice({
        type: "success",
        text: `Sent Claimed Payment Invoice (Credit Card / Bank Transfer / Crypto) to ${res.sentTo} (${res.sentVia})!`,
      });
      setPaymentModalSite(null);
      loadAll();
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to send payment invoice email" });
    } finally {
      setSendingPaymentEmail(false);
    }
  };

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPaymentConfig(true);
    setNotice(null);
    try {
      const res = await builderFetch("/api/website-builder/payment-config", {
        method: "PUT",
        body: JSON.stringify(paymentConfig),
      });
      if (res.paymentConfig) {
        setPaymentConfig(res.paymentConfig);
      }
      setNotice({
        type: "success",
        text: "Saved your Payment Methods (Lemon Squeezy Card, Bank Transfer & Crypto)! All new website claims will use these details.",
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to save payment methods" });
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleMarkSitePaid = async (site: GeneratedSiteRow) => {
    try {
      const updatedClaim = {
        ...(site.claimData || {}),
        paymentStatus: "paid_active",
        paidAt: new Date().toISOString(),
      };
      await builderFetch(`/api/website-builder/sites/${site.siteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "claimed",
          claimData: updatedClaim,
        }),
      });
      setSites((prev) =>
        prev.map((s) =>
          s.siteId === site.siteId ? { ...s, status: "claimed", claimData: updatedClaim } : s
        )
      );
      setNotice({
        type: "success",
        text: `Marked ${site.businessName} as PAID & ACTIVE!`,
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Could not update payment status" });
    }
  };

  const handleSendPitchEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModalSite) return;
    setSendingEmail(true);
    setNotice(null);
    try {
      const personaObj = STUDIO_VOICE_LIST.find((v) => v.id === selectedVoicePersona);
      const res = await builderFetch(`/api/website-builder/sites/${emailModalSite.siteId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          toEmail: pitchToEmail,
          subject: pitchSubject,
          body: pitchBody,
          ...(voiceWavBase64
            ? {
                wavBase64: voiceWavBase64,
                voiceScript,
                voiceLabel: personaObj?.label || selectedVoicePersona,
              }
            : {}),
        }),
      });
      setNotice({
        type: "success",
        text: `Sent "Claim Your Website" pitch email${
          voiceWavBase64 ? " + Attached .WAV AI Voice Note" : ""
        } to ${res.sentTo} (${res.sentVia})!`,
      });
      setSites((prev) =>
        prev.map((s) =>
          s.siteId === emailModalSite.siteId
            ? { ...s, email: pitchToEmail, status: s.status === "claimed" ? "claimed" : "pitched" }
            : s
        )
      );
      setEmailModalSite(null);
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to send email" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    try {
      const deletedSet = loadPersistedDeletedSiteIds();
      deletedSet.add(siteId);
      savePersistedDeletedSiteIds(deletedSet);
      try {
        sessionStorage.removeItem(`vh_site_cache_${siteId}`);
        localStorage.removeItem(`vh_site_cache_${siteId}`);
      } catch {}
      await builderFetch(`/api/website-builder/sites/${siteId}`, { method: "DELETE" });
      setSites((prev) => {
        const next = prev.filter((s) => s.siteId !== siteId);
        savePersistedSitesToStorage(next, paymentConfig);
        return next;
      });
      setCallerQuota((prev) => ({
        ...prev,
        used: Math.max(0, prev.used - 1),
        remaining: prev.unlimited ? 999999 : prev.remaining + 1,
      }));
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Could not delete site" });
    }
  };

  const handleOpenVercelModal = (site: GeneratedSiteRow) => {
    setVercelModalSite(site);
    const defaultSlug =
      site.siteConfig?.vercelProjectName ||
      site.siteId
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    setVercelProjectName(defaultSlug);
    setLastVercelResult(
      site.siteConfig?.vercelDeploymentUrl
        ? {
            siteId: site.siteId,
            deploymentUrl: site.siteConfig.vercelDeploymentUrl,
            projectName: defaultSlug,
          }
        : null
    );
  };

  const handleDeployToVercel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vercelModalSite) return;
    const cleanTok = vercelToken.trim();
    if (!cleanTok) {
      setNotice({
        type: "error",
        text: "Please paste your free Vercel Access Token from vercel.com/account/tokens.",
      });
      return;
    }
    try {
      localStorage.setItem("vh_user_vercel_token", cleanTok);
    } catch {}

    setDeployingVercel(true);
    setNotice(null);
    try {
      const res = await builderFetch(
        `/api/website-builder/sites/${vercelModalSite.siteId}/deploy-vercel`,
        {
          method: "POST",
          body: JSON.stringify({
            vercelToken: cleanTok,
            projectName: vercelProjectName.trim() || vercelModalSite.siteId,
            teamId: vercelTeamId.trim(),
          }),
        }
      );

      if (res.site) {
        setSites((prev) =>
          prev.map((s) => (s.siteId === vercelModalSite.siteId ? { ...s, ...res.site } : s))
        );
        setVercelModalSite((prev) => (prev ? { ...prev, ...res.site } : null));
      }
      setLastVercelResult({
        siteId: vercelModalSite.siteId,
        deploymentUrl: res.deploymentUrl,
        projectName: res.projectName,
      });
      setNotice({
        type: "success",
        text: `▲ Deployed ${vercelModalSite.businessName} live to Vercel at ${res.deploymentUrl}! ($0 hosting cost on your app)`,
      });
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "Failed to deploy website to Vercel",
      });
    } finally {
      setDeployingVercel(false);
    }
  };

  const handleUpdateAccessMode = async (
    newMode: "owner_only" | "high_level_plans" | "selected_users" | "all_users",
    customQuotas?: PlanWebsiteQuotas
  ) => {
    setSavingAccess(true);
    setNotice(null);
    try {
      const emails = whitelistInput
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (!emails.includes("jwandersonar@gmail.com")) {
        emails.unshift("jwandersonar@gmail.com");
      }
      const quotasToSave = customQuotas ||
        accessConfig.planQuotas || {
          starter: 3,
          growth: 15,
          scale: 100,
          enterprise: 999999,
        };
      const res = await builderFetch("/api/website-builder/access", {
        method: "PUT",
        body: JSON.stringify({
          ...accessConfig,
          mode: newMode,
          allowedUserEmails: emails,
          allowedPlanIds:
            newMode === "all_users"
              ? ["starter", "growth", "scale", "enterprise"]
              : ["scale", "enterprise"],
          planQuotas: quotasToSave,
        }),
      });
      if (res.config) {
        setAccessConfig(res.config);
        setNotice({
          type: "success",
          text:
            newMode === "owner_only"
              ? "Locked strictly to jwandersonar@gmail.com! Completely disabled and hidden for all SaaS users."
              : newMode === "all_users"
              ? `Enabled for All Users with Plan Limits (Starter: ${res.config.planQuotas?.starter ?? 3}, Growth: ${res.config.planQuotas?.growth ?? 15}, Scale: ${res.config.planQuotas?.scale ?? 100}, Enterprise: Unlimited)!`
              : newMode === "high_level_plans"
              ? "Enabled Auto-Unlock for High-Level Plans (Agency Scale $349/mo & Enterprise VIP $799/mo) + Owner!"
              : `Updated AI Website Builder access mode to: ${newMode}`,
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to update access control" });
    } finally {
      setSavingAccess(false);
    }
  };

  const copySiteUrl = (siteId: string) => {
    const fullUrl = `${window.location.origin}/site/${siteId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(siteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openSiteInstantly = (
    targetPath: string,
    siteRecord?: GeneratedSiteRow | null,
    e?: React.MouseEvent
  ) => {
    if (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
    }
    unlockStudioAudioOnUserGesture();
    const cleanPath = targetPath.startsWith("http")
      ? new URL(targetPath).pathname + new URL(targetPath).search
      : targetPath;
    const match = cleanPath.match(/^\/(?:site|review)\/([^/?#]+)/);
    const sid = siteRecord?.siteId || (match ? decodeURIComponent(match[1]) : "");
    const resolvedSite = siteRecord || sites.find((s) => s.siteId === sid) || null;
    if (cleanPath.startsWith("/site/") && sid) {
      startSiteWalkthroughAudio(sid, resolvedSite);
    }
    if (resolvedSite && typeof window !== "undefined") {
      const payload = { site: resolvedSite, paymentConfig };
      (window as any).__PRELOADED_SITE_DATA__ = payload;
      try {
        const serialized = JSON.stringify(payload);
        sessionStorage.setItem(`vh_site_cache_${resolvedSite.siteId}`, serialized);
        localStorage.setItem(`vh_site_cache_${resolvedSite.siteId}`, serialized);
      } catch {}
    }
    window.scrollTo(0, 0);
    setLocation(cleanPath);
  };

  const claimedCount = sites.filter((s) => s.claimRequested || s.status === "claimed").length;
  const noWebCount = mergedCandidates.filter((c) => c.detectionStatus === "no_website").length;
  const badWebCount = mergedCandidates.filter((c) => c.detectionStatus === "bad_website").length;

  return (
    <div className="space-y-6">
      {/* ─── TOP OWNER-ONLY LOCK & SUMMARY BANNER ─── */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-amber-400 text-slate-950">
                <Lock className="w-3.5 h-3.5" />
                {accessConfig.mode === "owner_only"
                  ? "OWNER EXCLUSIVE: jwandersonar@gmail.com ONLY"
                  : accessConfig.mode === "high_level_plans"
                  ? "👑 OWNER + HIGH-LEVEL PLANS (SCALE $349 & ENTERPRISE $799)"
                  : accessConfig.mode === "selected_users"
                  ? "OWNER + WHITELISTED USERS ONLY"
                  : "ENABLED FOR ALL SAAS USERS"}
              </span>
              <span className="text-xs text-slate-400">
                Valley Construction 4-Tap Lead Funnel Architecture
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              AI Auto-Website Builder &amp; “Claim This Website” Engine
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Automatically detects businesses with <strong>no website</strong> or an{" "}
              <strong>outdated low-converting website</strong>, builds them a complete high-converting website with an interactive{" "}
              <strong>4-Tap No-Form Estimate Funnel</strong> + <strong>Built-In Automated Bottom Chatbot (with Spoken AI Voice &amp; Sound Chime)</strong>, and pitches them via{" "}
              <strong className="text-emerald-300">🎙️ $0 AI Studio Voice-Notes (6 Human Voices) &amp; 📞 Outbound AI Machine Phone Calls</strong>.
            </p>
          </div>

          {/* Quick Owner Access Mode Switcher */}
          {isOwner && (
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5 shrink-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Account Visibility Control
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={savingAccess}
                  onClick={() => handleUpdateAccessMode("owner_only")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    accessConfig.mode === "owner_only"
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  My Account Only (Disable for Users)
                </button>
                <button
                  type="button"
                  disabled={savingAccess}
                  onClick={() => setSubTab("access")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    accessConfig.mode !== "owner_only"
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {accessConfig.mode === "owner_only" ? "Configure User Access" : `Mode: ${accessConfig.mode}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plan Quota & 1-Click Vercel Deployment Strip */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Your Plan Quota ({callerQuota.planId.toUpperCase()}):
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                {callerQuota.unlimited
                  ? `${callerQuota.used} Built · UNLIMITED QUOTA`
                  : `${callerQuota.used} / ${callerQuota.limit} Active Websites & Review Shields (${callerQuota.remaining} Remaining)`}
              </span>
              {!callerQuota.unlimited && (
                <a
                  href="/dashboard?tab=billing"
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation("/dashboard?tab=billing");
                  }}
                  className="text-xs font-bold text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Upgrade Plan for More Sites</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Preview &amp; test every website and 5-Star Review Shield right here, then click{" "}
              <strong className="text-white">▲ Deploy to Vercel (1-Click)</strong> on any site below to publish it permanently to your own free Vercel account (<code className="text-emerald-300">*.vercel.app</code> or custom client domain) at $0 hosting cost.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
              Starter: {accessConfig.planQuotas?.starter ?? 3} · Growth: {accessConfig.planQuotas?.growth ?? 15} · Scale: {accessConfig.planQuotas?.scale ?? 100} · VIP: ∞
            </span>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div>
            <div className="text-xs text-slate-400">Auto-Built Websites</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums mt-0.5">
              {sites.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">No-Website Leads Detected</div>
            <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums mt-0.5">
              {noWebCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Outdated Websites (&lt;65 Score)</div>
            <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums mt-0.5">
              {badWebCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Websites Claimed by Owners</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
              {claimedCount}
            </div>
          </div>
        </div>
      </div>

      {buildingId && (
        <WebsiteBuilderProgressSkeleton
          mode="generating"
          businessName={
            buildingId === "custom_form"
              ? customBizName || "Custom Business"
              : mergedCandidates.find((c) => (c.prospectId || c.businessName) === buildingId)?.businessName ||
                sites.find((s) => s.siteId === buildingId)?.businessName ||
                "Business Website"
          }
          category={
            buildingId === "custom_form"
              ? customCategory || "Local Services"
              : mergedCandidates.find((c) => (c.prospectId || c.businessName) === buildingId)?.category ||
                sites.find((s) => s.siteId === buildingId)?.category ||
                ""
          }
        />
      )}

      {notice && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
            notice.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/50 border-rose-500/40 text-rose-200"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── SUB-NAVIGATION TABS ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("sites")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === "sites"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Built Websites &amp; Claim Requests ({sites.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("voice")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
              subTab === "voice"
                ? "bg-emerald-400 text-slate-950 shadow-md"
                : "bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/70 border border-emerald-500/40"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>🎙️ AI Voice &amp; Phone Caller Studio ($0)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("candidates")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === "candidates"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            AI Detection: No Website / Bad Website ({mergedCandidates.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("custom")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === "custom"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            + Build Custom Business Website
          </button>
          <button
            type="button"
            onClick={() => setSubTab("payment")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
              subTab === "payment"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-900 text-emerald-300 hover:bg-slate-800 border border-emerald-500/30"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payment Methods (Lemon / Bank / Crypto)</span>
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setSubTab("access")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                subTab === "access"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Owner Access Lock ({accessConfig.mode === "owner_only" ? "Owner Only" : "Custom"})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/site/valley-construction-sacramento"
            onClick={(e) =>
              openSiteInstantly(
                "/site/valley-construction-sacramento",
                sites.find((s) => s.siteId === "valley-construction-sacramento"),
                e
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#7C4A15] text-white hover:bg-[#633A0F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Open Valley Construction Sample Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={loadAll}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── SUB-TAB 1: BUILT WEBSITES & CLAIM STATUS ─── */}
      {subTab === "sites" && (
        <div className="space-y-4">
          {/* Quick Playbook: Distinct Colors, Auto-Hosting vs Download, and Client Admin Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Palette className="w-4 h-4" />
                <span>11 Distinct Brand Color Palettes</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every website is automatically assigned a unique industry-matched color palette (or custom brand hex) so no two businesses look the same.
              </p>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Server className="w-4 h-4" />
                <span>Auto-Host Here OR Download HTML</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a client is interested, either <strong>Auto-Host</strong> (toggle <em>Live Production Mode</em> + connect domain) OR click <strong>Download HTML</strong> to host on Netlify, Vercel, or cPanel.
              </p>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Settings className="w-4 h-4" />
                <span>Single Owner Password + Image Regenerator</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every created site uses a single default Business Owner Admin Password (<code className="text-amber-300 font-mono font-bold">owner2026</code>) that the owner can change inside Admin, plus 1-click <strong>Regenerate Images</strong>.
              </p>
            </div>
          </div>

          {loading ? (
            <WebsiteBuilderProgressSkeleton mode="loading_list" />
          ) : sites.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
              <p className="text-slate-300 font-semibold">No websites built yet.</p>
              <button
                type="button"
                onClick={() => setSubTab("candidates")}
                className="px-5 py-2.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Detect Businesses with No Website / Bad Website →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const usedUrlsAcrossBuiltSites = new Set<string>();
                return sites.map((site, siteIdx) => {
                  const livePath = `/site/${site.siteId}`;
                  const isClaimed = site.claimRequested || site.status === "claimed";
                  const cfg = site.siteConfig || {};
                  const visualPreview = resolvePreviewVisualsForBusiness(
                    site.category,
                    site.businessName,
                    site.themeId || cfg.themeId,
                    cfg.finishedWork,
                    cfg.scrapedImages,
                    Number(cfg.imageVariationSeed ?? siteIdx),
                    usedUrlsAcrossBuiltSites,
                    site.city
                  );
                  const palette = visualPreview.theme;
                  const activeAccent = cfg.customAccentColor || palette.accent;
                  const rawPin = cfg.adminPassword || cfg.adminPin || "owner2026";
                  const adminPin = rawPin === "2026" && !cfg.adminPasswordChanged ? "owner2026" : rawPin;
                  const isLiveHosted = cfg.hostingMode === "live_hosted";
                  const scrapedCount = Array.isArray(cfg.scrapedImages) ? cfg.scrapedImages.length : 0;
                  return (
                  <div
                    key={site.siteId}
                    className={`bg-slate-900 border rounded-2xl p-6 transition-all ${
                      isClaimed ? "border-emerald-500/50" : "border-slate-800"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-white">
                            {cfg.brandName || site.businessName}
                          </h3>
                          <span className="text-xs text-slate-400">
                            {site.category} · {site.city}, {site.country}
                          </span>
                          <span className="text-slate-600">·</span>
                          {/* Interactive Brand Color Swatch & Quick-Switcher */}
                          <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                            <span
                              className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: activeAccent }}
                            />
                            <select
                              value={site.themeId || cfg.themeId || palette.id}
                              onChange={(e) => handleQuickChangeSiteTheme(site, e.target.value)}
                              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                              title="Switch Website Color Theme Live"
                            >
                              {Object.values(WEBSITE_COLOR_THEMES).map((t) => (
                                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs font-mono text-slate-400">
                            Owner Admin Password: <strong className="text-amber-300">{adminPin}</strong>
                          </span>
                          {isLiveHosted && (
                            <span className="text-xs font-bold text-emerald-400">
                              · ● LIVE HOSTED MODE
                            </span>
                          )}
                          {cfg.vercelDeploymentUrl && (
                            <a
                              href={cfg.vercelDeploymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-white text-slate-950 text-xs font-extrabold hover:bg-slate-200 transition-colors"
                              title="Open Live Deployed Vercel Production URL"
                            >
                              <span>▲ Live on Vercel</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {isClaimed && (
                            <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                              ✓ WEBSITE CLAIMED BY OWNER
                            </span>
                          )}
                        </div>

                        {/* Live Industry Action Visuals + Preserved Outdated Website Photos Strip */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                          <div className="flex items-center gap-2">
                            {visualPreview.images.slice(0, 4).map((imgUrl, idx) => (
                              <a
                                key={idx}
                                href={livePath}
                                onClick={(e) => openSiteInstantly(livePath, site, e)}
                                className="relative w-20 h-12 rounded-lg overflow-hidden border border-slate-700 group shrink-0 bg-slate-950 cursor-pointer"
                                title="Click to preview live website visuals"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`${site.businessName} visual ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <span
                                  className="absolute bottom-0 inset-x-0 h-1"
                                  style={{ backgroundColor: activeAccent }}
                                />
                              </a>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-400 space-y-0.5">
                            <div className="font-semibold text-slate-200 flex items-center gap-2 flex-wrap">
                              <span>{visualPreview.nicheLabel} Visuals Active</span>
                              <button
                                type="button"
                                disabled={regeneratingImagesSiteId === site.siteId}
                                onClick={() => handleRegenerateSiteImages(site)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                title="If any image is unrelated or not unique, click to regenerate fresh unique images for this website"
                              >
                                <Sparkles className={`w-3 h-3 ${regeneratingImagesSiteId === site.siteId ? "animate-spin" : ""}`} />
                                <span>
                                  {regeneratingImagesSiteId === site.siteId
                                    ? "Regenerating Images…"
                                    : "✨ Regenerate Images"}
                                </span>
                              </button>
                            </div>
                            <div>
                              3 Unique Showcase Photos (Base64-Embedded for Vercel)
                              {scrapedCount > 0
                                ? ` + ${scrapedCount} Preserved Client Website Photo${scrapedCount > 1 ? "s" : ""}`
                                : site.originalWebsite
                                ? ` · Outdated URL: ${site.originalWebsite}`
                                : " · Built for No-Website Lead"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400 font-mono">
                          <span>Phone: {site.phone || "N/A"}</span>
                          <span>Email: {site.email || "Not set"}</span>
                          <span>Views: {site.totalViews || 0}</span>
                          <span className="text-amber-300 font-semibold">
                            4-Tap &amp; Chatbot Leads Captured: {site.funnelSubmissionsCount || 0}
                          </span>
                        </div>

                        {/* Industry-Intelligent 4 Smart Features Strip */}
                        <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                {cfg.intelligentModules?.industryLabel ||
                                  `${site.category || "Local"} Smart Conversion Suite`}
                              </span>
                              {cfg.intelligentModules?.priceEstimator?.enabled !== false && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                                  ✓ Price Estimator
                                </span>
                              )}
                              {cfg.intelligentModules?.appointmentPicker?.enabled !== false && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-semibold">
                                  ✓ Live Slot Picker
                                </span>
                              )}
                              {cfg.intelligentModules?.promoVoucher?.enabled !== false && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                                  ✓ Promo Voucher ({cfg.intelligentModules?.promoVoucher?.code || "VIP50"})
                                </span>
                              )}
                              {cfg.intelligentModules?.seoBlog?.enabled !== false && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300 font-semibold">
                                  ✓ AI Local SEO Blog (
                                  {Array.isArray(cfg.intelligentModules?.seoBlog?.articles)
                                    ? cfg.intelligentModules.seoBlog.articles.length
                                    : 3}{" "}
                                  Guides)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
                              {cfg.intelligentModules?.intelligenceReason ||
                                "Intelligently configured for this business type (can toggle any or both Estimator & Slot Picker in Owner Admin)."}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleGenerateSiteBlogPost(site)}
                              disabled={generatingBlogSiteId === site.siteId}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 cursor-pointer disabled:opacity-50"
                              title="Generate a new AI Local SEO & Cost Guide article for this business"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  generatingBlogSiteId === site.siteId ? "animate-spin" : ""
                                }`}
                              />
                              <span>
                                {generatingBlogSiteId === site.siteId
                                  ? "Writing SEO Guide..."
                                  : "✨ +1 AI SEO Blog Post"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminDrawerSite(site)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                            >
                              <Settings className="w-3 h-3" />
                              <span>Configure 4 Features</span>
                            </button>
                          </div>
                        </div>

                        {/* Built-In Automated Website Chatbot + Arrival Chime Status Strip */}
                        <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5"
                              style={{ backgroundColor: activeAccent }}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-emerald-300">
                                  {cfg.chatbotConfig?.enabled === false
                                    ? "Automated Website Chatbot (Paused)"
                                    : "Built-In Automated Bottom Chatbot + Sound Chime: ACTIVE"}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                                  Auto-Opens on Visitor Arrival
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {(cfg.chatbotConfig?.greeting || "")
                                  .replace(/I'm your automated assistant\s*[—–-]*\s*/gi, "We're ")
                                  .replace(/I am your automated assistant\s*[—–-]*\s*/gi, "We're ") ||
                                  `👋 Hi there! Welcome to ${cfg.brandName || site.businessName} in ${site.city}. How can we help you today?`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                speakTextWithStudioPersona(
                                  (cfg.chatbotConfig?.greeting || "")
                                    .replace(/I'm your automated assistant\s*[—–-]*\s*/gi, "We're ")
                                    .replace(/I am your automated assistant\s*[—–-]*\s*/gi, "We're ") ||
                                    `Hi there! Welcome to ${cfg.brandName || site.businessName} in ${site.city}. How can we help you today?`,
                                  cfg.chatbotConfig?.voiceName || selectedVoicePersona || "Kore",
                                  cfg.brandName || site.businessName
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 cursor-pointer"
                              title="Hear the spoken AI voice greeting built into this website's chatbot"
                            >
                              <Mic className="w-3.5 h-3.5" />
                              <span>Test Spoken Voice</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => playChatbotSound("arrival")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                              title="Hear the exact arrival notification chime visitors hear when the chatbot opens on their website"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Test Chime</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminDrawerSite(site)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                            >
                              <Settings className="w-3 h-3" />
                              <span>Edit Chatbot &amp; Voice</span>
                            </button>
                          </div>
                        </div>

                        {/* If Claimed, show the Business Owner's Claim Submission Details */}
                        {isClaimed && site.claimData?.claimedByName && (
                          <div className="mt-3 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1.5">
                            <div className="font-bold text-emerald-300 flex flex-wrap items-center gap-2">
                              <span>
                                Claimed by {site.claimData.claimedByName} · Phone:{" "}
                                <span className="font-mono">{site.claimData.claimedByPhone}</span> · Email:{" "}
                                {site.claimData.claimedByEmail}
                              </span>
                              {site.claimData.monthlyTotal && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono font-extrabold">
                                  {site.claimData.billingMonths && site.claimData.billingMonths > 1
                                    ? `${site.claimData.billingMonths} Mos Prepaid ($${site.claimData.dueToday || site.claimData.monthlyTotal} Total)`
                                    : `$${site.claimData.monthlyTotal}/mo${site.claimData.oneTimeTotal ? ` + $${site.claimData.oneTimeTotal} setup` : ""}`}
                                </span>
                              )}
                            </div>
                            {site.claimData.selectedPlan && (
                              <div>
                                Selected Plan: <strong className="text-white">{site.claimData.selectedPlan}</strong>
                              </div>
                            )}
                            {Array.isArray(site.claimData.selectedAddons) &&
                              site.claimData.selectedAddons.length > 0 && (
                                <div>
                                  Upsell Add-Ons Chosen:{" "}
                                  <strong className="text-amber-300">
                                    {site.claimData.selectedAddons.join(" · ")}
                                  </strong>
                                </div>
                              )}
                            <div>
                              Domain Preference: <strong>{site.claimData.domainPreference}</strong>
                              {site.claimData.customNotes ? ` · Notes: "${site.claimData.customNotes}"` : ""}
                            </div>
                            <div className="pt-1.5 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                                  Payment Status:
                                </span>
                                {site.claimData.paymentStatus === "paid_active" ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-bold text-[11px]">
                                    ✓ PAID &amp; ACTIVE
                                  </span>
                                ) : site.claimData.paymentStatus === "payment_submitted" ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[11px]">
                                    💳 PAYMENT SUBMITTED ({String(site.claimData.paymentMethodSelected || "Card/Bank/Crypto").toUpperCase()})
                                    {site.claimData.paymentReference ? ` · Ref: ${site.claimData.paymentReference}` : ""}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold text-[11px]">
                                    ⏳ Awaiting Payment (${site.claimData.dueToday || site.claimData.monthlyTotal || 97} Due)
                                  </span>
                                )}
                                {site.claimData.autoEmailStatus && (
                                  <span className="text-[11px] text-emerald-300/80">
                                    · Invoice: {site.claimData.autoEmailStatus}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {site.claimData.paymentStatus !== "paid_active" && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkSitePaid(site)}
                                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer"
                                  >
                                    ✓ Mark as Paid &amp; Active
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                          href={livePath}
                          onClick={(e) => openSiteInstantly(livePath, site, e)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <span>Preview Live 4-Tap Site</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenVoiceStudioForSite(site, "website_claim")}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                          title="Generate a $0 Human AI Voice-Note Pitch (6 Distinct Voices) or Launch an Automated AI Machine Phone Call for this Website"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>🎙️ AI Voice Pitch &amp; Call</span>
                        </button>

                        <a
                          href={`/review/${site.siteId}`}
                          onClick={(e) => openSiteInstantly(`/review/${site.siteId}`, site, e)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap cursor-pointer"
                          title="Open Standalone 5-Star Review Shield & Bad-Review Blocker (/review/:siteId)"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>5-Star Review Shield</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenReviewShieldPitchModal(site)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/40 transition-colors whitespace-nowrap cursor-pointer"
                          title="Pitch the 5-Star Review Shield separately as a standalone $97/mo service"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Pitch Review Shield Separately</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPaymentModal(site)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/40 transition-colors whitespace-nowrap cursor-pointer"
                          title="Send Claimed Message with Payment Methods (Lemon Squeezy Credit Card, Bank Transfer, and Crypto)"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Send Payment / Claimed Msg</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAdminDrawerSite(site)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition-colors whitespace-nowrap cursor-pointer"
                          title="Open Website Owner Admin CMS (Change Logo, Brand Colors, Services, Hosting & Domain)"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Admin CMS &amp; Hosting</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenVercelModal(site)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold bg-white text-slate-950 hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                          title="Deploy this website directly to your free Vercel account (*.vercel.app or custom domain) in 1 click"
                        >
                          <span>▲ {cfg.vercelDeploymentUrl ? "Update on Vercel" : "Deploy to Vercel"}</span>
                        </button>

                        <a
                          href={`/api/website-builder/public/${site.siteId}/export-html`}
                          download={`${site.siteId}-production-website.html`}
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-sky-300 hover:bg-slate-700 border border-slate-700 whitespace-nowrap"
                          title="Download standalone HTML website to self-host anywhere"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download HTML</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenEmailModal(site)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-400" />
                          <span>Send Claim Email</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copySiteUrl(site.siteId)}
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 whitespace-nowrap cursor-pointer"
                        >
                          {copiedId === site.siteId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        {site.siteId !== "valley-construction-sacramento" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRebuildExistingSite(site)}
                              disabled={buildingId === site.siteId}
                              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 whitespace-nowrap"
                              title="Rebuild with AI-matched industry services & images"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${buildingId === site.siteId ? "animate-spin" : ""}`} />
                              <span>{buildingId === site.siteId ? "Rebuilding…" : "AI Rebuild"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSite(site.siteId)}
                              className="p-2.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700"
                              title="Delete website"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-TAB 1B: 🎙️ AI VOICE-NOTE STUDIO ($0 FREE) & OUTBOUND AI MACHINE PHONE CALLER FOR WEBSITES ─── */}
      {subTab === "voice" && (
        <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl text-white">
          <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-950">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Website Builder Suite · 6-Persona AI Voice Studio ($0 Cost) &amp; Automated Phone Caller</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Pitch Any Auto-Built 4-Tap Website or 5-Star Review Shield with Human AI Voice &amp; Machine Calls
                </h3>
                <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                  Select any built website below, pick one of our <strong>6 distinct human voices</strong> (Sarah, Marcus, Ryan, Victoria, Viktor, or Tunde), and generate a custom 25-second <strong>.WAV Voice-Note Walkthrough</strong> to attach to your Claim Email / WhatsApp, OR launch an <strong>Automated Outbound AI Machine Phone Call</strong> to ring the business owner&apos;s phone directly.
                </p>
              </div>

              {/* Quick Selector: Load from Built Websites or Detected Candidates */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <select
                  value={voiceTargetSiteId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setVoiceTargetSiteId(id);
                    const foundSite = sites.find((s) => s.siteId === id);
                    if (foundSite) {
                      setVoiceBizName(foundSite.businessName);
                      setVoiceOwnerName(foundSite.ownerName || "");
                      setVoiceCategory(foundSite.category || "Local Services");
                      setVoiceCity(foundSite.city || "Sacramento");
                      setVoicePhone(foundSite.phone || "");
                      setVoiceEmail(foundSite.email || "");
                      setVoiceSiteUrl(
                        `${window.location.origin}/${
                          voicePitchMode === "review_shield" ? "review" : "site"
                        }/${foundSite.siteId}`
                      );
                      handleGenerateBuilderVoicePitch(
                        selectedVoicePersona,
                        voicePitchMode,
                        {
                          siteId: foundSite.siteId,
                          businessName: foundSite.businessName,
                          ownerName: foundSite.ownerName,
                          category: foundSite.category,
                          city: foundSite.city,
                          phone: foundSite.phone,
                          email: foundSite.email,
                        },
                        true,
                        true
                      );
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300 cursor-pointer"
                >
                  <option value="">— Select Built Website to Pitch —</option>
                  {sites.map((s) => (
                    <option key={s.siteId} value={s.siteId}>
                      🌐 {s.businessName} ({s.city}) — /site/{s.siteId}
                    </option>
                  ))}
                </select>

                <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVoicePitchMode("website_claim");
                      if (voiceTargetSiteId) {
                        setVoiceSiteUrl(`${window.location.origin}/site/${voiceTargetSiteId}`);
                      }
                      handleGenerateBuilderVoicePitch(selectedVoicePersona, "website_claim", undefined, true, true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      voicePitchMode === "website_claim"
                        ? "bg-amber-400 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    🌐 Pitch 4-Tap Website
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoicePitchMode("review_shield");
                      if (voiceTargetSiteId) {
                        setVoiceSiteUrl(`${window.location.origin}/review/${voiceTargetSiteId}`);
                      }
                      handleGenerateBuilderVoicePitch(selectedVoicePersona, "review_shield", undefined, true, true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      voicePitchMode === "review_shield"
                        ? "bg-emerald-400 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    🛡️ Pitch Review Shield
                  </button>
                </div>
              </div>
            </div>

            {/* Editable Target Business Context Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Business Name</label>
                <input
                  value={voiceBizName}
                  onChange={(e) => setVoiceBizName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Owner / Contact</label>
                <input
                  value={voiceOwnerName}
                  onChange={(e) => setVoiceOwnerName(e.target.value)}
                  placeholder="Owner Name"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
                <input
                  value={voiceCategory}
                  onChange={(e) => setVoiceCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">City</label>
                <input
                  value={voiceCity}
                  onChange={(e) => setVoiceCity(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Owner Email (For .WAV)</label>
                <input
                  value={voiceEmail}
                  onChange={(e) => setVoiceEmail(e.target.value)}
                  placeholder="owner@business.com"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Phone (For AI Call)</label>
                <input
                  value={voicePhone}
                  onChange={(e) => setVoicePhone(e.target.value)}
                  placeholder="+19162911047"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Main 2-Column Studio Grid: Left = $0 6-Voice Studio, Right = Outbound AI Machine Caller */}
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: 6-Persona $0 Studio AI Voice-Note Pitch */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Mic className="w-4 h-4" />
                    <span>1. $0 Studio AI Voice-Note Pitch (6 Distinct Voices)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click any persona to switch voice &amp; script style
                  </span>
                </div>

                {/* 6 Voice Persona Switcher Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STUDIO_VOICE_LIST.map((vp) => {
                    const active = selectedVoicePersona === vp.id;
                    return (
                      <button
                        key={vp.id}
                        type="button"
                        disabled={generatingVoice}
                        onClick={() => {
                          setSelectedVoicePersona(vp.id);
                          handleGenerateBuilderVoicePitch(vp.id, voicePitchMode, undefined, true, true);
                        }}
                        className={`px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
                          active
                            ? "bg-emerald-500/20 border-emerald-400 text-white shadow-sm"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{vp.shortName}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{vp.roleBadge}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      Spoken Website Claim Script (Editable):
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateBuilderVoicePitch(selectedVoicePersona, voicePitchMode, undefined, true, true)
                      }
                      className="text-[11px] text-amber-400 hover:underline font-semibold cursor-pointer"
                    >
                      ↻ Regenerate Script for Persona
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={voiceScript}
                    onChange={(e) => {
                      setVoiceScript(e.target.value);
                      setVoiceWavDataUrl(null);
                    }}
                    placeholder="Click any of the 6 voice personas above or click 'Generate & Play Voice Pitch' below..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {voiceWavDataUrl && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                      <span>
                        Studio WAV Audio Ready ({STUDIO_VOICE_LIST.find((v) => v.id === synthesizedPersonaId)?.shortName || selectedVoicePersona})
                      </span>
                      <span>24kHz PCM WAV</span>
                    </div>
                    <audio controls src={voiceWavDataUrl} className="w-full h-8" />
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={generatingVoice}
                    onClick={() =>
                      handleGenerateBuilderVoicePitch(
                        selectedVoicePersona,
                        voicePitchMode,
                        undefined,
                        true,
                        !voiceScript.trim()
                      )
                    }
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {generatingVoice
                        ? "Synthesizing Studio Voice..."
                        : voiceScript
                        ? "🎙️ Synthesize & Play Voice"
                        : "🎙️ Generate & Play Voice Pitch"}
                    </span>
                  </button>

                  {speakingVoice ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopAllStudioVoices();
                        setSpeakingVoice(false);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    voiceScript && (
                      <button
                        type="button"
                        onClick={() => {
                          if (voiceWavDataUrl && synthesizedPersonaId === selectedVoicePersona) {
                            playStudioWavUrl(
                              voiceWavDataUrl,
                              () => setSpeakingVoice(true),
                              () => setSpeakingVoice(false)
                            );
                          } else {
                            handleGenerateBuilderVoicePitch(
                              selectedVoicePersona,
                              voicePitchMode,
                              undefined,
                              true,
                              false
                            );
                          }
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Play Voice</span>
                      </button>
                    )
                  )}

                  {voiceWavDataUrl && (
                    <a
                      href={voiceWavDataUrl}
                      download={`Website-Voice-Pitch-${voiceBizName.replace(/[^a-zA-Z0-9]/g, "-")}.wav`}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs inline-flex items-center gap-1.5 border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .WAV</span>
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  disabled={sendingVoiceEmail || !voiceScript.trim()}
                  onClick={handleSendVoiceStudioEmail}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {sendingVoiceEmail
                      ? "Sending Claim Email + .WAV Audio..."
                      : `Send Website Claim Email + Attached .WAV Voice Note to ${voiceEmail || "Owner"}`}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Outbound AI Machine Phone Caller */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    <span>2. Outbound AI Machine Phone Caller (Auto-Dials Owner)</span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                    Active Keys: {callerConfig?.keys?.length || 0}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Have our AI Machine Caller dial <strong>{voiceBizName}</strong> at{" "}
                  <strong className="text-amber-300 font-mono">{voicePhone || "their phone number"}</strong>. When the owner picks up, the AI speaks the Website Claim script above, answers questions about their new 4-Tap Estimate Funnel, and tells them to check their email/text for the live preview link!
                </p>

                {/* Quick API Key Pool Adder for Bland / Retell / Vapi */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-300">
                    Add Free-Trial AI Phone Caller Key (Bland.ai / Retell.ai $10 Free / Vapi.ai):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={newCallerKeyProvider}
                      onChange={(e) => setNewCallerKeyProvider(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="bland">Bland.ai</option>
                      <option value="retell">Retell.ai ($10 Free)</option>
                      <option value="vapi">Vapi.ai ($5 Free)</option>
                    </select>
                    <input
                      value={newCallerKeyValue}
                      onChange={(e) => setNewCallerKeyValue(e.target.value)}
                      placeholder="Paste API Key (sk-...)"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                    />
                    <div className="flex gap-1.5">
                      <input
                        value={newCallerFromNum}
                        onChange={(e) => setNewCallerFromNum(e.target.value)}
                        placeholder="From # (Optional)"
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        disabled={savingCallerKey}
                        onClick={handleAddWebsiteCallerKey}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shrink-0 cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {lastMachineCallId && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-200">
                        Live Call ID: <code className="font-mono">{lastMachineCallId.slice(0, 14)}</code> · Status:{" "}
                        <span className="text-amber-300 uppercase">{lastMachineCallStatus || "ringing"}</span>
                      </span>
                      <button
                        type="button"
                        disabled={checkingMachineCall}
                        onClick={handleCheckWebsiteMachineCallStatus}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {checkingMachineCall ? "Checking..." : "↻ Refresh Call Transcript"}
                      </button>
                    </div>
                    {lastMachineCallTranscript && (
                      <div className="p-2.5 rounded bg-slate-950 text-[11px] text-slate-300 font-mono max-h-28 overflow-y-auto whitespace-pre-wrap">
                        {lastMachineCallTranscript}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={placingMachineCall}
                  onClick={() => handlePlaceWebsiteMachineCall()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 disabled:opacity-50 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Phone className="w-4 h-4" />
                  <span>
                    {placingMachineCall
                      ? "Dialing Business Phone via AI Caller..."
                      : `📞 Launch Automated AI Machine Call to ${voiceBizName} (${voicePhone || "Set Phone"})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-TAB 2: AI DETECTION QUEUE (NO WEBSITE & BAD OUTDATED WEBSITES) ─── */}
      {subTab === "candidates" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white">
                AI Website Opportunity Detector (Prioritized by No-Website &amp; Low Conversion Score)
              </div>
              <p className="text-xs text-slate-400">
                Businesses with <strong>No Website</strong> or an <strong>Outdated Website (&lt;65/100)</strong> convert at the highest rate when sent a live custom 4-Tap website they can claim in one click.
              </p>
            </div>
          </div>

          {mergedCandidates.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <p className="text-slate-300 font-semibold">
                No scraped leads in your CRM yet, or build one directly with the Custom Builder tab.
              </p>
              <button
                type="button"
                onClick={() => setSubTab("custom")}
                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Build Custom Business Website Now →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(() => {
                const usedUrlsAcrossCandidates = new Set<string>();
                return mergedCandidates.map((cand, candIdx) => {
                  const candKey = cand.prospectId || cand.businessName;
                  const isBuilding = buildingId === candKey;
                  const candSeed = (candidateImageSeeds[candKey] || 0) + candIdx;
                  const previewVisuals = resolvePreviewVisualsForBusiness(
                    cand.category,
                    cand.businessName,
                    candidateThemeOverrides[candKey],
                    undefined,
                    undefined,
                    candSeed,
                    usedUrlsAcrossCandidates,
                    cand.city
                  );
                  return (
                    <div
                      key={candKey}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-2.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-base font-bold text-white">{cand.businessName}</span>
                          <span className="text-xs text-slate-400">
                            {cand.category} · {cand.city}
                          </span>
                          <span className="text-slate-600">·</span>
                          {cand.detectionStatus === "no_website" ? (
                            <span className="text-xs font-bold text-rose-400">
                              🚨 NO WEBSITE DETECTED
                            </span>
                          ) : cand.detectionStatus === "bad_website" ? (
                            <span className="text-xs font-bold text-amber-400">
                              ⚠️ OUTDATED WEBSITE ({cand.originalScore}/100)
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-sky-400">
                              UPGRADE READY (Missing 4-Tap Funnel)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{cand.detectionReason}</p>

                        {/* Pre-Build Industry Action Images + Brand Color Preview */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <div className="flex items-center gap-1.5">
                            {previewVisuals.images.slice(0, 3).map((src, i) => (
                              <div
                                key={`${candKey}_img_${i}_${src}`}
                                className="w-16 h-10 rounded-md overflow-hidden border border-slate-700 relative bg-slate-950 shrink-0"
                              >
                                <img
                                  src={src}
                                  alt={`${cand.businessName} preview ${i + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <span
                                  className="absolute bottom-0 inset-x-0 h-1"
                                  style={{ backgroundColor: previewVisuals.theme.accent }}
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setCandidateImageSeeds((prev) => ({
                                  ...prev,
                                  [candKey]: (prev[candKey] || 0) + 1,
                                }))
                              }
                              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-amber-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
                              title="Instantly swap in 3 different unique industry photos for this business"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>New Photos</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: previewVisuals.theme.accent }}
                              />
                              <select
                                value={candidateThemeOverrides[candKey] || previewVisuals.theme.id}
                                onChange={(e) =>
                                  setCandidateThemeOverrides((prev) => ({
                                    ...prev,
                                    [candKey]: e.target.value,
                                  }))
                                }
                                className="bg-transparent text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer"
                                title="Choose Brand Color Theme before building"
                              >
                                {Object.values(WEBSITE_COLOR_THEMES).map((t) => (
                                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {cand.originalWebsite
                                ? `Preserves photos from ${cand.originalWebsite} + 3 unique ${previewVisuals.nicheLabel} visuals + Auto-Built Bottom Chatbot`
                                : `Includes 3 unique ${previewVisuals.nicheLabel} visuals + Auto-Built Bottom Chatbot`}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 font-mono">
                          Phone: {cand.phone || "N/A"} · Email: {cand.email || "N/A"} · Current URL:{" "}
                          {cand.originalWebsite || "None"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenVoiceStudioForCandidate(cand)}
                          className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                          title="Generate a $0 Human AI Voice-Note Pitch or Launch an AI Phone Call for this candidate"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>🎙️ Voice Pitch &amp; Call</span>
                        </button>
                        {cand.builtSiteId ? (
                          <>
                            <a
                              href={`/site/${cand.builtSiteId}`}
                              onClick={(e) =>
                                openSiteInstantly(
                                  `/site/${cand.builtSiteId}`,
                                  sites.find((s) => s.siteId === cand.builtSiteId),
                                  e
                                )
                              }
                              className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>View Built Website</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                handleAutoBuildForCandidate(
                                  cand,
                                  previewVisuals.images.slice(0, 3),
                                  candSeed
                                )
                              }
                              disabled={isBuilding}
                              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap"
                            >
                              {isBuilding ? "Rebuilding…" : "Rebuild"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleAutoBuildForCandidate(
                                cand,
                                previewVisuals.images.slice(0, 3),
                                candSeed
                              )
                            }
                            disabled={isBuilding}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {isBuilding
                                ? "AI Building 4-Tap Website…"
                                : "Auto-Build 4-Tap Website & Claim Pitch"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-TAB 3: CUSTOM INSTANT BUILDER ─── */}
      {subTab === "custom" && (
        <form
          onSubmit={handleCustomBuild}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              Auto-Build High-Converting 4-Tap Website + Automated Bottom Chatbot for Any Business
            </h3>
            <p className="text-xs text-slate-400">
              Enter a business’s basic information below. The AI will automatically build their full 4-Tap Instant Estimate Website, Built-In Automated Bottom Chatbot (with arrival sound chime &amp; interactive customer questions), industry action visuals, and “What Changed” claim presentation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                value={customBizName}
                onChange={(e) => setCustomBizName(e.target.value)}
                placeholder="e.g. Valley Construction and Renovation"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Trade / Industry Category *
              </label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Dentist, Plumbing, HVAC, Law Firm, Restaurant, Auto Repair, Roofing"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Specific Business Services (Optional — AI auto-detects if blank)
              </label>
              <input
                type="text"
                value={customServices}
                onChange={(e) => setCustomServices(e.target.value)}
                placeholder="e.g. Dental Implants, Invisalign, Emergency Root Canal"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                City *
              </label>
              <input
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="e.g. Sacramento"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                State / Country
              </label>
              <input
                type="text"
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                placeholder="e.g. CA or USA"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Phone Number
              </label>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="(916) 291-1047"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Owner / Prospect Email (For Claim Pitch)
              </label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="owner@business.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Owner Name (Optional)
              </label>
              <input
                type="text"
                value={customOwnerName}
                onChange={(e) => setCustomOwnerName(e.target.value)}
                placeholder="e.g. Dr. Sarah Chen or Marcus Vance"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Existing Website URL (AI will scrape real services &amp; photos)
              </label>
              <input
                type="text"
                value={customOrigWeb}
                onChange={(e) => setCustomOrigWeb(e.target.value)}
                placeholder="Leave empty if business has no website"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Visual Design Theme
              </label>
              <select
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              >
                <option value="">✨ AI Auto-Match Distinct Brand Color by Industry &amp; Name</option>
                {Object.values(WEBSITE_COLOR_THEMES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.badge})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Notes / Special Offers / Positioning (Optional)
              </label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="e.g. 24/7 emergency dispatch, 20 years in business, accepts all PPO dental insurance, family-owned…"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>
          </div>

          {/* Live Visual & Brand Color Preview for Custom Builder Workflow */}
          {(() => {
            const customPreview = resolvePreviewVisualsForBusiness(
              customCategory || "Fitness & Personal Training",
              customBizName || "Sample Business",
              customTheme || undefined
            );
            return (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      Live Visual &amp; Color Theme Preview ({customPreview.nicheLabel})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Assigned Brand Palette:{" "}
                    <strong className="text-white">{customPreview.theme.name}</strong> (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full align-middle mx-1"
                      style={{ backgroundColor: customPreview.theme.accent }}
                    />
                    <span className="font-mono">{customPreview.theme.accent}</span>)
                    {customOrigWeb.trim()
                      ? ` · Will also scrape & preserve existing photos from ${customOrigWeb.trim()}`
                      : " · Includes 3 high-impact industry action visuals"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {customPreview.images.slice(0, 3).map((imgSrc, i) => (
                    <div
                      key={i}
                      className="w-24 h-14 rounded-lg overflow-hidden border border-slate-700 relative bg-slate-900"
                    >
                      <img
                        src={imgSrc}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className="absolute bottom-0 inset-x-0 h-1"
                        style={{ backgroundColor: customPreview.theme.accent }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <button
            type="submit"
            disabled={buildingId === "custom_form"}
            className="px-6 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {buildingId === "custom_form"
                ? "AI Building Custom 4-Tap Website…"
                : "Generate Live 4-Tap Website & Claim Pitch →"}
            </span>
          </button>
        </form>
      )}

      {/* ─── SUB-TAB 4: PAYMENT METHODS CONFIG (LEMON SQUEEZY CARD, BANK TRANSFER, CRYPTO) ─── */}
      {subTab === "payment" && (
        <form
          onSubmit={handleSavePaymentConfig}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Post-Claim Automated Billing &amp; Checkout
              </div>
              <h3 className="text-lg font-bold text-white">
                Payment Methods Sent When a Business Owner Claims a Website
              </h3>
              <p className="text-xs text-slate-400">
                Configure your <strong>Credit Card (Lemon Squeezy)</strong> checkout link,{" "}
                <strong>Bank Transfer / Wire / Zelle</strong> details, and{" "}
                <strong>Crypto Wallet Addresses</strong>. These appear immediately inside the Claim Modal and are automatically emailed to the business owner upon claiming.
              </p>
            </div>
            <label className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs font-bold text-emerald-300 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(paymentConfig.autoSendInvoiceOnClaim)}
                onChange={(e) =>
                  setPaymentConfig({ ...paymentConfig, autoSendInvoiceOnClaim: e.target.checked })
                }
                className="rounded accent-emerald-500"
              />
              <span>Auto-Email Payment Invoice on Claim</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 1. Credit Card (Lemon Squeezy) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <CreditCard className="w-4 h-4" />
                <span>1. Credit Card (Lemon Squeezy)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lemon Squeezy Checkout URL (or Stripe Payment Link)
                </label>
                <input
                  type="url"
                  value={paymentConfig.lemonCheckoutUrl || ""}
                  onChange={(e) =>
                    setPaymentConfig({ ...paymentConfig, lemonCheckoutUrl: e.target.value })
                  }
                  placeholder="https://yourstore.lemonsqueezy.com/checkout/buy/..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Card Checkout Note Shown to Client
                </label>
                <textarea
                  rows={3}
                  value={paymentConfig.lemonNotes || ""}
                  onChange={(e) =>
                    setPaymentConfig({ ...paymentConfig, lemonNotes: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            {/* 2. Bank Transfer / Wire / Zelle */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>2. Bank Transfer / Wire / Zelle</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.bankName || ""}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, bankName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.bankAccountName || ""}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, bankAccountName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.bankAccountNumber || ""}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, bankAccountNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Routing / ABA Number
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.bankRoutingNumber || ""}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, bankRoutingNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    SWIFT / IBAN
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.bankSwiftIban || ""}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, bankSwiftIban: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Zelle / Revolut / Instant
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.zelleOrFasterPay || ""}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, zelleOrFasterPay: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. Cryptocurrency Wallets */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                <Coins className="w-4 h-4" />
                <span>3. Crypto Wallets (USDT / USDC / BTC)</span>
              </div>
              <div className="space-y-2.5">
                {(paymentConfig.cryptoWallets || []).map((w: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={w.symbol}
                        onChange={(e) => {
                          const next = [...paymentConfig.cryptoWallets];
                          next[idx] = { ...next[idx], symbol: e.target.value };
                          setPaymentConfig({ ...paymentConfig, cryptoWallets: next });
                        }}
                        placeholder="USDT"
                        className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs font-bold"
                      />
                      <input
                        type="text"
                        value={w.network}
                        onChange={(e) => {
                          const next = [...paymentConfig.cryptoWallets];
                          next[idx] = { ...next[idx], network: e.target.value };
                          setPaymentConfig({ ...paymentConfig, cryptoWallets: next });
                        }}
                        placeholder="TRC20 / ERC20"
                        className="flex-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-300 text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      value={w.address}
                      onChange={(e) => {
                        const next = [...paymentConfig.cryptoWallets];
                        next[idx] = { ...next[idx], address: e.target.value };
                        setPaymentConfig({ ...paymentConfig, cryptoWallets: next });
                      }}
                      placeholder="Wallet address..."
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={savingPaymentConfig}
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              {savingPaymentConfig
                ? "Saving Payment Methods…"
                : "Save Payment Methods (Lemon Card, Bank Transfer & Crypto)"}
            </button>
          </div>
        </form>
      )}

      {/* ─── SUB-TAB 5: OWNER-ONLY ACCESS LOCK GOVERNANCE ─── */}
      {subTab === "access" && isOwner && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              Owner-Only Access Control &amp; SaaS User Permissions
            </h3>
            <p className="text-xs text-slate-400">
              Control who can see and use the AI Auto-Website Builder. By default, it is locked strictly to your owner account (<strong>jwandersonar@gmail.com</strong>) and completely hidden from regular SaaS users.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => handleUpdateAccessMode("owner_only")}
              className={`p-5 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                accessConfig.mode === "owner_only"
                  ? "bg-amber-500/10 border-amber-400 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">1. Strictly Owner Only</span>
                {accessConfig.mode === "owner_only" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-xs leading-relaxed">
                Enabled ONLY for <strong>jwandersonar@gmail.com</strong>. Completely hidden and disabled for all other users.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateAccessMode("high_level_plans")}
              className={`p-5 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                accessConfig.mode === "high_level_plans"
                  ? "bg-amber-500/10 border-amber-400 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300">2. High-Level Plans (Auto-Unlock)</span>
                {accessConfig.mode === "high_level_plans" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-xs leading-relaxed">
                Auto-unlocks AI Website + 5-Star Review Shield Builder for users on <strong>Agency Scale ($349/mo)</strong> &amp; <strong>Enterprise VIP ($799/mo)</strong>. Lower tiers see an upgrade prompt.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateAccessMode("selected_users")}
              className={`p-5 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                accessConfig.mode === "selected_users"
                  ? "bg-amber-500/10 border-amber-400 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">3. Owner + Selected Users</span>
                {accessConfig.mode === "selected_users" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-xs leading-relaxed">
                Enabled for your owner account plus specific user emails you whitelist below.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateAccessMode("all_users")}
              className={`p-5 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                accessConfig.mode === "all_users"
                  ? "bg-emerald-500/10 border-emerald-400 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-300">4. All Users (Tiered by Plan)</span>
                {accessConfig.mode === "all_users" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-xs leading-relaxed">
                Unlocks AI Website Builder &amp; Review Shield for all users, capped automatically by their plan quota below.
              </p>
            </button>
          </div>

          {/* Per-Plan Website & Review Shield Quota Limits Editor */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Per-Plan Website Builder &amp; 5-Star Review Shield Quotas
                </h4>
                <p className="text-xs text-slate-400">
                  Set how many active websites &amp; Review Shields each subscription tier can generate before being prompted to upgrade.
                </p>
              </div>
              <button
                type="button"
                disabled={savingAccess}
                onClick={() => handleUpdateAccessMode(accessConfig.mode, accessConfig.planQuotas)}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold whitespace-nowrap cursor-pointer"
              >
                {savingAccess ? "Saving Quotas…" : "Save Plan Quotas"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  Starter Plan ($49/mo) Limit
                </label>
                <input
                  type="number"
                  min={0}
                  value={accessConfig.planQuotas?.starter ?? 3}
                  onChange={(e) =>
                    setAccessConfig((prev) => ({
                      ...prev,
                      planQuotas: {
                        starter: Math.max(0, Number(e.target.value) || 0),
                        growth: prev.planQuotas?.growth ?? 15,
                        scale: prev.planQuotas?.scale ?? 100,
                        enterprise: prev.planQuotas?.enterprise ?? 999999,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
                <span className="text-[11px] text-slate-400 block">Default: 3 sites</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-sky-300">
                  Growth Pro Plan ($149/mo) Limit
                </label>
                <input
                  type="number"
                  min={0}
                  value={accessConfig.planQuotas?.growth ?? 15}
                  onChange={(e) =>
                    setAccessConfig((prev) => ({
                      ...prev,
                      planQuotas: {
                        starter: prev.planQuotas?.starter ?? 3,
                        growth: Math.max(0, Number(e.target.value) || 0),
                        scale: prev.planQuotas?.scale ?? 100,
                        enterprise: prev.planQuotas?.enterprise ?? 999999,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
                <span className="text-[11px] text-slate-400 block">Default: 15 sites</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-amber-300">
                  Agency Scale Plan ($349/mo) Limit
                </label>
                <input
                  type="number"
                  min={0}
                  value={accessConfig.planQuotas?.scale ?? 100}
                  onChange={(e) =>
                    setAccessConfig((prev) => ({
                      ...prev,
                      planQuotas: {
                        starter: prev.planQuotas?.starter ?? 3,
                        growth: prev.planQuotas?.growth ?? 15,
                        scale: Math.max(0, Number(e.target.value) || 0),
                        enterprise: prev.planQuotas?.enterprise ?? 999999,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
                <span className="text-[11px] text-slate-400 block">Default: 100 sites</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-emerald-300">
                  Enterprise VIP ($799/mo) Limit
                </label>
                <input
                  type="number"
                  min={1}
                  value={accessConfig.planQuotas?.enterprise ?? 999999}
                  onChange={(e) =>
                    setAccessConfig((prev) => ({
                      ...prev,
                      planQuotas: {
                        starter: prev.planQuotas?.starter ?? 3,
                        growth: prev.planQuotas?.growth ?? 15,
                        scale: prev.planQuotas?.scale ?? 100,
                        enterprise: Math.max(1, Number(e.target.value) || 999999),
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
                <span className="text-[11px] text-slate-400 block">999999 = Unlimited</span>
              </div>
            </div>
          </div>

          {accessConfig.mode === "selected_users" && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-slate-300">
                Whitelisted User Emails (comma-separated)
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={whitelistInput}
                  onChange={(e) => setWhitelistInput(e.target.value)}
                  placeholder="jwandersonar@gmail.com, vipclient@agency.com"
                  className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateAccessMode("selected_users")}
                  className="px-5 py-2.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
                >
                  Save Whitelist
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: SEND "CLAIM YOUR WEBSITE" PITCH EMAIL (Mobile Compatible) ─── */}
      {emailModalSite && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmailModalSite(null);
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full text-white shadow-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0 bg-slate-900">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Outreach + Live Website Claim Link
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                  Send “Claim Website” Email to {emailModalSite.businessName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalSite(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold shrink-0"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSendPitchEmail} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* 1-Click Switcher: Pitch Free Website vs Pitch Standalone Review Shield */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Choose Pitch Offer:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPitchSubject(
                          emailModalSite.pitchSubject ||
                            `We built a new 4-Tap Lead Website for ${emailModalSite.businessName}`
                        );
                        setPitchBody(emailModalSite.pitchBody || "");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-xs font-bold cursor-pointer"
                    >
                      🌐 Pitch Free Website (/site/{emailModalSite.siteId})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const p = buildStandaloneReviewShieldPitch(emailModalSite);
                        setPitchSubject(p.subject);
                        setPitchBody(p.body);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer"
                    >
                      🛡️ Pitch 5-Star Review Shield Separately (/review/{emailModalSite.siteId})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Recipient Business Email *
                  </label>
                  <input
                    type="email"
                    value={pitchToEmail}
                    onChange={(e) => setPitchToEmail(e.target.value)}
                    placeholder="owner@business.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-base sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={pitchSubject}
                    onChange={(e) => setPitchSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-base sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Body (Includes Live Preview &amp; “What Changed” Claim Link)
                  </label>
                  <textarea
                    rows={8}
                    value={pitchBody}
                    onChange={(e) => setPitchBody(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono leading-relaxed"
                    required
                  />
                </div>

                {/* Embedded 6-Persona AI Voice-Note Attachment & AI Machine Phone Call Bar inside Claim Email Modal */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-400">
                      <Mic className="w-4 h-4" />
                      <span>🎙️ Attach $0 AI Studio Voice-Note (.WAV) or Call with AI</span>
                    </div>
                    <select
                      value={selectedVoicePersona}
                      onChange={(e) => {
                        const vId = e.target.value;
                        setSelectedVoicePersona(vId);
                        handleGenerateBuilderVoicePitch(
                          vId,
                          voicePitchMode,
                          {
                            siteId: emailModalSite.siteId,
                            businessName: emailModalSite.businessName,
                            ownerName: emailModalSite.ownerName,
                            category: emailModalSite.category,
                            city: emailModalSite.city,
                            phone: emailModalSite.phone,
                            email: pitchToEmail || emailModalSite.email,
                          },
                          true,
                          true
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300 cursor-pointer"
                    >
                      {STUDIO_VOICE_LIST.map((vp) => (
                        <option key={vp.id} value={vp.id}>
                          {vp.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={generatingVoice}
                      onClick={() =>
                        handleGenerateBuilderVoicePitch(
                          selectedVoicePersona,
                          voicePitchMode,
                          {
                            siteId: emailModalSite.siteId,
                            businessName: emailModalSite.businessName,
                            ownerName: emailModalSite.ownerName,
                            category: emailModalSite.category,
                            city: emailModalSite.city,
                            phone: emailModalSite.phone,
                            email: pitchToEmail || emailModalSite.email,
                          },
                          true,
                          true
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {generatingVoice
                          ? "Synthesizing Voice..."
                          : voiceWavBase64
                          ? "↻ Regenerate & Play .WAV Voice Note"
                          : "🎙️ Generate & Attach 25s .WAV Voice Note"}
                      </span>
                    </button>

                    {emailModalSite.phone && (
                      <button
                        type="button"
                        disabled={placingMachineCall}
                        onClick={() =>
                          handlePlaceWebsiteMachineCall(
                            emailModalSite.phone,
                            emailModalSite.businessName
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>
                          {placingMachineCall
                            ? "Calling..."
                            : `📞 AI Machine Call (${emailModalSite.phone})`}
                        </span>
                      </button>
                    )}

                    {voiceWavBase64 && (
                      <span className="text-[11px] font-bold text-emerald-300">
                        ✓ .WAV Voice Note Ready (Will auto-attach to this email!)
                      </span>
                    )}
                  </div>

                  {voiceWavDataUrl && (
                    <audio controls src={voiceWavDataUrl} className="w-full h-8" />
                  )}
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEmailModalSite(null)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>{sendingEmail ? "Sending Email…" : "Send Website Claim Email"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: SEND CLAIMED PAYMENT INVOICE (LEMON CARD + BANK TRANSFER + CRYPTO) ─── */}
      {paymentModalSite && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPaymentModalSite(null);
          }}
        >
          <div className="bg-slate-900 border border-emerald-500/40 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full text-white shadow-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0 bg-slate-900">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Post-Claim Payment &amp; Hosting Activation Message
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                  Send Payment Methods (Card / Bank / Crypto) to {paymentModalSite.businessName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalSite(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold shrink-0"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSendPaymentEmail} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200">
                  This message includes your <strong>Lemon Squeezy Credit Card Link</strong>,{" "}
                  <strong>Bank Transfer / Wire / Zelle details</strong>, and{" "}
                  <strong>Crypto Wallet Addresses</strong>. You can email it directly or copy it for WhatsApp / SMS.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Business Owner Email *
                  </label>
                  <input
                    type="email"
                    value={paymentToEmail}
                    onChange={(e) => setPaymentToEmail(e.target.value)}
                    placeholder="owner@business.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-base sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Invoice Subject Line
                  </label>
                  <input
                    type="text"
                    value={paymentSubject}
                    onChange={(e) => setPaymentSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-base sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Claimed Message &amp; Payment Options (Lemon Card + Bank Transfer + Crypto)
                  </label>
                  <textarea
                    rows={12}
                    value={paymentBody}
                    onChange={(e) => setPaymentBody(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono leading-relaxed"
                    required
                  />
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentBody);
                    setCopiedPaymentMsg(true);
                    setTimeout(() => setCopiedPaymentMsg(false), 2000);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedPaymentMsg ? "Copied for WhatsApp / SMS!" : "Copy for WhatsApp / SMS"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentModalSite(null)}
                    className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingPaymentEmail}
                    className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>{sendingPaymentEmail ? "Sending Invoice…" : "Send Payment Email Now"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: 1-CLICK DEPLOY GENERATED WEBSITE TO VERCEL ($0 HOSTING COST) ─── */}
      {vercelModalSite && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVercelModalSite(null);
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl max-w-xl w-full text-white shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  ▲ 1-Click Production Deployment · $0 Server Hosting Cost
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  Deploy {vercelModalSite.businessName} to Vercel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVercelModalSite(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleDeployToVercel} className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/35 text-xs text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="font-bold text-emerald-300">
                    ✓ Permanent Embedded Images + Built-In Owner Admin Enabled
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    All 3 showcase photos are embedded directly inside the production HTML bundle so images <strong>never disappear on Vercel</strong>. Includes footer <strong>🔒 Owner Admin</strong> button (default password: <code className="text-amber-300 font-mono">owner2026</code>).
                  </div>
                </div>
                <button
                  type="button"
                  disabled={regeneratingImagesSiteId === vercelModalSite.siteId}
                  onClick={() => handleRegenerateSiteImages(vercelModalSite)}
                  className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {regeneratingImagesSiteId === vercelModalSite.siteId
                    ? "Regenerating…"
                    : "✨ Regenerate Images First"}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="font-bold text-white">
                  How 1-Click Vercel Deployment Works (Free Forever):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>
                    Open{" "}
                    <a
                      href="https://vercel.com/account/tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 underline font-semibold"
                    >
                      vercel.com/account/tokens
                    </a>{" "}
                    and click <strong>Create Token</strong> (takes 10 seconds on a free Vercel account).
                  </li>
                  <li>
                    Paste your token below — we save it in your browser so all future client sites deploy in 1 click.
                  </li>
                  <li>
                    Your client&apos;s complete 4-Tap Website + Automated Voice Chatbot is pushed live to{" "}
                    <code className="text-emerald-300">
                      https://{vercelProjectName || vercelModalSite.siteId}.vercel.app
                    </code>{" "}
                    where you can also attach any custom <code className="text-amber-300">.com</code> domain!
                  </li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Your Vercel Access Token *
                </label>
                <input
                  type="password"
                  value={vercelToken}
                  onChange={(e) => setVercelToken(e.target.value)}
                  placeholder="Paste token from vercel.com/account/tokens..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Vercel Project / Subdomain Name
                  </label>
                  <input
                    type="text"
                    value={vercelProjectName}
                    onChange={(e) =>
                      setVercelProjectName(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, "-")
                      )
                    }
                    placeholder="valley-construction-sacramento"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Vercel Team ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={vercelTeamId}
                    onChange={(e) => setVercelTeamId(e.target.value)}
                    placeholder="Leave blank for personal account"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>

              {lastVercelResult && lastVercelResult.siteId === vercelModalSite.siteId && (
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-300 flex items-center justify-between">
                    <span>✓ LIVE ON VERCEL EDGE NETWORK</span>
                    <span className="font-mono text-[11px]">{lastVercelResult.projectName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-emerald-500/30">
                    <a
                      href={lastVercelResult.deploymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono font-bold text-amber-300 hover:underline truncate"
                    >
                      {lastVercelResult.deploymentUrl}
                    </a>
                    <a
                      href={lastVercelResult.deploymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-extrabold text-xs shrink-0 inline-flex items-center gap-1"
                    >
                      <span>Open Live Site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setVercelModalSite(null)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deployingVercel}
                  className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-50 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>
                    {deployingVercel
                      ? "▲ Deploying to Vercel Edge…"
                      : "▲ Deploy Live to Vercel Now"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── WEBSITE OWNER ADMIN CMS & HOSTING DRAWER (Direct from Agency Dashboard) ─── */}
      {adminDrawerSite && (
        <WebsiteOwnerAdminDrawer
          isOpen={Boolean(adminDrawerSite)}
          onClose={() => setAdminDrawerSite(null)}
          site={adminDrawerSite}
          initialUnlocked={true}
          onSiteUpdated={(updatedSite) => {
            setAdminDrawerSite(updatedSite);
            setSites((prev) =>
              prev.map((s) => (s.siteId === updatedSite.siteId ? { ...s, ...updatedSite } : s))
            );
          }}
        />
      )}
    </div>
  );
}
