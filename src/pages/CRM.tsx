import { useState, useEffect, useCallback } from "react";
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
import { getCachedSaasUser, isUserAdmin, saasFetch } from "@/lib/saas-auth";
import OwnerWebsiteBuilderPanel from "@/components/OwnerWebsiteBuilderPanel";
import ProjectWorkspaceBar, { ExportLeadsBar } from "@/components/ProjectWorkspaceBar";
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
} from "@/lib/projects";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "waiting" | "proposal_sent" | "meeting" | "negotiating" | "won" | "lost" | "archive";
type Priority = "low" | "medium" | "high";

interface Prospect {
  id: number;
  projectId?: string;
  businessName: string;
  ownerName: string;
  category: string;
  website: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  facebook: string;
  instagram: string;
  linkedin: string;
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
}

interface HuntedBusiness {
  businessName: string;
  ownerName: string;
  category: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  country: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  softwareNeedScore: number;
  painPoint: string;
  estimatedValue: number;
  notes: string;
  selected?: boolean;
  importing?: boolean;
  imported?: boolean;
  aiAgentType?: string;
  aiAgentScore?: number;
  aiAgentFitReason?: string;
  aiAgentTopPain?: string;
  pitchType?: string;
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
  gmail:   { label: "Gmail",         icon: "G",  colorClass: "text-red-600 bg-red-50 border-red-200",   host: "smtp.gmail.com",        port: 587, hint: "Requires Gmail App Password (not your main password)" },
  outlook: { label: "Outlook / 365", icon: "O",  colorClass: "text-blue-600 bg-blue-50 border-blue-200", host: "smtp-mail.outlook.com", port: 587, hint: "Use your Microsoft account password" },
  brevo:   { label: "Brevo",         icon: "B",  colorClass: "text-teal-600 bg-teal-50 border-teal-200", host: "smtp-relay.brevo.com",  port: 587, hint: "Use Brevo SMTP key as password (not account password)" },
  smtp:    { label: "Custom SMTP",   icon: "⚙",  colorClass: "text-gray-600 bg-gray-50 border-gray-200", host: "",                      port: 587, hint: "Any SMTP-compatible provider" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_PROSPECTS: Prospect[] = [];

function getToken(): string {
  const existing = localStorage.getItem("ds_api_token");
  if (existing) return existing;
  localStorage.setItem("ds_api_token", "admin123");
  return "admin123";
}

function loadProspects(): Prospect[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_PROSPECTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_PROSPECTS;
    const cleaned = parsed.filter(
      (p: any) =>
        p &&
        !String(p.email || "").includes("example.com") &&
        !String(p.website || "").includes("example.com")
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return INITIAL_PROSPECTS;
  }
}

function saveProspects(data: Prospect[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  fetch(`${apiBase()}/api/crm/prospects/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ prospects: data }),
  }).catch(() => {});
}

function apiBase() {
  return API_BASE.replace("/agency-site", "");
}

function handleAuthFailure() {
  localStorage.setItem("ds_api_token", "admin123");
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
  const [form, setForm] = useState({
    label: account?.label ?? "",
    provider: account?.provider ?? "gmail",
    host: account?.host ?? "smtp.gmail.com",
    port: account?.port ?? 587,
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
  const [testTo, setTestTo] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const applyPreset = (provider: string) => {
    const cfg = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.smtp;
    setForm(f => ({ ...f, provider, host: cfg.host, port: cfg.port, secure: false }));
  };

  const adminAuthHeader = (): Record<string, string> => {
    return { Authorization: `Bearer ${getToken()}` };
  };

  const save = async () => {
    if (!form.host || !form.user || (!form.password && !account)) {
      setStatus({ type: "error", msg: "Host, email, and password are required." });
      return;
    }
    setSaving(true); setStatus(null);
    try {
      const url = account ? `${apiBase()}/api/crm/email-accounts/${account.id}` : `${apiBase()}/api/crm/email-accounts`;
      const r = await fetch(url, {
        method: account ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeader() },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || "Save failed");
      onSave(d.account);
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    } finally { setSaving(false); }
  };

  const test = async () => {
    if (!account) { setStatus({ type: "error", msg: "Save the account first, then send a test." }); return; }
    setTesting(true); setStatus(null);
    try {
      const r = await fetch(`${apiBase()}/api/crm/email-accounts/${account.id}/test`, {
        method: "POST", headers: { "Content-Type": "application/json", ...adminAuthHeader() },
        body: JSON.stringify({ to: testTo || form.user }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || `Request failed (${r.status})`);
      setStatus({ type: "success", msg: `Test email sent to ${testTo || form.user}` });
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
            <Switch checked={form.secure} onCheckedChange={v => setForm(f => ({ ...f, secure: v }))} />
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

          {account && (
            <div className="flex gap-2 pt-1">
              <Input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="Test recipient (optional)" className="flex-1" />
              <Button variant="outline" onClick={test} disabled={testing} className="gap-1.5 whitespace-nowrap">
                {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {testing ? "Sending…" : "Send Test"}
              </Button>
            </div>
          )}

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
  const [testStatus, setTestStatus] = useState<Record<number, { type: "success" | "error"; msg: string }>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const adminAuth = (): Record<string, string> => {
    const tok = localStorage.getItem("ds_api_token") ?? "";
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
    try {
      const r = await fetch(`${apiBase()}/api/crm/email-accounts/${acct.id}/test`, {
        method: "POST", headers: { "Content-Type": "application/json", ...adminAuth() },
        body: JSON.stringify({ to: acct.user }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || `Request failed (${r.status})`);
      setTestStatus(prev => ({ ...prev, [acct.id]: { type: "success", msg: "Test email sent!" } }));
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
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const q = JSON.parse(localStorage.getItem("vh_quick_hunt") || "null");
      if (q?.category) return [q.category];
    } catch {}
    if (activeProject?.targetCategory) return [activeProject.targetCategory];
    return ["Restaurant"];
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [city, setCity] = useState(() => {
    try {
      const q = JSON.parse(localStorage.getItem("vh_quick_hunt") || "null");
      if (q?.city) return q.city;
    } catch {}
    return activeProject?.targetCity || "";
  });
  const [country, setCountry] = useState(() => {
    try {
      const q = JSON.parse(localStorage.getItem("vh_quick_hunt") || "null");
      if (q?.country) {
        localStorage.removeItem("vh_quick_hunt");
        return q.country;
      }
    } catch {}
    return activeProject?.targetCountry || "";
  });
  const [count, setCount] = useState("50");
  const [extraContext, setExtraContext] = useState(() => activeProject?.extraContext || "");
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

  // Sync AI Hunter state when user switches from one Project to another
  useEffect(() => {
    if (!activeProject?.id) return;
    const savedProjectResults = loadProjectHuntedResults<HuntedBusiness>(activeProject.id);
    setResults(savedProjectResults);
    setProgress(
      savedProjectResults.length > 0
        ? `Loaded ${savedProjectResults.length} scraped businesses saved in project "${activeProject.name}"`
        : ""
    );
    setError("");
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
  }, [activeProject?.id]);

  // Persist scraped results per project so switching projects never loses scraped leads
  useEffect(() => {
    if (activeProject?.id) {
      saveProjectHuntedResults(activeProject.id, results);
    }
  }, [results, activeProject?.id]);

  const hunt = async () => {
    if (categories.length === 0) { setError("Select at least one business category."); return; }
    const catLabel = categories.length > 1 ? `${categories.length} categories` : categories[0];

    // Dedup helper shared by both modes below — a business can legitimately
    // show up under more than one category search, so we merge by name+city.
    const dedupKey = (b: HuntedBusiness) => `${b.businessName}|${b.city}`.toLowerCase().replace(/[^a-z0-9|]/g, "");

    if (bulkMode) {
      const cityList = bulkCities.split(/[\n,]+/).map(c => c.trim()).filter(Boolean);
      if (cityList.length === 0) { setError("Enter at least one city in the list."); return; }
      setHunting(true); setError(""); setResults([]);
      setProgress(`🌍 Bulk hunting ${catLabel} across ${cityList.length} cities — this takes a few minutes…`);
      try {
        const seen = new Set<string>();
        const merged: HuntedBusiness[] = [];
        let totalFiltered = 0;
        const cityResultsAgg: Record<string, number> = {};
        // One bulk-hunt call per selected category — each call already covers
        // every city in cityList server-side, then we merge + dedupe here.
        for (const cat of categories) {
          const resp = await callCRM("bulk-hunt", {
            category: cat,
            cities: cityList,
            country: country.trim(),
            countPerCity: Number(count),
            extraContext,
          });
          const businesses: HuntedBusiness[] = Array.isArray(resp) ? resp : (resp.prospects ?? []);
          totalFiltered += resp.filtered ?? 0;
          for (const b of businesses) {
            const key = dedupKey(b);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({ ...b, selected: true, imported: false, importing: false });
          }
          if (resp.cityResults) {
            for (const [c, n] of Object.entries(resp.cityResults as Record<string, number>)) {
              cityResultsAgg[c] = (cityResultsAgg[c] ?? 0) + Number(n);
            }
          }
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
      setHunting(true); setError(""); setResults([]); setProgress(`🔍 AI is scanning for ${catLabel} businesses…`);
      try {
        const seen = new Set<string>();
        const merged: HuntedBusiness[] = [];
        let totalFiltered = 0;
        for (const cat of categories) {
          const resp = await callCRM("hunt-businesses", {
            category: cat, city: city.trim(), country: country.trim(), count: Number(count), extraContext,
          });
          const businesses: HuntedBusiness[] = Array.isArray(resp) ? resp : (resp.prospects ?? []);
          totalFiltered += resp.filtered ?? 0;
          for (const b of businesses) {
            const key = dedupKey(b);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({ ...b, selected: true, imported: false, importing: false });
          }
        }
        setResults(merged);
        const filterNote = totalFiltered > 0 ? ` (${totalFiltered} with dead domains removed)` : "";
        setProgress(`✓ Found ${merged.length} ${catLabel} businesses in ${city}${filterNote}`);
      } catch (e: any) {
        setError(e.message); setProgress("");
      } finally { setHunting(false); }
    }
  };

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

    for (let i = 0; i < results.length; i++) {
      const b = results[i];
      if (!b.selected || b.imported) continue;

      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, importing: true } : r));

      let prospect: Omit<Prospect, "id" | "addedAt"> = {
        businessName: b.businessName,
        ownerName: b.ownerName,
        category: b.category,
        website: b.website,
        email: b.email,
        phone: b.phone,
        country: b.country,
        city: b.city,
        facebook: b.facebook,
        instagram: b.instagram,
        linkedin: b.linkedin,
        status: "new",
        priority: b.softwareNeedScore >= 8 ? "high" : b.softwareNeedScore >= 5 ? "medium" : "low",
        expectedValue: b.estimatedValue,
        probability: 20,
        nextFollowUp: "",
        notes: b.painPoint || b.notes || "",
        hunted: true,
        painPoint: b.painPoint,
      };

      if (autoGenerate) {
        try {
          const generated = await callCRM("auto-generate", {
            businessName: b.businessName, category: b.category,
            website: b.website, city: b.city, country: b.country,
            ownerName: b.ownerName, painPoint: b.painPoint, agencyName: AGENCY_NAME,
          });
          if (generated.analysis) prospect.analysis = generated.analysis;
          if (generated.email) prospect.generatedEmail = generated.email;
          if (generated.whatsapp) prospect.generatedWhatsApp = generated.whatsapp;
          if (generated.linkedin) prospect.generatedLinkedIn = generated.linkedin;
          // Store report link so it can be injected when the email is sent
          if (generated.reportId) prospect.reportId = generated.reportId;
          if (generated.reportUrl) prospect.reportUrl = generated.reportUrl;
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
        } catch { /* continue without AI data */ }
      }

      toImport.push(prospect);
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, importing: false, imported: true } : r));
    }

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
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-3 bg-muted/20 border-b border-border/50 flex items-center justify-between">
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
        </div>
        <div className="px-4 pb-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
          <Button onClick={hunt} disabled={hunting || categories.length === 0 || (!bulkMode && !city.trim()) || (bulkMode && !bulkCities.trim())} className="w-full gap-2 btn-premium text-white font-bold h-11">
            {hunting
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> {bulkMode ? "Bulk hunting across cities…" : "Hunting businesses…"}</>
              : bulkMode
              ? <><Globe className="w-4 h-4" /> Start Bulk Hunt ({bulkCities.split(/[\n,]+/).filter(c => c.trim()).length} cities × {categories.length || 1} categor{categories.length === 1 ? "y" : "ies"} × {count})</>
              : <><Radar className="w-4 h-4" /> Start AI Hunt ({categories.length || 1} categor{categories.length === 1 ? "y" : "ies"})</>}
          </Button>
        </div>
      </div>

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
          <div className="p-3 bg-muted/20 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-semibold">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectAll ? "bg-primary border-primary" : "border-gray-300"}`}>
                  {selectAll && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                Select All
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedCount} selected {activeProject ? `· Saving to "${activeProject.name}"` : ""}
              </span>
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

          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            {results.map((b, i) => (
              <div key={i} className={`p-4 flex items-start gap-3 transition-colors ${b.imported ? "bg-green-50/60" : b.selected ? "" : "opacity-60"}`}>
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm">{b.businessName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {b.ownerName && <span>{b.ownerName}</span>}
                        {b.email && <span className="text-primary">{b.email}</span>}
                        {b.phone && <span>{b.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.softwareNeedScore >= 8 ? "bg-red-100 text-red-700" : b.softwareNeedScore >= 5 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {b.softwareNeedScore}/10 need
                      </div>
                      {b.estimatedValue > 0 && (
                        <div className="text-xs font-bold text-purple-700">${b.estimatedValue.toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  {b.painPoint && <p className="text-xs text-muted-foreground mt-1.5 italic">"{b.painPoint}"</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {b.website && <span className="text-xs text-primary flex items-center gap-0.5"><Globe className="w-3 h-3" />{b.website}</span>}
                    {b.imported && <span className="text-xs font-bold text-green-700">✓ Imported {autoGenerate ? "+ AI Generated" : ""}</span>}
                  </div>
                </div>
              </div>
            ))}
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

  const analyze = async () => {
    setLoading(true); setError("");
    try {
      const data = await callCRM("analyze-website", {
        website: prospect.website, businessName: prospect.businessName, category: prospect.category,
      });
      onUpdate({
        ...prospect,
        analysis: data,
        reportId: data.reportId || prospect.reportId,
        reportUrl: data.reportUrl || prospect.reportUrl,
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const a = prospect.analysis;
  if (loading) return <LoadingSpinner text="AI is analyzing the business…" />;

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
              <span>Best-Fit Offer from Your Trained AI Catalog: <strong>{a.matchedOffer || a.projectType}</strong></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {prospect.reportId && (
            <a href={`/report/${prospect.reportId}`}>
              <Button size="sm" variant="outline" className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
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
          {Object.entries(a.checks).map(([k, v]) => (
            <div key={k} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${v ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {v ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
              {CHECK_LABELS[k] || k}
            </div>
          ))}
        </div>
      </div>

      {a.issues.length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 bg-muted/20 border-b border-border/50">
            <h4 className="text-sm font-bold">Issues Found ({a.issues.length})</h4>
          </div>
          <div className="divide-y divide-border/30">
            {a.issues.map((issue, i) => (
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

      {a.opportunities.length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 bg-muted/20 border-b border-border/50">
            <h4 className="text-sm font-bold">Revenue Opportunities</h4>
          </div>
          <div className="divide-y divide-border/30">
            {a.opportunities.map((op, i) => (
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

      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
        <h4 className="font-bold text-sm text-purple-900 mb-3">Project Estimate</h4>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Type</div>
            <div className="font-bold text-sm mt-1">{a.projectType}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Est. Value</div>
            <div className="font-bold text-sm mt-1 text-purple-700">${a.estimatedValue.min.toLocaleString()} – ${a.estimatedValue.max.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Delivery</div>
            <div className="font-bold text-sm mt-1">{a.deliveryWeeks.min}–{a.deliveryWeeks.max} weeks</div>
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
  const [followupDay, setFollowupDay] = useState("3");
  const [followup, setFollowup] = useState<{ subject: string; body: string } | null>(null);
  const [error, setError] = useState("");
  const [sendStatus, setSendStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

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

  const genEmail = async () => {
    setLoadingEmail(true); setError("");
    try {
      const data = await callCRM("generate-email", {
        businessName: prospect.businessName, ownerName: prospect.ownerName,
        category: prospect.category, website: prospect.website,
        issues, opportunities, agencyName: AGENCY_NAME,
        reportUrl: prospect.reportUrl || "",
      });
      // If API returned versions (A/B/C), store them; default to version A
      const versions: { version: string; subject: string; body: string }[] = data.versions || [];
      const primary = versions[0] ?? { version: "A", subject: data.subject, body: data.body };
      onUpdate({
        ...prospect,
        generatedEmail: {
          subject: primary.subject,
          body: primary.body,
          emailVersions: versions.length > 0 ? versions : undefined,
          selectedVersion: primary.version || "A",
        },
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoadingEmail(false); }
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

  const sendTrainedOutreachNow = async () => {
    setSendingTrained(true);
    setError("");
    setSendStatus(null);
    try {
      const resp = await callCRM("send-trained-outreach", {
        businessName: prospect.businessName,
        ownerName: prospect.ownerName,
        category: prospect.category,
        website: prospect.website,
        email: prospect.email,
        city: prospect.city,
        country: prospect.country,
        painPoint: prospect.painPoint,
        issues,
        opportunities,
        reportUrl: prospect.reportUrl || "",
      });

      const nextProspect: Prospect = {
        ...prospect,
        generatedEmail: resp.generatedEmail || prospect.generatedEmail,
        reportId: resp.reportId || prospect.reportId,
        reportUrl: resp.reportUrl || prospect.reportUrl,
        status: resp.sent ? "contacted" : prospect.status,
        emailSentAt: resp.emailSentAt || prospect.emailSentAt,
      };
      onUpdate(nextProspect);
      setSendStatus({
        type: resp.sent ? "success" : "error",
        msg: resp.message || (resp.sent ? `Trained AI email sent to ${prospect.email}` : `Generated personalized email (connect SMTP inbox to send live)`),
      });
    } catch (e: any) {
      setSendStatus({ type: "error", msg: e.message });
    } finally {
      setSendingTrained(false);
    }
  };

  const genWA = async () => {
    setLoadingWA(true); setError("");
    try {
      const data = await callCRM("generate-whatsapp", {
        businessName: prospect.businessName, category: prospect.category,
        opportunities, agencyName: AGENCY_NAME,
      });
      onUpdate({ ...prospect, generatedWhatsApp: data.message });
    } catch (e: any) { setError(e.message); }
    finally { setLoadingWA(false); }
  };

  const genLI = async () => {
    setLoadingLI(true); setError("");
    try {
      const data = await callCRM("generate-linkedin", {
        businessName: prospect.businessName, ownerName: prospect.ownerName,
        category: prospect.category, agencyName: AGENCY_NAME,
      });
      onUpdate({ ...prospect, generatedLinkedIn: data.message });
    } catch (e: any) { setError(e.message); }
    finally { setLoadingLI(false); }
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
    } catch (e: any) { setError(e.message); }
    finally { setLoadingFollowup(false); }
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

      {/* Email */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Cold Email
            {prospect.emailSentAt && <span className="text-xs text-green-600 font-normal">✓ Sent {new Date(prospect.emailSentAt).toLocaleDateString()}</span>}
          </h4>
          <div className="flex flex-wrap gap-2">
            {prospect.generatedEmail && <CopyButton text={`Subject: ${prospect.generatedEmail.subject}\n\n${prospect.generatedEmail.body}`} />}
            <Button size="sm" variant="outline" onClick={genEmail} disabled={loadingEmail || sendingTrained} className="h-7 text-xs gap-1">
              {loadingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {prospect.generatedEmail ? "Regenerate" : "Generate"}
            </Button>
            <Button
              size="sm"
              onClick={sendTrainedOutreachNow}
              disabled={sendingTrained || loadingEmail}
              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {sendingTrained ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {sendingTrained ? "Training & Sending…" : "Trigger Trained AI Send"}
            </Button>
            {prospect.generatedEmail && prospect.email && (
              <Button size="sm" onClick={sendEmail} disabled={sendingEmail}
                className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-white font-semibold">
                {sendingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {sendingEmail ? "Sending…" : "Send Now"}
              </Button>
            )}
          </div>
        </div>
        {/* A/B/C version tabs — shown when multiple versions are available */}
        {!loadingEmail && prospect.generatedEmail?.emailVersions && prospect.generatedEmail.emailVersions.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50 bg-muted/10">
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
            <span className="ml-auto text-xs text-muted-foreground">Pick the best variant before sending</span>
          </div>
        )}
        {loadingEmail ? <LoadingSpinner text="Crafting personalized email…" /> : prospect.generatedEmail ? (
          <div className="p-4 space-y-3">
            {prospect.email && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
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
              rows={10} className="text-sm font-mono" />
            {!prospect.email && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No email address for this prospect — add one to enable sending.
              </div>
            )}
          </div>
        ) : <div className="p-6 text-center text-sm text-muted-foreground">Click Generate to create a personalized email for {prospect.businessName}</div>}
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
        {loadingWA ? <LoadingSpinner text="Writing WhatsApp message…" /> : prospect.generatedWhatsApp ? (
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
        {loadingLI ? <LoadingSpinner text="Writing LinkedIn message…" /> : prospect.generatedLinkedIn ? (
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
        {loadingFollowup ? <LoadingSpinner text="Writing follow-up…" /> : followup ? (
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
    try {
      const a = prospect.analysis;
      const data = await callCRM("generate-proposal", {
        businessName: prospect.businessName, category: prospect.category,
        website: prospect.website, agencyName: AGENCY_NAME,
        issues: a?.issues.map(i => i.title).join(", ") || "",
        features: a?.recommendedFeatures.join(", ") || "",
        estimatedValue: a ? `${a.estimatedValue.min.toLocaleString()} – ${a.estimatedValue.max.toLocaleString()}` : "",
        customPrice: customPrice.trim() || undefined,
        customDuration: customDuration.trim() || undefined,
      });
      onUpdate({ ...prospect, proposal: data });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const p = prospect.proposal?.sections;
  if (loading) return <LoadingSpinner text="AI is generating your proposal…" />;

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
  const cfg = STATUS_CONFIG[prospect.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="font-extrabold text-xl flex items-center gap-2">
            {prospect.businessName}
            {prospect.hunted && <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Radar className="w-3 h-3" /> AI Hunted</span>}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-xs`}>{cfg.label}</Badge>
            {prospect.category && <span className="text-xs text-muted-foreground">{prospect.category}</span>}
            {prospect.city && <span className="text-xs text-muted-foreground">{prospect.city}{prospect.country ? `, ${prospect.country}` : ""}</span>}
            {prospect.priority === "high" && <span className="text-xs font-bold text-red-600">🔴 High Priority</span>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        <Button size="sm" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
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

      <Tabs defaultValue="analysis">
        <TabsList className="w-full">
          <TabsTrigger value="analysis" className="flex-1">AI Analysis</TabsTrigger>
          <TabsTrigger value="outreach" className="flex-1">Outreach</TabsTrigger>
          <TabsTrigger value="proposal" className="flex-1">Proposal</TabsTrigger>
          <TabsTrigger value="tracking" className="flex-1 gap-1"><Eye className="w-3.5 h-3.5" />Tracking</TabsTrigger>
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

type SortKey = "ai-score" | "value" | "added";

function ProspectList({
  prospects,
  onSelect,
  onDelete,
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
  const [sortBy, setSortBy] = useState<SortKey>("ai-score");
  const [trackingStats, setTrackingStats] = useState<Record<string, TrackingStats>>({});

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
      const matchSearch = !q || p.businessName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchStatus && matchCat;
    })
    .sort((a, b) => {
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

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search business, email, city…" value={search} onChange={e => setSearch(e.target.value)} />
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
          <SelectTrigger className="w-40">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai-score">AI Score ↓</SelectItem>
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
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p)}
                className="p-3.5 sm:p-4 flex items-center gap-3 hover:bg-muted/20 transition-colors group cursor-pointer"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm flex items-center justify-center flex-shrink-0">
                  {p.businessName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{p.businessName}</span>
                    <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-xs h-5`}>{cfg.label}</Badge>
                    {p.priority === "high" && <span className="text-xs text-red-600 font-bold">🔴</span>}
                    {p.hunted && <span className="text-xs text-purple-600 font-bold flex items-center gap-0.5"><Radar className="w-3 h-3" /></span>}
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
                    {p.email && trackingStats[p.email]?.opens > 0 && (
                      <span className="text-xs font-bold text-blue-600 inline-flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> Opened {trackingStats[p.email].opens}×
                      </span>
                    )}
                    {p.email && trackingStats[p.email]?.clicks > 0 && (
                      <span className="text-xs font-bold text-orange-600">🔗 Clicked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground flex-wrap">
                    {p.category && <span>{p.category}</span>}
                    {p.city && <span>{p.city}{p.country ? `, ${p.country}` : ""}</span>}
                    {p.email && <span className="truncate max-w-[220px] sm:max-w-none">{p.email}</span>}
                    {p.expectedValue > 0 && <span className="text-purple-700 font-semibold">${p.expectedValue.toLocaleString()}</span>}
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
        <div className="p-3 bg-muted/20 border-b border-border/50 flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          <h4 className="font-bold text-sm">Hunt Settings</h4>
          <span className="text-xs text-muted-foreground ml-1">— who to find</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Business Category</label>
            <Select value={settings.huntCategory} onValueChange={v => save({ huntCategory: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Businesses per Run</label>
            <Input type="number" min={5} max={100} value={settings.huntCount}
              onChange={e => setSettings(s => s ? { ...s, huntCount: Number(e.target.value) } : s)}
              onBlur={() => save({ huntCount: settings.huntCount })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">City</label>
            <Input value={settings.huntCity} placeholder="e.g. Lagos, London, Dubai"
              onChange={e => setSettings(s => s ? { ...s, huntCity: e.target.value } : s)}
              onBlur={() => save({ huntCity: settings.huntCity })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Country</label>
            <Input value={settings.huntCountry} placeholder="e.g. Nigeria, UK, UAE"
              onChange={e => setSettings(s => s ? { ...s, huntCountry: e.target.value } : s)}
              onBlur={() => save({ huntCountry: settings.huntCountry })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Extra Context (optional)</label>
            <Input value={settings.huntExtraContext} placeholder="e.g. focus on mid-size, avoid chains"
              onChange={e => setSettings(s => s ? { ...s, huntExtraContext: e.target.value } : s)}
              onBlur={() => save({ huntExtraContext: settings.huntExtraContext })} />
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

      {/* Stats */}
      {status?.stats && Object.keys(status.stats).length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 bg-muted/20 border-b border-border/50">
            <h4 className="font-bold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Run Stats</h4>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {Object.entries(status.stats).map(([k, v]) => (
              <div key={k} className="text-center rounded-lg border border-border/50 p-3">
                <div className="text-2xl font-extrabold text-primary">{String(v)}</div>
                <div className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
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

  if (loading) return <LoadingSpinner text="Loading Website Audit Reports…" />;

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
                <a href={`/report/${r.reportId}`}>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> View Report
                  </Button>
                </a>
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
  const [canUseWebsiteBuilder, setCanUseWebsiteBuilder] = useState<boolean>(() =>
    isUserAdmin(getCachedSaasUser())
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
    getToken();
    // Sync initial prospects into PostgreSQL on mount
    saveProspects(loadProspects());
    syncProjectsFromServer().then((merged) => {
      if (merged.length > 0) setProjects(merged);
    });
    saasFetch<{ allowed?: boolean }>("/api/website-builder/access")
      .then((res) => {
        if (typeof res?.allowed === "boolean") {
          setCanUseWebsiteBuilder(res.allowed || isUserAdmin(getCachedSaasUser()));
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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-sm">
                <Radar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight">Vanguard Hunter CRM</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Autonomous B2B Lead Discovery, Website Audit Engine, Cold Email Outreach & Sales CRM
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
                  window.location.href = "/dashboard";
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <a
              href="/landing"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Landing Page
            </a>
            <a
              href="/dashboard"
              className="px-3 py-2 text-xs font-semibold text-slate-800 hover:text-slate-950 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              User Dashboard
            </a>
            {isUserAdmin(getCachedSaasUser()) && (
              <a
                href="/admin"
                className="px-3 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Admin Panel
              </a>
            )}
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
            {canUseWebsiteBuilder && (
              <TabsTrigger value="website-builder" className="flex-1 gap-1.5 text-amber-700 font-bold">
                <Sparkles className="w-4 h-4 text-amber-600" /> AI Website Builder (Owner)
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

          {canUseWebsiteBuilder && (
            <TabsContent value="website-builder">
              <div className="bg-slate-950 rounded-2xl p-4 sm:p-6 text-slate-100">
                <OwnerWebsiteBuilderPanel externalLeads={activeProjectExportableLeads} />
              </div>
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
