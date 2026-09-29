import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Search, Plus, Globe, Mail, Phone, Trash2, Star, ChevronRight,
  BarChart3, Send, MessageCircle, Linkedin, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, TrendingUp, Users, Target, Sparkles, Download,
  X, Copy, Check, Building, Zap, LayoutDashboard, Radar, ExternalLink,
  Settings, Eye, EyeOff, Wifi, WifiOff, PlayCircle, StopCircle,
  ChevronDown, ChevronUp, Bot, MapPin, Filter, Inbox, BotMessageSquare,
  Database, ArrowLeft,
} from "lucide-react";
import API_BASE from "@/lib/api";
import { getCachedSaasUser, getSaasToken, clearSaasSession, isUserAdmin, saasFetch } from "@/lib/saas-auth";
import OwnerWebsiteBuilderPanel from "@/components/OwnerWebsiteBuilderPanel";
import MultiSmtpManagerPanel, { SmtpAppPasswordGuide } from "@/components/MultiSmtpManagerPanel";
import ProjectWorkspaceBar, { ExportLeadsBar } from "@/components/ProjectWorkspaceBar";
import {
  LeadScrapingProgressSkeleton,
  BatchOperationProgressBanner,
  WebsiteAuditReportSkeleton,
  ProposalGenerationSkeleton,
  OutreachCopySkeleton,
} from "@/components/ScrapingAndReportSkeletons";
import {
  LeadProject,
  DEFAULT_PROJECT_ID,
  loadProjects,
  saveProjects,
  syncProjectsFromServer,
  getActiveProjectId,
  setActiveProjectId,
  loadProjectHuntedResults,
  saveProjectHuntedResults,
  loadUserProspects,
  saveUserProspects,
} from "@/lib/projects";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "waiting" | "proposal_sent" | "meeting" | "negotiating" | "won" | "lost" | "archive";
type Priority = "low" | "medium" | "high";

interface ApolloModuleConfig {
  enabled: boolean;
  techStack: boolean;
  decisionMaker: boolean;
  intentScoring: boolean;
  warmSignals: boolean;
  smartSnippets: boolean;
  voiceNotePitch: boolean;
  machinePhoneCaller: boolean;
  accessMode: string;
}

const DEFAULT_APOLLO_CONFIG: ApolloModuleConfig = {
  enabled: true,
  techStack: true,
  decisionMaker: true,
  intentScoring: true,
  warmSignals: true,
  smartSnippets: true,
  voiceNotePitch: true,
  machinePhoneCaller: true,
  accessMode: "all_plans",
};

function useApolloConfig(): ApolloModuleConfig {
  const [cfg, setCfg] = useState<ApolloModuleConfig>(DEFAULT_APOLLO_CONFIG);
  useEffect(() => {
    saasFetch<{
      enabled?: boolean;
      accessMode?: string;
      modules?: {
        decisionMaker?: boolean;
        techStackSignals?: boolean;
        buyerIntentScore?: boolean;
        smartFilters?: boolean;
        multiChannelCockpit?: boolean;
        voiceNotePitch?: boolean;
        machinePhoneCaller?: boolean;
      };
      apollo?: Partial<ApolloModuleConfig>;
    }>("/api/saas/apollo-config")
      .then((d) => {
        if (!d) return;
        if (d.modules) {
          setCfg({
            enabled: Boolean(d.enabled),
            decisionMaker: Boolean(d.modules.decisionMaker),
            techStack: Boolean(d.modules.techStackSignals),
            intentScoring: Boolean(d.modules.buyerIntentScore),
            warmSignals: Boolean(d.modules.smartFilters),
            smartSnippets: Boolean(d.modules.multiChannelCockpit),
            voiceNotePitch: Boolean(d.modules.voiceNotePitch ?? true),
            machinePhoneCaller: Boolean(d.modules.machinePhoneCaller ?? true),
            accessMode: d.accessMode || "all_plans",
          });
        } else if (d.apollo) {
          setCfg({ ...DEFAULT_APOLLO_CONFIG, ...d.apollo });
        }
      })
      .catch(() => {});
  }, []);
  return cfg;
}

interface TrainedOfferSummary {
  primaryOfferName: string;
  hasWebsiteOffer: boolean;
  hasReviewOffer: boolean;
  websiteOfferName: string;
  reviewOfferName: string;
  servicesOffered: Array<{ id?: string; name: string; description: string; targetSignals?: string }>;
  offerDetails: string;
}

function useTrainedOfferSummary(): TrainedOfferSummary {
  const [summary, setSummary] = useState<TrainedOfferSummary>({
    primaryOfferName: "Website Creation & Review Service",
    hasWebsiteOffer: true,
    hasReviewOffer: true,
    websiteOfferName: "Website Creation & Mobile Redesign",
    reviewOfferName: "5-Star Review Service & Reputation Shield",
    servicesOffered: [],
    offerDetails: "Custom conversion websites and 5-star Google review generation systems",
  });

  useEffect(() => {
    saasFetch<{
      profile?: {
        offerDetails?: string;
        servicesOffered?: Array<{ id?: string; name: string; description: string; targetSignals?: string }>;
      };
    }>("/api/saas/ai-training")
      .then((res) => {
        const p = res?.profile;
        if (!p) return;
        const list = Array.isArray(p.servicesOffered) ? p.servicesOffered.filter((s) => s?.name?.trim()) : [];
        const combinedText = `${p.offerDetails || ""} ${list.map((s) => `${s.name} ${s.description}`).join(" ")}`;
        const websiteSrv = list.find((s) => /website|web design|site|redesign|landing page/i.test(`${s.name} ${s.description}`));
        const reviewSrv = list.find((s) => /review|reputation|5-star|star|google maps/i.test(`${s.name} ${s.description}`));
        const hasWeb = list.length === 0 || Boolean(websiteSrv) || /website|web design|site|redesign|landing page/i.test(combinedText);
        const hasRev = list.length === 0 || Boolean(reviewSrv) || /review|reputation|5-star|star|google maps/i.test(combinedText);
        let primaryOfferName = "Website Creation & Review Service";
        if (hasWeb && hasRev) {
          primaryOfferName = "Website Creation & Review Service";
        } else if (list.length > 0) {
          primaryOfferName = list[0].name;
        } else if (hasWeb) {
          primaryOfferName = websiteSrv?.name || "Website Creation Service";
        } else if (hasRev) {
          primaryOfferName = reviewSrv?.name || "5-Star Review Service";
        }
        setSummary({
          primaryOfferName,
          hasWebsiteOffer: hasWeb,
          hasReviewOffer: hasRev,
          websiteOfferName: websiteSrv?.name || "Website Creation & Mobile Redesign",
          reviewOfferName: reviewSrv?.name || "5-Star Review Service & Reputation Shield",
          servicesOffered: list,
          offerDetails: p.offerDetails || "Custom conversion websites and 5-star Google review generation systems",
        });
      })
      .catch(() => {});
  }, []);

  return summary;
}

function resolveAuditMatchedOffer(
  lead: {
    website?: string;
    cmsPlatform?: string;
    techStack?: string[];
    missingSignals?: string[];
    painPoint?: string;
    notes?: string;
    softwareNeedScore?: number;
    primaryOffer?: string;
    analysis?: WebsiteAnalysis;
    generatedSiteUrl?: string;
    generatedReviewUrl?: string;
  },
  trainedOffer: TrainedOfferSummary
): {
  primaryOffer: string | null;
  needsWebsite: boolean;
  needsReview: boolean;
  showGenerateWebsite: boolean;
  showGenerateReview: boolean;
} {
  const rawWeb = (lead.website || "").trim();
  const hasWebsite = Boolean(
    rawWeb &&
      !/^(none|n\/a|no website|-)$/i.test(rawWeb) &&
      lead.cmsPlatform !== "No Website"
  );
  const techText = (lead.techStack || []).join(" ").toLowerCase();
  const missingText = (lead.missingSignals || []).join(" ").toLowerCase();
  const painText = (lead.painPoint || "").toLowerCase();
  const cmsText = (lead.cmsPlatform || "").toLowerCase();
  const alreadyHasReviews =
    /customer reviews/i.test(techText) && !/no review|no 5-star review/i.test(missingText);

  let needsWebsite = false;
  let needsReview = false;
  let primaryOffer: string | null = null;

  if (lead.analysis) {
    const a = lead.analysis;
    const matchedText = (a.matchedOffer || "").toLowerCase();
    const issuesText = (a.issues || []).map((i) => `${i.title} ${i.description}`).join(" ").toLowerCase();
    const oppsText = (a.opportunities || []).map((o) => `${o.title} ${o.impact}`).join(" ").toLowerCase();

    needsWebsite =
      !hasWebsite ||
      a.websiteScore < 72 ||
      a.mobileScore < 68 ||
      a.conversionScore < 66 ||
      a.checks?.responsiveDesign === false ||
      a.checks?.modernUI === false ||
      a.checks?.contactForm === false ||
      /website|web design|redesign|landing page|site creation|no dedicated.*website/i.test(matchedText) ||
      (a.issues || []).some(
        (i) => i.priority === "high" && /website|redesign|mobile|landing page|no dedicated|lead capture|conversion/i.test(`${i.title} ${i.description}`)
      );

    needsReview =
      !alreadyHasReviews &&
      (/review|reputation|5-star|trust|rating/i.test(matchedText) ||
        a.checks?.trustElements === false ||
        /review|reputation|5-star|rating|testimonial/i.test(issuesText) ||
        /review|reputation|5-star/i.test(oppsText));

    if (trainedOffer.hasWebsiteOffer && trainedOffer.hasReviewOffer && needsWebsite && needsReview) {
      primaryOffer = "Website Creation & Review Service";
    } else if (trainedOffer.hasWebsiteOffer && needsWebsite && !needsReview) {
      primaryOffer = trainedOffer.websiteOfferName;
    } else if (trainedOffer.hasReviewOffer && needsReview && !needsWebsite) {
      primaryOffer = trainedOffer.reviewOfferName;
    } else {
      primaryOffer = a.matchedOffer || lead.primaryOffer || trainedOffer.primaryOfferName || null;
    }
  } else {
    const hasModernBookingAndForm =
      hasWebsite &&
      /online booking/i.test(techText) &&
      /contact form/i.test(techText) &&
      !/wix|godaddy|weebly|squarespace|wordpress|unreachable|parked/i.test(cmsText);

    needsWebsite =
      !hasWebsite ||
      !hasModernBookingAndForm ||
      /no website|unreachable|parked|diy|wix|godaddy|weebly|squarespace|wordpress|no lead capture|no contact form|no online booking|no booking|no https|outdated|slow|poor mobile|redesign/i.test(
        `${missingText} ${cmsText} ${painText}`
      ) ||
      (typeof lead.softwareNeedScore === "number" && lead.softwareNeedScore >= 6);

    needsReview =
      !alreadyHasReviews &&
      (!hasWebsite ||
        /no review|review funnel|review shield|reputation|5-star|low.*review|few.*review|no testimonial|unreachable/i.test(
          `${missingText} ${painText}`
        ));

    if (trainedOffer.hasWebsiteOffer && trainedOffer.hasReviewOffer && needsWebsite && needsReview) {
      primaryOffer = "Website Creation & Review Service";
    } else if (trainedOffer.hasWebsiteOffer && needsWebsite) {
      primaryOffer = trainedOffer.websiteOfferName;
    } else if (trainedOffer.hasReviewOffer && needsReview) {
      primaryOffer = trainedOffer.reviewOfferName;
    } else {
      const otherService = trainedOffer.servicesOffered.find(
        (s) =>
          !/website|web design|redesign|review|reputation|5-star/i.test(`${s.name} ${s.description}`) &&
          ((/chat|receptionist/i.test(`${missingText} ${painText}`) && /ai|receptionist|chat/i.test(`${s.name} ${s.description}`)) ||
            (/booking/i.test(`${missingText} ${painText}`) && /booking|appointment/i.test(`${s.name} ${s.description}`)) ||
            (/pixel|ad|seo/i.test(`${missingText} ${painText}`) && /seo|ad|marketing|google/i.test(`${s.name} ${s.description}`)))
      );
      primaryOffer = otherService?.name || lead.primaryOffer || trainedOffer.primaryOfferName || null;
    }
  }

  return {
    primaryOffer,
    needsWebsite,
    needsReview,
    showGenerateWebsite: Boolean(lead.generatedSiteUrl) || (trainedOffer.hasWebsiteOffer && needsWebsite),
    showGenerateReview: Boolean(lead.generatedReviewUrl) || (trainedOffer.hasReviewOffer && needsReview),
  };
}

async function generateInlineLeadAssets(lead: {
  businessName: string;
  ownerName?: string;
  category?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  painPoint?: string;
}): Promise<{ siteId: string; websiteUrl: string; reviewUrl: string }> {
  const origin = window.location.origin;
  const res = await saasFetch<{ site?: { siteId?: string; id?: string | number } }>("/api/website-builder/generate", {
    method: "POST",
    body: JSON.stringify({
      businessName: lead.businessName,
      ownerName: lead.ownerName || "",
      category: lead.category || "Local Business",
      city: lead.city || "Local Area",
      country: lead.country || "USA",
      phone: lead.phone || "(916) 291-1047",
      email: lead.email || "",
      originalWebsite: lead.website || "",
      existingWebsite: lead.website || "",
      painPoint: lead.painPoint || "",
      themeColor: "#1d4ed8",
      designStyle: "editorial",
      enableChatbot: true,
      enableReviewShield: true,
      googleReviewUrl: "",
      whatsappNumber: (lead.phone || "").replace(/\D/g, ""),
    }),
  });
  const siteId = String(res?.site?.siteId || res?.site?.id || "").trim();
  if (!siteId) throw new Error("Failed to generate website preview");
  try {
    const cachePayload = JSON.stringify({ site: res.site });
    sessionStorage.setItem(`vh_site_cache_${siteId}`, cachePayload);
    localStorage.setItem(`vh_site_cache_${siteId}`, cachePayload);
  } catch {}
  return {
    siteId,
    websiteUrl: `${origin}/site/${siteId}`,
    reviewUrl: `${origin}/review/${siteId}`,
  };
}

interface Prospect {
  id: number;
  projectId?: string;
  businessName: string;
  ownerName: string;
  ownerRole?: string;
  category: string;
  website: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  cmsPlatform?: string;
  techStack?: string[];
  missingSignals?: string[];
  buyerIntentScore?: number;
  intentTier?: "hot" | "warm" | "cold";
  intentReasons?: string[];
  status: LeadStatus;
  priority: Priority;
  expectedValue: number;
  probability: number;
  nextFollowUp: string;
  notes: string;
  addedAt: string;
  hunted?: boolean;
  painPoint?: string;
  emailSentAt?: string;
  analysis?: WebsiteAnalysis;
  generatedEmail?: { subject: string; body: string; emailVersions?: { version: string; subject: string; body: string }[]; selectedVersion?: string };
  generatedWhatsApp?: string;
  generatedLinkedIn?: string;
  proposal?: ProposalData;
  aiAgentType?: "receptionist" | "booking" | "sales" | "support" | "social";
  aiAgentScore?: number;
  aiAgentFitReason?: string;
  aiAgentTopPain?: string;
  pitchType?: "ai_agent" | "website" | "both";
  reportId?: string;
  reportUrl?: string;
  voicePitchScript?: string;
  voicePitchWavDataUrl?: string;
  voicePitchWavBase64?: string;
  voicePitchVoiceName?: string;
  lastMachineCallId?: string;
  lastMachineCallProvider?: string;
  lastMachineCallStatus?: string;
  lastMachineCallTranscript?: string;
  lastMachineCallRecordingUrl?: string;
  primaryOffer?: string;
  generatedSiteId?: string;
  generatedSiteUrl?: string;
  generatedReviewUrl?: string;
}

interface HuntedBusiness {
  businessName: string;
  ownerName: string;
  ownerRole?: string;
  category: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  country: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  cmsPlatform?: string;
  techStack?: string[];
  missingSignals?: string[];
  emailType?: string;
  executiveEmails?: string[];
  buyerIntentScore?: number;
  intentTier?: "hot" | "warm" | "cold";
  intentReasons?: string[];
  softwareNeedScore: number;
  painPoint: string;
  estimatedValue: number;
  notes: string;
  selected?: boolean;
  importing?: boolean;
  imported?: boolean;
  enriching?: boolean;
  analyzing?: boolean;
  analysis?: WebsiteAnalysis;
  reportId?: string;
  reportUrl?: string;
  aiAgentType?: string;
  aiAgentScore?: number;
  aiAgentFitReason?: string;
  aiAgentTopPain?: string;
  pitchType?: string;
  primaryOffer?: string;
  generatedSiteId?: string;
  generatedSiteUrl?: string;
  generatedReviewUrl?: string;
  generatingSite?: boolean;
  generatingReview?: boolean;
  generatingInlineEmail?: boolean;
  sendingInlineEmail?: boolean;
  inlineEmailSent?: boolean;
  inlineOpen?: boolean;
  generatedEmail?: { subject: string; body: string; emailVersions?: { version: string; subject: string; body: string }[]; selectedVersion?: string };
}

interface WebsiteAnalysis {
  websiteScore: number;
  leadScore: number;
  conversionScore: number;
  mobileScore: number;
  seoScore: number;
  growthPotential: number;
  checks: Record<string, boolean>;
  issues: { title: string; description: string; priority: string }[];
  opportunities: { title: string; impact: string; effort: string }[];
  recommendedFeatures: string[];
  projectType: string;
  matchedOffer?: string;
  estimatedValue: { min: number; max: number };
  deliveryWeeks: { min: number; max: number };
  summary: string;
}

interface ProposalData {
  sections: {
    executiveSummary: string;
    situation: string;
    problems: string[];
    solution: string;
    features: { name: string; desc: string }[];
    benefits: string[];
    timeline: { week: string; task: string }[];
    investment: string;
    whyUs: string[];
    nextSteps: string[];
  };
}

interface EmailAccount {
  id: number;
  label: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
  active: boolean;
  sentCount: number;
  dailyLimit: number;
  sentToday: number;
  consecutiveFailures: number;
  lastError: string;
  lastErrorAt: string | null;
  autoPaused: boolean;
  hasPassword: boolean;
  createdAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ds_crm_prospects";
const AGENCY_NAME = "DevStudio";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  new:           { label: "New",            color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  contacted:     { label: "Contacted",      color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  waiting:       { label: "Waiting",        color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  proposal_sent: { label: "Proposal Sent",  color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  meeting:       { label: "Meeting Set",    color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  negotiating:   { label: "Negotiating",    color: "text-pink-700",   bg: "bg-pink-50",   border: "border-pink-200" },
  won:           { label: "Won ✓",          color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  lost:          { label: "Lost",           color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  archive:       { label: "Archive",        color: "text-gray-600",   bg: "bg-gray-50",   border: "border-gray-200" },
};

const CATEGORIES = [
  // Real Estate & Property
  "Real Estate Agency", "Property Management", "Real Estate Developer",
  "Mortgage Broker", "Interior Designer", "Architecture Firm",
  // Food & Beverage
  "Restaurant", "Bakery", "Café / Coffee Shop", "Bar & Lounge",
  "Catering", "Food Truck", "Juice Bar", "Ice Cream Shop",
  // Health & Medical
  "Hospital", "Clinic", "Dentist", "Pharmacy", "Optician",
  "Physiotherapy", "Chiropractic", "Mental Health Practice", "Vet Clinic",
  // Beauty & Wellness
  "Salon", "Barbershop", "Spa & Wellness", "Nail Studio", "Tattoo Studio",
  // Fitness
  "Gym", "Yoga Studio", "Pilates Studio", "Martial Arts School",
  // Automotive
  "Car Dealer", "Auto Repair", "Car Wash", "Car Rental",
  // Professional Services
  "Lawyer", "Accountant", "Insurance", "Consultant", "Financial Advisor",
  "Recruiting Agency", "Marketing Agency", "Advertising Agency",
  // Education
  "School", "Tutoring Center", "Driving School", "Language School",
  "Music School", "Dance Studio",
  // Retail & Shopping
  "Supermarket", "Clothing Store", "Electronics Store", "Furniture Store",
  "Jewellery Store", "Pet Shop", "Book Store", "Gift Shop",
  // Hospitality & Travel
  "Hotel", "Guesthouse / B&B", "Hostel", "Travel Agency", "Tour Operator",
  // Events & Creative
  "Event Planner", "Photography Studio", "Videography Studio",
  "Wedding Planner", "Florist",
  // Home & Trade Services
  "Construction", "Electrician", "Plumber", "Landscaping",
  "Cleaning Service", "Security Company", "Pest Control",
  // Home Services — Tier 2/3 (roofing, HVAC, remodeling, restoration…)
  "Roofing Company", "Roofing & Solar Company", "Solar Company",
  "HVAC Company", "Plumbing Company", "Electrical Contractor",
  "Remodeling / Home Renovation Company", "Water Damage & Restoration Company",
  "Tree Service Company",
  // Dental & Medical Specialties
  "Dental Clinic", "Cosmetic Dentist", "Orthodontist", "Med Spa",
  // Legal & Professional — Tier 2/3
  "Law Firm - Personal Injury", "Law Firm - Family", "Law Firm - Immigration",
  "Accounting Firm", "Insurance Agency", "Real Estate Team",
  // Logistics & Transport
  "Logistics Company", "Courier Service", "Moving Company",
  // Technology
  "IT Services", "Printing & Design Studio", "Web Agency",
  // Religion & Community
  "Church", "Mosque", "Community Center", "NGO / Non-Profit",
  // Agriculture & Farming
  "Hobby Farm", "Livestock Feed & Agricultural Suppliers", "Farm Supply Store",
  "Organic Farm", "Ranch & Livestock Farm",
  // Automotive — Independent
  "Auto Repair Shop & Independent Mechanic", "Auto Body Shop", "Tire Shop",
  "Oil Change & Lube Shop", "Mobile Mechanic",
  "Other",
];

const CHECK_LABELS: Record<string, string> = {
  responsiveDesign: "Responsive Design", sslCertificate: "SSL Certificate",
  modernUI: "Modern UI", whatsappButton: "WhatsApp Button",
  contactForm: "Contact Form", bookingSystem: "Booking System",
  onlineOrdering: "Online Ordering", paymentIntegration: "Payment Integration",
  customerPortal: "Customer Portal", membershipArea: "Membership Area",
  blog: "Blog / Content", seoBasics: "SEO Basics", analytics: "Analytics",
  socialMedia: "Social Media Links", emailCapture: "Email Capture",
  liveChat: "Live Chat", aiChatbot: "AI Chatbot",
  callToAction: "Call-to-Action", trustElements: "Trust Elements",
};

const PROVIDER_CONFIGS: Record<string, { label: string; icon: string; colorClass: string; host: string; port: number; hint: string }> = {
  gmail:       { label: "Gmail",              icon: "G",  colorClass: "text-red-600 bg-red-50 border-red-200",       host: "smtp.gmail.com",        port: 587,  hint: "Use your 16-char Gmail App Password (auto-connects via IPv4 587/465 or Port 993 on Render)" },
  gmail_https: { label: "Gmail Bridge (443)", icon: "⚡", colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200", host: "script.google.com", port: 443,  hint: "Paste your Google Apps Script Web App URL (https://script.google.com/...) as Password to send over HTTPS Port 443" },
  brevo:       { label: "Brevo (Port 2525)",  icon: "B",  colorClass: "text-teal-600 bg-teal-50 border-teal-200",     host: "smtp-relay.brevo.com",  port: 2525, hint: "Use Brevo SMTP key (xsmtpsib-...) on Port 2525 or API key (xkeysib-...) over HTTPS" },
  outlook:     { label: "Outlook / 365",      icon: "O",  colorClass: "text-blue-600 bg-blue-50 border-blue-200",     host: "smtp.office365.com",    port: 587,  hint: "Use your Microsoft App Password" },
  smtp:        { label: "Custom SMTP",        icon: "⚙",  colorClass: "text-gray-600 bg-gray-50 border-gray-200",     host: "",                      port: 587,  hint: "Any SMTP-compatible provider" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_PROSPECTS: Prospect[] = [];

function getToken(): string {
  return getSaasToken();
}

function loadProspects(): Prospect[] {
  return loadUserProspects<Prospect>();
}

function saveProspects(data: Prospect[]) {
  saveUserProspects(data);
  const tok = getToken();
  if (!tok) return;
  fetch(`${apiBase()}/api/crm/prospects/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ prospects: data }),
  }).catch(() => {});
}

function apiBase() {
  return API_BASE.replace("/agency-site", "");
}

function handleAuthFailure() {
  // Do not overwrite user token with admin token
}

async function authFetch(path: string, init: RequestInit = {}) {
  const tok = getToken();
  const r = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${tok}` },
  });
  return r;
}

async function callCRM(endpoint: string, body: object) {
  const tok = getToken();
  const r = await fetch(`${apiBase()}/api/crm/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as any).error || `API error ${r.status}`);
  }
  return r.json();
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number; color?: string }) {
  const textColor = value >= 70 ? "text-green-600" : value >= 40 ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-bold ${textColor}`}>{value}/100</span>
      </div>
      <progress value={value} max={100} className="w-full h-2 rounded-full overflow-hidden accent-purple-600" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── Email Settings Panel (multi-account + rotation) ──────────────────────────

function AccountDialog({ account, onSave, onClose }: {
  account?: EmailAccount;
  onSave: (a: EmailAccount) => void;
  onClose: () => void;
}) {
  const initialHost = account?.host ?? "smtp.gmail.com";
  const initialPort =
    account?.port === 443 && initialHost.toLowerCase().includes("gmail.com")
      ? account?.secure
        ? 465
        : 587
      : account?.port ?? 587;
  const [savedAccount, setSavedAccount] = useState<EmailAccount | undefined>(account);
  const [form, setForm] = useState({
    label: account?.label ?? "",
    provider: account?.provider ?? "gmail",
    host: initialHost,
    port: initialPort,
    secure: account?.secure ?? false,
    user: account?.user ?? "",
    password: "",
    fromName: account?.fromName ?? "DevStudio",
    fromEmail: account?.fromEmail ?? "",
    dailyLimit: account?.dailyLimit ?? 0,
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState(
    account?.fromEmail && account.fromEmail.toLowerCase() !== (account.user || "").toLowerCase()
      ? account.fromEmail
      : ""
  );
  const [copiedScript, setCopiedScript] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const applyPreset = (provider: string) => {
    const cfg = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.smtp;
    setForm(f => ({ ...f, provider, host: cfg.host, port: cfg.port, secure: cfg.port === 465 }));
  };

  const adminAuthHeader = (): Record<string, string> => {
    return { Authorization: `Bearer ${getToken()}` };
  };

  const normalizedFormPayload = () => {
    const isGmailHost = form.host.toLowerCase().includes("gmail.com");
    const effectivePort = form.port === 443 && isGmailHost ? (form.secure ? 465 : 587) : form.port;
    return {
      ...form,
      port: effectivePort,
      password: form.password ? form.password.replace(/\s+/g, "") : "",
    };
  };

  const save = async () => {
    if (!form.host || !form.user || (!form.password && !savedAccount)) {
      setStatus({ type: "error", msg: "Host, email, and password are required." });
      return;
    }
    setSaving(true); setStatus(null);
    try {
      const payload = normalizedFormPayload();
      const url = savedAccount ? `${apiBase()}/api/crm/email-accounts/${savedAccount.id}` : `${apiBase()}/api/crm/email-accounts`;
      const r = await fetch(url, {
        method: savedAccount ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeader() },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || "Save failed");
      onSave(d.account);
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    } finally { setSaving(false); }
  };

  const test = async () => {
    if (!form.host || !form.user || (!form.password && !savedAccount)) {
      setStatus({ type: "error", msg: "Enter host, email, and password first." });
      return;
    }
    setTesting(true); setStatus(null);
    try {
      const payload = normalizedFormPayload();
      let targetId = savedAccount?.id;
      if (!targetId) {
        const createRes = await fetch(`${apiBase()}/api/crm/email-accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...adminAuthHeader() },
          body: JSON.stringify(payload),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error((createData as any).error || "Could not save account before testing");
        setSavedAccount(createData.account);
        targetId = createData.account?.id;
      }

      const targetRecipient =
        testTo.trim() ||
        (form.fromEmail.trim() && form.fromEmail.trim().toLowerCase() !== form.user.trim().toLowerCase()
          ? form.fromEmail.trim()
          : form.user.trim());

      const r = await fetch(`${apiBase()}/api/crm/email-accounts/${targetId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeader() },
        body: JSON.stringify({
          to: targetRecipient,
          ...payload,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || `Request failed (${r.status})`);
      if (d.account) {
        setSavedAccount(d.account);
      }
      setStatus({ type: "success", msg: `✓ Connected & verified! Test email delivered to ${d.to || targetRecipient}.` });
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    } finally { setTesting(false); }
  };

  const cfg = PROVIDER_CONFIGS[form.provider] || PROVIDER_CONFIGS.smtp;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Edit Email Account" : "Add Email Account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {status && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border ${status.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {status.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {status.msg}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Email Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PROVIDER_CONFIGS).map(([id, p]) => (
                <button key={id} onClick={() => applyPreset(id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.provider === id ? "border-primary bg-primary/5 text-primary" : "border-border/50 hover:border-primary/40"}`}>
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border ${p.colorClass}`}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            {cfg.hint && <p className="text-xs text-muted-foreground mt-1.5 bg-muted/30 px-3 py-2 rounded-lg">{cfg.hint}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Label</label>
            <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Main Gmail, Sales Brevo" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">SMTP Host</label>
              <Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Port</label>
              <Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.secure}
              onCheckedChange={v =>
                setForm(f => ({
                  ...f,
                  secure: v,
                  port: f.host.toLowerCase().includes("gmail.com") ? (v ? 465 : 587) : f.port,
                }))
              }
            />
            <label className="text-sm font-medium">Use SSL/TLS (port 465)</label>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email / Login</label>
            <Input type="email" value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="you@gmail.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Password {account?.hasPassword && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <Input type={showPass ? "text" : "password"} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={account?.hasPassword ? "••••••••  (unchanged)" : form.provider === "gmail" ? "16-char App Password" : "your password"}
                className="pr-10" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.provider === "gmail" && (
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 block">
                Generate Gmail App Password →
              </a>
            )}
            {(form.provider === "gmail" || form.provider === "gmail_https") && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                <div className="font-semibold">Sending to external emails on Render Free Tier?</div>
                <p className="text-[11px] text-emerald-800">
                  Render Free Tier blocks ports 587 &amp; 465. To send to any external address for free over HTTPS Port 443: copy the 10-line script below, paste it into a new project at <strong>script.google.com</strong> (Deploy → Web App → Who has access: Anyone), and paste the Web App URL into the Password field above.
                </p>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const code = `function doPost(e){try{var d=JSON.parse(e.postData.contents||"{}");if(d.action==="ping")return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);GmailApp.sendEmail(d.to,d.subject||"",d.text||"",{htmlBody:d.html||d.text||"",name:d.fromName||"Outreach Team",replyTo:d.replyTo||d.fromEmail||""});return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);}catch(err){return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);}}`;
                      navigator.clipboard.writeText(code);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 3000);
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px]"
                  >
                    {copiedScript ? "✓ Copied 10-Line Script!" : "Copy 10-Line Gmail Port 443 Script"}
                  </button>
                  <a
                    href="https://script.google.com/home/start"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-white border border-emerald-300 text-emerald-900 font-semibold text-[11px]"
                  >
                    Open script.google.com ↗
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Sender Name</label>
              <Input value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} placeholder="DevStudio" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">From Email (optional)</label>
              <Input type="email" value={form.fromEmail} onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))} placeholder="Same as login" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Daily Send Limit</label>
            <Input type="number" min={0} value={form.dailyLimit}
              onChange={e => setForm(f => ({ ...f, dailyLimit: Math.max(0, Number(e.target.value)) }))}
              placeholder="0 = unlimited" />
            <p className="text-xs text-muted-foreground mt-1">Rotation skips this account once it hits the limit for the day. Set 0 for unlimited.</p>
          </div>

          {account && account.autoPaused && (
            <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border bg-amber-50 text-amber-800 border-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Auto-paused after {account.consecutiveFailures} consecutive send failures{account.lastError ? `: ${account.lastError}` : ""}. Saving or sending a successful test will reactivate it.</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="Test recipient (optional)" className="flex-1" />
            <Button variant="outline" onClick={test} disabled={testing} className="gap-1.5 whitespace-nowrap">
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {testing ? "Sending…" : "Send Test"}
            </Button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={saving} className="flex-1 gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? "Saving…" : account ? "Save Changes" : "Add Account"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailSettingsPanel() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | undefined>(undefined);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [listTestTo, setListTestTo] = useState<string>("");
  const [testStatus, setTestStatus] = useState<Record<number, { type: "success" | "error"; msg: string }>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const adminAuth = (): Record<string, string> => {
    const tok = getToken() || localStorage.getItem("ds_api_token") || "";
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase()}/api/crm/email-accounts`, { headers: adminAuth() });
      const d = await r.json().catch(() => ([]));
      setAccounts(Array.isArray(d) ? d : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (acct: EmailAccount) => {
    setAccounts(prev => prev.map(a => a.id === acct.id ? { ...a, active: !acct.active } : a));
    const r = await fetch(`${apiBase()}/api/crm/email-accounts/${acct.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...adminAuth() },
      body: JSON.stringify({ active: !acct.active }),
    });
    if (!r.ok) setAccounts(prev => prev.map(a => a.id === acct.id ? { ...a, active: acct.active } : a));
  };

  const reactivateAccount = async (acct: EmailAccount) => {
    try {
      const r = await fetch(`${apiBase()}/api/crm/email-accounts/${acct.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...adminAuth() },
        body: JSON.stringify({ active: true, resetFailures: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && (d as any).account) {
        setAccounts(prev => prev.map(a => a.id === acct.id ? d.account : a));
      }
    } catch { /* ignore */ }
  };

  const deleteAccount = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${apiBase()}/api/crm/email-accounts/${id}`, { method: "DELETE", headers: adminAuth() });
      setAccounts(prev => prev.filter(a => a.id !== id));
    } finally { setDeletingId(null); }
  };

  const testAccount = async (acct: EmailAccount) => {
    setTestingId(acct.id);
    setTestStatus(prev => { const n = { ...prev }; delete n[acct.id]; return n; });
    const targetTo =
      listTestTo.trim() ||
      (acct.fromEmail && acct.fromEmail.toLowerCase() !== acct.user.toLowerCase() ? acct.fromEmail : acct.user);
    try {
      const r = await fetch(`${apiBase()}/api/crm/email-accounts/${acct.id}/test`, {
        method: "POST", headers: { "Content-Type": "application/json", ...adminAuth() },
        body: JSON.stringify({ to: targetTo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || `Request failed (${r.status})`);
      setTestStatus(prev => ({ ...prev, [acct.id]: { type: "success", msg: `Test email sent to ${d.to || targetTo}!` } }));
    } catch (e: any) {
      setTestStatus(prev => ({ ...prev, [acct.id]: { type: "error", msg: e.message } }));
    } finally { setTestingId(null); }
  };

  const onSave = (savedAccount: EmailAccount) => {
    setAccounts(prev => {
      const exists = prev.find(a => a.id === savedAccount.id);
      return exists ? prev.map(a => a.id === savedAccount.id ? savedAccount : a) : [...prev, savedAccount];
    });
    setEditingAccount(undefined);
    setShowAddDialog(false);
  };

  const activeAccounts = accounts.filter(a => a.active);
  const providerCfg = (p: string) => PROVIDER_CONFIGS[p] || PROVIDER_CONFIGS.smtp;

  if (loading) return <LoadingSpinner text="Loading email accounts…" />;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg mb-1">Email Accounts</h3>
          <p className="text-sm text-muted-foreground">Add multiple accounts — Gmail, Outlook, Brevo, or custom SMTP. The CRM rotates across all active accounts to send outreach.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      {activeAccounts.length > 0 && (() => {
        const totalCapacity = activeAccounts.reduce((s, a) => s + (a.dailyLimit > 0 ? a.dailyLimit : 0), 0);
        const hasUnlimited = activeAccounts.some(a => a.dailyLimit <= 0);
        const sentToday = activeAccounts.reduce((s, a) => s + (a.sentToday || 0), 0);
        const capacityLabel = hasUnlimited ? "Unlimited" : totalCapacity.toLocaleString() + "/day";
        return (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="p-3 bg-muted/20 border-b border-border/30 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-sm">Sending Capacity</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border/30">
              <div className="p-3 text-center">
                <div className="font-extrabold text-lg text-purple-700">{activeAccounts.length}</div>
                <div className="text-xs text-muted-foreground">Active Accounts</div>
              </div>
              <div className="p-3 text-center">
                <div className="font-extrabold text-lg text-green-700">{capacityLabel}</div>
                <div className="text-xs text-muted-foreground">Daily Limit</div>
              </div>
              <div className="p-3 text-center">
                <div className="font-extrabold text-lg">{sentToday.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Sent Today</div>
              </div>
            </div>
            {activeAccounts.length > 1 && (
              <div className="px-4 py-2 bg-green-50 border-t border-green-100 flex items-center gap-2 text-xs text-green-800">
                <RefreshCw className="w-3 h-3" />
                <span>Rotation active — cycles across {activeAccounts.length} accounts, always using the one with the least sent.</span>
              </div>
            )}
            {activeAccounts.length === 1 && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 text-xs text-blue-800">
                <CheckCircle2 className="w-3 h-3" />
                <span>Add more accounts to multiply your daily capacity (e.g. 10 Gmail accounts = 5,000–20,000 emails/day).</span>
              </div>
            )}
          </div>
        );
      })()}
      {activeAccounts.length === 0 && accounts.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>No active accounts — enable at least one to send emails.</span>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="text-center py-14 border-2 border-dashed border-border/40 rounded-xl">
          <Mail className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <h4 className="font-semibold text-base mb-1">No email accounts yet</h4>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">Add Gmail, Outlook, Brevo, or any custom SMTP to start sending outreach.</p>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add First Account
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(acct => {
          const cfg = providerCfg(acct.provider);
          const ts = testStatus[acct.id];
          const atLimit = acct.dailyLimit > 0 && acct.sentToday >= acct.dailyLimit;
          return (
            <div key={acct.id} className={`rounded-xl border-2 overflow-hidden transition-all ${acct.autoPaused ? "border-amber-300" : acct.active ? "border-border/60" : "border-border/20 opacity-60"}`}>
              <div className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl border font-bold ${cfg.colorClass} flex-shrink-0`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{acct.label || acct.user}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cfg.colorClass}`}>{cfg.label}</span>
                    {acct.autoPaused
                      ? <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Auto-paused</span>
                      : atLimit
                      ? <span className="text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full font-semibold">Daily limit reached</span>
                      : acct.active
                      ? <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-semibold">Active</span>
                      : <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-semibold">Inactive</span>}
                    {acct.sentCount > 0 && <span className="text-xs text-muted-foreground">{acct.sentCount} sent total</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{acct.user}</div>
                  <div className="text-xs text-muted-foreground">{acct.host}:{acct.port}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {acct.dailyLimit > 0 ? (
                      <span className={atLimit ? "text-orange-600 font-semibold" : ""}>{acct.sentToday}/{acct.dailyLimit} sent today</span>
                    ) : (
                      <span>{acct.sentToday} sent today · unlimited</span>
                    )}
                  </div>
                  {acct.autoPaused && acct.lastError && (
                    <div className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Paused after {acct.consecutiveFailures} failed sends: {acct.lastError}
                    </div>
                  )}
                </div>
                <Switch checked={acct.active} onCheckedChange={() => toggleActive(acct)} />
              </div>
              <div className="px-4 pb-3 flex items-center gap-2 flex-wrap border-t border-border/30 pt-3">
                <Input
                  value={listTestTo}
                  onChange={e => setListTestTo(e.target.value)}
                  placeholder={acct.fromEmail && acct.fromEmail !== acct.user ? `Recipient (${acct.fromEmail})` : "Test recipient email…"}
                  className="h-7 text-xs w-44"
                />
                <Button size="sm" variant="outline" onClick={() => testAccount(acct)} disabled={testingId === acct.id} className="h-7 text-xs gap-1">
                  {testingId === acct.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  {testingId === acct.id ? "Testing…" : "Send Test"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingAccount(acct)} className="h-7 text-xs gap-1">
                  Edit
                </Button>
                {acct.autoPaused && (
                  <Button size="sm" variant="outline" onClick={() => reactivateAccount(acct)} className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50">
                    <RefreshCw className="w-3 h-3" /> Reactivate
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteAccount(acct.id)} disabled={deletingId === acct.id}
                  className="h-7 text-xs gap-1 text-destructive/70 hover:text-destructive">
                  {deletingId === acct.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete
                </Button>
                {ts && (
                  <span className={`text-xs flex items-center gap-1 ${ts.type === "success" ? "text-green-700" : "text-red-600"}`}>
                    {ts.type === "success" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {ts.msg}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {accounts.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40 space-y-2">
          <p className="font-semibold text-foreground">Provider setup tips:</p>
          <p>• <strong>Gmail:</strong> Enable 2FA → <span className="font-mono">myaccount.google.com/apppasswords</span> → generate a 16-char App Password (use that as the password here). Host: <span className="font-mono">smtp.gmail.com</span>, port 587. Each Gmail account sends up to 500 emails/day.</p>
          <p>• <strong>Google Workspace (paid):</strong> Same steps as Gmail but limit is 2,000/day per account. 10 Workspace accounts = 20,000 emails/day.</p>
          <p>• <strong>Outlook / 365:</strong> Use your Microsoft account password, or an app password if 2FA is on. Host: <span className="font-mono">smtp.office365.com</span>, port 587.</p>
          <p>• <strong>Brevo:</strong> SMTP & API → SMTP Keys → generate key (use as password, login is your Brevo email). Free tier = 300/day, paid = 20,000+/day from a single account.</p>
          <div className="mt-2 pt-2 border-t border-border/30 text-green-800 bg-green-50 rounded p-2">
            <p className="font-semibold">💡 To hit 20,000 emails/day:</p>
            <p>Add 10 Google Workspace accounts (one per row). Each sends 2,000/day. The CRM automatically rotates across all of them. Use different Gmail addresses so each account stays independent.</p>
          </div>
        </div>
      )}

      {showAddDialog && <AccountDialog onSave={onSave} onClose={() => setShowAddDialog(false)} />}
      {editingAccount && <AccountDialog account={editingAccount} onSave={onSave} onClose={() => setEditingAccount(undefined)} />}

      {/* Interactive Step-by-Step App Password & Multi-SMTP Setup Guide + Bulk Multi-Gmail Pool Manager */}
      <div className="pt-4 border-t border-border/40 space-y-6">
        <SmtpAppPasswordGuide defaultProvider="gmail" />
        <MultiSmtpManagerPanel
          mode="user"
          title="Advanced Multi-Gmail & Multi-SMTP Pool Manager (Bulk Add & Rotation)"
          subtitle="Paste multiple Gmail App Passwords at once or add unlimited SMTP relays for automatic round-robin outreach & message delivery."
        />
      </div>
    </div>
  );
}

// ─── AI Hunter Panel ──────────────────────────────────────────────────────────

function AIHunterPanel({
  onImport,
  activeProject,
}: {
  onImport: (prospects: Omit<Prospect, "id" | "addedAt">[]) => void;
  activeProject?: LeadProject | null;
}) {
  // `categories` supports selecting one or many business types at once.
  // Kept as an array from the start (default: a single category) so every
  // existing single-category flow below keeps working unchanged.
  const initialQuickHuntRef = useRef<{
    category?: string;
    city?: string;
    country?: string;
    count?: string;
    extraContext?: string;
    autoRun?: boolean;
  } | null>(null);

  if (initialQuickHuntRef.current === null) {
    try {
      const parsed = JSON.parse(localStorage.getItem("vh_quick_hunt") || "null");
      if (parsed && typeof parsed === "object") {
        initialQuickHuntRef.current = parsed;
        localStorage.removeItem("vh_quick_hunt");
      } else {
        initialQuickHuntRef.current = {};
      }
    } catch {
      initialQuickHuntRef.current = {};
    }
  }

  const [categories, setCategories] = useState<string[]>(() => {
    if (initialQuickHuntRef.current?.category) return [initialQuickHuntRef.current.category];
    if (activeProject?.targetCategory) return [activeProject.targetCategory];
    return ["Restaurant"];
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [city, setCity] = useState(() => {
    if (initialQuickHuntRef.current?.city) return initialQuickHuntRef.current.city;
    return activeProject?.targetCity || "";
  });
  const [country, setCountry] = useState(() => {
    if (initialQuickHuntRef.current?.country) return initialQuickHuntRef.current.country;
    return activeProject?.targetCountry || "";
  });
  const [count, setCount] = useState(() => initialQuickHuntRef.current?.count || "50");
  const [extraContext, setExtraContext] = useState(
    () => initialQuickHuntRef.current?.extraContext || activeProject?.extraContext || ""
  );
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [hunting, setHunting] = useState(false);
  const [results, setResults] = useState<HuntedBusiness[]>(() =>
    activeProject?.id ? loadProjectHuntedResults<HuntedBusiness>(activeProject.id) : []
  );
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [selectAll, setSelectAll] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCities, setBulkCities] = useState("");
  const apolloCfg = useApolloConfig();
  const trainedOffer = useTrainedOfferSummary();
  const [apolloFilter, setApolloFilter] = useState<string>("all");
  const [preSearchFilters, setPreSearchFilters] = useState<string[]>(["all"]);
  const [preFilterDropdownOpen, setPreFilterDropdownOpen] = useState<boolean>(false);
  const preFilterDropdownRef = useRef<HTMLDivElement | null>(null);
  const [hunterSearchQuery, setHunterSearchQuery] = useState<string>("");
  const [autoPilotChain, setAutoPilotChain] = useState<boolean>(false);
  const [syncingToAutomation, setSyncingToAutomation] = useState<boolean>(false);
  const [automationSyncNotice, setAutomationSyncNotice] = useState<string>("");
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [huntBatchProgress, setHuntBatchProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 1,
  });
  const [enrichBatchProgress, setEnrichBatchProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [importBatchProgress, setImportBatchProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const prevProjectIdRef = useRef<string | undefined>(activeProject?.id);

  const preFilterOptions = [
    { id: "all", label: "All Businesses" },
    { id: "no_website", label: "No Website" },
    { id: "bad_website", label: "Bad / Outdated Website" },
    { id: "decision_maker", label: "Decision Maker" },
    { id: "verified_email", label: "Verified Email" },
    { id: "no_reviews", label: "Needs Review Service" },
    { id: "no_booking_chat", label: "No Booking / Live Chat" },
    { id: "hot_intent", label: "High Need (Score 7+)" },
  ];

  const togglePreSearchFilter = (id: string) => {
    if (id === "all") {
      setPreSearchFilters(["all"]);
      return;
    }
    setPreSearchFilters((prev) => {
      const withoutAll = prev.filter((x) => x !== "all");
      const exists = withoutAll.includes(id);
      const next = exists ? withoutAll.filter((x) => x !== id) : [...withoutAll, id];
      return next.length === 0 ? ["all"] : next;
    });
  };

  const matchesPreSearchFilter = (b: HuntedBusiness): boolean => {
    const active = preSearchFilters.filter((f) => f && f !== "all");
    if (active.length === 0) return true;

    const rawWeb = (b.website || "").trim();
    const hasNoWebsite =
      !rawWeb || /^(none|n\/a|no website|-)$/i.test(rawWeb) || b.cmsPlatform === "No Website";
    const cms = (b.cmsPlatform || "").toLowerCase();
    const missing = (b.missingSignals || []).join(" ").toLowerCase();
    const tech = (b.techStack || []).join(" ").toLowerCase();
    const pain = (b.painPoint || "").toLowerCase();

    const hasBadWebsite =
      !hasNoWebsite &&
      ((b.softwareNeedScore ?? 0) >= 4 ||
        (b.analysis && b.analysis.websiteScore < 72) ||
        /wix|squarespace|godaddy|weebly|wordpress|custom html|unreachable|parked/i.test(cms) ||
        (Array.isArray(b.missingSignals) && b.missingSignals.length > 0) ||
        /outdated|slow|no online booking|no contact form|unreachable|prime candidate|opportunity/i.test(pain));

    const hasDecisionMaker = Boolean(
      (b.ownerName && b.ownerName.trim()) ||
        (b.linkedin && b.linkedin.trim()) ||
        (Array.isArray(b.executiveEmails) && b.executiveEmails.length > 0) ||
        b.emailType === "direct_executive"
    );
    const hasVerifiedEmail = Boolean(b.email && b.email.includes("@"));
    const needsReview =
      hasNoWebsite || /review/i.test(missing) || !/customer reviews/i.test(tech);
    const missingBookingOrChat = hasNoWebsite || /booking|chat|receptionist/i.test(missing);
    const isHotIntent =
      (b.softwareNeedScore ?? 0) >= 6 || (b.buyerIntentScore ?? 0) >= 65;

    return active.some((f) => {
      if (f === "no_website") return hasNoWebsite;
      if (f === "bad_website") return hasBadWebsite;
      if (f === "decision_maker") return hasDecisionMaker;
      if (f === "verified_email") return hasVerifiedEmail;
      if (f === "no_reviews") return needsReview;
      if (f === "no_booking_chat") return missingBookingOrChat;
      if (f === "hot_intent") return isHotIntent;
      return true;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        preFilterDropdownRef.current &&
        !preFilterDropdownRef.current.contains(e.target as Node)
      ) {
        setPreFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildHuntedFallbackAnalysis = (b: HuntedBusiness): WebsiteAnalysis => {
    const hasWeb = Boolean(b.website && !/^(none|n\/a|no website|-)$/i.test(b.website.trim()));
    const cat = b.category || "local service";
    const cityStr = b.city || "your area";
    const preRes = resolveAuditMatchedOffer({ ...b, analysis: undefined }, trainedOffer);
    const needsWeb = preRes.needsWebsite;
    const needsRev = preRes.needsReview;
    const matchedOffer = preRes.primaryOffer || trainedOffer.primaryOfferName || "Website Creation & Review Service";
    return {
      matchedOffer,
      websiteScore: !hasWeb ? 14 : needsWeb ? 46 : 66,
      leadScore: needsWeb ? 50 : 68,
      conversionScore: !hasWeb ? 12 : needsWeb ? 38 : 64,
      mobileScore: !hasWeb ? 18 : needsWeb ? 52 : 70,
      seoScore: !hasWeb ? 15 : needsWeb ? 44 : 64,
      growthPotential: 92,
      checks: {
        responsiveDesign: hasWeb && !needsWeb,
        sslCertificate: hasWeb,
        modernUI: hasWeb && !needsWeb,
        whatsappButton: false,
        contactForm: hasWeb && !needsWeb,
        bookingSystem: false,
        onlineOrdering: false,
        paymentIntegration: false,
        customerPortal: false,
        membershipArea: false,
        blog: false,
        seoBasics: hasWeb,
        analytics: hasWeb && !needsWeb,
        socialMedia: true,
        emailCapture: false,
        liveChat: false,
        aiChatbot: false,
        callToAction: hasWeb && !needsWeb,
        trustElements: hasWeb && !needsRev,
      },
      issues: [
        ...(needsWeb
          ? [
              {
                title: hasWeb ? "High-Friction Mobile Lead Capture" : "No Dedicated Conversion Website",
                description: hasWeb
                  ? `Visitors searching for ${cat.toLowerCase()} in ${cityStr} lack a fast 4-tap quote or online booking flow.`
                  : `Prospective customers searching for ${b.businessName} in ${cityStr} have no dedicated website to book or request quotes.`,
                priority: "high",
              },
            ]
          : []),
        ...(needsRev
          ? [
              {
                title: "Missing Automated 5-Star Review Funnel",
                description: "Happy clients are not systematically guided to post 5-star Google reviews.",
                priority: needsWeb ? "medium" : "high",
              },
            ]
          : []),
      ],
      opportunities: [
        {
          title: `Deploy ${matchedOffer}`,
          impact: "+25–40% increase in mobile customer inquiries",
          effort: "low",
        },
      ],
      recommendedFeatures: [matchedOffer, "24/7 Spoken AI Receptionist & Booking"],
      projectType: "Medium Web App",
      estimatedValue: { min: 1500, max: 3500 },
      deliveryWeeks: { min: 1, max: 2 },
      summary: `${b.businessName} in ${cityStr} shows strong local demand, and our audit indicates ${matchedOffer} is the top priority to convert more visitors into booked clients.`,
    };
  };

  const analyzeSingleHunted = async (idx: number, sourceList?: HuntedBusiness[]) => {
    const list = sourceList || results;
    const target = list[idx];
    if (!target) return;
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, analyzing: true } : r));
    try {
      const data = await callCRM("analyze-website", {
        website: target.website,
        businessName: target.businessName,
        category: target.category,
        city: target.city,
        painPoint: target.painPoint,
        cmsPlatform: target.cmsPlatform,
        missingSignals: target.missingSignals,
      });
      const fb = buildHuntedFallbackAnalysis(target);
      const mergedAnalysis: WebsiteAnalysis = {
        ...fb,
        ...data,
        checks: { ...fb.checks, ...(data?.checks || {}) },
        issues: Array.isArray(data?.issues) && data.issues.length > 0 ? data.issues : fb.issues,
        opportunities: Array.isArray(data?.opportunities) && data.opportunities.length > 0 ? data.opportunities : fb.opportunities,
        recommendedFeatures: Array.isArray(data?.recommendedFeatures) && data.recommendedFeatures.length > 0 ? data.recommendedFeatures : fb.recommendedFeatures,
        estimatedValue: data?.estimatedValue?.min ? data.estimatedValue : fb.estimatedValue,
        deliveryWeeks: data?.deliveryWeeks?.min ? data.deliveryWeeks : fb.deliveryWeeks,
      };
      const resolved = resolveAuditMatchedOffer({ ...target, analysis: mergedAnalysis }, trainedOffer);
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        analyzing: false,
        analysis: mergedAnalysis,
        primaryOffer: resolved.primaryOffer || mergedAnalysis.matchedOffer || r.primaryOffer,
        reportId: data?.reportId || r.reportId,
        reportUrl: data?.reportUrl || r.reportUrl,
      } : r));
    } catch {
      const fb = buildHuntedFallbackAnalysis(target);
      const resolved = resolveAuditMatchedOffer({ ...target, analysis: fb }, trainedOffer);
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        analyzing: false,
        analysis: fb,
        primaryOffer: resolved.primaryOffer || fb.matchedOffer || r.primaryOffer,
      } : r));
    }
  };

  const analyzeAllVisibleHunted = async (customList?: HuntedBusiness[]) => {
    const activeList = customList || results;
    if (activeList.length === 0) return;
    setBulkAnalyzing(true);
    const total = activeList.length;
    const CONCURRENCY = 4;
    for (let i = 0; i < total; i += CONCURRENCY) {
      const batchIndices = Array.from({ length: Math.min(CONCURRENCY, total - i) }, (_, k) => i + k);
      const firstLabel = activeList[batchIndices[0]]?.businessName || "Lead";
      setEnrichBatchProgress({
        current: Math.min(total, i + batchIndices.length),
        total,
        label: `Auditing ${firstLabel}`,
      });
      await Promise.all(batchIndices.map(idx => analyzeSingleHunted(idx, activeList)));
    }
    setBulkAnalyzing(false);
    setEnrichBatchProgress(null);
    setProgress(`✓ Auto-Analyzer completed website & offer audits for ${total} leads`);
  };

  const enrichSingleHunted = async (idx: number) => {
    const target = results[idx];
    if (!target || !target.website) return;
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, enriching: true } : r));
    try {
      const data = await callCRM("apollo-enrich", {
        website: target.website,
        businessName: target.businessName,
        category: target.category,
        email: target.email,
        phone: target.phone,
      });
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        enriching: false,
        ownerName: data.ownerName || r.ownerName,
        ownerRole: data.ownerRole || r.ownerRole,
        linkedin: data.linkedin || r.linkedin,
        facebook: data.facebook || r.facebook,
        instagram: data.instagram || r.instagram,
        cmsPlatform: data.cmsPlatform || r.cmsPlatform,
        techStack: Array.isArray(data.techStack) ? data.techStack : r.techStack,
        missingSignals: Array.isArray(data.missingSignals) ? data.missingSignals : r.missingSignals,
        buyerIntentScore: data.buyerIntentScore ?? r.buyerIntentScore,
        intentTier: data.intentTier || r.intentTier,
        intentReasons: Array.isArray(data.intentReasons) ? data.intentReasons : r.intentReasons,
      } : r));
    } catch {
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, enriching: false } : r));
    }
  };

  const generateInlineEmailForHunted = async (
    idx: number,
    overrides?: { websiteUrl?: string; reviewUrl?: string }
  ) => {
    const b = results[idx];
    if (!b) return;
    const leadOfferRes = resolveAuditMatchedOffer(b, trainedOffer);
    const effectiveLeadOffer = leadOfferRes.primaryOffer || b.primaryOffer || trainedOffer.primaryOfferName;
    const demoWebsiteUrl = overrides?.websiteUrl ?? b.generatedSiteUrl ?? "";
    const reviewServiceUrl = overrides?.reviewUrl ?? b.generatedReviewUrl ?? "";
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, generatingInlineEmail: true, inlineOpen: true } : r));
    try {
      const data = await callCRM("generate-email", {
        businessName: b.businessName,
        ownerName: b.ownerName,
        ownerRole: b.ownerRole,
        category: b.category,
        website: b.website,
        city: b.city,
        cmsPlatform: b.cmsPlatform,
        missingSignals: b.missingSignals,
        issues: b.painPoint || "",
        opportunities: trainedOffer.offerDetails,
        agencyName: AGENCY_NAME,
        primaryOffer: effectiveLeadOffer,
        demoWebsiteUrl,
        reviewServiceUrl,
      });
      const versions = Array.isArray(data?.versions) && data.versions.length > 0 ? data.versions : [];
      const first = versions[0] || {
        version: "A",
        subject: data?.subject || `Quick idea for ${b.businessName} — ${effectiveLeadOffer}`,
        body: data?.body || `Hi ${b.ownerName || `${b.businessName} Team`},\n\nI was looking at ${b.businessName}${b.city ? ` in ${b.city}` : ""} today and noticed an opportunity around ${effectiveLeadOffer} to help you capture more local clients.${demoWebsiteUrl ? `\n\n• Live Website Preview: ${demoWebsiteUrl}` : ""}${reviewServiceUrl ? `\n• 5-Star Review Page: ${reviewServiceUrl}` : ""}\n\nWould you be open to taking a quick look?\n\nBest regards,\n${AGENCY_NAME}`,
      };
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        generatingInlineEmail: false,
        inlineOpen: true,
        generatedEmail: {
          subject: first.subject,
          body: first.body,
          emailVersions: versions.length > 0 ? versions : [first],
          selectedVersion: first.version || "A",
        },
      } : r));
    } catch {
      const fallbackBody = `Hi ${b.ownerName || `${b.businessName} Team`},\n\nI was looking at ${b.businessName}${b.city ? ` in ${b.city}` : ""} today and put together a tailored ${effectiveLeadOffer} breakdown to help turn more local searches into booked clients.${demoWebsiteUrl ? `\n\n• Live Website Preview: ${demoWebsiteUrl}` : ""}${reviewServiceUrl ? `\n• 5-Star Review Page: ${reviewServiceUrl}` : ""}\n\nWould you be open to a quick walkthrough this week?\n\nBest regards,\n${AGENCY_NAME}`;
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        generatingInlineEmail: false,
        inlineOpen: true,
        generatedEmail: {
          subject: `Quick idea for ${b.businessName} — ${effectiveLeadOffer}`,
          body: fallbackBody,
        },
      } : r));
    }
  };

  const generateInlineWebsiteOrReviewForHunted = async (idx: number, mode: "website" | "review") => {
    const b = results[idx];
    if (!b) return;
    setError("");
    setResults(prev => prev.map((r, i) => i === idx ? {
      ...r,
      generatingSite: mode === "website" ? true : r.generatingSite,
      generatingReview: mode === "review" ? true : r.generatingReview,
      inlineOpen: true,
    } : r));
    try {
      let siteId = b.generatedSiteId;
      let websiteUrl = b.generatedSiteUrl;
      let reviewUrl = b.generatedReviewUrl;
      const isForceRegenerate =
        (mode === "website" && Boolean(b.generatedSiteUrl)) ||
        (mode === "review" && Boolean(b.generatedReviewUrl));
      const hasValidSlug = Boolean(siteId && !/^\d+$/.test(String(siteId)));
      if (!hasValidSlug || isForceRegenerate) {
        const assets = await generateInlineLeadAssets(b);
        siteId = assets.siteId;
        websiteUrl = assets.websiteUrl;
        reviewUrl = assets.reviewUrl;
      } else {
        const origin = window.location.origin;
        websiteUrl = `${origin}/site/${siteId}`;
        reviewUrl = `${origin}/review/${siteId}`;
      }
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        generatingSite: false,
        generatingReview: false,
        generatedSiteId: siteId,
        generatedSiteUrl: mode === "website" ? websiteUrl : (r.generatedSiteUrl || websiteUrl),
        generatedReviewUrl: mode === "review" ? reviewUrl : (r.generatedReviewUrl || reviewUrl),
      } : r));
      await generateInlineEmailForHunted(idx, {
        websiteUrl: mode === "website" ? websiteUrl : b.generatedSiteUrl,
        reviewUrl: mode === "review" ? reviewUrl : b.generatedReviewUrl,
      });
    } catch (e: any) {
      setError(e?.message || "Could not generate preview link");
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, generatingSite: false, generatingReview: false } : r));
    }
  };

  const sendInlineEmailForHunted = async (idx: number) => {
    const b = results[idx];
    if (!b || !b.email || !b.generatedEmail) return;
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, sendingInlineEmail: true } : r));
    try {
      await callCRM("send-email", {
        to: b.email,
        subject: b.generatedEmail.subject,
        body: b.generatedEmail.body,
        prospectName: b.businessName,
      });
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, sendingInlineEmail: false, inlineEmailSent: true } : r));
    } catch (e: any) {
      setError(e?.message || "Failed to send email");
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, sendingInlineEmail: false } : r));
    }
  };

  const enrichAllVisibleWebsites = async () => {
    const indices = results
      .map((r, idx) => (r.website ? idx : -1))
      .filter(idx => idx !== -1);
    if (indices.length === 0) return;
    setBulkEnriching(true);
    setEnrichBatchProgress({
      current: 1,
      total: indices.length,
      label: results[indices[0]]?.businessName || "Website",
    });
    setProgress(`⚡ Running live website deep scan across ${indices.length} domains…`);
    const CONCURRENCY = 5;
    for (let i = 0; i < indices.length; i += CONCURRENCY) {
      const batch = indices.slice(i, i + CONCURRENCY);
      const firstInBatch = results[batch[0]]?.businessName || "";
      setEnrichBatchProgress({
        current: Math.min(indices.length, i + batch.length),
        total: indices.length,
        label: firstInBatch,
      });
      await Promise.all(batch.map(idx => enrichSingleHunted(idx)));
    }
    setBulkEnriching(false);
    setEnrichBatchProgress(null);
    setProgress(`✓ Live Deep Scan completed for ${indices.length} websites`);
  };

  // Sync AI Hunter state when user switches from one Project to another
  useEffect(() => {
    if (!activeProject?.id) return;
    const isInitialMountWithQuickHunt =
      prevProjectIdRef.current === activeProject.id &&
      Boolean(initialQuickHuntRef.current?.category || initialQuickHuntRef.current?.city);
    prevProjectIdRef.current = activeProject.id;

    const savedProjectResults = loadProjectHuntedResults<HuntedBusiness>(activeProject.id);
    setResults(savedProjectResults);
    setProgress(
      savedProjectResults.length > 0
        ? `Loaded ${savedProjectResults.length} scraped businesses saved in project "${activeProject.name}"`
        : ""
    );
    setError("");
    if (!isInitialMountWithQuickHunt) {
      if (activeProject.targetCategory) {
        setCategories([activeProject.targetCategory]);
      }
      if (activeProject.targetCity) {
        setCity(activeProject.targetCity);
      }
      if (activeProject.targetCountry) {
        setCountry(activeProject.targetCountry);
      }
      if (activeProject.extraContext) {
        setExtraContext(activeProject.extraContext);
      }
    }
  }, [activeProject?.id]);

  // Persist scraped results per project so switching projects never loses scraped leads
  useEffect(() => {
    if (activeProject?.id) {
      saveProjectHuntedResults(activeProject.id, results);
    }
  }, [results, activeProject?.id]);

  const currentSaasUser = getCachedSaasUser();
  const isOwnerOrAdmin = isUserAdmin(currentSaasUser);
  const currentPlanId = isOwnerOrAdmin ? "enterprise" : (currentSaasUser?.planId || "free");
  const isFreeTierUser = !isOwnerOrAdmin && currentPlanId === "free";
  const isBulkOrAutopilotLocked = !isOwnerOrAdmin && (currentPlanId === "free" || currentPlanId === "starter");

  const hunt = async () => {
    if (categories.length === 0) { setError("Select at least one business category."); return; }
    if (bulkMode && isBulkOrAutopilotLocked) {
      setError("🔒 20-City Bulk Hunter is locked on the Free Explorer & Starter plans. Please upgrade to Growth or higher in Dashboard → Plans & Billing.");
      return;
    }
    const catLabel = categories.length > 1 ? `${categories.length} categories` : categories[0];
    const effectiveCount = isFreeTierUser ? Math.min(25, Number(count) || 25) : Number(count);

    // Dedup helper shared by both modes below — a business can legitimately
    // show up under more than one category search, so we merge by name+city.
    const dedupKey = (b: HuntedBusiness) => `${b.businessName}|${b.city}`.toLowerCase().replace(/[^a-z0-9|]/g, "");

    if (bulkMode) {
      const cityList = bulkCities.split(/[\n,]+/).map(c => c.trim()).filter(Boolean);
      if (cityList.length === 0) { setError("Enter at least one city in the list."); return; }
      setHunting(true); setError(""); setResults([]);
      setHuntBatchProgress({ completed: 0, total: categories.length });
      setProgress(`🌍 Bulk hunting ${catLabel} across ${cityList.length} cities — this takes a few minutes…`);
      try {
        const seen = new Set<string>();
        const merged: HuntedBusiness[] = [];
        let totalFiltered = 0;
        const cityResultsAgg: Record<string, number> = {};
        // One bulk-hunt call per selected category — each call already covers
        // every city in cityList server-side, then we merge + dedupe here.
        for (let cIdx = 0; cIdx < categories.length; cIdx++) {
          const cat = categories[cIdx];
          setHuntBatchProgress({ completed: cIdx, total: categories.length });
          setProgress(`🌍 Bulk hunting "${cat}" across ${cityList.length} cities (${cIdx + 1} of ${categories.length})…`);
          const resp = await callCRM("bulk-hunt", {
            category: cat,
            cities: cityList,
            country: country.trim(),
            countPerCity: effectiveCount,
            extraContext,
            preFilters: preSearchFilters,
          });
          const businesses: HuntedBusiness[] = Array.isArray(resp) ? resp : (resp.prospects ?? []);
          totalFiltered += resp.filtered ?? 0;
          for (const b of businesses) {
            const key = dedupKey(b);
            if (seen.has(key)) continue;
            seen.add(key);
            const initialAnalysis = b.analysis || buildHuntedFallbackAnalysis(b);
            const resolvedOffer = resolveAuditMatchedOffer({ ...b, analysis: initialAnalysis }, trainedOffer);
            merged.push({
              ...b,
              analysis: initialAnalysis,
              primaryOffer: b.primaryOffer || resolvedOffer.primaryOffer || initialAnalysis.matchedOffer,
              selected: true,
              imported: false,
              importing: false,
            });
          }
          if (resp.cityResults) {
            for (const [c, n] of Object.entries(resp.cityResults as Record<string, number>)) {
              cityResultsAgg[c] = (cityResultsAgg[c] ?? 0) + Number(n);
            }
          }
          setResults([...merged]);
          setHuntBatchProgress({ completed: cIdx + 1, total: categories.length });
        }
        merged.sort((a, b) => (b.softwareNeedScore ?? 0) - (a.softwareNeedScore ?? 0));
        setResults(merged);
        const cityResultsText = Object.entries(cityResultsAgg).map(([c, n]) => `${c}: ${n}`).join(", ");
        setProgress(`✓ Bulk hunt done — ${merged.length} unique businesses (${catLabel}) across ${cityList.length} cities${totalFiltered > 0 ? ` (${totalFiltered} dead domains removed)` : ""}${cityResultsText ? ` · ${cityResultsText}` : ""}`);
      } catch (e: any) {
        setError(e.message); setProgress("");
      } finally { setHunting(false); }
    } else {
      if (!city.trim()) { setError("Please enter a city to hunt in."); return; }
      setHunting(true); setError(""); setResults([]);
      setHuntBatchProgress({ completed: 0, total: categories.length });
      setProgress(`🔍 AI is scanning for ${catLabel} businesses in ${city}…`);
      try {
        const seen = new Set<string>();
        const merged: HuntedBusiness[] = [];
        let totalFiltered = 0;
        for (let cIdx = 0; cIdx < categories.length; cIdx++) {
          const cat = categories[cIdx];
          setHuntBatchProgress({ completed: cIdx, total: categories.length });
          setProgress(`🔍 Scanning ${cat} businesses in ${city} (${cIdx + 1} of ${categories.length})…`);
          const resp = await callCRM("hunt-businesses", {
            category: cat,
            city: city.trim(),
            country: country.trim(),
            count: effectiveCount,
            extraContext,
            preFilters: preSearchFilters,
          });
          const businesses: HuntedBusiness[] = Array.isArray(resp) ? resp : (resp.prospects ?? []);
          totalFiltered += resp.filtered ?? 0;
          for (const b of businesses) {
            const key = dedupKey(b);
            if (seen.has(key)) continue;
            seen.add(key);
            const initialAnalysis = b.analysis || buildHuntedFallbackAnalysis(b);
            const resolvedOffer = resolveAuditMatchedOffer({ ...b, analysis: initialAnalysis }, trainedOffer);
            merged.push({
              ...b,
              analysis: initialAnalysis,
              primaryOffer: b.primaryOffer || resolvedOffer.primaryOffer || initialAnalysis.matchedOffer,
              selected: true,
              imported: false,
              importing: false,
            });
          }
          setResults([...merged]);
          setHuntBatchProgress({ completed: cIdx + 1, total: categories.length });
        }
        let finalHunted = merged;
        if (autoPilotChain && merged.length > 0) {
          // In Auto-Pilot Chain mode, automatically prioritize high-need leads (score >= 6 or verified email)
          finalHunted = merged.map(b => ({
            ...b,
            selected: (b.softwareNeedScore ?? 0) >= 6 || Boolean(b.email),
          }));
          setResults(finalHunted);
        } else {
          setResults(finalHunted);
        }
        const filterNote = totalFiltered > 0 ? ` (${totalFiltered} with dead domains removed)` : "";
        setProgress(`✓ Found ${merged.length} ${catLabel} businesses in ${city}${filterNote}${isFreeTierUser ? " (Free Explorer cap: 25 leads/scan)" : ""}`);
      } catch (e: any) {
        setError(e.message); setProgress("");
      } finally { setHunting(false); }
    }
  };

  // Sync current Hunter target settings directly to the 24/7 Autonomous Scheduler
  const syncCampaignToAutomation = async () => {
    if (isBulkOrAutopilotLocked) {
      setError("🔒 24/7 Autonomous Autopilot is locked on the Free Explorer & Starter plans. Upgrade to Growth or higher in Billing to unlock 24/7 execution.");
      return;
    }
    const targetCities = bulkMode
      ? bulkCities
          .split(/[\n,]+/)
          .map(c => c.trim())
          .filter(Boolean)
          .join(", ")
      : city.trim();
    if (!targetCities) {
      setError("Enter a city or bulk city list first to sync with 24/7 Automation.");
      return;
    }
    setSyncingToAutomation(true);
    setAutomationSyncNotice("");
    try {
      const r = await fetch(`${apiBase()}/api/automation/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huntCategory: categories.join(", ") || "Dentist",
          huntCity: targetCities,
          huntCountry: country.trim(),
          huntCount: Math.min(100, Math.max(10, Number(count) || 50)),
          huntExtraContext: extraContext.trim(),
          autoScore: true,
          autoEmail: true,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setAutomationSyncNotice(
        `✓ Synced ${categories.join(", ")} in ${targetCities} to 24/7 Automation Queue! Open the Automation tab to toggle 24/7 mode.`
      );
    } catch (e: any) {
      setError(e.message || "Failed to sync campaign to automation");
    } finally {
      setSyncingToAutomation(false);
    }
  };

  useEffect(() => {
    if (initialQuickHuntRef.current?.autoRun && city.trim()) {
      initialQuickHuntRef.current.autoRun = false;
      hunt();
    }
  }, []);

  const toggleSelect = (i: number) => setResults(prev => prev.map((b, idx) => idx === i ? { ...b, selected: !b.selected } : b));

  const toggleAll = () => {
    const newVal = !selectAll;
    setSelectAll(newVal);
    setResults(prev => prev.map(b => ({ ...b, selected: newVal })));
  };

  const importSelected = async () => {
    const selected = results.filter(b => b.selected && !b.imported);
    if (selected.length === 0) return;

    const toImport: Omit<Prospect, "id" | "addedAt">[] = [];
    let processedCount = 0;

    for (let i = 0; i < results.length; i++) {
      const b = results[i];
      if (!b.selected || b.imported) continue;

      processedCount++;
      setImportBatchProgress({
        current: processedCount,
        total: selected.length,
        label: b.businessName,
      });
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, importing: true } : r));

      let prospect: Omit<Prospect, "id" | "addedAt"> = {
        businessName: b.businessName,
        ownerName: b.ownerName,
        ownerRole: b.ownerRole,
        category: b.category,
        website: b.website,
        email: b.email,
        phone: b.phone,
        country: b.country,
        city: b.city,
        facebook: b.facebook,
        instagram: b.instagram,
        linkedin: b.linkedin,
        cmsPlatform: b.cmsPlatform,
        techStack: b.techStack,
        missingSignals: b.missingSignals,
        buyerIntentScore: b.buyerIntentScore,
        intentTier: b.intentTier,
        intentReasons: b.intentReasons,
        status: "new",
        priority: b.softwareNeedScore >= 8 ? "high" : b.softwareNeedScore >= 5 ? "medium" : "low",
        expectedValue: b.estimatedValue,
        probability: 20,
        nextFollowUp: "",
        notes: b.painPoint || b.notes || "",
        hunted: true,
        painPoint: b.painPoint,
        primaryOffer: b.primaryOffer || resolveAuditMatchedOffer(b, trainedOffer).primaryOffer || undefined,
        analysis: b.analysis,
        reportId: b.reportId,
        reportUrl: b.reportUrl,
        generatedSiteId: b.generatedSiteId,
        generatedSiteUrl: b.generatedSiteUrl,
        generatedReviewUrl: b.generatedReviewUrl,
        generatedEmail: b.generatedEmail,
      };

      if (autoGenerate) {
        try {
          const generated = await callCRM("auto-generate", {
            businessName: b.businessName, category: b.category,
            website: b.website, city: b.city, country: b.country,
            ownerName: b.ownerName, painPoint: b.painPoint, agencyName: AGENCY_NAME,
            cmsPlatform: b.cmsPlatform, missingSignals: b.missingSignals,
          });
          if (generated.analysis) {
            prospect.analysis = generated.analysis;
            const resolvedAfterAudit = resolveAuditMatchedOffer(
              { ...b, analysis: generated.analysis },
              trainedOffer
            );
            prospect.primaryOffer =
              resolvedAfterAudit.primaryOffer ||
              generated.matchedOffer ||
              generated.analysis.matchedOffer ||
              prospect.primaryOffer;
          }
          if (generated.email) prospect.generatedEmail = generated.email;
          if (generated.whatsapp) prospect.generatedWhatsApp = generated.whatsapp;
          if (generated.linkedin) prospect.generatedLinkedIn = generated.linkedin;
          // Store report link so it can be injected when the email is sent
          if (generated.reportId) prospect.reportId = generated.reportId;
          if (generated.reportUrl) prospect.reportUrl = generated.reportUrl;
          // Also auto-generate natural spoken AI voice pitch script on import
          const firstOwner = b.ownerName ? b.ownerName.split(" ")[0] : "";
          const topGap = (b.missingSignals && b.missingSignals[0]) ? b.missingSignals[0].toLowerCase() : (b.painPoint || "missing an automated 24/7 booking and AI receptionist system");
          prospect.voicePitchScript = `Hey ${firstOwner || `there at ${b.businessName}`}, I was just looking at ${b.businessName}${b.city ? ` in ${b.city}` : ""}${b.cmsPlatform ? ` built on ${b.cmsPlatform}` : ""}, and noticed your site currently has ${topGap}—which usually causes 30 to 40 percent of after-hours customers to call a competitor instead. I just recorded a custom Website Audit Report showing how to fix this in 48 hours and sent the link to your email. Take a quick 60-second look!`;
          if (generated.analysis?.estimatedValue) {
            prospect.expectedValue = Math.round((generated.analysis.estimatedValue.min + generated.analysis.estimatedValue.max) / 2);
          }
          if (generated.aiAgent) {
            prospect.aiAgentType     = generated.aiAgent.type;
            prospect.aiAgentScore    = generated.aiAgent.score;
            prospect.aiAgentFitReason = generated.aiAgent.fitReason;
            prospect.aiAgentTopPain  = generated.aiAgent.topPain;
          }
          if (generated.pitchType) prospect.pitchType = generated.pitchType;
        } catch {
          const fbAnalysis = b.analysis || buildHuntedFallbackAnalysis(b);
          prospect.analysis = fbAnalysis;
          const resolvedAfterAudit = resolveAuditMatchedOffer({ ...b, analysis: fbAnalysis }, trainedOffer);
          prospect.primaryOffer = resolvedAfterAudit.primaryOffer || fbAnalysis.matchedOffer || prospect.primaryOffer;
        }
      }

      toImport.push(prospect);
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, importing: false, imported: true } : r));
    }

    setImportBatchProgress(null);
    onImport(toImport);
  };

  const selectedCount = results.filter(b => b.selected && !b.imported).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg">AI Business Hunter</h2>
            <p className="text-white/80 text-sm">Finds real businesses in any city + auto-generates analysis & outreach</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { v: "Auto", l: "Business Discovery" },
            { v: "AI", l: "Analysis & Scoring" },
            { v: "Ready", l: "Emails & Proposals" },
          ].map(s => (
            <div key={s.l} className="bg-white/10 rounded-xl p-2">
              <div className="font-extrabold text-sm">{s.v}</div>
              <div className="text-white/70 text-xs">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hunt config */}
      <div className="rounded-xl border border-border/50">
        <div className="p-3 bg-muted/20 border-b border-border/50 rounded-t-xl flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2"><Filter className="w-4 h-4" /> Hunt Settings</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground block">
                Business Categories <span className="text-muted-foreground/70 font-normal">(select one or more)</span>
              </label>
              {categories.length > 0 && (
                <button type="button" onClick={() => setCategories([])} className="text-xs text-muted-foreground hover:text-red-600">
                  Clear
                </button>
              )}
            </div>
            <Input
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              placeholder="Search categories (e.g. roofing, dental, law firm)…"
              className="mb-2"
            />
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-border rounded-lg bg-muted/10">
              {CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase())).map(c => {
                const active = categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategories(prev => active ? prev.filter(x => x !== c) : [...prev, c])}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      active ? "bg-purple-600 text-white border-purple-600" : "bg-white text-muted-foreground border-border hover:border-purple-300"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {categories.length === 0 ? "No categories selected." : `${categories.length} selected: ${categories.join(", ")}`}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              {bulkMode ? "Per-City Count" : "How Many"}
            </label>
            <Input
              type="number"
              min={10} max={10000} step={10}
              value={count}
              onChange={e => setCount(String(Math.max(10, Math.min(10000, Number(e.target.value) || 10))))}
              placeholder="e.g. 100"
            />
          </div>

          {/* Classic Before-Search Multi-Select Filter Dropdown */}
          <div className="relative" ref={preFilterDropdownRef}>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Before-Search Filter <span className="text-muted-foreground/70 font-normal">(multi-select)</span>
            </label>
            <button
              type="button"
              onClick={() => setPreFilterDropdownOpen((o) => !o)}
              className="w-full h-9 px-3 py-1.5 text-left text-xs sm:text-sm bg-white border border-input rounded-md flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="truncate font-medium text-slate-800">
                {preSearchFilters.includes("all")
                  ? "All Businesses"
                  : preFilterOptions
                      .filter((o) => preSearchFilters.includes(o.id))
                      .map((o) => o.label)
                      .join(", ")}
              </span>
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
                  preFilterDropdownOpen ? "rotate-90" : ""
                }`}
              />
            </button>

            {preFilterDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 max-h-64 overflow-y-auto">
                <div className="px-3 py-1 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Select Lead Criteria
                  </span>
                  {!preSearchFilters.includes("all") && (
                    <button
                      type="button"
                      onClick={() => setPreSearchFilters(["all"])}
                      className="text-[11px] font-semibold text-purple-600 hover:underline cursor-pointer"
                    >
                      Reset to All
                    </button>
                  )}
                </div>
                {preFilterOptions.map((opt) => {
                  const checked = preSearchFilters.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => togglePreSearchFilter(opt.id)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className={`font-medium ${checked ? "text-slate-900 font-semibold" : "text-slate-700"}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bulk Mode toggle */}
          <div className="sm:col-span-2 flex items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div>
              <div className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0" /> Bulk Hunt — Multiple Cities
              </div>
              <div className="text-xs text-indigo-700 mt-0.5">Hunt across many cities at once to rapidly build a large prospect list</div>
            </div>
            <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
          </div>

          {bulkMode ? (
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cities (one per line, up to 20)</label>
              <Textarea
                value={bulkCities}
                onChange={e => setBulkCities(e.target.value)}
                placeholder={"New York\nLos Angeles\nChicago\nHouston\nPhoenix\nLondon\nToronto\nSydney"}
                rows={6}
                className="text-sm font-mono resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {bulkCities.split(/[\n,]+/).filter(c => c.trim()).length} cities · {count} per city = ~{bulkCities.split(/[\n,]+/).filter(c => c.trim()).length * Number(count)} prospects
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">City *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="pl-8" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Lagos, London, Miami" />
              </div>
            </div>
          )}
          {!bulkMode && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Country</label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Nigeria, UK, USA" />
            </div>
          )}
          {bulkMode && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Country</label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. USA (applies to all cities)" />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Extra Context (optional)</label>
            <Input value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder="e.g. focus on mid-size businesses, avoid chains, luxury segment…" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <div>
              <div className="text-sm font-bold text-purple-900 flex items-center gap-2"><Bot className="w-4 h-4" /> Auto-Generate Analysis & Emails</div>
              <div className="text-xs text-purple-700 mt-0.5">AI writes website analysis, cold email, WhatsApp, and LinkedIn for each prospect automatically</div>
            </div>
            <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" /> Smart Auto-Qualification Filter (Score 6+ or Verified Email)
              </div>
              <div className="text-xs text-emerald-800 mt-0.5">
                Automatically pre-selects only high-need prospects with verified contact signals after scraping so you never waste AI credits on low-fit leads
              </div>
            </div>
            <Switch checked={autoPilotChain} onCheckedChange={setAutoPilotChain} />
          </div>
        </div>
        <div className="px-4 pb-4 space-y-2.5">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          {automationSyncNotice && (
            <div className="text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {automationSyncNotice}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={hunt} disabled={hunting || categories.length === 0 || (!bulkMode && !city.trim()) || (bulkMode && !bulkCities.trim())} className="flex-1 gap-2 btn-premium text-white font-bold h-11">
              {hunting
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> {bulkMode ? "Bulk hunting across cities…" : "Hunting businesses…"}</>
                : bulkMode
                ? <><Globe className="w-4 h-4" /> Start Bulk Hunt ({bulkCities.split(/[\n,]+/).filter(c => c.trim()).length} cities × {categories.length || 1} categor{categories.length === 1 ? "y" : "ies"} × {count})</>
                : <><Radar className="w-4 h-4" /> Start AI Hunt ({categories.length || 1} categor{categories.length === 1 ? "y" : "ies"})</>}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={syncingToAutomation}
              onClick={syncCampaignToAutomation}
              className="h-11 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 gap-1.5 shrink-0"
              title="Push these categories and cities into the 24/7 Autonomous Scheduler"
            >
              {syncingToAutomation ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 text-indigo-600" />}
              <span>Push to 24/7 Automation Queue</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Live Visual Scraping Progress & Skeleton Rows while Hunting */}
      {hunting && (
        <LeadScrapingProgressSkeleton
          categories={categories}
          cityLabel={
            bulkMode
              ? `${bulkCities.split(/[\n,]+/).filter(c => c.trim()).length} cities`
              : city || "Target City"
          }
          targetCount={
            bulkMode
              ? bulkCities.split(/[\n,]+/).filter(c => c.trim()).length * Number(count)
              : count
          }
          bulkMode={bulkMode}
          completedSteps={huntBatchProgress.completed}
          totalSteps={huntBatchProgress.total}
          statusText={progress}
        />
      )}

      {/* Batch Deep-Scan or Auto-Report Generation Progress Banner */}
      {enrichBatchProgress && (
        <BatchOperationProgressBanner
          title="Live Website & Tech-Stack Deep Scan"
          subtitle="Extracting CMS platform, conversion pixels, live chat signals, and decision-makers"
          current={enrichBatchProgress.current}
          total={enrichBatchProgress.total}
          currentItemLabel={enrichBatchProgress.label}
        />
      )}

      {importBatchProgress && (
        <BatchOperationProgressBanner
          title={
            autoGenerate
              ? "Importing Leads & Generating Website Audit Reports"
              : "Importing Selected Leads to Workspace Project"
          }
          subtitle={
            autoGenerate
              ? "Building shareable /report/:id diagnostic, Cold Email variants, WhatsApp & Voice Script"
              : "Saving verified contact records into project pipeline"
          }
          current={importBatchProgress.current}
          total={importBatchProgress.total}
          currentItemLabel={importBatchProgress.label}
        />
      )}

      {/* Progress */}
      {progress && !hunting && (
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3 font-semibold">{progress}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* Export Generated Leads Bar directly inside AI Hunter */}
          <ExportLeadsBar
            leads={(results.some(r => r.selected) ? results.filter(r => r.selected) : results).map(b => ({
              ...b,
              projectName: activeProject?.name || "AI Hunter",
            }))}
            projectName={activeProject?.name || "AI-Hunter-Scraped"}
            label={
              results.some(r => r.selected)
                ? `Export Selected Scraped Leads`
                : `Export All Scraped Leads`
            }
          />

          <div className="rounded-xl border border-border/50 overflow-hidden">
          {apolloCfg.enabled && (
            <div className="px-3 py-2.5 bg-slate-950 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 mr-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Filter:
                </span>
                {[
                  { id: "all", label: `All (${results.length})` },
                  { id: "email", label: `✉ Verified Email (${results.filter(r => r.email).length})` },
                  ...(apolloCfg.intentScoring ? [{ id: "hot", label: `🔥 Hot Intent 75+ (${results.filter(r => (r.buyerIntentScore ?? 0) >= 75).length})` }] : []),
                  ...(apolloCfg.decisionMaker ? [{ id: "owner", label: `👤 Decision-Maker (${results.filter(r => r.ownerName || r.linkedin).length})` }] : []),
                  ...(apolloCfg.techStack ? [
                    { id: "no_chat", label: `⚠️ No Live Chat (${results.filter(r => (r.missingSignals || []).some(s => s.toLowerCase().includes("chat"))).length})` },
                    { id: "no_booking", label: `📅 No Booking (${results.filter(r => (r.missingSignals || []).some(s => s.toLowerCase().includes("booking"))).length})` },
                    { id: "no_pixels", label: `🎯 No Ad Pixels (${results.filter(r => (r.missingSignals || []).some(s => s.toLowerCase().includes("pixel"))).length})` },
                    { id: "diy_cms", label: `🛠️ Wix/Squarespace/WP (${results.filter(r => r.cmsPlatform && r.cmsPlatform !== "Custom / HTML5" && r.cmsPlatform !== "No Website").length})` },
                  ] : []),
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setApolloFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      apolloFilter === f.id
                        ? "bg-amber-400 text-slate-950 shadow-sm"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {apolloCfg.techStack && results.some(r => r.website) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkEnriching}
                    onClick={enrichAllVisibleWebsites}
                    className="h-7 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 gap-1"
                  >
                    {bulkEnriching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {bulkEnriching ? "Deep Scanning…" : "⚡ Deep Scan Websites"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkAnalyzing}
                  onClick={() => analyzeAllVisibleHunted()}
                  className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 gap-1"
                >
                  {bulkAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                  {bulkAnalyzing ? "Auditing Leads…" : "🤖 Auto-Analyze All"}
                </Button>
              </div>
            </div>
          )}
          <div className="p-3 bg-muted/20 border-b border-border/50 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-semibold">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectAll ? "bg-primary border-primary" : "border-gray-300"}`}>
                    {selectAll && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  Select All
                </button>
                <span className="text-xs text-muted-foreground">
                  {selectedCount} selected {activeProject ? `· Saving to "${activeProject.name}"` : ""}
                </span>
                {/* 1-Click Smart Qualification Selection Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      setResults(prev =>
                        prev.map(b => ({ ...b, selected: (b.softwareNeedScore ?? 0) >= 7 }))
                      )
                    }
                    className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    Select High-Need 7+ ({results.filter(b => (b.softwareNeedScore ?? 0) >= 7).length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setResults(prev => prev.map(b => ({ ...b, selected: Boolean(b.email) })))
                    }
                    className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    Select Verified Email ({results.filter(b => Boolean(b.email)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setResults(prev =>
                        prev.map(b => ({
                          ...b,
                          selected:
                            (b.missingSignals && b.missingSignals.length > 0) ||
                            (b.softwareNeedScore ?? 0) >= 8,
                        }))
                      )
                    }
                    className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    Select Missing Chat/Booking
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={importSelected}
                  disabled={selectedCount === 0}
                  className="gap-2 font-semibold h-8 text-xs sm:text-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Import {selectedCount > 0 ? selectedCount : ""} to Project {autoGenerate ? "+ Auto-Generate" : ""}
                </Button>
              </div>
            </div>

            {/* Search bar inside Scraped Hunter Results */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={hunterSearchQuery}
                onChange={e => setHunterSearchQuery(e.target.value)}
                placeholder="Filter scraped leads by business name, domain, email, or city…"
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
          </div>

          <div className="divide-y divide-border/30 sm:max-h-[680px] sm:overflow-y-auto">
            {(() => {
              const hasStrictPreMatch = results.some(b => matchesPreSearchFilter(b));
              return (
                <>
                  {!hasStrictPreMatch && preSearchFilters.some(f => f !== "all") && (
                    <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-xs text-amber-900">
                      <span>
                        Showing all {results.length} scraped leads from this scan (click <strong>Hunt</strong> to scan specifically for your selected filter, or reset filter).
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreSearchFilters(["all"])}
                        className="px-2 py-0.5 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Reset to All
                      </button>
                    </div>
                  )}
                  {results.map((b, i) => {
                    if (hasStrictPreMatch && !matchesPreSearchFilter(b)) return null;
              if (hunterSearchQuery.trim()) {
                const q = hunterSearchQuery.trim().toLowerCase();
                const matchText = `${b.businessName || ""} ${b.website || ""} ${b.email || ""} ${b.city || ""} ${b.painPoint || ""}`.toLowerCase();
                if (!matchText.includes(q)) return null;
              }
              if (apolloCfg.enabled && apolloFilter !== "all") {
                if (apolloFilter === "email" && !b.email) return null;
                if (apolloFilter === "hot" && (b.buyerIntentScore ?? 0) < 75) return null;
                if (apolloFilter === "owner" && !b.ownerName && !b.linkedin) return null;
                if (apolloFilter === "no_chat" && !(b.missingSignals || []).some(s => s.toLowerCase().includes("chat"))) return null;
                if (apolloFilter === "no_booking" && !(b.missingSignals || []).some(s => s.toLowerCase().includes("booking"))) return null;
                if (apolloFilter === "no_pixels" && !(b.missingSignals || []).some(s => s.toLowerCase().includes("pixel"))) return null;
                if (apolloFilter === "diy_cms" && (!b.cmsPlatform || b.cmsPlatform === "Custom / HTML5" || b.cmsPlatform === "No Website")) return null;
              }
              const linkedinSearchUrl = b.linkedin || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${b.ownerName || ""} ${b.businessName} ${b.city || ""}`.trim())}`;
              return (
              <div key={i} className={`p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3 transition-colors overflow-hidden ${b.imported ? "bg-green-50/60" : b.selected ? "" : "opacity-60"}`}>
                {b.imported ? (
                  <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : b.importing ? (
                  <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <button onClick={() => toggleSelect(i)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${b.selected ? "bg-primary border-primary" : "border-gray-300"}`}>
                    {b.selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="break-words">{b.businessName}</span>
                        {apolloCfg.enabled && apolloCfg.decisionMaker && b.ownerName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            👤 {b.ownerName}{b.ownerRole ? ` · ${b.ownerRole}` : ""}
                          </span>
                        )}
                        {apolloCfg.enabled && apolloCfg.decisionMaker && (
                          <a
                            href={linkedinSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                            title={b.linkedin ? "Direct LinkedIn Profile" : "1-Click LinkedIn Decision-Maker X-Ray"}
                          >
                            <Linkedin className="w-2.5 h-2.5" />
                            {b.linkedin ? "LinkedIn Verified" : "Find Owner on LinkedIn"}
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                        {b.email && <span className="text-primary font-semibold break-all">✉ {b.email}</span>}
                        {b.phone && <span>📞 {b.phone}</span>}
                        {b.city && <span>📍 {b.city}{b.country ? `, ${b.country}` : ""}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap sm:justify-end">
                      {apolloCfg.enabled && apolloCfg.intentScoring && typeof b.buyerIntentScore === "number" && (
                        <div
                          title={(b.intentReasons || []).join(" • ")}
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                            b.buyerIntentScore >= 75
                              ? "bg-orange-100 text-orange-800 border-orange-300"
                              : b.buyerIntentScore >= 55
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {b.buyerIntentScore >= 75 ? "🔥" : "⚡"} {b.buyerIntentScore}/100 Intent
                        </div>
                      )}
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.softwareNeedScore >= 8 ? "bg-red-100 text-red-700" : b.softwareNeedScore >= 5 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {b.softwareNeedScore}/10 need
                      </div>
                      {b.estimatedValue > 0 && (
                        <div className="text-xs font-bold text-purple-700">${b.estimatedValue.toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  {b.painPoint && <p className="text-xs text-muted-foreground mt-1.5 italic break-words">"{b.painPoint}"</p>}
                  {/* Apollo+ Tech Stack & Missing Revenue Signals Row */}
                  {apolloCfg.enabled && apolloCfg.techStack && (b.cmsPlatform || (b.techStack && b.techStack.length > 0) || (b.missingSignals && b.missingSignals.length > 0)) && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {b.cmsPlatform && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          🖥️ CMS: {b.cmsPlatform}
                        </span>
                      )}
                      {(b.techStack || []).slice(0, 4).map((t, idx) => (
                        <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {t}
                        </span>
                      ))}
                      {(b.missingSignals || []).slice(0, 3).map((m, idx) => (
                        <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          ⚠️ {m}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {b.website && (
                      <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 break-all max-w-full">
                        <Globe className="w-3 h-3 shrink-0" /><span>{b.website}</span>
                      </a>
                    )}
                    {apolloCfg.enabled && apolloCfg.techStack && b.website && (
                      <button
                        type="button"
                        disabled={b.enriching}
                        onClick={() => enrichSingleHunted(i)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer flex items-center gap-1"
                      >
                        {b.enriching ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                        {b.enriching ? "Scanning…" : "⚡ Live Scan Tech & Owner"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={b.analyzing}
                      onClick={() => analyzeSingleHunted(i)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer flex items-center gap-1"
                    >
                      {b.analyzing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <BarChart3 className="w-2.5 h-2.5" />}
                      {b.analyzing ? "Auditing…" : b.analysis ? `✓ Audited (${b.analysis.websiteScore}/100)` : "🔍 Run Audit"}
                    </button>
                    {b.imported && <span className="text-xs font-bold text-green-700">✓ Imported {autoGenerate ? "+ AI Generated" : ""}</span>}
                  </div>

                  {/* Primary Offer + Inline Website / Review / Generate Cold Email Bar (mobile-friendly) */}
                  {(() => {
                    const offerRes = resolveAuditMatchedOffer(b, trainedOffer);
                    return (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          {offerRes.primaryOffer ? (
                            <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1 w-fit max-w-full">
                              <span className="font-semibold text-slate-900 shrink-0">Primary Offer:</span>
                              <span className="truncate">{offerRes.primaryOffer}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Run Live Scan or Audit to match best offer
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                            {offerRes.showGenerateWebsite && (
                              <button
                                type="button"
                                disabled={b.generatingSite}
                                onClick={() => generateInlineWebsiteOrReviewForHunted(i, "website")}
                                className="flex-1 sm:flex-initial justify-center px-2.5 py-2 sm:py-1 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                {b.generatingSite ? <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> : <Globe className="w-3 h-3 text-slate-600 shrink-0" />}
                                <span>{b.generatedSiteUrl ? "Regenerate Website" : "Generate Website"}</span>
                              </button>
                            )}
                            {offerRes.showGenerateReview && (
                              <button
                                type="button"
                                disabled={b.generatingReview}
                                onClick={() => generateInlineWebsiteOrReviewForHunted(i, "review")}
                                className="flex-1 sm:flex-initial justify-center px-2.5 py-2 sm:py-1 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                {b.generatingReview ? <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> : <Star className="w-3 h-3 text-amber-500 shrink-0" />}
                                <span>{b.generatedReviewUrl ? "Regenerate Review" : "Generate Review"}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={b.generatingInlineEmail}
                              onClick={() => {
                                if (b.generatedEmail && b.inlineOpen) {
                                  setResults(prev => prev.map((r, idx) => idx === i ? { ...r, inlineOpen: false } : r));
                                } else if (b.generatedEmail && !b.inlineOpen) {
                                  setResults(prev => prev.map((r, idx) => idx === i ? { ...r, inlineOpen: true } : r));
                                } else {
                                  generateInlineEmailForHunted(i);
                                }
                              }}
                              className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1 rounded-md text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                            >
                              {b.generatingInlineEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Mail className="w-3.5 h-3.5 shrink-0" />}
                              <span>{b.generatedEmail ? (b.inlineOpen ? "Hide Cold Email" : "View Cold Email") : "Generate Cold Email"}</span>
                            </button>
                          </div>
                        </div>

                        {(b.generatedSiteUrl || b.generatedReviewUrl) && (
                          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                            {b.generatedSiteUrl && (
                              <div className="inline-flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-700">Website Preview:</span>
                                <a href={b.generatedSiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium break-all">
                                  {b.generatedSiteUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                            )}
                            {b.generatedReviewUrl && (
                              <div className="inline-flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-700">Review Page:</span>
                                <a href={b.generatedReviewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium break-all">
                                  {b.generatedReviewUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {b.inlineOpen && b.generatedEmail && (
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5 mt-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                <Mail className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                <span>Personalized Cold Email{offerRes.primaryOffer ? ` (${offerRes.primaryOffer})` : ""}</span>
                                {b.inlineEmailSent && <span className="text-green-600 font-semibold">· ✓ Sent</span>}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <CopyButton text={`Subject: ${b.generatedEmail.subject}\n\n${b.generatedEmail.body}`} />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateInlineEmailForHunted(i)}
                                  disabled={b.generatingInlineEmail}
                                  className="h-7 text-xs gap-1"
                                >
                                  <RefreshCw className={`w-3 h-3 ${b.generatingInlineEmail ? "animate-spin" : ""}`} />
                                  Regenerate
                                </Button>
                                {b.email && (
                                  <Button
                                    size="sm"
                                    onClick={() => sendInlineEmailForHunted(i)}
                                    disabled={b.sendingInlineEmail}
                                    className="h-7 text-xs gap-1 bg-slate-900 hover:bg-slate-800 text-white"
                                  >
                                    <Send className="w-3 h-3" />
                                    {b.sendingInlineEmail ? "Sending…" : "Send Email"}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Input
                              value={b.generatedEmail.subject}
                              onChange={(e) =>
                                setResults(prev =>
                                  prev.map((r, idx) =>
                                    idx === i && r.generatedEmail
                                      ? { ...r, generatedEmail: { ...r.generatedEmail, subject: e.target.value } }
                                      : r
                                  )
                                )
                              }
                              className="h-8 text-xs font-semibold"
                            />
                            <Textarea
                              value={b.generatedEmail.body}
                              onChange={(e) =>
                                setResults(prev =>
                                  prev.map((r, idx) =>
                                    idx === i && r.generatedEmail
                                      ? { ...r, generatedEmail: { ...r.generatedEmail, body: e.target.value } }
                                      : r
                                  )
                                )
                              }
                              rows={5}
                              className="text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              );
            })}
                </>
              );
            })()}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ prospects }: { prospects: Prospect[] }) {
  const stats = {
    total: prospects.length,
    hunted: prospects.filter(p => p.hunted).length,
    contacted: prospects.filter(p => p.status === "contacted" || p.status === "waiting").length,
    proposals: prospects.filter(p => p.status === "proposal_sent").length,
    won: prospects.filter(p => p.status === "won").length,
    pipeline: prospects.filter(p => !["lost","archive"].includes(p.status)).reduce((s, p) => s + (p.expectedValue || 0), 0),
    analyzed: prospects.filter(p => p.analysis).length,
    emailsSent: prospects.filter(p => p.emailSentAt).length,
  };
  const convRate = stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0;

  const cards = [
    { label: "Total Prospects", value: stats.total, icon: <Users className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    { label: "AI Hunted", value: stats.hunted, icon: <Radar className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
    { label: "AI Analyzed", value: stats.analyzed, icon: <BarChart3 className="w-5 h-5" />, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100" },
    { label: "Emails Sent", value: stats.emailsSent, icon: <Send className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
    { label: "Projects Won", value: stats.won, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50 border-green-100" },
    { label: "Conversion Rate", value: `${convRate}%`, icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    { label: "Pipeline Value", value: `$${stats.pipeline.toLocaleString()}`, icon: <Target className="w-5 h-5" />, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    { label: "Proposals Sent", value: stats.proposals, icon: <Download className="w-5 h-5" />, color: "text-pink-600", bg: "bg-pink-50 border-pink-100" },
  ];

  const pipeline = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key, pipelineLabel: cfg.label, count: prospects.filter(p => p.status === key).length,
    value: prospects.filter(p => p.status === key).reduce((s, p) => s + (p.expectedValue || 0), 0),
    ...cfg,
  })).filter(s => !["archive"].includes(s.key));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`flex items-center gap-3 p-4 rounded-xl border ${c.bg}`}>
            <div className={c.color}>{c.icon}</div>
            <div>
              <div className={`text-2xl font-extrabold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground font-semibold">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <h3 className="font-bold text-sm">Sales Pipeline</h3>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {pipeline.map(s => (
            <div key={s.key} className={`rounded-xl p-3 border ${s.border} ${s.bg}`}>
              <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${s.color}`}>{s.pipelineLabel}</div>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.count}</div>
              {s.value > 0 && <div className={`text-xs mt-0.5 ${s.color} opacity-70`}>${s.value.toLocaleString()}</div>}
            </div>
          ))}
        </div>
      </div>

      {prospects.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Radar className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-lg">AI Hunter Ready</p>
          <p className="text-sm mt-1">Use the Hunter tab to automatically find businesses — AI will analyze them and write outreach for you.</p>
        </div>
      )}
    </div>
  );
}

// ─── Add/Edit Prospect Dialog ─────────────────────────────────────────────────

const EMPTY_PROSPECT = {
  businessName: "", ownerName: "", category: "", website: "", email: "",
  phone: "", country: "", city: "", facebook: "", instagram: "", linkedin: "",
  status: "new" as LeadStatus, priority: "medium" as Priority,
  expectedValue: 0, probability: 50, nextFollowUp: "", notes: "",
};

function AddProspectDialog({ onAdd, editData, onClose }: {
  onAdd: (p: Omit<Prospect, "id" | "addedAt">) => void;
  editData?: Prospect | null;
  onClose?: () => void;
}) {
  const [form, setForm] = useState(editData ? { ...editData } : { ...EMPTY_PROSPECT });
  const [open, setOpen] = useState(!!editData);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.businessName.trim()) return;
    onAdd(form as any);
    setForm({ ...EMPTY_PROSPECT });
    setOpen(false);
    onClose?.();
  };

  useEffect(() => { if (editData) { setForm({ ...editData }); setOpen(true); } }, [editData]);

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) onClose?.(); }}>
      {!editData && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 font-semibold"><Plus className="w-4 h-4" /> Add Manually</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editData ? "Edit Prospect" : "Add New Prospect"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            { k: "businessName", l: "Business Name *", p: "e.g. Mario's Pizza" },
            { k: "ownerName", l: "Owner / Contact Name", p: "e.g. Mario Rossi" },
            { k: "email", l: "Email", p: "owner@business.com" },
            { k: "phone", l: "Phone / WhatsApp", p: "+1 555 000 0000" },
            { k: "website", l: "Website", p: "https://website.com" },
            { k: "country", l: "Country", p: "e.g. United States" },
            { k: "city", l: "City", p: "e.g. New York" },
            { k: "facebook", l: "Facebook", p: "facebook.com/page" },
            { k: "instagram", l: "Instagram", p: "@handle" },
            { k: "linkedin", l: "LinkedIn", p: "linkedin.com/company/..." },
          ].map(f => (
            <div key={f.k} className={f.k === "website" || f.k === "businessName" ? "col-span-2" : ""}>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{f.l}</label>
              <Input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.p} />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Category</label>
            <Select value={form.category} onValueChange={v => set("category", v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Priority</label>
            <Select value={form.priority} onValueChange={v => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴 High</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Expected Value ($)</label>
            <Input type="number" value={form.expectedValue} onChange={e => set("expectedValue", Number(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Win Probability (%)</label>
            <Input type="number" min={0} max={100} value={form.probability} onChange={e => set("probability", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Next Follow-up Date</label>
            <Input type="date" value={form.nextFollowUp} onChange={e => set("nextFollowUp", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes</label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Meeting notes, special requests, pricing notes…" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSubmit} className="flex-1 font-semibold" disabled={!form.businessName.trim()}>
            {editData ? "Save Changes" : "Add Prospect"}
          </Button>
          <Button variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────

function AnalysisPanel({ prospect, onUpdate }: { prospect: Prospect; onUpdate: (p: Prospect) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const trainedOffer = useTrainedOfferSummary();

  const buildClientFallbackAnalysis = (): WebsiteAnalysis => {
    const hasWeb = Boolean(prospect.website && !/^(none|n\/a|no website|-)$/i.test(prospect.website.trim()));
    const cat = prospect.category || "local service";
    const city = prospect.city || "your area";
    const preSignalRes = resolveAuditMatchedOffer({ ...prospect, analysis: undefined }, trainedOffer);
    const needsWeb = preSignalRes.needsWebsite;
    const needsRev = preSignalRes.needsReview;
    const matchedOffer = preSignalRes.primaryOffer || "24/7 AI Receptionist & Automated Booking";

    const issues: { title: string; description: string; priority: string }[] = [];
    if (needsWeb) {
      issues.push({
        title: hasWeb ? "High-Friction Mobile Lead Capture" : "No Dedicated Conversion Website",
        description: hasWeb
          ? `Mobile visitors searching for ${cat.toLowerCase()} in ${city} face static contact forms without instant quote or booking confirmation.`
          : `Prospective customers searching for ${prospect.businessName} in ${city} have no dedicated website or instant booking funnel.`,
        priority: "high",
      });
    }
    if (needsRev) {
      issues.push({
        title: "Missing Automated 5-Star Review Funnel",
        description: "Satisfied customers are not automatically routed to leave 5-star Google reviews while private feedback is intercepted.",
        priority: needsWeb ? "medium" : "high",
      });
    }
    issues.push({
      title: "No 24/7 Automated AI Receptionist or Instant Reply",
      description: "After-hours and peak-hour customer inquiries go unanswered without an automated chat and voice receptionist.",
      priority: !needsWeb && !needsRev ? "high" : "medium",
    });

    return {
      matchedOffer,
      websiteScore: !hasWeb ? 14 : needsWeb ? 46 : 74,
      leadScore: needsWeb ? 52 : 76,
      conversionScore: !hasWeb ? 12 : needsWeb ? 38 : 68,
      mobileScore: !hasWeb ? 18 : needsWeb ? 54 : 76,
      seoScore: !hasWeb ? 15 : needsWeb ? 44 : 68,
      growthPotential: 92,
      checks: {
        responsiveDesign: hasWeb && !needsWeb,
        sslCertificate: hasWeb,
        modernUI: hasWeb && !needsWeb,
        whatsappButton: false,
        contactForm: hasWeb && !needsWeb,
        bookingSystem: false,
        onlineOrdering: false,
        paymentIntegration: false,
        customerPortal: false,
        membershipArea: false,
        blog: false,
        seoBasics: hasWeb,
        analytics: hasWeb && !needsWeb,
        socialMedia: true,
        emailCapture: false,
        liveChat: false,
        aiChatbot: false,
        callToAction: hasWeb && !needsWeb,
        trustElements: hasWeb && !needsRev,
      },
      issues,
      opportunities: [
        {
          title: `Deploy ${matchedOffer}`,
          impact: "+25–40% increase in mobile customer inquiries",
          effort: "low",
        },
        {
          title: needsRev ? "Activate 5-Star Review Shield" : "Automate 24/7 AI Receptionist & Booking",
          impact: "Captures missed calls & protects 5-star local reputation",
          effort: "low",
        },
      ],
      recommendedFeatures: [
        matchedOffer,
        ...(needsWeb ? ["4-Tap Mobile Quote & Booking Funnel"] : []),
        ...(needsRev ? ["5-Star Review Shield & QR Gatekeeper"] : []),
        "24/7 Spoken AI Receptionist Chatbot",
      ],
      projectType: "Medium Web App",
      estimatedValue: { min: 1500, max: 3500 },
      deliveryWeeks: { min: 1, max: 2 },
      summary: `${prospect.businessName} has strong local demand in ${city} as a ${cat} provider, and our audit indicates ${matchedOffer} is the top priority to convert more local traffic into booked appointments.`,
    };
  };

  const analyze = async () => {
    setLoading(true); setError("");
    try {
      const data = await callCRM("analyze-website", {
        website: prospect.website,
        businessName: prospect.businessName,
        category: prospect.category,
        city: prospect.city,
        painPoint: prospect.painPoint,
        cmsPlatform: prospect.cmsPlatform,
        missingSignals: prospect.missingSignals,
      });
      const fb = buildClientFallbackAnalysis();
      const merged: WebsiteAnalysis = {
        ...fb,
        ...data,
        checks: { ...fb.checks, ...(data?.checks || {}) },
        issues: Array.isArray(data?.issues) && data.issues.length > 0 ? data.issues : fb.issues,
        opportunities: Array.isArray(data?.opportunities) && data.opportunities.length > 0 ? data.opportunities : fb.opportunities,
        recommendedFeatures: Array.isArray(data?.recommendedFeatures) && data.recommendedFeatures.length > 0 ? data.recommendedFeatures : fb.recommendedFeatures,
        estimatedValue: data?.estimatedValue?.min ? data.estimatedValue : fb.estimatedValue,
        deliveryWeeks: data?.deliveryWeeks?.min ? data.deliveryWeeks : fb.deliveryWeeks,
      };
      const resolved = resolveAuditMatchedOffer({ ...prospect, analysis: merged }, trainedOffer);
      onUpdate({
        ...prospect,
        analysis: merged,
        primaryOffer: resolved.primaryOffer || merged.matchedOffer || prospect.primaryOffer,
        reportId: data?.reportId || prospect.reportId,
        reportUrl: data?.reportUrl || prospect.reportUrl,
      });
    } catch {
      const fb = buildClientFallbackAnalysis();
      const resolved = resolveAuditMatchedOffer({ ...prospect, analysis: fb }, trainedOffer);
      onUpdate({
        ...prospect,
        analysis: fb,
        primaryOffer: resolved.primaryOffer || fb.matchedOffer || prospect.primaryOffer,
      });
    } finally { setLoading(false); }
  };

  const autoAnalyzedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!prospect.analysis && !loading && autoAnalyzedIdRef.current !== prospect.id) {
      autoAnalyzedIdRef.current = prospect.id;
      void analyze();
    }
  }, [prospect.id]);

  const a = prospect.analysis;
  if (loading) {
    return (
      <WebsiteAuditReportSkeleton
        businessName={prospect.businessName}
        website={prospect.website}
      />
    );
  }

  if (!a) return (
    <div className="text-center py-12">
      <BarChart3 className="w-12 h-12 mx-auto mb-4 text-primary/30" />
      <h3 className="font-bold text-lg mb-2">AI Website Analysis</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
        Get a full digital audit — scores, issues, opportunities for {prospect.businessName}.
      </p>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <Button onClick={analyze} className="gap-2 btn-premium text-white font-bold">
        <Sparkles className="w-4 h-4" /> Run AI Analysis
      </Button>
    </div>
  );

  const scoreColorClass = (v: number) => v >= 70 ? "text-green-600" : v >= 40 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-lg">{prospect.businessName} — Report</h3>
          <p className="text-sm text-muted-foreground mt-1">{a.summary}</p>
          {(a.matchedOffer || a.projectType) && (
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Recommended Offer: <strong>{a.matchedOffer || a.projectType}</strong></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {prospect.reportId && (
            <a href={`/report/${prospect.reportId}`}>
              <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                <ExternalLink className="w-3.5 h-3.5" /> View Client Audit Report
              </Button>
            </a>
          )}
          <Button size="sm" variant="outline" onClick={analyze} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Re-analyze
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Website Score", v: a.websiteScore },
          { label: "Lead Generation", v: a.leadScore },
          { label: "Conversion", v: a.conversionScore },
          { label: "Mobile Experience", v: a.mobileScore },
          { label: "SEO Score", v: a.seoScore },
          { label: "Growth Potential", v: a.growthPotential },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/50 p-3 text-center">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{s.label}</div>
            <div className={`text-3xl font-extrabold ${scoreColorClass(s.v)}`}>{s.v}</div>
            <div className="text-[10px] text-muted-foreground">/100</div>
          </div>
        ))}
      </div>

      {/* AI Agent Opportunity card */}
      {prospect.aiAgentType && AGENT_META[prospect.aiAgentType] && (() => {
        const agent = AGENT_META[prospect.aiAgentType!];
        const agentScore = safe(prospect.aiAgentScore);
        const scoreColor2 = agentScore >= 70 ? "text-green-700 bg-green-50 border-green-200"
          : agentScore >= 45 ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-red-700 bg-red-50 border-red-200";
        return (
          <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
            <div className="p-3 border-b border-violet-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600" />
              <h4 className="text-sm font-bold text-violet-900">AI Agent Opportunity</h4>
              <span className={`ml-auto text-xs font-bold border rounded-full px-2 py-0.5 ${scoreColor2}`}>
                Fit score {agentScore}/100
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold border rounded-lg px-3 py-1.5 ${agent.color}`}>
                  {agent.icon} {agent.label}
                </span>
                {prospect.pitchType && (
                  <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5 bg-background">
                    Pitch: {prospect.pitchType === "ai_agent" ? "AI Agent only" : prospect.pitchType === "both" ? "AI Agent + Website" : "Website only"}
                  </span>
                )}
              </div>
              {prospect.aiAgentTopPain && (
                <div className="text-sm">
                  <span className="font-semibold text-violet-900">Top pain: </span>
                  <span className="text-violet-800">{prospect.aiAgentTopPain}</span>
                </div>
              )}
              {prospect.aiAgentFitReason && (
                <p className="text-xs text-muted-foreground italic">{prospect.aiAgentFitReason}</p>
              )}
            </div>
          </div>
        );
      })()}

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-3 bg-muted/20 border-b border-border/50">
          <h4 className="text-sm font-bold">Feature Checklist</h4>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(a.checks || {}).map(([k, v]) => (
            <div key={k} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${v ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {v ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
              {CHECK_LABELS[k] || k}
            </div>
          ))}
        </div>
      </div>

      {(a.issues || []).length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 bg-muted/20 border-b border-border/50">
            <h4 className="text-sm font-bold">Issues Found ({(a.issues || []).length})</h4>
          </div>
          <div className="divide-y divide-border/30">
            {(a.issues || []).map((issue, i) => (
              <div key={i} className="p-3 flex items-start gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                  issue.priority === "high" ? "bg-red-100 text-red-700" :
                  issue.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                }`}>{issue.priority}</span>
                <div>
                  <div className="text-sm font-semibold">{issue.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{issue.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(a.opportunities || []).length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 bg-muted/20 border-b border-border/50">
            <h4 className="text-sm font-bold">Revenue Opportunities</h4>
          </div>
          <div className="divide-y divide-border/30">
            {(a.opportunities || []).map((op, i) => (
              <div key={i} className="p-3 flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">{op.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{op.impact}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-auto font-medium ${
                  op.effort === "low" ? "bg-green-100 text-green-700" :
                  op.effort === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                }`}>{op.effort} effort</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#FAF9F5] border border-[#E4E2DD] rounded-xl p-4">
        <h4 className="font-bold text-sm text-[#0B0F17] mb-3">Project Estimate</h4>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Type</div>
            <div className="font-bold text-sm mt-1">{a.projectType || "Medium Web App"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Est. Value</div>
            <div className="font-mono-num font-bold text-sm mt-1 text-[#1D4ED8]">${(a.estimatedValue?.min ?? 1500).toLocaleString()} – ${(a.estimatedValue?.max ?? 3500).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Delivery</div>
            <div className="font-mono-num font-bold text-sm mt-1">{a.deliveryWeeks?.min ?? 1}–{a.deliveryWeeks?.max ?? 2} weeks</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Outreach Panel ───────────────────────────────────────────────────────────

function OutreachPanel({ prospect, onUpdate }: { prospect: Prospect; onUpdate: (p: Prospect) => void }) {
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingWA, setLoadingWA] = useState(false);
  const [loadingLI, setLoadingLI] = useState(false);
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingTrained, setSendingTrained] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [generatingSiteInline, setGeneratingSiteInline] = useState(false);
  const [generatingReviewInline, setGeneratingReviewInline] = useState(false);
  const [followupDay, setFollowupDay] = useState("3");
  const [followup, setFollowup] = useState<{ subject: string; body: string } | null>(null);
  const [error, setError] = useState("");
  const [sendStatus, setSendStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const trainedOffer = useTrainedOfferSummary();
  const auditOfferRes = resolveAuditMatchedOffer(prospect, trainedOffer);
  const effectivePrimaryOffer = auditOfferRes.primaryOffer || prospect.analysis?.matchedOffer || trainedOffer.primaryOfferName;

  const sendProposalEmail = async () => {
    if (!prospect.email || !prospect.proposal) return;
    setSendingProposal(true); setSendStatus(null);
    try {
      // Protected route — must go through callCRM() for the bearer token / 401 handling.
      await callCRM("send-proposal-email", { to: prospect.email, prospectName: prospect.businessName, proposal: prospect.proposal, agencyName: AGENCY_NAME });
      onUpdate({ ...prospect, status: "proposal_sent" });
      setSendStatus({ type: "success", msg: `Proposal emailed to ${prospect.email}` });
    } catch (e: any) { setSendStatus({ type: "error", msg: e.message }); }
    finally { setSendingProposal(false); }
  };

  const issues = prospect.analysis?.issues.slice(0, 3).map(i => i.title).join(", ") || "";
  const opportunities = prospect.analysis?.opportunities.slice(0, 2).map(o => o.title).join(", ") || "";

  const buildLocalFallbackEmails = () => {
    const biz = prospect.businessName || "your business";
    const firstOwner = prospect.ownerName ? prospect.ownerName.split(" ")[0] : "";
    const greeting = firstOwner ? `Hi ${firstOwner},` : `Hi ${biz} Team,`;
    const cat = (prospect.category || "local").toLowerCase();
    const cityPart = prospect.city ? ` in ${prospect.city}` : "";
    const reportLine = prospect.reportUrl
      ? `\n\nI also put together a custom Website & Conversion Audit for ${biz} here:\n${prospect.reportUrl}`
      : "";
    const signOff = `\n\nBest regards,\n${AGENCY_NAME}`;

    return [
      {
        version: "A",
        subject: `Quick growth idea for ${biz}`,
        body: `${greeting}\n\nWhile reviewing ${cat} businesses${cityPart}, I noticed ${biz} has a strong local reputation, but mobile visitors don't currently have a fast 1-click booking or instant quote flow.\n\nWe help ${cat} businesses turn missed website visitors into booked clients automatically.${reportLine}\n\nWould you be open to a quick 5-minute walkthrough this week?${signOff}`,
      },
      {
        version: "B",
        subject: `Capturing more ${prospect.city || "local"} clients for ${biz}`,
        body: `${greeting}\n\nI was looking at ${biz}${cityPart} today and saw a clear opportunity to convert more of your search traffic into booked appointments without adding extra phone work for your team.${reportLine}\n\nWould you be open to seeing a quick preview of how this would work for ${biz}?${signOff}`,
      },
      {
        version: "C",
        subject: `${biz} — website & conversion upgrade`,
        body: `${greeting}\n\nMost ${cat} businesses${cityPart} lose 30–40% of after-hours inquiries when visitors have to wait for a callback.\n\nWe built a streamlined conversion & booking blueprint tailored for ${biz}.${reportLine}\n\nCan I send over a 60-second overview?${signOff}`,
      },
    ];
  };

  const genEmailWithOverrides = async (overrides?: {
    websiteUrl?: string;
    reviewUrl?: string;
    siteId?: string;
  }) => {
    setLoadingEmail(true); setError(""); setSendStatus(null);
    const demoWebsiteUrl = overrides?.websiteUrl ?? prospect.generatedSiteUrl ?? "";
    const reviewServiceUrl = overrides?.reviewUrl ?? prospect.generatedReviewUrl ?? "";
    const nextSiteId = overrides?.siteId ?? prospect.generatedSiteId;
    try {
      const data = await callCRM("generate-email", {
        businessName: prospect.businessName, ownerName: prospect.ownerName,
        ownerRole: prospect.ownerRole,
        category: prospect.category, website: prospect.website,
        city: prospect.city,
        cmsPlatform: prospect.cmsPlatform,
        missingSignals: prospect.missingSignals,
        issues, opportunities, agencyName: AGENCY_NAME,
        reportUrl: prospect.reportUrl || "",
        primaryOffer: effectivePrimaryOffer,
        demoWebsiteUrl,
        reviewServiceUrl,
      });
      const fallbackVersions = buildLocalFallbackEmails();
      const versions: { version: string; subject: string; body: string }[] =
        Array.isArray(data?.versions) && data.versions.length > 0
          ? data.versions
          : fallbackVersions;
      const primary = versions[0] ?? fallbackVersions[0];
      onUpdate({
        ...prospect,
        primaryOffer: effectivePrimaryOffer,
        generatedSiteId: nextSiteId,
        generatedSiteUrl: demoWebsiteUrl || prospect.generatedSiteUrl,
        generatedReviewUrl: reviewServiceUrl || prospect.generatedReviewUrl,
        generatedEmail: {
          subject: primary.subject || fallbackVersions[0].subject,
          body: primary.body || fallbackVersions[0].body,
          emailVersions: versions,
          selectedVersion: primary.version || "A",
        },
      });
    } catch {
      const fallbackVersions = buildLocalFallbackEmails();
      const primary = fallbackVersions[0];
      onUpdate({
        ...prospect,
        primaryOffer: effectivePrimaryOffer,
        generatedSiteId: nextSiteId,
        generatedSiteUrl: demoWebsiteUrl || prospect.generatedSiteUrl,
        generatedReviewUrl: reviewServiceUrl || prospect.generatedReviewUrl,
        generatedEmail: {
          subject: primary.subject,
          body: primary.body,
          emailVersions: fallbackVersions,
          selectedVersion: "A",
        },
      });
    } finally { setLoadingEmail(false); }
  };

  const genEmail = () => genEmailWithOverrides();

  const handleGenerateInlineAsset = async (mode: "website" | "review") => {
    setError("");
    if (mode === "website") setGeneratingSiteInline(true);
    else setGeneratingReviewInline(true);
    try {
      let siteId = prospect.generatedSiteId;
      let websiteUrl = prospect.generatedSiteUrl;
      let reviewUrl = prospect.generatedReviewUrl;
      const isForceRegenerate =
        (mode === "website" && Boolean(prospect.generatedSiteUrl)) ||
        (mode === "review" && Boolean(prospect.generatedReviewUrl));
      const hasValidSlug = Boolean(siteId && !/^\d+$/.test(String(siteId)));
      if (!hasValidSlug || isForceRegenerate) {
        const assets = await generateInlineLeadAssets(prospect);
        siteId = assets.siteId;
        websiteUrl = assets.websiteUrl;
        reviewUrl = assets.reviewUrl;
      } else {
        const origin = window.location.origin;
        websiteUrl = `${origin}/site/${siteId}`;
        reviewUrl = `${origin}/review/${siteId}`;
      }
      const nextWebsiteUrl = mode === "website" ? websiteUrl : (prospect.generatedSiteUrl || websiteUrl);
      const nextReviewUrl = mode === "review" ? reviewUrl : (prospect.generatedReviewUrl || reviewUrl);
      await genEmailWithOverrides({
        siteId,
        websiteUrl: nextWebsiteUrl,
        reviewUrl: nextReviewUrl,
      });
    } catch (e: any) {
      setError(e?.message || "Could not generate preview link");
    } finally {
      setGeneratingSiteInline(false);
      setGeneratingReviewInline(false);
    }
  };

  const sendEmail = async () => {
    if (!prospect.email || !prospect.generatedEmail) return;
    setSendingEmail(true); setSendStatus(null);
    try {
      await callCRM("send-email", {
        to: prospect.email,
        subject: prospect.generatedEmail.subject,
        body: prospect.generatedEmail.body,
        prospectName: prospect.businessName,
        reportUrl: (prospect as any).reportUrl ?? undefined,
      });
      onUpdate({ ...prospect, status: "contacted", emailSentAt: new Date().toISOString() });
      setSendStatus({ type: "success", msg: `Email sent to ${prospect.email}` });
    } catch (e: any) {
      setSendStatus({ type: "error", msg: e.message });
    } finally { setSendingEmail(false); }
  };

  const genWA = async () => {
    setLoadingWA(true); setError("");
    try {
      const data = await callCRM("generate-whatsapp", {
        businessName: prospect.businessName, category: prospect.category,
        opportunities, agencyName: AGENCY_NAME,
      });
      onUpdate({ ...prospect, generatedWhatsApp: data.message });
    } catch {
      const firstOwner = prospect.ownerName ? prospect.ownerName.split(" ")[0] : "there";
      onUpdate({
        ...prospect,
        generatedWhatsApp: `Hi ${firstOwner}! 👋 I was checking out ${prospect.businessName}${prospect.city ? ` in ${prospect.city}` : ""} and put together a quick conversion & booking audit to help capture more local clients automatically. Mind if I share the link here?`,
      });
    } finally { setLoadingWA(false); }
  };

  const genLI = async () => {
    setLoadingLI(true); setError("");
    try {
      const data = await callCRM("generate-linkedin", {
        businessName: prospect.businessName, ownerName: prospect.ownerName,
        category: prospect.category, agencyName: AGENCY_NAME,
      });
      onUpdate({ ...prospect, generatedLinkedIn: data.message });
    } catch {
      const firstOwner = prospect.ownerName ? prospect.ownerName.split(" ")[0] : "there";
      onUpdate({
        ...prospect,
        generatedLinkedIn: `Hi ${firstOwner}, impressed by ${prospect.businessName}'s work${prospect.city ? ` in ${prospect.city}` : ""}. Would love to connect and share a quick growth idea for your ${prospect.category || "business"}!`,
      });
    } finally { setLoadingLI(false); }
  };

  const genFollowup = async () => {
    setLoadingFollowup(true); setError("");
    try {
      const data = await callCRM("generate-followup", {
        businessName: prospect.businessName, ownerName: prospect.ownerName,
        day: followupDay, agencyName: AGENCY_NAME,
        previousContext: `Sent cold email about custom software for their ${prospect.category} business`,
      });
      setFollowup(data);
    } catch {
      const firstOwner = prospect.ownerName ? prospect.ownerName.split(" ")[0] : `${prospect.businessName} Team`;
      setFollowup({
        subject: `Following up — quick idea for ${prospect.businessName}`,
        body: `Hi ${firstOwner},\n\nJust floating this back to the top of your inbox in case it got buried. Would you be open to a quick 5-minute look at the conversion blueprint we put together for ${prospect.businessName}?\n\nBest,\n${AGENCY_NAME}`,
      });
    } finally { setLoadingFollowup(false); }
  };

  return (
    <div className="space-y-5">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {sendStatus && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${sendStatus.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {sendStatus.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {sendStatus.msg}
        </div>
      )}

      {/* AI Agent / Pitch context banner */}
      {(prospect.aiAgentType || prospect.pitchType) && (() => {
        const agent = prospect.aiAgentType ? AGENT_META[prospect.aiAgentType] : null;
        const pitchLabel = prospect.pitchType === "ai_agent" ? "AI Agent pitch" : prospect.pitchType === "both" ? "AI Agent + Website pitch" : "Website pitch";
        return (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-start gap-3">
            <Bot className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <div className="font-bold text-violet-900">
                {agent ? `${agent.icon} ${agent.label}` : "AI Agent Opportunity"}
                <span className="ml-2 font-normal text-violet-600 text-xs border border-violet-200 bg-violet-100 rounded-full px-2 py-0.5">{pitchLabel}</span>
              </div>
              {prospect.aiAgentTopPain && (
                <p className="text-violet-800"><span className="font-semibold">Pain:</span> {prospect.aiAgentTopPain}</p>
              )}
              {prospect.aiAgentFitReason && (
                <p className="text-violet-700 text-xs">{prospect.aiAgentFitReason}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Cold Email — Clean & Portable to match WhatsApp / LinkedIn / Follow-up */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" /> Personalized Cold Email
              {prospect.emailSentAt && <span className="text-xs text-green-600 font-normal">✓ Sent {new Date(prospect.emailSentAt).toLocaleDateString()}</span>}
            </h4>
            {auditOfferRes.primaryOffer && (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-800 border border-slate-200 rounded-md px-2 py-0.5 font-medium max-w-full">
                <span className="shrink-0">Primary Offer:</span> <strong className="font-semibold truncate">{auditOfferRes.primaryOffer}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
            {auditOfferRes.showGenerateWebsite && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerateInlineAsset("website")}
                disabled={generatingSiteInline || loadingEmail}
                className="flex-1 sm:flex-initial h-8 sm:h-7 text-xs gap-1"
              >
                {generatingSiteInline ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                {prospect.generatedSiteUrl ? "Regenerate Website" : "Generate Website"}
              </Button>
            )}
            {auditOfferRes.showGenerateReview && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerateInlineAsset("review")}
                disabled={generatingReviewInline || loadingEmail}
                className="flex-1 sm:flex-initial h-8 sm:h-7 text-xs gap-1"
              >
                {generatingReviewInline ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3 text-amber-500" />}
                {prospect.generatedReviewUrl ? "Regenerate Review" : "Generate Review"}
              </Button>
            )}
            {prospect.generatedEmail && <CopyButton text={`Subject: ${prospect.generatedEmail.subject}\n\n${prospect.generatedEmail.body}`} />}
            <Button
              size="sm"
              onClick={genEmail}
              disabled={loadingEmail}
              className="w-full sm:w-auto h-8 sm:h-7 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              {loadingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {prospect.generatedEmail ? "Regenerate Cold Email" : "Generate Cold Email"}
            </Button>
            {prospect.generatedEmail && prospect.email && (
              <Button size="sm" onClick={sendEmail} disabled={sendingEmail}
                className="w-full sm:w-auto h-8 sm:h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-white font-semibold">
                {sendingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {sendingEmail ? "Sending…" : "Send Now"}
              </Button>
            )}
          </div>
        </div>
        {(prospect.generatedSiteUrl || prospect.generatedReviewUrl) && (
          <div className="px-4 py-2 border-b border-border/50 bg-slate-50 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-4 text-xs">
            {prospect.generatedSiteUrl && (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-700">Generated Website:</span>
                <a href={prospect.generatedSiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium break-all">
                  {prospect.generatedSiteUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
            {prospect.generatedReviewUrl && (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-700">Generated Review Service:</span>
                <a href={prospect.generatedReviewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium break-all">
                  {prospect.generatedReviewUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}
        {/* A/B/C version tabs — shown when multiple versions are available */}
        {!loadingEmail && prospect.generatedEmail?.emailVersions && prospect.generatedEmail.emailVersions.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50 bg-muted/10 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Variant:</span>
            {prospect.generatedEmail.emailVersions.map(v => (
              <button
                key={v.version}
                onClick={() => onUpdate({
                  ...prospect,
                  generatedEmail: {
                    ...prospect.generatedEmail!,
                    subject: v.subject,
                    body: v.body,
                    selectedVersion: v.version,
                  },
                })}
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border transition-colors ${
                  prospect.generatedEmail?.selectedVersion === v.version
                    ? "bg-primary text-white border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                }`}
              >
                {v.version}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">Pick the best variant before sending</span>
          </div>
        )}
        {loadingEmail ? <OutreachCopySkeleton label={`Crafting personalized cold email for ${prospect.businessName}…`} /> : prospect.generatedEmail ? (
          <div className="p-4 space-y-3">
            {prospect.email && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 break-all">
                Sending to: <span className="font-semibold text-foreground">{prospect.email}</span>
              </div>
            )}
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs font-bold text-muted-foreground mb-1">SUBJECT</div>
              <Input value={prospect.generatedEmail.subject}
                onChange={e => onUpdate({ ...prospect, generatedEmail: { ...prospect.generatedEmail!, subject: e.target.value } })}
                className="border-none bg-transparent p-0 font-semibold text-sm h-auto focus-visible:ring-0" />
            </div>
            <Textarea value={prospect.generatedEmail.body}
              onChange={e => onUpdate({ ...prospect, generatedEmail: { ...prospect.generatedEmail!, body: e.target.value } })}
              rows={7} className="text-sm" />
            {!prospect.email && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No email address for this prospect — add one to enable sending.
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a personalized cold email for <strong>{prospect.businessName}</strong>
            </p>
            <Button
              onClick={genEmail}
              disabled={loadingEmail}
              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold w-full sm:w-auto"
            >
              <Mail className="w-4 h-4" />
              Generate Cold Email
            </Button>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <h4 className="font-bold text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp Message</h4>
          <div className="flex gap-2">
            {prospect.generatedWhatsApp && <CopyButton text={prospect.generatedWhatsApp} />}
            <Button size="sm" variant="outline" onClick={genWA} disabled={loadingWA} className="h-7 text-xs gap-1">
              {loadingWA ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {prospect.generatedWhatsApp ? "Regenerate" : "Generate"}
            </Button>
            {prospect.generatedWhatsApp && prospect.phone && (
              <a
                href={`https://wa.me/${prospect.phone.replace(/\D/g, "")}?text=${encodeURIComponent(prospect.generatedWhatsApp!)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="w-3 h-3" /> Open WA
                </Button>
              </a>
            )}
          </div>
        </div>
        {loadingWA ? <OutreachCopySkeleton label="Writing high-response WhatsApp outreach message…" /> : prospect.generatedWhatsApp ? (
          <div className="p-4">
            <Textarea value={prospect.generatedWhatsApp}
              onChange={e => onUpdate({ ...prospect, generatedWhatsApp: e.target.value })} rows={5} className="text-sm" />
          </div>
        ) : <div className="p-6 text-center text-sm text-muted-foreground">Generate a short WhatsApp message</div>}
      </div>

      {/* LinkedIn */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <h4 className="font-bold text-sm flex items-center gap-2"><Linkedin className="w-4 h-4 text-blue-700" /> LinkedIn Message</h4>
          <div className="flex gap-2">
            {prospect.generatedLinkedIn && <CopyButton text={prospect.generatedLinkedIn} />}
            <Button size="sm" variant="outline" onClick={genLI} disabled={loadingLI} className="h-7 text-xs gap-1">
              {loadingLI ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {prospect.generatedLinkedIn ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
        {loadingLI ? <OutreachCopySkeleton label="Writing LinkedIn decision-maker connection note…" /> : prospect.generatedLinkedIn ? (
          <div className="p-4">
            <Textarea value={prospect.generatedLinkedIn}
              onChange={e => onUpdate({ ...prospect, generatedLinkedIn: e.target.value })} rows={3} className="text-sm" />
            <div className="text-xs text-muted-foreground mt-2">{prospect.generatedLinkedIn.length}/300 characters</div>
          </div>
        ) : <div className="p-6 text-center text-sm text-muted-foreground">Generate a 300-char LinkedIn connection request</div>}
      </div>

      {/* Follow-up */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <h4 className="font-bold text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-orange-600" /> Follow-up Generator</h4>
          <div className="flex items-center gap-2">
            <Select value={followupDay} onValueChange={setFollowupDay}>
              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Day 3</SelectItem>
                <SelectItem value="7">Day 7</SelectItem>
                <SelectItem value="14">Day 14</SelectItem>
                <SelectItem value="30">Day 30</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={genFollowup} disabled={loadingFollowup} className="h-7 text-xs gap-1">
              {loadingFollowup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate
            </Button>
            {followup && <CopyButton text={`Subject: ${followup.subject}\n\n${followup.body}`} />}
          </div>
        </div>
        {loadingFollowup ? <OutreachCopySkeleton label={`Writing Day ${followupDay} follow-up sequence…`} /> : followup ? (
          <div className="p-4 space-y-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs font-bold text-muted-foreground mb-1">SUBJECT</div>
              <div className="text-sm font-semibold">{followup.subject}</div>
            </div>
            <Textarea value={followup.body} onChange={e => setFollowup({ ...followup, body: e.target.value })} rows={6} className="text-sm" />
          </div>
        ) : <div className="p-6 text-center text-sm text-muted-foreground">Generate follow-ups for Day 3, 7, 14, or 30</div>}
      </div>
    </div>
  );
}

// ─── AI Studio Voice-Note Pitch & Outbound AI Machine Phone Caller Cockpit ──

const STUDIO_VOICES = [
  {
    id: "Kore",
    shortName: "👩🏼 Sarah (US Female)",
    label: "Sarah (Kore) — Warm US Female Executive · Upbeat",
    lang: "en-US",
    gender: "female",
    pitch: 1.2,
    rate: 1.04,
  },
  {
    id: "Charon",
    shortName: "🧔🏻‍♂️ Marcus (Deep Male)",
    label: "Marcus (Charon) — Deep Baritone Male Consultant · Authoritative",
    lang: "en-US",
    gender: "male",
    pitch: 0.68,
    rate: 0.88,
  },
  {
    id: "Puck",
    shortName: "👨🏻‍💻 Ryan (Fast Founder)",
    label: "Ryan (Puck) — Fast Silicon Valley Male Founder · Energetic",
    lang: "en-US",
    gender: "male",
    pitch: 1.05,
    rate: 1.15,
  },
  {
    id: "Zephyr",
    shortName: "🇬🇧 Victoria (UK Female)",
    label: "Victoria (Zephyr) — Crisp British UK Female Agency Director",
    lang: "en-GB",
    gender: "female",
    pitch: 1.14,
    rate: 0.98,
  },
  {
    id: "Fenrir",
    shortName: "🦅 Viktor (Bold Closer)",
    label: "Viktor (Fenrir) — Bold Wall Street Male Closer · Direct",
    lang: "en-US",
    gender: "male",
    pitch: 0.78,
    rate: 1.08,
  },
  {
    id: "Orus",
    shortName: "🌍 Tunde (Global Male)",
    label: "Tunde (Orus) — Warm Global / Nigerian Male Executive Advisor",
    lang: "en-NG",
    gender: "male",
    pitch: 0.85,
    rate: 0.94,
  },
];

function AIVoiceAndMachineCallerCockpit({
  prospect,
  onUpdate,
  enableVoiceNote,
  enableMachineCaller,
}: {
  prospect: Prospect;
  onUpdate: (p: Prospect) => void;
  enableVoiceNote: boolean;
  enableMachineCaller: boolean;
}) {
  const [selectedVoice, setSelectedVoice] = useState<string>(prospect.voicePitchVoiceName || "Kore");
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [speakingBrowser, setSpeakingBrowser] = useState(false);
  const [sendingVoiceEmail, setSendingVoiceEmail] = useState(false);
  const [placingCall, setPlacingCall] = useState(false);
  const [checkingCall, setCheckingCall] = useState(false);
  const [dialPhone, setDialPhone] = useState(prospect.phone || "");
  const [showKeyManager, setShowKeyManager] = useState(false);
  const [callerConfig, setCallerConfig] = useState<any>(null);
  const [newKeyProvider, setNewKeyProvider] = useState<"retell" | "bland" | "vapi">("bland");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyFromNumber, setNewKeyFromNumber] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setDialPhone(prospect.phone || "");
  }, [prospect.phone]);

  const loadCallerConfig = useCallback(async () => {
    try {
      const r = await authFetch("/api/crm/voice-caller/config");
      if (r.ok) {
        const d = await r.json();
        setCallerConfig(d.config || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (enableMachineCaller) loadCallerConfig();
  }, [enableMachineCaller, loadCallerConfig]);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingBrowser(false);
  }, []);

  const playWavUrl = useCallback(
    (wavUrl: string) => {
      stopSpeaking();
      const audio = new Audio(wavUrl);
      activeAudioRef.current = audio;
      setSpeakingBrowser(true);
      audio.onended = () => {
        setSpeakingBrowser(false);
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        setSpeakingBrowser(false);
        activeAudioRef.current = null;
      };
      audio.play().catch(() => {
        setSpeakingBrowser(false);
        activeAudioRef.current = null;
      });
    },
    [stopSpeaking]
  );

  const speakBrowserFallback = useCallback(
    (textToSpeak: string, voiceId: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      stopSpeaking();
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      const voices = window.speechSynthesis.getVoices();
      const voiceMeta = STUDIO_VOICES.find((v) => v.id === voiceId) || STUDIO_VOICES[0];

      const isFemale = voiceMeta.gender === "female";
      const femaleKeywords = ["Female", "Samantha", "Victoria", "Karen", "Zira", "Aria", "Jenny", "Google UK English Female", "Moira", "Tessa"];
      const maleKeywords = ["Male", "Daniel", "Alex", "David", "Guy", "Christopher", "Google UK English Male", "Aaron", "Fred", "Arthur"];
      const targetKeywords = isFemale ? femaleKeywords : maleKeywords;

      const matchedVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(voiceMeta.lang.toLowerCase()) &&
            targetKeywords.some((kw) => v.name.toLowerCase().includes(kw.toLowerCase()))
        ) ||
        voices.find((v) => targetKeywords.some((kw) => v.name.toLowerCase().includes(kw.toLowerCase()))) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(voiceMeta.lang.toLowerCase())) ||
        voices[STUDIO_VOICES.findIndex((v) => v.id === voiceId) % Math.max(1, voices.length)];

      if (matchedVoice) utter.voice = matchedVoice;
      utter.pitch = voiceMeta.pitch;
      utter.rate = voiceMeta.rate;
      setSpeakingBrowser(true);
      utter.onend = () => setSpeakingBrowser(false);
      utter.onerror = () => setSpeakingBrowser(false);
      window.speechSynthesis.speak(utter);
    },
    [stopSpeaking]
  );

  const generateStudioVoicePitch = async (
    overrideVoiceName?: string,
    autoPlayAfter = true,
    regenerateScriptForVoice = false
  ) => {
    const targetVoice = overrideVoiceName || selectedVoice;
    stopSpeaking();
    setGeneratingVoice(true);
    setFeedback(null);
    try {
      const data = await callCRM("generate-voice-pitch", {
        businessName: prospect.businessName,
        ownerName: prospect.ownerName,
        ownerRole: prospect.ownerRole,
        category: prospect.category,
        city: prospect.city,
        website: prospect.website,
        cmsPlatform: prospect.cmsPlatform,
        missingSignals: prospect.missingSignals,
        painPoint: prospect.painPoint,
        reportUrl: prospect.reportUrl || "",
        agencyName: AGENCY_NAME,
        voiceName: targetVoice,
        customScript: regenerateScriptForVoice ? "" : prospect.voicePitchScript || "",
        regenerateScriptForVoice,
      });
      onUpdate({
        ...prospect,
        voicePitchScript: data.script,
        voicePitchVoiceName: targetVoice,
        voicePitchWavBase64: data.wavBase64 || undefined,
        voicePitchWavDataUrl: data.wavDataUrl || undefined,
      });
      setFeedback({
        type: "ok",
        text: data.wavDataUrl
          ? `✓ Studio Voice Ready: ${data.voiceLabel || targetVoice} (${data.engine})`
          : `✓ Voice Script Ready (${data.voiceLabel || targetVoice}) — playing neural voice!`,
      });
      if (autoPlayAfter) {
        if (data.wavDataUrl) {
          playWavUrl(data.wavDataUrl);
        } else if (data.script) {
          speakBrowserFallback(data.script, targetVoice);
        }
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Failed to generate voice pitch" });
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleVoicePersonaChange = (nextVoice: string) => {
    setSelectedVoice(nextVoice);
    // Automatically synthesize & preview the newly selected persona so every voice sounds distinct immediately
    generateStudioVoicePitch(nextVoice, true, true);
  };

  const speakWithNeuralVoice = async () => {
    // If we already have a Studio WAV generated for THIS exact selectedVoice, play it immediately
    if (prospect.voicePitchWavDataUrl && prospect.voicePitchVoiceName === selectedVoice) {
      playWavUrl(prospect.voicePitchWavDataUrl);
      return;
    }
    // Otherwise synthesize the real Studio WAV for selectedVoice on the server and play it
    await generateStudioVoicePitch(selectedVoice, true, false);
  };

  const sendVoiceEmailToLead = async () => {
    if (!prospect.email) {
      setFeedback({ type: "err", text: "Add an email address for this prospect first." });
      return;
    }
    setSendingVoiceEmail(true);
    setFeedback(null);
    try {
      const resp = await callCRM("send-voice-email", {
        to: prospect.email,
        businessName: prospect.businessName,
        ownerName: prospect.ownerName,
        script: prospect.voicePitchScript,
        wavBase64: prospect.voicePitchWavBase64,
        reportUrl: prospect.reportUrl,
      });
      onUpdate({
        ...prospect,
        status: "contacted",
        emailSentAt: new Date().toISOString(),
      });
      setFeedback({
        type: "ok",
        text: `✓ AI Voice-Note (.wav) + Audit Link emailed to ${prospect.email} via ${resp.sentVia || "SMTP Pool"}!`,
      });
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Failed to send voice email" });
    } finally {
      setSendingVoiceEmail(false);
    }
  };

  const triggerOutboundMachineCall = async () => {
    if (!dialPhone.trim()) {
      setFeedback({ type: "err", text: "Enter the business's phone number to launch an AI Machine Call." });
      return;
    }
    setPlacingCall(true);
    setFeedback(null);
    try {
      const resp = await callCRM("voice-caller/call", {
        phone: dialPhone.trim(),
        businessName: prospect.businessName,
        ownerName: prospect.ownerName,
        ownerRole: prospect.ownerRole,
        category: prospect.category,
        city: prospect.city,
        website: prospect.website,
        cmsPlatform: prospect.cmsPlatform,
        missingSignals: prospect.missingSignals,
        painPoint: prospect.painPoint,
        reportUrl: prospect.reportUrl || "",
        customScript: prospect.voicePitchScript || "",
      });
      onUpdate({
        ...prospect,
        phone: dialPhone.trim(),
        status: "contacted",
        lastMachineCallId: resp.callId,
        lastMachineCallProvider: resp.provider,
        lastMachineCallStatus: resp.status || "ringing",
      });
      setFeedback({
        type: "ok",
        text: `📞 AI Machine Caller (${resp.provider.toUpperCase()}) is now ringing ${resp.calledNumber}! The AI voice agent will pitch ${prospect.businessName} automatically.`,
      });
      loadCallerConfig();
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Failed to launch AI machine call" });
    } finally {
      setPlacingCall(false);
    }
  };

  const checkLiveCallStatus = async () => {
    if (!prospect.lastMachineCallId) return;
    setCheckingCall(true);
    try {
      const r = await authFetch(`/api/crm/voice-caller/status/${encodeURIComponent(prospect.lastMachineCallId)}`);
      const d = await r.json();
      if (r.ok) {
        onUpdate({
          ...prospect,
          lastMachineCallStatus: d.status || prospect.lastMachineCallStatus,
          lastMachineCallTranscript: d.transcript || prospect.lastMachineCallTranscript,
          lastMachineCallRecordingUrl: d.recordingUrl || prospect.lastMachineCallRecordingUrl,
        });
        setFeedback({
          type: "ok",
          text: `Call Status: ${(d.status || "in-progress").toUpperCase()}${d.durationSeconds ? ` · Duration: ${d.durationSeconds}s` : ""}`,
        });
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message });
    } finally {
      setCheckingCall(false);
    }
  };

  const handleAddCallerKey = async () => {
    if (!newKeyValue.trim()) return;
    setSavingKey(true);
    try {
      const r = await authFetch("/api/crm/voice-caller/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newKey: {
            provider: newKeyProvider,
            label: newKeyLabel.trim() || `${newKeyProvider.toUpperCase()} Key`,
            apiKey: newKeyValue.trim(),
            fromNumber: newKeyFromNumber.trim(),
          },
        }),
      });
      const d = await r.json();
      if (d.config) setCallerConfig(d.config);
      setNewKeyValue("");
      setNewKeyLabel("");
      setFeedback({ type: "ok", text: `✓ Added ${newKeyProvider.toUpperCase()} API key to AI Machine Caller rotation pool!` });
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message });
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveCallerKey = async (id: string) => {
    const r = await authFetch("/api/crm/voice-caller/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeKeyId: id }),
    });
    const d = await r.json();
    if (d.config) setCallerConfig(d.config);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-white overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-indigo-950/70 to-slate-950 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-extrabold text-sm flex items-center gap-2 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            🎙️ AI Human Voice-Note Studio ($0 Free) &amp; 🤖 Outbound AI Machine Phone Caller
          </h4>
          <p className="text-xs text-slate-300 mt-0.5">
            Let realistic AI human voices pitch <strong>{prospect.businessName}</strong> for you—zero Nigerian SIM airtime required.
          </p>
        </div>
        {enableMachineCaller && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowKeyManager((v) => !v)}
            className="h-7 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700 gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            {showKeyManager ? "Hide Caller Key Pool" : `⚙️ AI Caller Pool (${callerConfig?.keys?.length || 0} Keys)`}
          </Button>
        )}
      </div>

      {feedback && (
        <div
          className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-semibold border ${
            feedback.type === "ok"
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              : "bg-rose-500/15 text-rose-300 border-rose-500/30"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Expandable Free-Credit Key Pool Manager (Bland AI / Retell AI / Vapi) */}
      {enableMachineCaller && showKeyManager && (
        <div className="m-4 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Free-Credit Outbound AI Phone Caller Key Pool (Multi-Account Rotation)
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Get free outbound AI phone calling credits from{" "}
                <a href="https://www.retellai.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">Retell.ai ($10 free)</a>,{" "}
                <a href="https://www.bland.ai" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">Bland.ai (Free Sandbox)</a>, or{" "}
                <a href="https://vapi.ai" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">Vapi.ai ($5 free)</a>. Paste unlimited keys below—the engine rotates across them automatically!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={newKeyProvider}
              onChange={(e) => setNewKeyProvider(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
            >
              <option value="bland">Bland.ai (No From-# Needed)</option>
              <option value="retell">Retell.ai ($10 Free Credits)</option>
              <option value="vapi">Vapi.ai ($5 Free Credits)</option>
            </select>
            <Input
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              placeholder="Account label (optional)"
              className="bg-slate-950 border-slate-700 text-white text-xs h-9"
            />
            <Input
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="Paste API Key (sk-... or org_...)"
              className="bg-slate-950 border-slate-700 text-white text-xs h-9"
            />
            <div className="flex gap-1.5">
              {newKeyProvider !== "bland" && (
                <Input
                  value={newKeyFromNumber}
                  onChange={(e) => setNewKeyFromNumber(e.target.value)}
                  placeholder="From # (+1...)"
                  className="bg-slate-950 border-slate-700 text-white text-xs h-9"
                />
              )}
              <Button
                size="sm"
                onClick={handleAddCallerKey}
                disabled={savingKey || !newKeyValue.trim()}
                className="h-9 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shrink-0"
              >
                + Add Key
              </Button>
            </div>
          </div>

          {callerConfig?.keys && callerConfig.keys.length > 0 && (
            <div className="space-y-1.5 pt-2">
              {callerConfig.keys.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold uppercase text-amber-300">{k.provider}</span>
                    <span className="text-slate-200">{k.label}</span>
                    <span className="font-mono text-slate-400">{k.apiKeyMasked}</span>
                    <span className="text-slate-400">· {k.callsMade || 0} calls placed</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCallerKey(k.id)}
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Column 1: 100% Free Forever Studio AI Voice-Note Pitch */}
        {enableVoiceNote && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  🎙️ 1. Studio AI Voice-Note Pitch ($0 Free Forever)
                </span>
                <select
                  value={selectedVoice}
                  onChange={(e) => handleVoicePersonaChange(e.target.value)}
                  disabled={generatingVoice}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {STUDIO_VOICES.map((v) => {
                  const isSelected = selectedVoice === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={generatingVoice}
                      onClick={() => handleVoicePersonaChange(v.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                          : "bg-slate-950 text-slate-300 border-slate-800 hover:border-emerald-500/50 hover:text-white"
                      }`}
                    >
                      {v.shortName}
                    </button>
                  );
                })}
              </div>

              <Textarea
                value={
                  prospect.voicePitchScript ||
                  `Hey ${prospect.ownerName ? prospect.ownerName.split(" ")[0] : `there at ${prospect.businessName}`}, Sarah here! I was just looking at ${prospect.businessName}${prospect.city ? ` in ${prospect.city}` : ""}${prospect.cmsPlatform ? ` built on ${prospect.cmsPlatform}` : ""}, and noticed your website currently has ${(prospect.missingSignals && prospect.missingSignals[0]) ? prospect.missingSignals[0].toLowerCase() : "no 24/7 AI live chat or instant booking widget"}—which usually causes 30 to 40 percent of after-hours customers to call a competitor instead. I just recorded a custom Website Audit Report showing how to fix this in 48 hours and sent the link to your email. Take a quick 60-second look!`
                }
                onChange={(e) => onUpdate({ ...prospect, voicePitchScript: e.target.value })}
                rows={4}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs leading-relaxed"
              />

              {prospect.voicePitchWavDataUrl && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                    <span>
                      🎧 Studio Human Voice Recording ({STUDIO_VOICES.find((v) => v.id === (prospect.voicePitchVoiceName || selectedVoice))?.shortName || selectedVoice})
                    </span>
                    <a
                      href={prospect.voicePitchWavDataUrl}
                      download={`Voice-Pitch-${(prospect.voicePitchVoiceName || selectedVoice)}-${prospect.businessName.replace(/[^a-zA-Z0-9]/g, "-")}.wav`}
                      className="text-amber-300 hover:underline"
                    >
                      📥 Download .WAV for WhatsApp
                    </a>
                  </div>
                  <audio key={prospect.voicePitchVoiceName || selectedVoice} controls src={prospect.voicePitchWavDataUrl} className="w-full h-8" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => generateStudioVoicePitch(selectedVoice, true, false)}
                disabled={generatingVoice}
                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
              >
                {generatingVoice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingVoice ? "Synthesizing Studio Voice…" : "🎙️ Generate Studio AI Voice (.WAV)"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={speakingBrowser ? stopSpeaking : speakWithNeuralVoice}
                className="h-8 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border-slate-700 gap-1.5"
              >
                {speakingBrowser ? <StopCircle className="w-3.5 h-3.5 text-rose-400" /> : <PlayCircle className="w-3.5 h-3.5 text-amber-400" />}
                {speakingBrowser ? "Stop Voice" : "🔊 Speak Out Loud Now"}
              </Button>

              {prospect.email && (
                <Button
                  size="sm"
                  onClick={sendVoiceEmailToLead}
                  disabled={sendingVoiceEmail}
                  className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                >
                  {sendingVoiceEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingVoiceEmail ? "Emailing Voice Note…" : "✉ Email Voice Note to Lead"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Column 2: Outbound AI Machine Phone Caller (Rings Their Actual Business Phone) */}
        {enableMachineCaller && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  🤖 2. Outbound AI Machine Phone Caller (Hands-Free)
                </span>
                {prospect.lastMachineCallStatus && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Status: {prospect.lastMachineCallStatus}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Dials <strong>{prospect.businessName}</strong> from the cloud using your connected AI Caller Pool (Bland / Retell / Vapi). When they pick up, the <strong>AI Voice Machine</strong> speaks the script on the left, answers questions about your audit report, and saves the call transcript here.
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">
                  Business Phone Number to Ring (E.164 or Local Format)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={dialPhone}
                    onChange={(e) => setDialPhone(e.target.value)}
                    placeholder="+1 (512) 555-0199"
                    className="bg-slate-950 border-slate-700 text-white text-xs h-9 font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={triggerOutboundMachineCall}
                    disabled={placingCall}
                    className="h-9 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs gap-1.5 shrink-0"
                  >
                    {placingCall ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                    {placingCall ? "Dialing…" : "🤖 Launch AI Machine Call"}
                  </Button>
                </div>
              </div>

              {prospect.lastMachineCallTranscript && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 max-h-32 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase text-amber-400">Live AI Machine Call Transcript</div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">{prospect.lastMachineCallTranscript}</p>
                </div>
              )}

              {prospect.lastMachineCallRecordingUrl && (
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Call Recording</div>
                  <audio controls src={prospect.lastMachineCallRecordingUrl} className="w-full h-8" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] text-slate-400">
                {callerConfig?.keys?.length > 0
                  ? `✓ ${callerConfig.keys.length} AI Caller Key(s) active in rotation pool`
                  : "💡 Click '⚙️ AI Caller Pool' above to paste a free Retell/Bland/Vapi key"}
              </div>
              {prospect.lastMachineCallId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkLiveCallStatus}
                  disabled={checkingCall}
                  className="h-7 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-white border-slate-700 gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingCall ? "animate-spin" : ""}`} />
                  Refresh Call Transcript
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Proposal Panel ───────────────────────────────────────────────────────────

function ProposalPanel({ prospect, onUpdate }: { prospect: Prospect; onUpdate: (p: Prospect) => void }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [error, setError] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customDuration, setCustomDuration] = useState("");

  const sendProposal = async () => {
    if (!prospect.email || !prospect.proposal) return;
    setSending(true); setSendStatus(null);
    try {
      // Protected route — must go through callCRM() for the bearer token / 401 handling.
      await callCRM("send-proposal-email", { to: prospect.email, prospectName: prospect.businessName, proposal: prospect.proposal, agencyName: AGENCY_NAME });
      onUpdate({ ...prospect, status: "proposal_sent" });
      setSendStatus({ type: "success", msg: `HTML proposal sent to ${prospect.email}` });
    } catch (e: any) { setSendStatus({ type: "error", msg: e.message }); }
    finally { setSending(false); }
  };

  const generate = async () => {
    setLoading(true); setError("");
    const a = prospect.analysis;
    const fallbackProposal: ProposalData = {
      sections: {
        executiveSummary: `${AGENCY_NAME} has prepared this turnkey digital conversion and automation proposal for ${prospect.businessName} to capture more high-intent ${prospect.category || "local"} customers and automate 24/7 lead response.`,
        situation: prospect.website
          ? `${prospect.businessName} currently operates ${prospect.website}, which lacks an interactive mobile booking funnel and 24/7 automated receptionist.`
          : `${prospect.businessName} currently lacks a dedicated high-converting website and automated 24/7 booking funnel.`,
        problems: [
          "Prospective mobile customers face friction when trying to request pricing or book an appointment.",
          "After-hours and peak-hour inquiries go unanswered without an automated 24/7 AI receptionist.",
          "Satisfied customers are not systematically routed into a 5-Star Google Review Shield.",
        ],
        solution: `${AGENCY_NAME} will deploy a custom 4-Tap Conversion Website, 24/7 Spoken AI Receptionist, and 5-Star Review Shield tailored for ${prospect.businessName}.`,
        features: [
          { name: "4-Tap Instant Quote & Booking Funnel", desc: "Converts mobile visitors into qualified leads in under 15 seconds without long forms." },
          { name: "24/7 Spoken AI Receptionist", desc: "Greets visitors with a natural studio voice, answers FAQs, and captures phone numbers." },
          { name: "5-Star Review Shield", desc: "Routes 4–5 star ratings to Google Maps while privately intercepting 1–3 star feedback." },
        ],
        benefits: [
          "25–40% lift in mobile lead conversion",
          "Zero missed after-hours inquiries",
          "Faster response times and higher booked-job volume",
          "Protected 5-star Google Maps reputation",
          "Full ownership and easy 1-click admin customization",
        ],
        timeline: [
          { week: customDuration.trim() ? customDuration.trim() : "Days 1–3", task: "Custom brand design, local copy, and 4-tap funnel configuration" },
          { week: "Days 4–7", task: "24/7 AI receptionist training, domain connection, and live launch" },
        ],
        investment: customPrice.trim() || (a?.estimatedValue?.min ? `$${a.estimatedValue.min.toLocaleString()} – $${a.estimatedValue.max.toLocaleString()}` : "$1,500 Turnkey Setup"),
        whyUs: [
          `Specialized in high-converting ${prospect.category || "local service"} digital systems`,
          "Rapid 5-to-7 day turnkey deployment with zero downtime",
          "Proven 4-tap mobile funnel architecture",
        ],
        nextSteps: [
          "Approve this proposal and select your preferred launch date",
          "We configure your custom site, AI receptionist, and domain",
          "Go live and start capturing new customer inquiries immediately",
        ],
      },
    };
    try {
      const data = await callCRM("generate-proposal", {
        businessName: prospect.businessName, category: prospect.category,
        website: prospect.website, agencyName: AGENCY_NAME,
        issues: (a?.issues || []).map(i => i.title).join(", ") || "",
        features: (a?.recommendedFeatures || []).join(", ") || "",
        estimatedValue: a?.estimatedValue?.min ? `${a.estimatedValue.min.toLocaleString()} – ${a.estimatedValue.max.toLocaleString()}` : "",
        customPrice: customPrice.trim() || undefined,
        customDuration: customDuration.trim() || undefined,
      });
      onUpdate({ ...prospect, proposal: data?.sections ? data : fallbackProposal });
    } catch {
      onUpdate({ ...prospect, proposal: fallbackProposal });
    } finally { setLoading(false); }
  };

  const p = prospect.proposal?.sections;
  if (loading) return <ProposalGenerationSkeleton businessName={prospect.businessName} />;

  if (!p) return (
    <div className="text-center py-12">
      <Download className="w-12 h-12 mx-auto mb-4 text-primary/30" />
      <h3 className="font-bold text-lg mb-2">AI Proposal Generator</h3>
      <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
        Generate a full professional proposal for {prospect.businessName}.
      </p>
      {!prospect.analysis && <p className="text-amber-600 text-xs mb-4">Tip: Run Website Analysis first for a more accurate proposal.</p>}
      <div className="max-w-xs mx-auto grid grid-cols-2 gap-2 mb-4 text-left">
        <div>
          <label className="text-xs text-muted-foreground">Price (optional)</label>
          <Input value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="e.g. $800" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Duration (optional)</label>
          <Input value={customDuration} onChange={e => setCustomDuration(e.target.value)} placeholder="e.g. 1 week" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
        Leave blank to let the AI estimate price and timeline instead.
      </p>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <Button onClick={generate} className="gap-2 btn-premium text-white font-bold">
        <Sparkles className="w-4 h-4" /> Generate Proposal
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {sendStatus && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${sendStatus.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {sendStatus.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {sendStatus.msg}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-lg">Proposal — {prospect.businessName}</h3>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground">Price</label>
            <Input value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="AI estimate" className="h-8 w-28 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration</label>
            <Input value={customDuration} onChange={e => setCustomDuration(e.target.value)} placeholder="AI estimate" className="h-8 w-28 text-sm" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={generate} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Print/PDF</Button>
          {prospect.email && (
            <Button size="sm" onClick={sendProposal} disabled={sending} className="gap-1.5 bg-primary text-white">
              {sending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Mail className="w-3.5 h-3.5" /> Email Proposal</>}
            </Button>
          )}
        </div>
      </div>

      {[
        { title: "Executive Summary", content: <p className="text-sm leading-relaxed">{p.executiveSummary}</p> },
        { title: "Current Digital Situation", content: <p className="text-sm leading-relaxed">{p.situation}</p> },
        { title: "Problems We Found", content: <ul className="space-y-2">{p.problems.map((pb, i) => <li key={i} className="flex items-start gap-2 text-sm"><AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />{pb}</li>)}</ul> },
        { title: "Our Recommended Solution", content: <p className="text-sm leading-relaxed">{p.solution}</p> },
        { title: "Key Features", content: <div className="grid sm:grid-cols-2 gap-2">{p.features.map((f, i) => <div key={i} className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /><div><div className="text-sm font-semibold">{f.name}</div><div className="text-xs text-muted-foreground">{f.desc}</div></div></div>)}</div> },
        { title: "Business Benefits", content: <ul className="space-y-2">{p.benefits.map((b, i) => <li key={i} className="flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-green-600 flex-shrink-0" />{b}</li>)}</ul> },
        { title: "Delivery Timeline", content: <div className="space-y-2">
          {(p as any).timelineSummary && <p className="text-xs font-semibold text-primary mb-1">{(p as any).timelineSummary}</p>}
          {p.timeline.map((t, i) => <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"><div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded flex-shrink-0">{t.week}</div><div className="text-sm">{t.task}</div></div>)}
        </div> },
        { title: "Investment", content: <p className="text-sm leading-relaxed">{p.investment}</p> },
        { title: "Why Choose DevStudio", content: <ul className="space-y-2">{p.whyUs.map((w, i) => <li key={i} className="flex items-start gap-2 text-sm"><Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />{w}</li>)}</ul> },
        { title: "Next Steps", content: <div className="space-y-2">{p.nextSteps.map((s, i) => <div key={i} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"><div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div><div className="text-sm">{s}</div></div>)}</div> },
      ].map(section => (
        <div key={section.title} className="rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 bg-muted/20 border-b border-border/50">
            <h4 className="font-bold text-sm">{section.title}</h4>
          </div>
          <div className="p-4">{section.content}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Prospect Detail ──────────────────────────────────────────────────────────

function ProspectDetail({ prospect, onUpdate, onDelete, onBack }: {
  prospect: Prospect;
  onUpdate: (p: Prospect) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deepScanning, setDeepScanning] = useState(false);
  const [detailTab, setDetailTab] = useState("analysis");
  const apolloCfg = useApolloConfig();
  const trainedOffer = useTrainedOfferSummary();
  const cfg = STATUS_CONFIG[prospect.status];
  const offerRes = resolveAuditMatchedOffer(prospect, trainedOffer);

  const runLiveApolloScan = async () => {
    setDeepScanning(true);
    try {
      const data = await callCRM("apollo-enrich", {
        website: prospect.website,
        businessName: prospect.businessName,
        category: prospect.category,
        email: prospect.email,
        phone: prospect.phone,
      });
      onUpdate({
        ...prospect,
        ownerName: data.ownerName || prospect.ownerName,
        ownerRole: data.ownerRole || prospect.ownerRole,
        linkedin: data.linkedin || prospect.linkedin,
        facebook: data.facebook || prospect.facebook,
        instagram: data.instagram || prospect.instagram,
        cmsPlatform: data.cmsPlatform || prospect.cmsPlatform,
        techStack: Array.isArray(data.techStack) ? data.techStack : prospect.techStack,
        missingSignals: Array.isArray(data.missingSignals) ? data.missingSignals : prospect.missingSignals,
        buyerIntentScore: data.buyerIntentScore ?? prospect.buyerIntentScore,
        intentTier: data.intentTier || prospect.intentTier,
        intentReasons: Array.isArray(data.intentReasons) ? data.intentReasons : prospect.intentReasons,
      });
    } catch {}
    finally { setDeepScanning(false); }
  };

  const linkedinXrayUrl = prospect.linkedin || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${prospect.ownerName || ""} ${prospect.businessName} ${prospect.city || ""}`.trim())}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 shrink-0 px-2 sm:px-3">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-lg sm:text-xl flex items-center gap-2 flex-wrap break-words">
              <span>{prospect.businessName}</span>
              {prospect.hunted && <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Radar className="w-3 h-3" /> AI Hunted</span>}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-xs`}>{cfg.label}</Badge>
              {offerRes.primaryOffer && (
                <span className="text-xs bg-slate-100 text-slate-800 border border-slate-200 rounded-md px-2 py-0.5 font-medium">
                  Primary Offer: <strong className="font-semibold">{offerRes.primaryOffer}</strong>
                </span>
              )}
              {prospect.category && <span className="text-xs text-muted-foreground">{prospect.category}</span>}
              {prospect.city && <span className="text-xs text-muted-foreground">{prospect.city}{prospect.country ? `, ${prospect.country}` : ""}</span>}
              {prospect.priority === "high" && <span className="text-xs font-bold text-red-600">🔴 High Priority</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            onClick={() => setDetailTab("outreach")}
            className="flex-1 sm:flex-initial gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Mail className="w-3.5 h-3.5" />
            {prospect.generatedEmail ? "View Cold Email" : "Generate Cold Email"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Website", value: prospect.website, href: prospect.website, icon: <Globe className="w-3.5 h-3.5" /> },
          { label: "Email", value: prospect.email, href: `mailto:${prospect.email}`, icon: <Mail className="w-3.5 h-3.5" /> },
          { label: "Phone", value: prospect.phone, href: `tel:${prospect.phone}`, icon: <Phone className="w-3.5 h-3.5" /> },
          { label: "Expected Value", value: prospect.expectedValue ? `$${prospect.expectedValue.toLocaleString()}` : "—", icon: <Target className="w-3.5 h-3.5" /> },
        ].map(item => item.value ? (
          <div key={item.label} className="rounded-xl border border-border/50 p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">{item.icon}{item.label}</div>
            {item.href && item.value ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline truncate block">{item.value}</a>
            ) : <div className="text-sm font-semibold truncate">{item.value}</div>}
          </div>
        ) : null)}
      </div>

      {/* Apollo+ Live B2B Intelligence & Deep Enrichment Card */}
      {apolloCfg.enabled && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 text-white p-4 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Live Lead Intelligence
              </span>
              {apolloCfg.intentScoring && typeof prospect.buyerIntentScore === "number" && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                  prospect.buyerIntentScore >= 75
                    ? "bg-orange-500 text-white"
                    : prospect.buyerIntentScore >= 55
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}>
                  🔥 {prospect.buyerIntentScore}/100 Buyer Intent ({(prospect.intentTier || "warm").toUpperCase()})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {apolloCfg.decisionMaker && (
                <a
                  href={linkedinXrayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  {prospect.linkedin ? "Open Verified LinkedIn" : "LinkedIn Owner X-Ray"}
                </a>
              )}
              <Button
                size="sm"
                onClick={runLiveApolloScan}
                disabled={deepScanning}
                className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
              >
                {deepScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {deepScanning ? "Scanning Live HTML…" : "⚡ Run Live Deep Scan"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {apolloCfg.decisionMaker && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Decision-Maker & Socials</div>
                <div className="text-sm font-bold text-white">
                  {prospect.ownerName || "Owner / Managing Director"}
                </div>
                <div className="text-xs text-amber-300 font-semibold mt-0.5">
                  {prospect.ownerRole || "Executive Decision-Maker"}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {prospect.facebook && (
                    <a href={prospect.facebook} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline">Facebook ↗</a>
                  )}
                  {prospect.instagram && (
                    <a href={prospect.instagram} target="_blank" rel="noopener noreferrer" className="text-[11px] text-pink-400 hover:underline">Instagram ↗</a>
                  )}
                </div>
              </div>
            )}

            {apolloCfg.techStack && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Detected CMS & Tech Stack</div>
                <div className="text-sm font-bold text-white mb-1.5">
                  🖥️ {prospect.cmsPlatform || (prospect.website ? "Click Deep Scan to Detect" : "No Website")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(prospect.techStack && prospect.techStack.length > 0) ? (
                    prospect.techStack.map((t, idx) => (
                      <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No active marketing/chat scripts detected</span>
                  )}
                </div>
              </div>
            )}

            {apolloCfg.techStack && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">Missing Revenue Signals (Pitch Angles)</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(prospect.missingSignals && prospect.missingSignals.length > 0) ? (
                    prospect.missingSignals.map((m, idx) => (
                      <span key={idx} className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        ⚠️ {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Run Deep Scan to uncover missing chat, booking, or ad pixels</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Pipeline Status</label>
          <Select value={prospect.status} onValueChange={v => onUpdate({ ...prospect, status: v as LeadStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {prospect.nextFollowUp && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Next Follow-up</label>
            <div className="flex items-center gap-2 p-2 border border-border/50 rounded-lg text-sm">
              <Clock className="w-4 h-4 text-orange-500" />
              {new Date(prospect.nextFollowUp).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {prospect.painPoint && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="text-xs font-bold text-purple-800 mb-1">AI IDENTIFIED PAIN POINT</div>
          <p className="text-sm text-purple-900">{prospect.painPoint}</p>
        </div>
      )}

      {prospect.notes && (
        <div className="rounded-xl border border-border/50 p-4">
          <div className="text-xs font-bold text-muted-foreground mb-2">NOTES</div>
          <p className="text-sm leading-relaxed">{prospect.notes}</p>
        </div>
      )}

      <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="analysis" className="flex-1 text-xs sm:text-sm">AI Analysis</TabsTrigger>
          <TabsTrigger value="outreach" className="flex-1 text-xs sm:text-sm gap-1">
            <Mail className="w-3.5 h-3.5" /> Outreach
          </TabsTrigger>
          <TabsTrigger value="proposal" className="flex-1 text-xs sm:text-sm">Proposal</TabsTrigger>
          <TabsTrigger value="tracking" className="flex-1 text-xs sm:text-sm gap-1"><Eye className="w-3.5 h-3.5" />Tracking</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis" className="mt-4"><AnalysisPanel prospect={prospect} onUpdate={onUpdate} /></TabsContent>
        <TabsContent value="outreach" className="mt-4"><OutreachPanel prospect={prospect} onUpdate={onUpdate} /></TabsContent>
        <TabsContent value="proposal" className="mt-4"><ProposalPanel prospect={prospect} onUpdate={onUpdate} /></TabsContent>
        <TabsContent value="tracking" className="mt-4"><TrackingPanel prospect={prospect} /></TabsContent>
      </Tabs>

      {editing && <AddProspectDialog onAdd={p => { onUpdate({ ...prospect, ...p }); setEditing(false); }} editData={prospect} onClose={() => setEditing(false)} />}
    </div>
  );
}

// ─── Email Tracking Panel ─────────────────────────────────────────────────────

interface TrackingEvent {
  trackingId: string;
  subject: string;
  emailType: string;
  opens: number;
  clicks: number;
  firstOpenAt: string | null;
  lastOpenAt: string | null;
  firstClickAt: string | null;
  sentAt: string;
}

function TrackingPanel({ prospect }: { prospect: Prospect }) {
  const [history, setHistory] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prospect.email) { setLoading(false); return; }
    fetch(`${apiBase()}/api/crm/track/history/${encodeURIComponent(prospect.email)}`)
      .then(r => r.json())
      .then(d => { setHistory(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [prospect.email]);

  if (loading) return <LoadingSpinner text="Loading tracking data…" />;
  if (!prospect.email) return (
    <div className="text-center py-10 text-sm text-muted-foreground">No email address for this prospect.</div>
  );

  const totalOpens = history.reduce((a, h) => a + h.opens, 0);
  const totalClicks = history.reduce((a, h) => a + h.clicks, 0);

  if (history.length === 0) return (
    <div className="text-center py-12">
      <Eye className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <h3 className="font-semibold text-base mb-1">No emails sent yet</h3>
      <p className="text-sm text-muted-foreground">Once you send an outreach or proposal email, open & click tracking will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Emails Sent", value: history.length, color: "text-foreground" },
          { label: "Total Opens", value: totalOpens, color: totalOpens > 0 ? "text-green-600" : "text-muted-foreground" },
          { label: "Link Clicks", value: totalClicks, color: totalClicks > 0 ? "text-orange-600" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/50 p-4 text-center">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {history.map((h, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{h.subject}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Sent {new Date(h.sentAt).toLocaleDateString()} · {h.emailType === "proposal" ? "📄 Proposal" : "✉ Outreach"}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {h.opens > 0 ? (
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {h.opens} open{h.opens !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">Not opened</span>
                )}
                {h.clicks > 0 && (
                  <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                    🔗 {h.clicks} click{h.clicks !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {h.firstOpenAt && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="w-3 h-3 text-green-600" />
                First opened: {new Date(h.firstOpenAt).toLocaleString()}
                {h.lastOpenAt && h.lastOpenAt !== h.firstOpenAt && (
                  <> · Last: {new Date(h.lastOpenAt).toLocaleString()}</>
                )}
              </div>
            )}
            {h.firstClickAt && (
              <div className="text-xs text-muted-foreground">
                🔗 First clicked: {new Date(h.firstClickAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Prospect List ────────────────────────────────────────────────────────────

interface TrackingStats {
  opens: number;
  clicks: number;
  firstOpenAt: string | null;
  lastOpenAt: string | null;
  firstClickAt: string | null;
  count: number;
}

/** Clamp any value to a finite number in [0, 100]. */
function safe(n: unknown): number {
  const v = Number(n);
  return isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
}

/** Composite AI opportunity score — blends website lead quality + AI agent fit.
 *  Analysed prospects: website signals (70%) + AI agent score bonus (30%).
 *  Unanalysed prospects: best of aiAgentScore / probability, capped at 49 so
 *  any fully-analysed lead with score ≥ 50 ranks above all unanalysed ones.
 */
function aiOpportunityScore(p: Prospect): number {
  if (p.analysis) {
    const websiteSignal = safe(p.analysis.leadScore) * 0.5 + safe(p.analysis.growthPotential) * 0.2;
    const agentSignal   = safe(p.aiAgentScore) * 0.3;
    return Math.min(100, websiteSignal + agentSignal);
  }
  const fallback = Math.max(safe(p.aiAgentScore ?? 0), safe(p.probability));
  return Math.min(49, fallback);
}

const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  receptionist: { label: "AI Receptionist", icon: "🤖", color: "bg-violet-50 text-violet-700 border-violet-200" },
  booking:      { label: "Booking Bot",     icon: "📅", color: "bg-blue-50 text-blue-700 border-blue-200" },
  sales:        { label: "Sales Bot",       icon: "💰", color: "bg-green-50 text-green-700 border-green-200" },
  support:      { label: "Support Bot",     icon: "🎧", color: "bg-orange-50 text-orange-700 border-orange-200" },
  social:       { label: "Social Bot",      icon: "📱", color: "bg-pink-50 text-pink-700 border-pink-200" },
};

type SortKey = "ai-score" | "apollo-intent" | "value" | "added";

function ProspectList({
  prospects,
  onSelect,
  onDelete,
  onUpdate,
  projects,
  activeProjectName,
}: {
  prospects: Prospect[];
  onSelect: (p: Prospect) => void;
  onDelete: (id: number) => void;
  onUpdate?: (p: Prospect) => void;
  projects?: LeadProject[];
  activeProjectName?: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [apolloQuickFilter, setApolloQuickFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("ai-score");
  const [trackingStats, setTrackingStats] = useState<Record<string, TrackingStats>>({});
  const [openEmailIds, setOpenEmailIds] = useState<Record<number, boolean>>({});
  const [loadingEmailIds, setLoadingEmailIds] = useState<Record<number, boolean>>({});
  const [loadingSiteIds, setLoadingSiteIds] = useState<Record<number, boolean>>({});
  const [loadingReviewIds, setLoadingReviewIds] = useState<Record<number, boolean>>({});
  const [sendingEmailIds, setSendingEmailIds] = useState<Record<number, boolean>>({});
  const apolloCfg = useApolloConfig();
  const trainedOffer = useTrainedOfferSummary();

  const generateInlineEmailForProspect = async (
    p: Prospect,
    overrides?: { websiteUrl?: string; reviewUrl?: string; siteId?: string }
  ) => {
    if (!onUpdate) {
      onSelect(p);
      return;
    }
    const offerRes = resolveAuditMatchedOffer(p, trainedOffer);
    const effectiveLeadOffer = offerRes.primaryOffer || p.primaryOffer || trainedOffer.primaryOfferName;
    const demoWebsiteUrl = overrides?.websiteUrl ?? p.generatedSiteUrl ?? "";
    const reviewServiceUrl = overrides?.reviewUrl ?? p.generatedReviewUrl ?? "";
    const nextSiteId = overrides?.siteId ?? p.generatedSiteId;

    setLoadingEmailIds(prev => ({ ...prev, [p.id]: true }));
    setOpenEmailIds(prev => ({ ...prev, [p.id]: true }));
    try {
      const data = await callCRM("generate-email", {
        businessName: p.businessName,
        ownerName: p.ownerName,
        ownerRole: p.ownerRole,
        category: p.category,
        website: p.website,
        city: p.city,
        cmsPlatform: p.cmsPlatform,
        missingSignals: p.missingSignals,
        issues: p.painPoint || "",
        opportunities: trainedOffer.offerDetails,
        agencyName: AGENCY_NAME,
        reportUrl: p.reportUrl || "",
        primaryOffer: effectiveLeadOffer,
        demoWebsiteUrl,
        reviewServiceUrl,
      });
      const versions = Array.isArray(data?.versions) && data.versions.length > 0 ? data.versions : [];
      const first = versions[0] || {
        version: "A",
        subject: data?.subject || `Quick idea for ${p.businessName} — ${effectiveLeadOffer}`,
        body: data?.body || `Hi ${p.ownerName || `${p.businessName} Team`},\n\nI was looking at ${p.businessName}${p.city ? ` in ${p.city}` : ""} today and noticed an opportunity around ${effectiveLeadOffer} to help you capture more local clients.${demoWebsiteUrl ? `\n\n• Live Website Preview: ${demoWebsiteUrl}` : ""}${reviewServiceUrl ? `\n• 5-Star Review Page: ${reviewServiceUrl}` : ""}\n\nWould you be open to taking a quick look?\n\nBest regards,\n${AGENCY_NAME}`,
      };
      onUpdate({
        ...p,
        primaryOffer: effectiveLeadOffer,
        generatedSiteId: nextSiteId,
        generatedSiteUrl: demoWebsiteUrl || p.generatedSiteUrl,
        generatedReviewUrl: reviewServiceUrl || p.generatedReviewUrl,
        generatedEmail: {
          subject: first.subject,
          body: first.body,
          emailVersions: versions.length > 0 ? versions : [first],
          selectedVersion: first.version || "A",
        },
      });
    } catch {
      const fallbackBody = `Hi ${p.ownerName || `${p.businessName} Team`},\n\nI was looking at ${p.businessName}${p.city ? ` in ${p.city}` : ""} today and put together a tailored ${effectiveLeadOffer} breakdown to help turn more local searches into booked clients.${demoWebsiteUrl ? `\n\n• Live Website Preview: ${demoWebsiteUrl}` : ""}${reviewServiceUrl ? `\n• 5-Star Review Page: ${reviewServiceUrl}` : ""}\n\nWould you be open to a quick walkthrough this week?\n\nBest regards,\n${AGENCY_NAME}`;
      onUpdate({
        ...p,
        primaryOffer: effectiveLeadOffer,
        generatedSiteId: nextSiteId,
        generatedSiteUrl: demoWebsiteUrl || p.generatedSiteUrl,
        generatedReviewUrl: reviewServiceUrl || p.generatedReviewUrl,
        generatedEmail: {
          subject: `Quick idea for ${p.businessName} — ${effectiveLeadOffer}`,
          body: fallbackBody,
        },
      });
    } finally {
      setLoadingEmailIds(prev => ({ ...prev, [p.id]: false }));
    }
  };

  const generateInlineAssetForProspect = async (p: Prospect, mode: "website" | "review") => {
    if (!onUpdate) {
      onSelect(p);
      return;
    }
    if (mode === "website") setLoadingSiteIds(prev => ({ ...prev, [p.id]: true }));
    else setLoadingReviewIds(prev => ({ ...prev, [p.id]: true }));
    setOpenEmailIds(prev => ({ ...prev, [p.id]: true }));
    try {
      let siteId = p.generatedSiteId;
      let websiteUrl = p.generatedSiteUrl;
      let reviewUrl = p.generatedReviewUrl;
      const isForceRegenerate =
        (mode === "website" && Boolean(p.generatedSiteUrl)) ||
        (mode === "review" && Boolean(p.generatedReviewUrl));
      const hasValidSlug = Boolean(siteId && !/^\d+$/.test(String(siteId)));
      if (!hasValidSlug || isForceRegenerate) {
        const assets = await generateInlineLeadAssets(p);
        siteId = assets.siteId;
        websiteUrl = assets.websiteUrl;
        reviewUrl = assets.reviewUrl;
      } else {
        const origin = window.location.origin;
        websiteUrl = `${origin}/site/${siteId}`;
        reviewUrl = `${origin}/review/${siteId}`;
      }
      await generateInlineEmailForProspect(p, {
        siteId,
        websiteUrl: mode === "website" ? websiteUrl : (p.generatedSiteUrl || websiteUrl),
        reviewUrl: mode === "review" ? reviewUrl : (p.generatedReviewUrl || reviewUrl),
      });
    } catch {
      // ignore
    } finally {
      setLoadingSiteIds(prev => ({ ...prev, [p.id]: false }));
      setLoadingReviewIds(prev => ({ ...prev, [p.id]: false }));
    }
  };

  const sendInlineEmailForProspect = async (p: Prospect) => {
    if (!p.email || !p.generatedEmail || !onUpdate) return;
    setSendingEmailIds(prev => ({ ...prev, [p.id]: true }));
    try {
      await callCRM("send-email", {
        to: p.email,
        subject: p.generatedEmail.subject,
        body: p.generatedEmail.body,
        prospectName: p.businessName,
        reportUrl: p.reportUrl || undefined,
      });
      onUpdate({ ...p, status: "contacted", emailSentAt: new Date().toISOString() });
    } catch {
      // ignore
    } finally {
      setSendingEmailIds(prev => ({ ...prev, [p.id]: false }));
    }
  };

  useEffect(() => {
    const emailedEmails = prospects.filter(p => p.emailSentAt && p.email).map(p => p.email);
    if (emailedEmails.length === 0) return;
    fetch(`${apiBase()}/api/crm/track/stats?emails=${encodeURIComponent(emailedEmails.join(","))}`)
      .then(r => r.json())
      .then(d => { if (d && typeof d === "object") setTrackingStats(d); })
      .catch(() => {});
  }, [prospects]);

  const filtered = prospects
    .filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.businessName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.ownerName || "").toLowerCase().includes(q) || (p.cmsPlatform || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      if (!matchSearch || !matchStatus || !matchCat) return false;
      if (apolloCfg.enabled && apolloQuickFilter !== "all") {
        if (apolloQuickFilter === "hot_intent" && (p.buyerIntentScore ?? 0) < 75) return false;
        if (apolloQuickFilter === "warm_signal" && !(p.email && (trackingStats[p.email]?.opens > 0 || trackingStats[p.email]?.clicks > 0))) return false;
        if (apolloQuickFilter === "has_owner" && !p.ownerName && !p.linkedin) return false;
        if (apolloQuickFilter === "missing_chat" && !(p.missingSignals || []).some(s => s.toLowerCase().includes("chat") || s.toLowerCase().includes("booking"))) return false;
        if (apolloQuickFilter === "has_cms" && !p.cmsPlatform) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "apollo-intent") return (b.buyerIntentScore ?? aiOpportunityScore(b)) - (a.buyerIntentScore ?? aiOpportunityScore(a));
      if (sortBy === "ai-score") return aiOpportunityScore(b) - aiOpportunityScore(a);
      if (sortBy === "value") return (b.expectedValue ?? 0) - (a.expectedValue ?? 0);
      // "added" — newest first
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

  return (
    <div className="space-y-4">
      {/* Export Generated Leads Bar in Prospects Tab */}
      {filtered.length > 0 && (
        <ExportLeadsBar
          leads={filtered}
          projectName={activeProjectName || "Project-Prospects"}
          projectsMap={
            projects
              ? Object.fromEntries(projects.map((proj) => [proj.id, proj.name]))
              : undefined
          }
          label="Export Project Leads"
        />
      )}

      {/* Apollo+ Quick Filter Bar in Prospects Tab */}
      {apolloCfg.enabled && prospects.length > 0 && (
        <div className="px-3 py-2.5 rounded-xl bg-slate-950 text-white border border-slate-800 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Segments:
          </span>
          {[
            { id: "all", label: `All Prospects (${prospects.length})` },
            ...(apolloCfg.intentScoring ? [{ id: "hot_intent", label: `🔥 Hot Buyer Intent (${prospects.filter(p => (p.buyerIntentScore ?? 0) >= 75).length})` }] : []),
            ...(apolloCfg.warmSignals ? [{ id: "warm_signal", label: `👀 Warm Signal: Opened/Clicked (${prospects.filter(p => p.email && (trackingStats[p.email]?.opens > 0 || trackingStats[p.email]?.clicks > 0)).length})` }] : []),
            ...(apolloCfg.decisionMaker ? [{ id: "has_owner", label: `👤 Decision-Maker Identified (${prospects.filter(p => p.ownerName || p.linkedin).length})` }] : []),
            ...(apolloCfg.techStack ? [
              { id: "missing_chat", label: `⚠️ Missing Chat / Booking (${prospects.filter(p => (p.missingSignals || []).some(s => s.toLowerCase().includes("chat") || s.toLowerCase().includes("booking"))).length})` },
              { id: "has_cms", label: `🖥️ Tech Stack Detected (${prospects.filter(p => p.cmsPlatform).length})` },
            ] : []),
          ].map(seg => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setApolloQuickFilter(seg.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                apolloQuickFilter === seg.id
                  ? "bg-amber-400 text-slate-950"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search business, owner, CMS, email, city…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-44">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai-score">AI Score ↓</SelectItem>
            {apolloCfg.enabled && apolloCfg.intentScoring && (
              <SelectItem value="apollo-intent">🔥 Buyer Intent ↓</SelectItem>
            )}
            <SelectItem value="value">Deal Value ↓</SelectItem>
            <SelectItem value="added">Date Added ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Building className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">{prospects.length === 0 ? "No prospects yet. Use AI Hunter to find businesses automatically." : "No results match your filters."}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40 rounded-xl border border-border/50 overflow-hidden bg-white">
          {filtered.map(p => {
            const cfg = STATUS_CONFIG[p.status];
            const hasWarmClick = Boolean(p.email && trackingStats[p.email]?.clicks > 0);
            const hasWarmOpen = Boolean(p.email && trackingStats[p.email]?.opens > 0);
            const offerRes = resolveAuditMatchedOffer(p, trainedOffer);
            const isEmailOpen = Boolean(openEmailIds[p.id]);
            const isGeneratingEmail = Boolean(loadingEmailIds[p.id]);
            const isGeneratingSite = Boolean(loadingSiteIds[p.id]);
            const isGeneratingReview = Boolean(loadingReviewIds[p.id]);
            const isSendingEmail = Boolean(sendingEmailIds[p.id]);
            return (
              <div
                key={p.id}
                className="p-3.5 sm:p-4 hover:bg-muted/10 transition-colors group overflow-hidden"
              >
                <div
                  onClick={() => onSelect(p)}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                    {p.businessName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 break-words">{p.businessName}</span>
                      <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-xs h-5`}>{cfg.label}</Badge>
                      {offerRes.primaryOffer && (
                        <span className="text-[11px] bg-slate-100 text-slate-800 border border-slate-200 rounded px-2 py-0.5 font-medium">
                          Primary Offer: {offerRes.primaryOffer}
                        </span>
                      )}
                      {p.priority === "high" && <span className="text-xs text-red-600 font-bold">🔴</span>}
                      {p.hunted && <span className="text-xs text-purple-600 font-bold flex items-center gap-0.5"><Radar className="w-3 h-3" /></span>}
                      {apolloCfg.enabled && apolloCfg.intentScoring && typeof p.buyerIntentScore === "number" && (
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                          p.buyerIntentScore >= 75
                            ? "bg-orange-100 text-orange-800 border-orange-300"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          🔥 {p.buyerIntentScore}/100 Intent
                        </span>
                      )}
                      {apolloCfg.enabled && apolloCfg.decisionMaker && p.ownerName && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          👤 {p.ownerName}{p.ownerRole ? ` (${p.ownerRole})` : ""}
                        </span>
                      )}
                      {apolloCfg.enabled && apolloCfg.techStack && p.cmsPlatform && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          🖥️ {p.cmsPlatform}
                        </span>
                      )}
                      {p.aiAgentType && AGENT_META[p.aiAgentType] && (
                        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 inline-flex items-center gap-1 whitespace-nowrap ${AGENT_META[p.aiAgentType].color}`}>
                          <span>{AGENT_META[p.aiAgentType].icon}</span>
                          <span>{AGENT_META[p.aiAgentType].label}</span>
                        </span>
                      )}
                      {p.analysis && (
                        <span className="text-xs text-purple-600 font-bold inline-flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" />
                          {Math.round(aiOpportunityScore(p))}
                        </span>
                      )}
                      {p.emailSentAt && <span className="text-xs text-green-600 font-bold">✓ Emailed</span>}
                      {apolloCfg.enabled && apolloCfg.warmSignals && hasWarmClick && (
                        <span className="text-xs font-extrabold text-white bg-rose-600 px-2 py-0.5 rounded-full animate-pulse">
                          🔥 Warm Signal: Clicked Audit Link ({trackingStats[p.email].clicks}×)
                        </span>
                      )}
                      {hasWarmOpen && (
                        <span className="text-xs font-bold text-blue-600 inline-flex items-center gap-0.5">
                          <Eye className="w-3 h-3" /> Opened {trackingStats[p.email].opens}×
                        </span>
                      )}
                      {!apolloCfg.warmSignals && hasWarmClick && (
                        <span className="text-xs font-bold text-orange-600">🔗 Clicked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground flex-wrap">
                      {p.category && <span>{p.category}</span>}
                      {p.city && <span>{p.city}{p.country ? `, ${p.country}` : ""}</span>}
                      {p.email && <span className="break-all">{p.email}</span>}
                      {p.expectedValue > 0 && <span className="text-purple-700 font-semibold">${p.expectedValue.toLocaleString()}</span>}
                      {apolloCfg.enabled && apolloCfg.techStack && p.missingSignals && p.missingSignals.length > 0 && (
                        <span className="text-[11px] text-rose-600 font-semibold">
                          ⚠️ {p.missingSignals.slice(0, 2).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="sm:opacity-0 sm:group-hover:opacity-100 text-destructive/70 h-8 w-8 p-0 flex-shrink-0"
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                </div>

                {/* Mobile-Friendly Action Bar right on each Prospect Card */}
                <div
                  className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex flex-col gap-2"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:justify-end">
                    {offerRes.showGenerateWebsite && (
                      <button
                        type="button"
                        disabled={isGeneratingSite}
                        onClick={() => generateInlineAssetForProspect(p, "website")}
                        className="flex-1 sm:flex-initial justify-center px-2.5 py-2 sm:py-1 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isGeneratingSite ? <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> : <Globe className="w-3 h-3 text-slate-600 shrink-0" />}
                        <span>{p.generatedSiteUrl ? "Regenerate Website" : "Generate Website"}</span>
                      </button>
                    )}
                    {offerRes.showGenerateReview && (
                      <button
                        type="button"
                        disabled={isGeneratingReview}
                        onClick={() => generateInlineAssetForProspect(p, "review")}
                        className="flex-1 sm:flex-initial justify-center px-2.5 py-2 sm:py-1 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isGeneratingReview ? <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> : <Star className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span>{p.generatedReviewUrl ? "Regenerate Review" : "Generate Review"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isGeneratingEmail}
                      onClick={() => {
                        if (p.generatedEmail && isEmailOpen) {
                          setOpenEmailIds(prev => ({ ...prev, [p.id]: false }));
                        } else if (p.generatedEmail && !isEmailOpen) {
                          setOpenEmailIds(prev => ({ ...prev, [p.id]: true }));
                        } else {
                          generateInlineEmailForProspect(p);
                        }
                      }}
                      className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1 rounded-md text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      {isGeneratingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Mail className="w-3.5 h-3.5 shrink-0" />}
                      <span>{p.generatedEmail ? (isEmailOpen ? "Hide Cold Email" : "View Cold Email") : "Generate Cold Email"}</span>
                    </button>
                  </div>

                  {(p.generatedSiteUrl || p.generatedReviewUrl) && (
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                      {p.generatedSiteUrl && (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-700">Website Preview:</span>
                          <a href={p.generatedSiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium break-all">
                            {p.generatedSiteUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      )}
                      {p.generatedReviewUrl && (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-700">Review Page:</span>
                          <a href={p.generatedReviewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium break-all">
                            {p.generatedReviewUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {isEmailOpen && p.generatedEmail && (
                    <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5 mt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <Mail className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>Personalized Cold Email{offerRes.primaryOffer ? ` (${offerRes.primaryOffer})` : ""}</span>
                          {p.emailSentAt && <span className="text-green-600 font-semibold">· ✓ Sent</span>}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CopyButton text={`Subject: ${p.generatedEmail.subject}\n\n${p.generatedEmail.body}`} />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateInlineEmailForProspect(p)}
                            disabled={isGeneratingEmail}
                            className="h-7 text-xs gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${isGeneratingEmail ? "animate-spin" : ""}`} />
                            Regenerate
                          </Button>
                          {p.email && (
                            <Button
                              size="sm"
                              onClick={() => sendInlineEmailForProspect(p)}
                              disabled={isSendingEmail}
                              className="h-7 text-xs gap-1 bg-slate-900 hover:bg-slate-800 text-white"
                            >
                              <Send className="w-3 h-3" />
                              {isSendingEmail ? "Sending…" : "Send Email"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <Input
                        value={p.generatedEmail.subject}
                        onChange={(e) =>
                          onUpdate?.({
                            ...p,
                            generatedEmail: { ...p.generatedEmail!, subject: e.target.value },
                          })
                        }
                        className="h-8 text-xs font-semibold"
                      />
                      <Textarea
                        value={p.generatedEmail.body}
                        onChange={(e) =>
                          onUpdate?.({
                            ...p,
                            generatedEmail: { ...p.generatedEmail!, body: e.target.value },
                          })
                        }
                        rows={5}
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inbox Replies Panel ──────────────────────────────────────────────────────

type InboxReply = {
  id: number;
  prospectEmail: string;
  businessName: string;
  subject: string;
  bodyText: string;
  classification: string;
  aiResponse: string | null;
  aiRepliedAt: string | null;
  receivedAt: string;
  read: boolean;
};

type CustomRequest = {
  id: number;
  name: string | null;
  email: string;
  businessType: string | null;
  description: string;
  budget: string | null;
  whatsapp: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

const CLASSIFICATION_META: Record<string, { label: string; color: string }> = {
  interested:      { label: "Interested",      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  call_requested:  { label: "Call Requested",  color: "bg-amber-500/15  text-amber-400  border-amber-500/30" },
  not_interested:  { label: "Not Interested",  color: "bg-slate-500/15  text-slate-400  border-slate-500/30" },
  objection:       { label: "Objection",       color: "bg-rose-500/15   text-rose-400   border-rose-500/30" },
  other:           { label: "Other",            color: "bg-sky-500/15    text-sky-400    border-sky-500/30" },
};

// ─── Automation Panel ─────────────────────────────────────────────────────────

interface AutomationSettings {
  autoHuntEnabled: boolean;
  huntCategory: string;
  huntCity: string;
  huntCountry: string;
  huntCount: number;
  huntExtraContext: string;
  huntIntervalHours: number;
  autoScore: boolean;
  autoEmail: boolean;
  emailDelayMinutes: number;
  autoReply: boolean;
  followUpEnabled: boolean;
  followUpDays: number;
}

interface AutomationStatus {
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  activeAccounts: number;
  stats: Record<string, any>;
}

interface ProviderStatus { count: number; active: boolean; envFallback: boolean; }
interface DatasourceStatus {
  foursquare: ProviderStatus;
  tomtom:     ProviderStatus;
  here:       ProviderStatus;
  gemini:     { count: number; active: boolean };
  estimatedYieldPerCity: number;
}

// ─── Per-provider API key manager ─────────────────────────────────────────────

function ApiKeyPoolManager({
  provider, title, desc, quotaPerAccount,
}: {
  provider: string; title: string; desc: string; quotaPerAccount: string;
  signupUrl?: string; signupLabel?: string; onUpdated?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-card">
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{desc} · {quotaPerAccount}</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
          Server Pool ({provider.toUpperCase()})
        </span>
      </div>
    </div>
  );
}

// ─── Automation panel ─────────────────────────────────────────────────────────

function AutomationPanel() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [dsStatus, setDsStatus] = useState<DatasourceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dsOpen, setDsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sRes, stRes, dsRes] = await Promise.all([
        fetch(`${apiBase()}/api/automation/settings`),
        fetch(`${apiBase()}/api/automation/status`),
        authFetch(`/api/api-pools/status`),
      ]);
      if (sRes.ok)  setSettings(await sRes.json());
      if (stRes.ok) setStatus(await stRes.json());
      if (dsRes.ok) setDsStatus(await dsRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<AutomationSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`${apiBase()}/api/automation/settings`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json();
      setSettings(updated);
      // refresh status after toggle
      const st = await fetch(`${apiBase()}/api/automation/status`);
      if (st.ok) setStatus(await st.json());
      setMsg({ type: "ok", text: "Saved" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally { setSaving(false); }
  };

  const runNow = async () => {
    setRunning(true); setMsg(null);
    try {
      const r = await fetch(`${apiBase()}/api/automation/run-now`, { method: "POST" });
      const d = await r.json();
      setMsg({ type: d.success ? "ok" : "err", text: d.message || "Started" });
      setTimeout(load, 3000);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    finally { setRunning(false); }
  };

  if (loading) return <LoadingSpinner text="Loading automation settings…" />;
  if (!settings) return <div className="text-center py-12 text-muted-foreground">Failed to load settings</div>;

  const isReady = status && status.activeAccounts > 0;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${settings.autoHuntEnabled ? "bg-green-50 border-green-200" : "bg-muted/30 border-border/50"}`}>
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${settings.autoHuntEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
        <div className="flex-1">
          <div className="font-bold text-sm">{settings.autoHuntEnabled ? "Automation is LIVE" : "Automation is OFF"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {status?.activeAccounts ?? 0} email account{status?.activeAccounts !== 1 ? "s" : ""} active
            {status?.lastRunAt && ` · Last run ${new Date(status.lastRunAt).toLocaleString()}`}
            {status?.nextRunAt && ` · Next run ${new Date(status.nextRunAt).toLocaleString()}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={runNow} disabled={running || !isReady}
            className="gap-1.5 h-8 text-xs font-semibold">
            {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            Run Now
          </Button>
          <Switch checked={settings.autoHuntEnabled} disabled={saving || !isReady}
            onCheckedChange={v => save({ autoHuntEnabled: v })} />
        </div>
      </div>

      {!isReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Add Gmail accounts first.</span> Go to <strong>Email Settings</strong> and add your Gmail accounts with App Passwords before enabling automation.
          </div>
        </div>
      )}

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg border ${msg.type === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Hunt Settings */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-3 bg-muted/20 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />
            <h4 className="font-bold text-sm">Autonomous Hunt & Multi-City Rotation Queue</h4>
            <span className="text-xs text-muted-foreground ml-1">— rotates automatically on every run</span>
          </div>
          {status?.stats?.activeTargetCity && (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
              Last Rotated: {status.stats.activeTargetCategory || settings.huntCategory} in {status.stats.activeTargetCity}
              {status.stats.nextTargetCity ? ` → Next: ${status.stats.nextTargetCity}` : ""}
            </span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Primary Category (or comma-separated rotation list)
              </label>
              <Input
                value={settings.huntCategory}
                placeholder="e.g. Dentist, MedSpa, Roofing, Law Firm"
                onChange={e => setSettings(s => s ? { ...s, huntCategory: e.target.value } : s)}
                onBlur={() => save({ huntCategory: settings.huntCategory })}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  { label: "+ Dentist", val: "Dentist" },
                  { label: "+ MedSpa", val: "MedSpa" },
                  { label: "+ Roofing", val: "Roofing" },
                  { label: "+ HVAC", val: "HVAC" },
                  { label: "+ Law Firm", val: "Law Firm" },
                  { label: "+ Real Estate", val: "Real Estate Agency" },
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => {
                      const current = settings.huntCategory
                        .split(",")
                        .map(s => s.trim())
                        .filter(Boolean);
                      const next = current.includes(item.val)
                        ? current.join(", ")
                        : [...current, item.val].join(", ");
                      save({ huntCategory: next });
                    }}
                    className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Businesses per Run</label>
              <Input type="number" min={5} max={100} value={settings.huntCount}
                onChange={e => setSettings(s => s ? { ...s, huntCount: Number(e.target.value) } : s)}
                onBlur={() => save({ huntCount: settings.huntCount })} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Verified for live DNS & MX records + deduplicated against past sends.
              </p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Target City or Multi-City Rotation Queue (comma-separated)
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    {
                      label: "US Sunbelt Pack (8 Cities)",
                      cities: "Austin, Miami, Phoenix, Dallas, Tampa, Atlanta, Charlotte, Nashville",
                      country: "USA",
                    },
                    {
                      label: "US Tier-1 Metros",
                      cities: "New York, Los Angeles, Chicago, Houston, San Diego, Denver, Seattle",
                      country: "USA",
                    },
                    {
                      label: "UK & Ireland Pack",
                      cities: "London, Manchester, Birmingham, Leeds, Glasgow, Dublin",
                      country: "UK",
                    },
                    {
                      label: "Canada & Australia",
                      cities: "Toronto, Vancouver, Calgary, Montreal, Sydney, Melbourne, Brisbane",
                      country: "Canada",
                    },
                  ].map(pack => (
                    <button
                      key={pack.label}
                      type="button"
                      onClick={() => save({ huntCity: pack.cities, huntCountry: pack.country })}
                      className="px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-semibold text-indigo-800 cursor-pointer"
                    >
                      + {pack.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input value={settings.huntCity} placeholder="e.g. Austin, Miami, Phoenix, Chicago, London"
                onChange={e => setSettings(s => s ? { ...s, huntCity: e.target.value } : s)}
                onBlur={() => save({ huntCity: settings.huntCity })} />
              <p className="text-[11px] text-muted-foreground mt-1">
                {settings.huntCity.split(/[\n,]+/).filter(c => c.trim()).length} cit{settings.huntCity.split(/[\n,]+/).filter(c => c.trim()).length === 1 ? "y" : "ies"} in rotation queue · Scheduler advances to the next city automatically on each run.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Country</label>
              <Input value={settings.huntCountry} placeholder="e.g. USA, UK, Canada, Nigeria"
                onChange={e => setSettings(s => s ? { ...s, huntCountry: e.target.value } : s)}
                onBlur={() => save({ huntCountry: settings.huntCountry })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Extra Context (optional)</label>
              <Input value={settings.huntExtraContext} placeholder="e.g. focus on private practices missing online booking"
                onChange={e => setSettings(s => s ? { ...s, huntExtraContext: e.target.value } : s)}
                onBlur={() => save({ huntExtraContext: settings.huntExtraContext })} />
            </div>
          </div>
        </div>
      </div>

      {/* Schedule & Sending */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-3 bg-muted/20 border-b border-border/50 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h4 className="font-bold text-sm">Schedule & Sending</h4>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Run Every (hours)</label>
              <Input type="number" min={1} max={48} value={settings.huntIntervalHours}
                onChange={e => setSettings(s => s ? { ...s, huntIntervalHours: Number(e.target.value) } : s)}
                onBlur={() => save({ huntIntervalHours: settings.huntIntervalHours })} />
              <p className="text-[10px] text-muted-foreground mt-1">24 = once/day. 12 = twice/day.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Delay Between Emails (mins)</label>
              <Input type="number" min={0} max={30} value={settings.emailDelayMinutes}
                onChange={e => setSettings(s => s ? { ...s, emailDelayMinutes: Number(e.target.value) } : s)}
                onBlur={() => save({ emailDelayMinutes: settings.emailDelayMinutes })} />
              <p className="text-[10px] text-muted-foreground mt-1">1–2 mins recommended to avoid spam flags.</p>
            </div>
          </div>

          {/* Feature toggles */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            {[
              { key: "autoScore", label: "AI Analysis", desc: "Auto-analyze each business website before emailing" },
              { key: "autoEmail", label: "Auto Send Emails", desc: "Automatically send the AI-generated cold email" },
              { key: "autoReply", label: "Auto Reply", desc: "AI replies to interested leads automatically" },
              { key: "followUpEnabled", label: "Follow-ups", desc: `Send a follow-up after ${settings.followUpDays} days if no reply` },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <Switch checked={(settings as any)[key]}
                  onCheckedChange={v => save({ [key]: v } as any)} />
              </div>
            ))}
            {settings.followUpEnabled && (
              <div className="pl-4 border-l-2 border-border/50">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Follow-up after (days)</label>
                <Input type="number" min={1} max={30} value={settings.followUpDays} className="w-24"
                  onChange={e => setSettings(s => s ? { ...s, followUpDays: Number(e.target.value) } : s)}
                  onBlur={() => save({ followUpDays: settings.followUpDays })} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats & Live Autonomous Prospect Log */}
      {status?.stats && Object.keys(status.stats).length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden space-y-0">
          <div className="p-3 bg-muted/20 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Last Autonomous Cycle Telemetry
            </h4>
            {status.stats.lastRunAt && (
              <span className="text-xs text-muted-foreground">
                Completed {new Date(status.stats.lastRunAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Leads Scraped", value: status.stats.hunted ?? 0 },
              { label: "AI Audited", value: status.stats.scored ?? 0 },
              { label: "Emails Sent", value: status.stats.emailed ?? 0 },
              { label: "Follow-Ups Sent", value: status.stats.followUps ?? 0 },
              { label: "Duplicates Skipped", value: status.stats.skippedDuplicates ?? 0 },
            ].map(item => (
              <div key={item.label} className="text-center rounded-lg border border-border/50 p-3 bg-white">
                <div className="text-2xl font-extrabold text-primary font-mono">{item.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {Array.isArray(status.stats.lastProspects) && status.stats.lastProspects.length > 0 && (
            <div className="border-t border-border/50">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-border/50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Processed Prospects in Last Run ({status.stats.lastProspects.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  Auto-generated shareable audit links & A/B/C rotational outreach
                </span>
              </div>
              <div className="divide-y divide-border/40 max-h-64 overflow-y-auto bg-white">
                {status.stats.lastProspects.map((p: any, idx: number) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {p.businessName}
                        {p.city ? <span className="font-normal text-slate-500"> · {p.city}</span> : null}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {p.email || p.website || "Verified prospect"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.reportUrl && (
                        <a
                          href={p.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold hover:underline"
                        >
                          View Audit
                        </a>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          p.emailed
                            ? "bg-emerald-50 text-emerald-700"
                            : p.scored
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.emailed ? "✓ Emailed" : p.scored ? "Audited" : `Score ${p.score ?? 5}/10`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">How to launch high-volume automated outreach:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed">
          <li>Go to <strong>Email Accounts</strong> and connect your sender inboxes with a daily warm-up limit</li>
          <li>Select your target <strong>Business Category</strong> and <strong>City</strong> above</li>
          <li>Enable <strong>Website Analysis</strong> and <strong>Auto Send Emails</strong></li>
          <li>Click <strong>Run Now</strong> to execute a cycle immediately, or toggle automation <strong>ON</strong> for 24/7 execution</li>
        </ol>
      </div>
    </div>
  );
}

function InboxPanel() {
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const loadReplies = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/api/automation/replies?limit=100`);
      if (r.ok) setReplies(await r.json());
    } finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const r = await authFetch(`/api/admin/custom-requests`);
      if (r.ok) setRequests(await r.json());
    } finally { setRequestsLoading(false); }
  }, []);

  useEffect(() => { loadReplies(); loadRequests(); }, [loadReplies, loadRequests]);

  const checkReplies = async () => {
    setChecking(true);
    setMsg("");
    try {
      const r = await fetch(`${apiBase()}/api/automation/check-replies`, { method: "POST" });
      const d = await r.json();
      setMsg(d.message || (d.error ? `Error: ${d.error}` : "Done"));
      if (!d.error) await loadReplies();
    } finally { setChecking(false); }
  };

  const markRead = async (id: number) => {
    await fetch(`${apiBase()}/api/automation/replies/${id}/read`, { method: "PATCH" });
    setReplies(r => r.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const unread = replies.filter(r => !r.read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            Inbox Replies
            {unread > 0 && (
              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold">{unread} new</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Replies from prospects — AI classifies each one and auto-responds if enabled.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadReplies} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={checkReplies} disabled={checking}>
            <BotMessageSquare className="w-4 h-4 mr-1.5" />
            {checking ? "Checking…" : "Check Inbox"}
          </Button>
        </div>
      </div>

      {msg && (
        <div className="text-sm px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground">
          {msg}
        </div>
      )}

      {/* ── Proposal / consultation requests from the public report page ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Proposal Requests
            {requests.filter(r => r.status === "new").length > 0 && (
              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold">
                {requests.filter(r => r.status === "new").length} new
              </span>
            )}
          </h3>
          <Button variant="ghost" size="sm" onClick={loadRequests} disabled={requestsLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${requestsLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Submitted from the "Request Proposal" / "Book Consultation" buttons on report pages.
        </p>
        {requests.length === 0 && !requestsLoading && (
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            No proposal requests yet.
          </div>
        )}
        <div className="space-y-2">
          {requests.map(req => <ProposalRequestRow key={req.id} request={req} />)}
        </div>
      </div>

      <div className="border-t border-border pt-4" />

      {replies.length === 0 && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No replies yet</p>
          <p className="text-sm mt-1">Make sure IMAP is enabled on your email accounts, then click <strong>Check Inbox</strong>.</p>
        </div>
      )}

      <div className="space-y-2">
        {replies.map(reply => {
          const meta = CLASSIFICATION_META[reply.classification] ?? CLASSIFICATION_META.other;
          const isOpen = expanded === reply.id;
          return (
            <motion.div
              key={reply.id}
              layout
              className={`rounded-xl border ${reply.read ? "border-border bg-card/50" : "border-primary/30 bg-primary/5"} overflow-hidden`}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => {
                  setExpanded(isOpen ? null : reply.id);
                  if (!reply.read) markRead(reply.id);
                }}
              >
                {!reply.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{reply.businessName || reply.prospectEmail}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>{meta.label}</span>
                    {reply.aiRepliedAt && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <BotMessageSquare className="w-3 h-3" /> Auto-replied
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{reply.subject}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(reply.receivedAt).toLocaleDateString()}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Their reply</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3 border border-border">
                      {reply.bodyText || "(empty)"}
                    </p>
                  </div>
                  {reply.aiResponse && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <BotMessageSquare className="w-3 h-3" /> AI response sent
                      </p>
                      <p className="text-sm whitespace-pre-wrap bg-emerald-950/30 rounded-lg p-3 border border-emerald-800/30">
                        {reply.aiResponse}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ProposalRequestRow({ request }: { request: CustomRequest }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(`Re: your project — ${request.businessType || "custom build"}`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setStatus(null);
    try {
      await callCRM("send-email", { to: request.email, subject, body, prospectName: request.name || request.email });
      setStatus({ type: "success", msg: "Sent via AI Hunter." });
      setOpen(false);
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message || "Failed to send" });
    } finally { setSending(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{request.name || request.email}</span>
          <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-sky-500/15 text-sky-500 border-sky-500/30">{request.status}</span>
          <span className="text-xs text-muted-foreground ml-auto">{new Date(request.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{request.email}{request.whatsapp ? ` · ${request.whatsapp}` : ""}{request.budget ? ` · Budget: ${request.budget}` : ""}</p>
        <p className="text-sm mt-2 whitespace-pre-wrap bg-muted/50 rounded-lg p-3 border border-border">{request.description}</p>
        <div className="flex gap-2 mt-3">
          <a href={`mailto:${request.email}`}>
            <Button variant="outline" size="sm"><Mail className="w-3.5 h-3.5 mr-1.5" />Reply by Email</Button>
          </a>
          <Button size="sm" onClick={() => setOpen(o => !o)}>
            <BotMessageSquare className="w-3.5 h-3.5 mr-1.5" />Reply via AI Hunter
          </Button>
        </div>
        {status && (
          <div className={`text-xs mt-2 ${status.type === "success" ? "text-emerald-500" : "text-red-500"}`}>{status.msg}</div>
        )}
        {open && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your reply…" rows={5} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
                <Send className="w-3.5 h-3.5 mr-1.5" />{sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Website Reports Panel ────────────────────────────────────────────────────

function WebsiteReportsPanel() {
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch("/api/reports/admin/all");
      if (r.ok) setReports(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const updateStatus = async (reportId: string, status: string) => {
    await authFetch(`/api/reports/admin/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setReports(prev => prev.map(r => r.reportId === reportId ? { ...r, status } : r));
  };

  const deleteReport = async (reportId: string) => {
    await authFetch(`/api/reports/admin/${reportId}`, { method: "DELETE" });
    setReports(prev => prev.filter(r => r.reportId !== reportId));
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E4E2DD] bg-white p-4 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
              </div>
              <div className="h-3 w-64 bg-slate-100 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-28 bg-slate-100 rounded-lg" />
              <div className="h-8 w-20 bg-slate-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Client-Facing Website Audit Reports
          </h3>
          <p className="text-sm text-muted-foreground">
            Generated automatically during AI lead analysis & cold outreach. Shareable links track real-time prospect views and proposal requests.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReports} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-border/50 rounded-xl text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No Website Audit Reports yet</p>
          <p className="text-sm mt-1">Analyze any prospect in the Prospects tab to automatically generate a shareable Website Audit Report.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.map(r => (
            <div key={r.reportId} className="rounded-xl border border-border/60 bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base">{r.businessName}</span>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">#{r.reportId}</span>
                  {r.proposalRequested && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">🔥 Proposal Requested</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" /> {r.totalViews} view{r.totalViews !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  {r.website && <span>{r.website}</span>}
                  {r.lastViewed && <span>Last viewed: {new Date(r.lastViewed).toLocaleString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={r.status || "active"} onValueChange={v => updateStatus(r.reportId, v)}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                    <SelectItem value="client_replied">Client Replied</SelectItem>
                    <SelectItem value="won">Won ✓</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/report/${r.reportId}`)}
                  className="h-8 text-xs gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Report
                </Button>
                <CopyButton text={`${window.location.origin}/report/${r.reportId}`} />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive" onClick={() => deleteReport(r.reportId)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────

export default function CRM() {
  const [location, setLocation] = useLocation();
  const [prospects, setProspects] = useState<Prospect[]>(loadProspects);
  const [projects, setProjects] = useState<LeadProject[]>(loadProjects);
  const [activeProjectId, setActiveProjectState] = useState<string>(() =>
    getActiveProjectId(loadProjects())
  );
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [tab, setTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t && t !== "train-ai") return t;
    } catch {}
    return "hunter";
  });
  const [canUseWebsiteBuilder, setCanUseWebsiteBuilder] = useState<boolean>(true);
  const [builderAccessMode, setBuilderAccessMode] = useState<string>("all_users");
  const [callerPlanId, setCallerPlanId] = useState<string>(
    getCachedSaasUser()?.planId || "starter"
  );

  const handleSelectProject = useCallback((projectId: string) => {
    setActiveProjectState(projectId);
    setActiveProjectId(projectId);
  }, []);

  const handleCreateProject = useCallback(
    (input: Omit<LeadProject, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newProj: LeadProject = {
        ...input,
        id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setProjects((prev) => {
        const next = [...prev, newProj];
        saveProjects(next);
        return next;
      });
      handleSelectProject(newProj.id);
    },
    [handleSelectProject]
  );

  const handleUpdateProject = useCallback((updated: LeadProject) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      saveProjects(next);
      return next;
    });
  }, []);

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      setProjects((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((p) => p.id !== projectId);
        saveProjects(next);
        if (activeProjectId === projectId) {
          const fallbackId = next[0]?.id || DEFAULT_PROJECT_ID;
          setActiveProjectState(fallbackId);
          setActiveProjectId(fallbackId);
        }
        return next;
      });
    },
    [activeProjectId]
  );

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t && t !== "train-ai") setTab(t);
    } catch {}
  }, [location]);

  useEffect(() => {
    if (!getSaasToken()) {
      clearSaasSession();
      setLocation("/auth?mode=login&redirect=/crm");
      return;
    }
    const localInitial = loadProspects();
    setProspects(localInitial);
    // Verify active user session
    saasFetch("/api/saas/auth/me").catch(() => {
      clearSaasSession();
      setLocation("/auth?mode=login&redirect=/crm");
    });
    // Load this user's private prospects from the server and merge with this user's local prospects
    authFetch("/api/crm/prospects")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.prospects)) {
          const remote: Prospect[] = data.prospects;
          const currentLocal = loadProspects();
          if (remote.length > 0 && currentLocal.length === 0) {
            saveUserProspects(remote);
            setProspects(remote);
          } else if (currentLocal.length > 0) {
            const byId = new Map<number | string, Prospect>();
            for (const rp of remote) byId.set(rp.id, rp);
            for (const lp of currentLocal) byId.set(lp.id, lp);
            const mergedList = Array.from(byId.values());
            saveProspects(mergedList);
            setProspects(mergedList);
          } else {
            setProspects([]);
          }
        }
      })
      .catch(() => {});
    syncProjectsFromServer().then((merged) => {
      if (merged.length > 0) {
        setProjects(merged);
        setActiveProjectState((prev) =>
          prev === "all" || merged.some((p) => p.id === prev)
            ? prev
            : merged[0]?.id || DEFAULT_PROJECT_ID
        );
      }
    });
    saasFetch<{
      allowed?: boolean;
      callerPlanId?: string;
      config?: { mode?: string };
    }>("/api/website-builder/access")
      .then((res) => {
        if (typeof res?.allowed === "boolean") {
          setCanUseWebsiteBuilder(res.allowed || isUserAdmin(getCachedSaasUser()));
        }
        if (res?.config?.mode) {
          setBuilderAccessMode(res.config.mode);
        }
        if (res?.callerPlanId) {
          setCallerPlanId(res.callerPlanId);
        }
      })
      .catch(() => {});
  }, []);

  const save = useCallback((data: Prospect[]) => {
    setProspects(data);
    saveProspects(data);
  }, []);

  const activeProject =
    activeProjectId === "all"
      ? projects[0] || null
      : projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const defaultProjectId = projects[0]?.id || DEFAULT_PROJECT_ID;

  const projectLeadCounts = projects.reduce<Record<string, number>>((acc, proj) => {
    const importedCount = prospects.filter(
      (p) => (p.projectId || defaultProjectId) === proj.id
    ).length;
    const huntedOnlyCount = loadProjectHuntedResults<HuntedBusiness>(proj.id).filter(
      (h) => !h.imported
    ).length;
    acc[proj.id] = importedCount + huntedOnlyCount;
    return acc;
  }, {});

  const projectProspects =
    activeProjectId === "all"
      ? prospects
      : prospects.filter(
          (p) => (p.projectId || defaultProjectId) === activeProjectId
        );

  // Combine imported prospects + any un-imported scraped leads in the active project so Export always includes generated leads!
  const activeProjectExportableLeads = (() => {
    if (activeProjectId === "all") {
      return prospects;
    }
    const unimportedHunted = loadProjectHuntedResults<HuntedBusiness>(activeProjectId)
      .filter((h) => !h.imported)
      .map((h) => ({
        ...h,
        projectId: activeProjectId,
        projectName: activeProject?.name || "Project",
      }));
    return [...projectProspects, ...unimportedHunted];
  })();

  const addProspects = useCallback(
    (newOnes: Omit<Prospect, "id" | "addedAt">[]) => {
      const targetProjId =
        activeProjectId === "all" ? defaultProjectId : activeProjectId;
      setProspects((prev) => {
        const maxId = prev.length > 0 ? Math.max(...prev.map((p) => p.id)) : 0;
        const added = newOnes.map((p, i) => ({
          ...p,
          projectId: p.projectId || targetProjId,
          id: maxId + i + 1,
          addedAt: new Date().toISOString(),
        }));
        const next = [...prev, ...added];
        saveProspects(next);
        return next;
      });
      setTab("prospects");
    },
    [activeProjectId, defaultProjectId]
  );

  const update = useCallback((p: Prospect) => {
    save(prospects.map(x => x.id === p.id ? p : x));
    if (selected?.id === p.id) setSelected(p);
  }, [prospects, selected, save]);

  const remove = useCallback((id: number) => {
    save(prospects.filter(p => p.id !== id));
    if (selected?.id === id) setSelected(null);
  }, [prospects, selected, save]);

  if (selected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <ProspectDetail
            prospect={selected}
            onUpdate={update}
            onDelete={() => { remove(selected.id); }}
            onBack={() => setSelected(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#FAF9F5] text-[#0B0F17]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E4E2DD]">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-[#0B0F17] flex items-center justify-center text-amber-400">
                <Radar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-[#0B0F17]">Vanguard Hunter CRM</h1>
                <p className="text-xs sm:text-sm text-[#525866]">
                  Autonomous B2B Lead Discovery · Website &amp; Voice Diagnostic Engine · Multi-Inbox Sequences
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  setLocation("/dashboard");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B0F17] bg-[#F2F0EA] hover:bg-[#E4E2DD] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setLocation("/landing")}
              className="px-3 py-2 text-xs font-semibold text-[#0B0F17] bg-[#F2F0EA] hover:bg-[#E4E2DD] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Landing Page
            </button>
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="px-3 py-2 text-xs font-semibold text-[#0B0F17] border border-[#D8D5CD] bg-white hover:bg-[#F2F0EA] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              User Dashboard
            </button>
            {isUserAdmin(getCachedSaasUser()) && (
              <button
                type="button"
                onClick={() => setLocation("/admin")}
                className="px-3 py-2 text-xs font-semibold text-amber-300 bg-[#0B0F17] hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Admin Console
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearSaasSession();
                setLocation("/landing");
              }}
              className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        <ProjectWorkspaceBar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          projectLeadCounts={projectLeadCounts}
          totalLeadsCount={prospects.length}
          activeProjectLeads={activeProjectExportableLeads}
          categories={CATEGORIES}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-6 flex flex-wrap h-auto gap-1 p-1.5">
            <TabsTrigger value="hunter" className="flex-1 gap-1.5">
              <Radar className="w-4 h-4" /> AI Hunter
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex-1 gap-1.5">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="prospects" className="flex-1 gap-1.5">
              <Users className="w-4 h-4" /> Prospects
              {projectProspects.length > 0 && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{projectProspects.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1 gap-1.5">
              <Globe className="w-4 h-4" /> Audit Reports
            </TabsTrigger>
            {(canUseWebsiteBuilder || builderAccessMode !== "owner_only") && (
              <TabsTrigger value="website-builder" className="flex-1 gap-1.5 text-amber-700 font-bold">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>
                  {isUserAdmin(getCachedSaasUser())
                    ? "AI Website Builder (Owner)"
                    : canUseWebsiteBuilder
                    ? "AI Website + Review Shield"
                    : "🔒 AI Website Builder (VIP)"}
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger value="email-settings" className="flex-1 gap-1.5">
              <Settings className="w-4 h-4" /> Email Accounts
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex-1 gap-1.5">
              <Zap className="w-4 h-4" /> Automation
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex-1 gap-1.5">
              <Inbox className="w-4 h-4" /> Inbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hunter">
            <AIHunterPanel
              onImport={addProspects}
              activeProject={activeProject}
            />
          </TabsContent>

          <TabsContent value="dashboard">
            <Dashboard prospects={projectProspects} />
          </TabsContent>

          <TabsContent value="prospects">
            <ProspectList
              prospects={projectProspects}
              onSelect={setSelected}
              onDelete={remove}
              onUpdate={update}
              projects={projects}
              activeProjectName={
                activeProjectId === "all"
                  ? "All-Projects"
                  : activeProject?.name || "Project"
              }
            />
          </TabsContent>

          <TabsContent value="reports">
            <WebsiteReportsPanel />
          </TabsContent>

          {(canUseWebsiteBuilder || builderAccessMode !== "owner_only") && (
            <TabsContent value="website-builder">
              {canUseWebsiteBuilder ? (
                <div className="bg-slate-950 rounded-2xl p-4 sm:p-6 text-slate-100">
                  <OwnerWebsiteBuilderPanel externalLeads={activeProjectExportableLeads} />
                </div>
              ) : (
                <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-6 sm:p-10 text-white shadow-2xl space-y-6">
                  <div className="max-w-3xl space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                      👑 High-Level Agency Exclusive Feature · Current Plan: {callerPlanId.toUpperCase()}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      Unlock the AI 4-Tap Website Builder &amp; 5-Star Review Shield Engine
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                      Stop sending cold emails without a finished asset. On the{" "}
                      <strong className="text-amber-300">Agency Scale ($349/mo)</strong> and{" "}
                      <strong className="text-amber-300">Enterprise VIP ($799/mo)</strong> plans, you automatically unlock our 1-Click AI Website Builder and 5-Star Review Shield Blocker so you can charge local businesses{" "}
                      <strong className="text-emerald-400">$97–$297/month</strong> in recurring retainers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold uppercase text-amber-400">1. Pre-Built 4-Tap Websites</div>
                      <div className="text-sm font-bold text-white">Auto-Build Client Sites in 10 Seconds</div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Automatically detects businesses with no website or a low-converting website and builds them a live preview at <code>/site/:id</code>.
                      </p>
                    </div>
                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold uppercase text-emerald-400">2. 5-Star Review Shield</div>
                      <div className="text-sm font-bold text-white">Block 1–3 Star Google Reviews</div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Every business also gets a standalone Review Shield funnel + printable QR table stand at <code>/review/:id</code> that you can sell for $97–$147/mo.
                      </p>
                    </div>
                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold uppercase text-blue-400">3. Built-In Client Checkout</div>
                      <div className="text-sm font-bold text-white">Keep 100% of Client Payments</div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Includes 1, 3, and 12-month hosting checkout via Credit Card (Lemon Squeezy), Bank Transfer, and Crypto.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLocation("/dashboard?tab=billing&plan=scale")}
                      className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      👑 Upgrade to Agency Scale ($349/mo) to Unlock Now →
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("/dashboard?tab=billing&plan=enterprise")}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      View Enterprise VIP ($799/mo)
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="email-settings">
            <EmailSettingsPanel />
          </TabsContent>

          <TabsContent value="automation">
            <AutomationPanel />
          </TabsContent>

          <TabsContent value="inbox">
            <InboxPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
