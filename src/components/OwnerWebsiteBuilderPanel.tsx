import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { getAdminToken, getSaasToken } from "@/lib/saas-auth";
import {
  WebsiteOwnerAdminDrawer,
  WEBSITE_COLOR_THEMES,
} from "@/components/WebsiteOwnerAdminDrawer";

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

interface BuilderAccessConfig {
  mode: "owner_only" | "selected_users" | "all_users";
  ownerEmail: string;
  allowedUserEmails: string[];
  autoDetectNoWebsite: boolean;
  autoDetectBadWebsite: boolean;
  badWebsiteScoreThreshold: number;
}

async function builderFetch(path: string, init?: RequestInit) {
  const token = getAdminToken() || getSaasToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-admin-token": token,
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
  const [subTab, setSubTab] = useState<"sites" | "candidates" | "custom" | "payment" | "access">("sites");
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<GeneratedSiteRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [accessConfig, setAccessConfig] = useState<BuilderAccessConfig>({
    mode: "owner_only",
    ownerEmail: "jwandersonar@gmail.com",
    allowedUserEmails: ["jwandersonar@gmail.com"],
    autoDetectNoWebsite: true,
    autoDetectBadWebsite: true,
    badWebsiteScoreThreshold: 65,
  });
  const [isOwner, setIsOwner] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Building state
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      const [accData, sitesData, candData, payData] = await Promise.all([
        builderFetch("/api/website-builder/access"),
        builderFetch("/api/website-builder/sites").catch(() => ({ sites: [] })),
        builderFetch("/api/website-builder/candidates").catch(() => ({ candidates: [] })),
        builderFetch("/api/website-builder/payment-config").catch(() => ({ paymentConfig: null })),
      ]);
      if (accData?.config) {
        setAccessConfig(accData.config);
        setWhitelistInput((accData.config.allowedUserEmails || []).join(", "));
      }
      if (payData?.paymentConfig) {
        setPaymentConfig(payData.paymentConfig);
      }
      setIsOwner(Boolean(accData?.isOwner));
      if (Array.isArray(sitesData?.sites)) setSites(sitesData.sites);
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

  // Merge externalLeads (from CRM local storage / hunted results) with server candidates
  const mergedCandidates: CandidateRow[] = React.useMemo(() => {
    const byName = new Map<string, CandidateRow>();
    for (const c of candidates) {
      byName.set(c.businessName.trim().toLowerCase(), c);
    }
    const existingSitesByName = new Map(
      sites.map((s) => [s.businessName.trim().toLowerCase(), s])
    );

    for (const lead of externalLeads) {
      const name = (lead.businessName || lead.company || lead.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (byName.has(key)) continue;

      const rawWeb = (lead.website || "").trim();
      const hasNoWeb =
        !rawWeb || /^(none|n\/a|no website|-|null)$/i.test(rawWeb) || rawWeb.length < 4;
      const score =
        lead.analysis?.websiteScore ??
        lead.softwareNeedScore ??
        (hasNoWeb ? 0 : 48);

      const detectionStatus: "no_website" | "bad_website" | "upgrade_ready" = hasNoWeb
        ? "no_website"
        : score < (accessConfig.badWebsiteScoreThreshold || 65)
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
          : `Outdated / Low-Converting Site (${score}/100) — Missing 4-Tap Instant Estimate Funnel`,
        originalScore: hasNoWeb ? 0 : score,
        builtSiteId: matchedSite?.siteId || null,
        builtSiteUrl: matchedSite ? `/site/${matchedSite.siteId}` : null,
        builtSiteStatus: matchedSite?.status || null,
        claimRequested: matchedSite?.claimRequested || false,
      });
    }

    const list = Array.from(byName.values());
    const order = { no_website: 0, bad_website: 1, upgrade_ready: 2 };
    list.sort((a, b) => order[a.detectionStatus] - order[b.detectionStatus]);
    return list;
  }, [candidates, externalLeads, sites, accessConfig.badWebsiteScoreThreshold]);

  const handleAutoBuildForCandidate = async (cand: CandidateRow) => {
    setBuildingId(cand.prospectId || cand.businessName);
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
        }),
      });
      if (res.site) {
        setSites((prev) => [res.site, ...prev]);
        setNotice({
          type: "success",
          text: `Auto-built high-converting 4-Tap website for ${cand.businessName}! Live at /site/${res.site.siteId}`,
        });
        setSubTab("sites");
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to generate website" });
    } finally {
      setBuildingId(null);
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
        await builderFetch(`/api/website-builder/sites/${site.siteId}`, { method: "DELETE" }).catch(() => {});
        setSites((prev) => [res.site, ...prev.filter((s) => s.siteId !== site.siteId)]);
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

  const handleOpenEmailModal = (site: GeneratedSiteRow) => {
    setEmailModalSite(site);
    setPitchToEmail(site.email || "");
    setPitchSubject(site.pitchSubject || `We built a new 4-Tap Lead Website for ${site.businessName}`);
    setPitchBody(site.pitchBody || "");
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
      const res = await builderFetch(`/api/website-builder/sites/${emailModalSite.siteId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          toEmail: pitchToEmail,
          subject: pitchSubject,
          body: pitchBody,
        }),
      });
      setNotice({
        type: "success",
        text: `Sent "Claim Your Website" pitch email to ${res.sentTo} (${res.sentVia})!`,
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
      await builderFetch(`/api/website-builder/sites/${siteId}`, { method: "DELETE" });
      setSites((prev) => prev.filter((s) => s.siteId !== siteId));
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Could not delete site" });
    }
  };

  const handleUpdateAccessMode = async (newMode: "owner_only" | "selected_users" | "all_users") => {
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
      const res = await builderFetch("/api/website-builder/access", {
        method: "PUT",
        body: JSON.stringify({
          ...accessConfig,
          mode: newMode,
          allowedUserEmails: emails,
        }),
      });
      if (res.config) {
        setAccessConfig(res.config);
        setNotice({
          type: "success",
          text:
            newMode === "owner_only"
              ? "Locked strictly to jwandersonar@gmail.com! Completely disabled and hidden for all SaaS users."
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
                  ? "OWNER EXCLUSIVE: jwandersonar@gmail.com ONLY (Disabled for Users)"
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
              <strong>4-Tap No-Form Estimate Funnel</strong>, and sends them the live preview + “What Changed” breakdown to claim in 1 click.
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
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#7C4A15] text-white hover:bg-[#633A0F] transition-colors whitespace-nowrap"
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
                <span>Built-In Owner Admin CMS Panel</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every website has its own <strong>Admin CMS Drawer</strong> (with a 4-digit Client PIN) where you or the business owner can upload a logo, change colors, edit services, and view leads.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading auto-built websites…</div>
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
              {sites.map((site) => {
                const livePath = `/site/${site.siteId}`;
                const isClaimed = site.claimRequested || site.status === "claimed";
                const cfg = site.siteConfig || {};
                const palette =
                  WEBSITE_COLOR_THEMES[site.themeId || cfg.themeId || "valley_craft"] ||
                  WEBSITE_COLOR_THEMES.valley_craft;
                const activeAccent = cfg.customAccentColor || palette.accent;
                const adminPin = cfg.adminPin || "2026";
                const isLiveHosted = cfg.hostingMode === "live_hosted";
                return (
                  <div
                    key={site.siteId}
                    className={`bg-slate-900 border rounded-2xl p-6 transition-all ${
                      isClaimed ? "border-emerald-500/50" : "border-slate-800"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-white">
                            {cfg.brandName || site.businessName}
                          </h3>
                          <span className="text-xs text-slate-400">
                            {site.category} · {site.city}, {site.country}
                          </span>
                          <span className="text-slate-600">·</span>
                          {/* Brand Color Swatch Pill */}
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200">
                            <span
                              className="w-3 h-3 rounded-full border border-white/30 inline-block"
                              style={{ backgroundColor: activeAccent }}
                            />
                            <span>{palette.name}</span>
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs font-mono text-slate-400">
                            Admin PIN: <strong className="text-amber-300">{adminPin}</strong>
                          </span>
                          {isLiveHosted && (
                            <span className="text-xs font-bold text-emerald-400">
                              · ● LIVE HOSTED MODE
                            </span>
                          )}
                          {isClaimed && (
                            <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                              ✓ WEBSITE CLAIMED BY OWNER
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400 font-mono">
                          <span>Phone: {site.phone || "N/A"}</span>
                          <span>Email: {site.email || "Not set"}</span>
                          <span>Views: {site.totalViews || 0}</span>
                          <span className="text-amber-300 font-semibold">
                            4-Tap Funnel Leads Captured: {site.funnelSubmissionsCount || 0}
                          </span>
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
                                  ${site.claimData.monthlyTotal}/mo
                                  {site.claimData.oneTimeTotal ? ` + $${site.claimData.oneTimeTotal} setup` : ""}
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
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
                        >
                          <span>Preview Live 4-Tap Site</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

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
              })}
            </div>
          )}
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
              {mergedCandidates.map((cand) => {
                const isBuilding = buildingId === (cand.prospectId || cand.businessName);
                return (
                  <div
                    key={cand.prospectId || cand.businessName}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
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
                      <div className="text-xs text-slate-500 font-mono">
                        Phone: {cand.phone || "N/A"} · Email: {cand.email || "N/A"} · Current URL:{" "}
                        {cand.originalWebsite || "None"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cand.builtSiteId ? (
                        <>
                          <a
                            href={`/site/${cand.builtSiteId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 whitespace-nowrap inline-flex items-center gap-1.5"
                          >
                            <span>View Built Website</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleAutoBuildForCandidate(cand)}
                            disabled={isBuilding}
                            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap"
                          >
                            {isBuilding ? "Rebuilding…" : "Rebuild"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAutoBuildForCandidate(cand)}
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
              })}
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
              Auto-Build High-Converting 4-Tap Website for Any Business
            </h3>
            <p className="text-xs text-slate-400">
              Enter a business’s basic information below. The AI will build their full Valley-style 4-Tap Instant Estimate Website, “A Schedule You Can See” timeline, local suburb SEO coverage, and “What Changed” claim presentation.
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleUpdateAccessMode("owner_only")}
              className={`p-5 rounded-xl border text-left space-y-2 transition-all ${
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
              onClick={() => handleUpdateAccessMode("selected_users")}
              className={`p-5 rounded-xl border text-left space-y-2 transition-all ${
                accessConfig.mode === "selected_users"
                  ? "bg-amber-500/10 border-amber-400 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">2. Owner + Selected Users</span>
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
              className={`p-5 rounded-xl border text-left space-y-2 transition-all ${
                accessConfig.mode === "all_users"
                  ? "bg-amber-500/10 border-amber-400 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">3. Enable for All SaaS Users</span>
                {accessConfig.mode === "all_users" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-xs leading-relaxed">
                Unlocks the AI Website Builder across all active subscriber workspaces.
              </p>
            </button>
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
