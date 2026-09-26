import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Plus, Globe, Mail, Phone, Trash2, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, Users, Target, Sparkles, X, Building,
  Radar, ExternalLink, PlayCircle, PauseCircle, ChevronRight,
  FileText, Send, Zap, BarChart3, Download, Check, Copy, Megaphone,
} from "lucide-react";
import API_BASE from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  description: string;
  emailSubject: string;
  emailTemplate: string;
  affiliateLink: string;
  sendIntervalMinutes: number;
  status: "draft" | "running" | "paused" | "completed";
  sentCount: number;
  failedCount: number;
  totalContacts: number;
  opensCount: number;
  clicksCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AffContact {
  id: number;
  campaignId: number;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  country: string;
  category: string;
  status: "pending" | "sent" | "failed" | "skipped";
  generatedMessage: string;
  generatedSubject: string;
  sentAt: string | null;
  errorMsg: string;
  createdAt: string;
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
  softwareNeedScore: number;
  painPoint: string;
  selected?: boolean;
  imported?: boolean;
}

interface Progress {
  campaign: Campaign;
  breakdown: { pending: number; sent: number; failed: number; skipped: number };
  isRunning: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AFFILIATE_CATEGORIES = [
  // Agriculture & Farming
  "Hobby Farm", "Livestock Feed & Agricultural Suppliers", "Farm Supply Store",
  "Organic Farm", "Ranch & Livestock Farm",
  // Automotive
  "Auto Repair Shop & Independent Mechanic", "Auto Body Shop", "Tire Shop",
  "Oil Change & Lube Shop", "Mobile Mechanic", "Auto Repair", "Car Dealer",
  // Food & Beverage
  "Restaurant", "Bakery", "Café / Coffee Shop", "Bar & Lounge", "Catering", "Food Truck",
  // Health & Medical
  "Clinic", "Dentist", "Pharmacy", "Physiotherapy", "Vet Clinic",
  // Beauty & Wellness
  "Salon", "Barbershop", "Spa & Wellness", "Nail Studio",
  // Fitness
  "Gym", "Yoga Studio", "Pilates Studio", "Martial Arts School",
  // Professional Services
  "Lawyer", "Accountant", "Insurance", "Consultant", "Financial Advisor",
  // Home & Trade
  "Construction", "Electrician", "Plumber", "Landscaping", "Cleaning Service",
  "HVAC Company", "Roofing Company", "Solar Company",
  // Retail
  "Pet Shop", "Clothing Store", "Electronics Store", "Furniture Store", "Gift Shop",
  // Hospitality
  "Hotel", "Guesthouse / B&B", "Travel Agency",
  // Events & Creative
  "Event Planner", "Photography Studio", "Wedding Planner", "Florist",
  // Technology
  "IT Services", "Web Agency",
  "Other",
];

const TEMPLATE_VARS = [
  { key: "{{businessName}}", label: "Business Name" },
  { key: "{{ownerName}}", label: "Owner Name" },
  { key: "{{city}}", label: "City" },
  { key: "{{category}}", label: "Category" },
  { key: "{{website}}", label: "Website" },
  { key: "{{affiliateLink}}", label: "Affiliate Link" },
];

const INTERVAL_OPTIONS = [
  { value: "1", label: "1 minute" },
  { value: "2", label: "2 minutes" },
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:     { label: "Draft",     color: "text-gray-600",   bg: "bg-gray-100",   icon: <FileText className="w-3 h-3" /> },
  running:   { label: "Running",   color: "text-green-700",  bg: "bg-green-100",  icon: <PlayCircle className="w-3 h-3" /> },
  paused:    { label: "Paused",    color: "text-yellow-700", bg: "bg-yellow-100", icon: <PauseCircle className="w-3 h-3" /> },
  completed: { label: "Completed", color: "text-blue-700",   bg: "bg-blue-100",   icon: <CheckCircle2 className="w-3 h-3" /> },
};

const CONTACT_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "text-gray-600",   bg: "bg-gray-100" },
  sent:     { label: "Sent ✓",   color: "text-green-700",  bg: "bg-green-100" },
  failed:   { label: "Failed",   color: "text-red-700",    bg: "bg-red-100" },
  skipped:  { label: "Skipped",  color: "text-yellow-700", bg: "bg-yellow-100" },
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() {
  const existing = localStorage.getItem("ds_api_token");
  if (existing) return existing;
  localStorage.setItem("ds_api_token", "admin123");
  return "admin123";
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}
function apiBase() {
  return (API_BASE || "").replace(/\/agency-site\/?$/, "");
}
async function afetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${apiBase()}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || res.statusText); }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CampaignBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.color} ${s.bg}`}>
      {s.icon}{s.label}
    </span>
  );
}

function ContactStatusBadge({ status }: { status: string }) {
  const s = CONTACT_STATUS_STYLES[status] || CONTACT_STATUS_STYLES.pending;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.color} ${s.bg}`}>{s.label}</span>;
}

// ─── Hunt Tab ─────────────────────────────────────────────────────────────────

function HuntTab({ campaignId, onImported }: { campaignId: number; onImported: () => void }) {
  const [category, setCategory] = useState("Restaurant");
  const [categorySearch, setCategorySearch] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [count, setCount] = useState("30");
  const [hunting, setHunting] = useState(false);
  const [results, setResults] = useState<HuntedBusiness[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const hunt = async () => {
    if (!city.trim()) { setError("Enter a city to hunt in."); return; }
    setHunting(true); setError(""); setResults([]);
    setProgress(`🔍 Scanning for ${category} businesses in ${city}…`);
    try {
      const resp = await afetch("/api/crm/hunt-businesses", {
        method: "POST",
        body: JSON.stringify({ category, city: city.trim(), country: country.trim(), count: Number(count) }),
      });
      const businesses: HuntedBusiness[] = Array.isArray(resp) ? resp : (resp.prospects ?? []);
      setResults(businesses.map(b => ({ ...b, selected: true, imported: false })));
      setProgress(`✓ Found ${businesses.length} ${category} businesses in ${city}${resp.filtered ? ` (${resp.filtered} dead domains removed)` : ""}`);
    } catch (e: any) { setError(e.message); setProgress(""); }
    finally { setHunting(false); }
  };

  const toggleAll = () => {
    const allSelected = results.every(b => b.selected);
    setResults(prev => prev.map(b => ({ ...b, selected: !allSelected })));
  };

  const importSelected = async () => {
    const selected = results.filter(b => b.selected && !b.imported);
    if (selected.length === 0) return;
    setImporting(true);
    try {
      await afetch(`/api/affiliate/campaigns/${campaignId}/contacts`, {
        method: "POST",
        body: JSON.stringify({
          contacts: selected.map(b => ({
            businessName: b.businessName, ownerName: b.ownerName,
            email: b.email, phone: b.phone, website: b.website,
            city: b.city, country: b.country, category: b.category,
          }))
        }),
      });
      setResults(prev => prev.map(b => b.selected ? { ...b, imported: true, selected: false } : b));
      onImported();
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  };

  const selectedCount = results.filter(b => b.selected && !b.imported).length;
  const filteredCategories = AFFILIATE_CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold">Business Hunter</h3>
            <p className="text-white/75 text-sm">Find real businesses to add as affiliate contacts</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category search */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Business Category</label>
          <Input placeholder="Search categories…" value={categorySearch} onChange={e => setCategorySearch(e.target.value)} className="h-9" />
          <div className="border rounded-xl h-44 overflow-y-auto p-2 space-y-0.5">
            {filteredCategories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${category === c ? "bg-violet-100 text-violet-800 font-semibold" : "hover:bg-gray-100 text-gray-700"}`}>
                {c}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">Selected: <span className="font-semibold text-violet-700">{category}</span></p>
        </div>

        {/* Location & count */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-700">City *</label>
            <Input placeholder="e.g. Austin, TX" value={city} onChange={e => setCity(e.target.value)} className="h-9 mt-1" onKeyDown={e => e.key === "Enter" && hunt()} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Country (optional)</label>
            <Input placeholder="e.g. United States" value={country} onChange={e => setCountry(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Results to fetch</label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["10","20","30","50","100"].map(n => <SelectItem key={n} value={n}>{n} businesses</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={hunt} disabled={hunting} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold h-10">
            {hunting ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Hunting…</> : <><Radar className="w-4 h-4 mr-2" />Hunt Businesses</>}
          </Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {progress && <div className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2">{progress}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">{results.length} results</h4>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleAll} className="h-8 text-xs">
                {results.every(b => b.selected) ? "Deselect All" : "Select All"}
              </Button>
              <Button size="sm" disabled={selectedCount === 0 || importing}
                onClick={importSelected}
                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
                {importing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                Import {selectedCount > 0 ? `(${selectedCount})` : ""}
              </Button>
            </div>
          </div>
          <div className="border rounded-xl divide-y max-h-96 overflow-y-auto">
            {results.map((b, i) => (
              <div key={i} onClick={() => !b.imported && setResults(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r))}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${b.imported ? "opacity-40 cursor-default" : b.selected ? "bg-violet-50" : "hover:bg-gray-50"}`}>
                <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${b.imported ? "bg-green-500 border-green-500" : b.selected ? "bg-violet-600 border-violet-600" : "border-gray-300"}`}>
                  {(b.selected || b.imported) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-800 truncate">{b.businessName}</span>
                    {b.imported && <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Imported</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-0.5">
                    {b.city && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{b.city}</span>}
                    {b.email && <span className="flex items-center gap-1 text-green-700"><Mail className="w-3 h-3" />{b.email}</span>}
                    {b.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</span>}
                    {b.website && <a href={b.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-violet-600 hover:underline"><Globe className="w-3 h-3" />{b.website.replace(/https?:\/\//, "")}</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ campaign, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
  const [contacts, setContacts] = useState<AffContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [previewContact, setPreviewContact] = useState<AffContact | null>(null);
  const [search, setSearch] = useState("");

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await afetch(`/api/affiliate/campaigns/${campaign.id}/contacts`);
      setContacts(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [campaign.id]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const deleteContact = async (id: number) => {
    await afetch(`/api/affiliate/contacts/${id}`, { method: "DELETE" }).catch(() => {});
    setContacts(prev => prev.filter(c => c.id !== id));
    onRefresh();
  };

  const resetContact = async (id: number) => {
    await afetch(`/api/affiliate/contacts/${id}/reset`, { method: "POST" }).catch(() => {});
    loadContacts();
  };

  const generateAll = async () => {
    setGenerating(true);
    setGenProgress("Generating personalised messages…");
    try {
      const resp = await afetch(`/api/affiliate/campaigns/${campaign.id}/generate-messages`, { method: "POST", body: JSON.stringify({}) });
      setGenProgress(`✓ Generated ${resp.generated} messages${resp.errors?.length ? ` (${resp.errors.length} errors)` : ""}`);
      await loadContacts();
    } catch (e: any) { setGenProgress(`Error: ${e.message}`); }
    finally { setGenerating(false); }
  };

  const filtered = contacts.filter(c =>
    !search || c.businessName.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase())
  );

  const stats = { pending: 0, sent: 0, failed: 0, skipped: 0 };
  contacts.forEach(c => { if (stats[c.status as keyof typeof stats] !== undefined) stats[c.status as keyof typeof stats]++; });
  const withMsg = contacts.filter(c => c.generatedMessage).length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: contacts.length, color: "text-gray-800" },
          { label: "Pending", value: stats.pending, color: "text-gray-600" },
          { label: "Sent", value: stats.sent, color: "text-green-700" },
          { label: "Messages ready", value: withMsg, color: "text-violet-700" },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 border rounded-xl p-3 text-center">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Input placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-full sm:max-w-xs" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={loadContacts} className="h-8 gap-1 flex-shrink-0">
            <RefreshCw className="w-3 h-3" />Refresh
          </Button>
          <Button size="sm" onClick={generateAll} disabled={generating || contacts.length === 0}
            className="h-8 gap-1 bg-violet-600 hover:bg-violet-700 text-white flex-1 sm:flex-none">
            {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Generate All Messages
          </Button>
        </div>
      </div>

      {genProgress && <div className="text-sm bg-violet-50 border border-violet-200 text-violet-800 rounded-xl px-4 py-2">{genProgress}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Loading contacts…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No contacts yet</p>
          <p className="text-sm mt-1">Use the Hunt tab to find and import businesses</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Business", "Email", "City", "Status", "Message", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-800 truncate max-w-[160px]">{c.businessName}</div>
                      {c.ownerName && <div className="text-xs text-gray-500">{c.ownerName}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${c.email ? "text-gray-700" : "text-gray-400 italic"}`}>
                        {c.email || "No email"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{c.city || "—"}</td>
                    <td className="px-4 py-2.5">
                      <ContactStatusBadge status={c.status} />
                      {c.errorMsg && <p className="text-xs text-red-500 mt-0.5 max-w-[120px] truncate" title={c.errorMsg}>{c.errorMsg}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.generatedMessage ? (
                        <button onClick={() => setPreviewContact(c)}
                          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900 font-medium">
                          <FileText className="w-3 h-3" />Preview
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {(c.status === "failed" || c.status === "skipped") && (
                          <button onClick={() => resetContact(c.id)} title="Reset to pending"
                            className="p-1 text-gray-400 hover:text-yellow-600 transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => deleteContact(c.id)} title="Delete"
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message preview dialog */}
      <Dialog open={!!previewContact} onOpenChange={() => setPreviewContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generated Message — {previewContact?.businessName}</DialogTitle></DialogHeader>
          {previewContact && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">SUBJECT</p>
                <p className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium">{previewContact.generatedSubject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">BODY</p>
                <pre className="bg-gray-50 rounded-lg px-3 py-3 text-sm whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">{previewContact.generatedMessage}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Template Tab ─────────────────────────────────────────────────────────────

function TemplateTab({ campaign, onSaved }: { campaign: Campaign; onSaved: (updated: Campaign) => void }) {
  const [subject, setSubject] = useState(campaign.emailSubject);
  const [template, setTemplate] = useState(campaign.emailTemplate);
  const [affiliateLink, setAffiliateLink] = useState(campaign.affiliateLink || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setSubject(campaign.emailSubject);
    setTemplate(campaign.emailTemplate);
    setAffiliateLink(campaign.affiliateLink || "");
  }, [campaign]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await afetch(`/api/affiliate/campaigns/${campaign.id}`, {
        method: "PUT",
        body: JSON.stringify({ emailSubject: subject, emailTemplate: template, affiliateLink }),
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const insertVar = (key: string) => {
    setTemplate(prev => prev + key);
  };

  const copyVar = (key: string) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const DEFAULT_TEMPLATE = `Hi {{ownerName}},

I came across {{businessName}} in {{city}} and wanted to reach out.

We have an affiliate programme that could be a great fit for {{category}} businesses like yours.

Would you be open to a quick chat about how we can work together?

Best,
[Your Name]`;

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2"><FileText className="w-4 h-4" />Email Template</h4>
        <p className="text-sm text-amber-700">Write your template once — the AI will personalise it for each contact. Use variables below to insert dynamic values.</p>
      </div>

      {/* Variables */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Available variables (click to copy):</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_VARS.map(v => (
            <button key={v.key} onClick={() => copyVar(v.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-mono rounded-lg hover:bg-violet-100 transition-colors">
              {copied === v.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {v.key}
              <span className="text-violet-500 font-sans">· {v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Affiliate Link */}
      <div>
        <label className="text-sm font-semibold text-gray-700">Affiliate Link <span className="text-gray-400 font-normal">(optional)</span></label>
        <Input
          placeholder="https://your-affiliate-link.com/ref=abc123"
          value={affiliateLink}
          onChange={e => setAffiliateLink(e.target.value)}
          className="mt-1 font-mono text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Paste your affiliate URL. The AI will embed it naturally as a call-to-action, and clicks will be tracked. Use <span className="font-mono bg-gray-100 px-1 rounded">{"{{affiliateLink}}"}</span> in the template to place it manually.</p>
      </div>

      {/* Subject */}
      <div>
        <label className="text-sm font-semibold text-gray-700">Email Subject *</label>
        <Input
          placeholder="e.g. Partnership opportunity for {{businessName}}"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Template body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-semibold text-gray-700">Email Body *</label>
          {!template && (
            <button onClick={() => setTemplate(DEFAULT_TEMPLATE)}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium">
              Use starter template
            </button>
          )}
        </div>
        <Textarea
          placeholder={`Write your email template here. Use {{businessName}}, {{ownerName}}, {{city}}, etc.\n\nThe AI will personalise this for each contact when you generate messages.`}
          value={template}
          onChange={e => setTemplate(e.target.value)}
          className="min-h-[280px] font-mono text-sm resize-y"
        />
        <p className="text-xs text-gray-400 mt-1">{template.length} characters · ~{Math.ceil(template.split(/\s+/).length)} words</p>
      </div>

      <Button onClick={save} disabled={saving || !subject.trim() || !template.trim()}
        className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6">
        {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
        {saved ? "Saved!" : saving ? "Saving…" : "Save Template"}
      </Button>
    </div>
  );
}

// ─── Send Tab ─────────────────────────────────────────────────────────────────

interface Analytics { sent: number; opens: number; clicks: number; uniqueOpens: number; uniqueClicks: number; openRate: number; clickRate: number; }

function SendTab({ campaign, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [interval, setInterval] = useState(String(campaign.sendIntervalMinutes || 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProgress = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const [data, analyticsData] = await Promise.all([
        afetch(`/api/affiliate/campaigns/${campaign.id}/progress`),
        afetch(`/api/affiliate/campaigns/${campaign.id}/analytics`).catch(() => null),
      ]);
      setProgress(data);
      if (analyticsData) setAnalytics(analyticsData);
    } catch { /* silent */ }
    finally { setLoadingProgress(false); }
  }, [campaign.id]);

  useEffect(() => {
    loadProgress();
    // Poll every 5s if running
    const id = window.setInterval(() => { if (progress?.isRunning) { loadProgress(); onRefresh(); } }, 5000);
    return () => window.clearInterval(id);
  }, [loadProgress, progress?.isRunning]);

  const saveInterval = async () => {
    setSaving(true);
    try {
      await afetch(`/api/affiliate/campaigns/${campaign.id}`, {
        method: "PUT",
        body: JSON.stringify({ sendIntervalMinutes: Number(interval) }),
      });
      onRefresh();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const start = async () => {
    setError(""); setActioning(true);
    try {
      await afetch(`/api/affiliate/campaigns/${campaign.id}/start`, { method: "POST" });
      await loadProgress();
      onRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setActioning(false); }
  };

  const pause = async () => {
    setActioning(true);
    try {
      await afetch(`/api/affiliate/campaigns/${campaign.id}/pause`, { method: "POST" });
      await loadProgress();
      onRefresh();
    } catch { /* silent */ }
    finally { setActioning(false); }
  };

  const isRunning = progress?.isRunning || campaign.status === "running";
  const bd = progress?.breakdown ?? { pending: 0, sent: 0, failed: 0, skipped: 0 };
  const total = bd.pending + bd.sent + bd.failed + bd.skipped;
  const pct = total > 0 ? Math.round(((bd.sent + bd.failed + bd.skipped) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className={`rounded-2xl p-5 border-2 ${isRunning ? "bg-green-50 border-green-200" : campaign.status === "completed" ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRunning ? "bg-green-100" : "bg-gray-100"}`}>
              {isRunning ? <PlayCircle className="w-5 h-5 text-green-600" /> : <Send className="w-5 h-5 text-gray-500" />}
            </div>
            <div>
              <p className="font-extrabold text-gray-800">{isRunning ? "Campaign is running" : campaign.status === "completed" ? "Campaign completed" : "Ready to send"}</p>
              {isRunning && <p className="text-sm text-green-700">Sending every {campaign.sendIntervalMinutes} minute{campaign.sendIntervalMinutes !== 1 ? "s" : ""} in the background</p>}
            </div>
          </div>
          <CampaignBadge status={campaign.status} />
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{bd.sent + bd.failed + bd.skipped} of {total} processed</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <progress value={pct} max={100} className="w-full h-2.5 rounded-full overflow-hidden accent-violet-600" />
          </div>
        )}

        {/* Breakdown */}
        {total > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: "Pending", value: bd.pending, color: "text-gray-700" },
              { label: "Sent", value: bd.sent, color: "text-green-700" },
              { label: "Failed", value: bd.failed, color: "text-red-700" },
              { label: "Skipped", value: bd.skipped, color: "text-yellow-700" },
            ].map(s => (
              <div key={s.label} className="text-center bg-white/60 rounded-lg p-2">
                <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opens & Clicks Analytics */}
      {analytics && analytics.sent > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-3">
          <h4 className="font-bold text-blue-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Email Analytics
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center border border-blue-100">
              <div className="text-2xl font-extrabold text-blue-700">{analytics.openRate}%</div>
              <div className="text-xs text-gray-500 mt-0.5">Open Rate</div>
              <div className="text-xs text-gray-400">{analytics.uniqueOpens} of {analytics.sent} opened</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-blue-100">
              <div className="text-2xl font-extrabold text-violet-700">{analytics.clickRate}%</div>
              <div className="text-xs text-gray-500 mt-0.5">Click Rate</div>
              <div className="text-xs text-gray-400">{analytics.uniqueClicks} of {analytics.sent} clicked</div>
            </div>
          </div>
          <p className="text-xs text-blue-600/70">Opens and clicks are tracked in real time. Refresh to update.</p>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-4">
        {/* Interval */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1 block">Send interval</label>
          <div className="flex items-center gap-2">
            <Select value={interval} onValueChange={setInterval} disabled={isRunning}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={saveInterval} disabled={saving || isRunning} className="h-9">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">One email sent every {interval} minute{Number(interval) !== 1 ? "s" : ""} to avoid spam filters</p>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {[
            { ok: !!campaign.emailTemplate, label: "Email template set" },
            { ok: !!campaign.emailSubject, label: "Email subject set" },
            { ok: campaign.totalContacts > 0, label: `Contacts imported (${campaign.totalContacts})` },
          ].map(item => (
            <div key={item.label} className={`flex items-center gap-2 text-sm ${item.ok ? "text-green-700" : "text-gray-400"}`}>
              {item.ok ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {item.label}
            </div>
          ))}
        </div>

        {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm"><AlertTriangle className="w-4 h-4" />{error}</div>}

        {/* Start / Pause button */}
        {isRunning ? (
          <Button onClick={pause} disabled={actioning}
            className="w-full h-11 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-base gap-2">
            {actioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-5 h-5" />}
            Pause Campaign
          </Button>
        ) : campaign.status === "completed" ? (
          <div className="text-center py-4 text-green-700 font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />All contacts processed — campaign complete!
          </div>
        ) : (
          <Button onClick={start} disabled={actioning || !campaign.emailTemplate || campaign.totalContacts === 0}
            className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-bold text-base gap-2">
            {actioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
            Start Sending
          </Button>
        )}

        <div className="flex justify-center">
          <button onClick={() => { loadProgress(); onRefresh(); }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loadingProgress ? "animate-spin" : ""}`} />Refresh status
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Campaign Dialog ──────────────────────────────────────────────────────

function NewCampaignDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (c: Campaign) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Campaign name is required"); return; }
    setCreating(true); setError("");
    try {
      const campaign = await afetch("/api/affiliate/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      onCreate(campaign);
      setName(""); setDescription("");
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Affiliate Campaign</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-semibold text-gray-700">Campaign Name *</label>
            <Input placeholder="e.g. Farm Supply Outreach Q3" value={name} onChange={e => setName(e.target.value)}
              className="mt-1" onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Description (optional)</label>
            <Input placeholder="What is this campaign for?" value={description} onChange={e => setDescription(e.target.value)} className="mt-1" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-violet-600 hover:bg-violet-700 text-white">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}Create Campaign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AffiliateHunter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hunt");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data: Campaign[] = await afetch("/api/affiliate/campaigns");
      setCampaigns(data);
      // Re-sync selected
      if (selected) {
        const refreshed = data.find(c => c.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [selected?.id]);

  useEffect(() => { loadCampaigns(); }, []);

  const handleCreate = (campaign: Campaign) => {
    setCampaigns(prev => [...prev, campaign]);
    setSelected(campaign);
    setShowNew(false);
    setActiveTab("template");
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await afetch(`/api/affiliate/campaigns/${id}`, { method: "DELETE" });
      setCampaigns(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* silent */ }
    finally { setDeleting(null); }
  };

  const saveName = async () => {
    if (!selected || !nameInput.trim()) { setEditingName(false); return; }
    try {
      const updated = await afetch(`/api/affiliate/campaigns/${selected.id}`, {
        method: "PUT", body: JSON.stringify({ name: nameInput.trim() }),
      });
      setCampaigns(prev => prev.map(c => c.id === selected.id ? updated : c));
      setSelected(updated);
    } catch { /* silent */ }
    setEditingName(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-gradient-to-br from-violet-700 via-indigo-700 to-purple-800 text-white px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <a href="/" className="text-white/80 hover:text-white text-sm font-medium transition-colors">← Back to AI Business Hunter</a>
          </div>
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Affiliate Hunter</h1>
              <p className="text-white/75 text-xs sm:text-sm mt-0.5 leading-snug">Hunt businesses → import contacts → generate personalised messages → send on autopilot</p>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => setShowNew(true)}
                className="bg-white text-violet-700 hover:bg-violet-50 font-bold gap-1.5 text-sm px-3 sm:px-4">
                <Plus className="w-4 h-4" /><span className="hidden xs:inline">New </span>Campaign
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-5">
          {/* Campaign sidebar — shown on mobile only when no campaign is selected */}
          <div className={`md:w-64 md:flex-shrink-0 ${selected ? "hidden md:block" : "block w-full"}`}>
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaigns</p>
              </div>
              {loading ? (
                <div className="text-center py-8 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No campaigns yet</p>
                  <button onClick={() => setShowNew(true)} className="mt-2 text-xs text-violet-600 font-medium hover:text-violet-800">+ Create one</button>
                </div>
              ) : (
                <div className="divide-y max-h-[calc(100vh-260px)] overflow-y-auto">
                  {campaigns.map(c => (
                    <div key={c.id}
                      onClick={() => { setSelected(c); setActiveTab("hunt"); }}
                      className={`px-4 py-3 cursor-pointer transition-colors group relative ${selected?.id === c.id ? "bg-violet-50 border-l-2 border-violet-600" : "hover:bg-gray-50"}`}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${selected?.id === c.id ? "text-violet-800" : "text-gray-800"}`}>{c.name}</p>
                          <div className="mt-1"><CampaignBadge status={c.status} /></div>
                          <p className="text-xs text-gray-400 mt-1">{c.totalContacts} contact{c.totalContacts !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                            disabled={deleting === c.id}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 border-t">
                <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={() => setShowNew(true)}>
                  <Plus className="w-3.5 h-3.5" />New Campaign
                </Button>
              </div>
            </div>
          </div>

          {/* Main panel — hidden on mobile when no campaign selected (sidebar shows instead) */}
          <div className={`flex-1 min-w-0 ${!selected ? "hidden md:block" : "block"}`}>
            {!selected ? (
              <div className="bg-white border rounded-2xl p-8 sm:p-12 text-center shadow-sm">
                <Megaphone className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                <h3 className="text-xl font-extrabold text-gray-700 mb-2">Select a campaign to get started</h3>
                <p className="text-gray-500 mb-6">Create an affiliate campaign, hunt businesses, add contacts, and send personalised emails automatically.</p>
                <Button onClick={() => setShowNew(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                  <Plus className="w-4 h-4" />Create Your First Campaign
                </Button>
              </div>
            ) : (
              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                {/* Campaign header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gray-50">
                  {/* Mobile back button */}
                  <button onClick={() => setSelected(null)}
                    className="md:hidden flex items-center gap-1 text-xs text-violet-600 font-medium mb-2 hover:text-violet-800 transition-colors">
                    ← All Campaigns
                  </button>
                  <div className="flex flex-wrap items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {editingName ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input value={nameInput} onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                            className="h-8 text-sm font-semibold w-48 sm:w-56" autoFocus />
                          <Button size="sm" onClick={saveName} className="h-8 text-xs">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} className="h-8 text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingName(true); setNameInput(selected.name); }}
                          className="text-base sm:text-lg font-extrabold text-gray-800 hover:text-violet-700 transition-colors truncate text-left">
                          {selected.name}
                        </button>
                      )}
                      <CampaignBadge status={selected.status} />
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{selected.totalContacts}</span>
                      <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" />{selected.sentCount} sent</span>
                      {selected.failedCount > 0 && <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-3.5 h-3.5" />{selected.failedCount} failed</span>}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="px-3 sm:px-6 pt-4">
                    <TabsList className="bg-gray-100 rounded-xl p-1 w-full sm:w-auto">
                      <TabsTrigger value="hunt" className="rounded-lg text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Radar className="w-3.5 h-3.5" />Hunt
                      </TabsTrigger>
                      <TabsTrigger value="contacts" className="rounded-lg text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Users className="w-3.5 h-3.5" />Contacts {selected.totalContacts > 0 && <span className="bg-violet-100 text-violet-700 rounded-full px-1.5 text-xs font-bold">{selected.totalContacts}</span>}
                      </TabsTrigger>
                      <TabsTrigger value="template" className="rounded-lg text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <FileText className="w-3.5 h-3.5" />Template
                        {selected.emailTemplate && <Check className="w-3 h-3 text-green-600" />}
                      </TabsTrigger>
                      <TabsTrigger value="send" className="rounded-lg text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Send className="w-3.5 h-3.5" />Send
                        {selected.status === "running" && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="px-3 sm:px-6 py-4 sm:py-5">
                    <TabsContent value="hunt" className="mt-0">
                      <HuntTab campaignId={selected.id} onImported={loadCampaigns} />
                    </TabsContent>
                    <TabsContent value="contacts" className="mt-0">
                      <ContactsTab campaign={selected} onRefresh={loadCampaigns} />
                    </TabsContent>
                    <TabsContent value="template" className="mt-0">
                      <TemplateTab campaign={selected} onSaved={updated => {
                        setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
                        setSelected(updated);
                      }} />
                    </TabsContent>
                    <TabsContent value="send" className="mt-0">
                      <SendTab campaign={selected} onRefresh={loadCampaigns} />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>

      <NewCampaignDialog open={showNew} onClose={() => setShowNew(false)} onCreate={handleCreate} />
    </div>
  );
}
