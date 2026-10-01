import React, { useState, useEffect } from "react";
import {
  Filter,
  SlidersHorizontal,
  Bookmark,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saasFetch } from "@/lib/saas-auth";

export interface AdvancedLeadFilters {
  minIntentScore: number;
  minNeedScore: number;
  maxWebsiteScore: number;
  cmsPlatforms: string[];
  missingSignals: string[];
  requireVerifiedEmail: boolean;
  requirePhone: boolean;
  requireDecisionMaker: boolean;
  companySizes: string[];
  minDealValue: number;
  includeKeywords: string;
  excludeKeywords: string;
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedLeadFilters = {
  minIntentScore: 0,
  minNeedScore: 1,
  maxWebsiteScore: 100,
  cmsPlatforms: [],
  missingSignals: [],
  requireVerifiedEmail: false,
  requirePhone: false,
  requireDecisionMaker: false,
  companySizes: [],
  minDealValue: 0,
  includeKeywords: "",
  excludeKeywords: "",
};

interface SavedFilterPreset {
  id: number;
  name: string;
  description: string;
  filtersJson: Partial<AdvancedLeadFilters> & { preFilters?: string[] };
  isDefault: boolean;
}

const CMS_OPTIONS = [
  "No Website",
  "WordPress",
  "Wix",
  "Squarespace",
  "GoDaddy",
  "Shopify",
  "Webflow",
  "Custom HTML",
];

const MISSING_SIGNAL_OPTIONS = [
  "No AI Chat / Receptionist",
  "No Online Booking",
  "No 5-Star Review Funnel",
  "No Ad Pixels (FB/Google)",
  "No Website Built",
  "No Contact Form",
];

const COMPANY_SIZE_OPTIONS = ["1-10", "11-50", "51-200", "200+"];

export function countActiveAdvancedFilters(f: AdvancedLeadFilters): number {
  let count = 0;
  if (f.minIntentScore > 0) count++;
  if (f.minNeedScore > 1) count++;
  if (f.maxWebsiteScore < 100) count++;
  if (f.cmsPlatforms.length > 0) count++;
  if (f.missingSignals.length > 0) count++;
  if (f.requireVerifiedEmail) count++;
  if (f.requirePhone) count++;
  if (f.requireDecisionMaker) count++;
  if (f.companySizes.length > 0) count++;
  if (f.minDealValue > 0) count++;
  if (f.includeKeywords.trim()) count++;
  if (f.excludeKeywords.trim()) count++;
  return count;
}

export function doesLeadMatchAdvancedFilters(lead: any, f: AdvancedLeadFilters): boolean {
  const intent = Number(lead.buyerIntentScore ?? lead.intentScore ?? 65);
  const need = Number(lead.softwareNeedScore ?? 6);
  const webScore = Number(lead.analysis?.websiteScore ?? (lead.website ? 54 : 15));
  const dealVal = Number(lead.expectedValue ?? lead.estimatedValue ?? 2500);

  if (f.minIntentScore > 0 && intent < f.minIntentScore) return false;
  if (f.minNeedScore > 1 && need < f.minNeedScore) return false;
  if (f.maxWebsiteScore < 100 && webScore > f.maxWebsiteScore) return false;
  if (f.minDealValue > 0 && dealVal < f.minDealValue) return false;

  if (f.requireVerifiedEmail && !(lead.email && String(lead.email).includes("@"))) {
    return false;
  }
  if (f.requirePhone && !(lead.phone && String(lead.phone).trim().length >= 6)) {
    return false;
  }
  if (
    f.requireDecisionMaker &&
    !Boolean(
      (lead.ownerName && String(lead.ownerName).trim()) ||
        (lead.linkedin && String(lead.linkedin).trim()) ||
        lead.emailType === "direct_executive"
    )
  ) {
    return false;
  }

  if (f.cmsPlatforms.length > 0) {
    const rawWeb = String(lead.website || "").trim();
    const hasNoWeb = !rawWeb || /^(none|n\/a|no website|-)$/i.test(rawWeb) || lead.cmsPlatform === "No Website";
    const leadCms = String(lead.cmsPlatform || (hasNoWeb ? "No Website" : "Custom HTML")).toLowerCase();
    const cmsMatched = f.cmsPlatforms.some((targetCms) => {
      if (targetCms === "No Website") return hasNoWeb;
      return leadCms.includes(targetCms.toLowerCase());
    });
    if (!cmsMatched) return false;
  }

  if (f.missingSignals.length > 0) {
    const missingHay = [
      ...(Array.isArray(lead.missingSignals) ? lead.missingSignals : []),
      lead.painPoint || "",
      !lead.website ? "No Website Built" : "",
    ]
      .join(" ")
      .toLowerCase();
    const signalMatched = f.missingSignals.some((sig) => {
      const token = sig.toLowerCase().replace(/^no\s+/i, "").slice(0, 10);
      return missingHay.includes(token);
    });
    if (!signalMatched) return false;
  }

  if (f.includeKeywords.trim()) {
    const tokens = f.includeKeywords
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length > 0) {
      const hay = `${lead.businessName || ""} ${lead.category || ""} ${lead.city || ""} ${lead.painPoint || ""} ${lead.notes || ""} ${(lead.missingSignals || []).join(" ")}`.toLowerCase();
      if (!tokens.some((t) => hay.includes(t))) return false;
    }
  }

  if (f.excludeKeywords.trim()) {
    const exTokens = f.excludeKeywords
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (exTokens.length > 0) {
      const hay = `${lead.businessName || ""} ${lead.website || ""} ${lead.category || ""} ${lead.painPoint || ""}`.toLowerCase();
      if (exTokens.some((t) => hay.includes(t))) return false;
    }
  }

  return true;
}

export default function AdvancedHunterFiltersBar({
  filters,
  onChange,
  onApplyPresetPreFilters,
  totalLeadsCount,
  matchedLeadsCount,
}: {
  filters: AdvancedLeadFilters;
  onChange: (next: AdvancedLeadFilters) => void;
  onApplyPresetPreFilters?: (preFilters: string[]) => void;
  totalLeadsCount?: number;
  matchedLeadsCount?: number;
}) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<number | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [notice, setNotice] = useState("");

  const activeCount = countActiveAdvancedFilters(filters);

  const loadPresets = async () => {
    try {
      const data = await saasFetch<{ filters: SavedFilterPreset[] }>("/api/crm/advanced-filters");
      if (data && Array.isArray(data.filters)) {
        setPresets(data.filters);
      }
    } catch {}
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const applyPreset = (preset: SavedFilterPreset) => {
    const fj = preset.filtersJson || {};
    setActivePresetId(preset.id);
    onChange({
      minIntentScore: Number(fj.minIntentScore ?? 0),
      minNeedScore: Number(fj.minNeedScore ?? 1),
      maxWebsiteScore: Number(fj.maxWebsiteScore ?? 100),
      cmsPlatforms: Array.isArray(fj.cmsPlatforms) ? fj.cmsPlatforms : [],
      missingSignals: Array.isArray(fj.missingSignals) ? fj.missingSignals : [],
      requireVerifiedEmail: Boolean(fj.requireVerifiedEmail),
      requirePhone: Boolean(fj.requirePhone),
      requireDecisionMaker: Boolean(fj.requireDecisionMaker),
      companySizes: Array.isArray(fj.companySizes) ? fj.companySizes : [],
      minDealValue: Number(fj.minDealValue ?? 0),
      includeKeywords: String(fj.includeKeywords || ""),
      excludeKeywords: String(fj.excludeKeywords || ""),
    });
    if (Array.isArray(fj.preFilters) && onApplyPresetPreFilters) {
      onApplyPresetPreFilters(fj.preFilters);
    }
    setNotice(`Applied preset: "${preset.name}"`);
    setTimeout(() => setNotice(""), 3000);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      const res = await saasFetch<{ filter: SavedFilterPreset }>("/api/crm/advanced-filters", {
        method: "POST",
        body: JSON.stringify({
          name: presetName.trim(),
          description: presetDesc.trim(),
          filtersJson: filters,
          isDefault: false,
        }),
      });
      if (res?.filter) {
        setPresets((prev) => [res.filter, ...prev]);
        setActivePresetId(res.filter.id);
      }
      setPresetName("");
      setPresetDesc("");
      setShowSaveForm(false);
      setNotice("Saved filter preset to database.");
      setTimeout(() => setNotice(""), 3000);
    } catch {
      setNotice("Could not save filter preset.");
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await saasFetch(`/api/crm/advanced-filters/${id}`, { method: "DELETE" });
      setPresets((prev) => prev.filter((p) => p.id !== id));
      if (activePresetId === id) setActivePresetId(null);
    } catch {}
  };

  const resetAll = () => {
    setActivePresetId(null);
    onChange({ ...DEFAULT_ADVANCED_FILTERS });
    if (onApplyPresetPreFilters) onApplyPresetPreFilters(["all"]);
  };

  const toggleArrayItem = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Top summary bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-700 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>Advanced Lead Generation Filters</span>
            {activeCount > 0 && (
              <span className="font-mono tabular-nums text-xs text-indigo-700 font-semibold">
                ({activeCount} active)
              </span>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {typeof totalLeadsCount === "number" && totalLeadsCount > 0 && (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              · Matching {matchedLeadsCount ?? totalLeadsCount} of {totalLeadsCount} leads
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {presets.slice(0, 3).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              title={preset.description}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer border ${
                activePresetId === preset.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Bookmark className="w-3 h-3 inline mr-1 -mt-0.5" />
              <span className="truncate max-w-[170px] inline-block align-bottom">{preset.name}</span>
            </button>
          ))}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            className="px-3 py-1 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            {expanded ? "Hide Filters" : "Configure Criteria"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <span>✓ {notice}</span>
        </div>
      )}

      {expanded && (
        <div className="p-4 space-y-5">
          {/* Row 1: Quantitative Thresholds (Tabular Nums) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-semibold text-slate-700">Min Buyer Intent Score</label>
                <span className="font-mono tabular-nums font-bold text-indigo-700">
                  {filters.minIntentScore}/100
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={filters.minIntentScore}
                onChange={(e) =>
                  onChange({ ...filters, minIntentScore: Number(e.target.value) })
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                <span>0 (Any)</span>
                <span>55 (Warm)</span>
                <span>75+ (Hot)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-semibold text-slate-700">Min Software Need</label>
                <span className="font-mono tabular-nums font-bold text-indigo-700">
                  {filters.minNeedScore}/10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={9}
                step={1}
                value={filters.minNeedScore}
                onChange={(e) =>
                  onChange({ ...filters, minNeedScore: Number(e.target.value) })
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                <span>1/10</span>
                <span>5/10</span>
                <span>8+/10 (Urgent)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-semibold text-slate-700">Max Website Audit Score</label>
                <span className="font-mono tabular-nums font-bold text-indigo-700">
                  {filters.maxWebsiteScore === 100 ? "Any (≤100)" : `≤ ${filters.maxWebsiteScore}/100`}
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={filters.maxWebsiteScore}
                onChange={(e) =>
                  onChange({ ...filters, maxWebsiteScore: Number(e.target.value) })
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                <span>≤40 (Poor)</span>
                <span>≤65 (Outdated)</span>
                <span>100 (All)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-semibold text-slate-700">Min Est. Deal Value</label>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  ${filters.minDealValue.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={250}
                value={filters.minDealValue}
                onChange={(e) =>
                  onChange({ ...filters, minDealValue: Number(e.target.value) })
                }
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                <span>$0</span>
                <span>$2,000</span>
                <span>$5,000+</span>
              </div>
            </div>
          </div>

          {/* Row 2: CMS Platforms & Missing Revenue Signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Target CMS / Website Platform
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CMS_OPTIONS.map((cms) => {
                  const active = filters.cmsPlatforms.includes(cms);
                  return (
                    <button
                      key={cms}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...filters,
                          cmsPlatforms: toggleArrayItem(filters.cmsPlatforms, cms),
                        })
                      }
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {cms}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Required Missing Conversion Signals (Pitch Angles)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MISSING_SIGNAL_OPTIONS.map((sig) => {
                  const active = filters.missingSignals.includes(sig);
                  return (
                    <button
                      key={sig}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...filters,
                          missingSignals: toggleArrayItem(filters.missingSignals, sig),
                        })
                      }
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {sig}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 3: Contact Verification Toggles & Company Size */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-800">Verified Email Only</span>
              <Switch
                checked={filters.requireVerifiedEmail}
                onCheckedChange={(v) => onChange({ ...filters, requireVerifiedEmail: v })}
              />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-800">Owner / Decision-Maker</span>
              <Switch
                checked={filters.requireDecisionMaker}
                onCheckedChange={(v) => onChange({ ...filters, requireDecisionMaker: v })}
              />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-800">Direct Phone Number</span>
              <Switch
                checked={filters.requirePhone}
                onCheckedChange={(v) => onChange({ ...filters, requirePhone: v })}
              />
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 shrink-0 mr-1">Size:</span>
              {COMPANY_SIZE_OPTIONS.map((sz) => {
                const active = filters.companySizes.includes(sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        companySizes: toggleArrayItem(filters.companySizes, sz),
                      })
                    }
                    className={`px-2 py-0.5 rounded text-xs font-mono tabular-nums border transition-colors cursor-pointer ${
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Keyword Inclusion / Exclusion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Include Keywords (comma-separated)
              </label>
              <Input
                value={filters.includeKeywords}
                onChange={(e) => onChange({ ...filters, includeKeywords: e.target.value })}
                placeholder="e.g. emergency, implants, medspa, commercial, luxury"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Exclude Keywords / National Chains (comma-separated)
              </label>
              <Input
                value={filters.excludeKeywords}
                onChange={(e) => onChange({ ...filters, excludeKeywords: e.target.value })}
                placeholder="e.g. walmart, mcdonalds, aspen dental, franchise"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Row 5: Saved Database Filter Presets & Save New Preset */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-600">Saved DB Filter Presets:</span>
              {presets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                    activePresetId === p.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>{p.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePreset(p.id, e)}
                    className="opacity-60 hover:opacity-100 ml-1"
                    title="Delete saved preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {!showSaveForm ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowSaveForm(true)}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Current Filter Preset</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name (e.g. Miami MedSpa High-Intent)"
                  className="h-8 text-xs w-52"
                />
                <Input
                  value={presetDesc}
                  onChange={(e) => setPresetDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className="h-8 text-xs w-48"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={savingPreset || !presetName.trim()}
                  onClick={handleSavePreset}
                  className="h-8 text-xs font-semibold gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingPreset ? "Saving…" : "Save"}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSaveForm(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
