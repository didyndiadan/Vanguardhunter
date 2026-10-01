import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  SlidersHorizontal,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Share2,
  Database,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Settings,
  Check,
  Copy,
  FileSpreadsheet,
  FileJson,
  Printer,
  Layers,
  Target,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saasFetch } from "@/lib/saas-auth";

const METRIC_DEFINITIONS = [
  { id: "total_prospects", label: "Total Prospects Analyzed", category: "Discovery" },
  { id: "verified_email_rate", label: "Verified Email Rate (%)", category: "Discovery" },
  { id: "decision_maker_rate", label: "Decision-Maker Identified (%)", category: "Discovery" },
  { id: "avg_intent_score", label: "Avg Buyer Intent Score", category: "Discovery" },
  { id: "avg_website_score", label: "Avg Website Audit Score", category: "Website Audit" },
  { id: "avg_mobile_score", label: "Avg Mobile Experience Score", category: "Website Audit" },
  { id: "avg_seo_score", label: "Avg Local SEO Score", category: "Website Audit" },
  { id: "avg_conversion_score", label: "Avg Conversion Readiness", category: "Website Audit" },
  { id: "missing_chat_rate", label: "Missing AI Chat / Receptionist (%)", category: "Website Audit" },
  { id: "missing_booking_rate", label: "Missing Online Booking (%)", category: "Website Audit" },
  { id: "audit_report_views", label: "Client Audit Report Views", category: "Engagement" },
  { id: "proposal_requests", label: "Inbound Proposal Requests", category: "Engagement" },
  { id: "outreach_open_rate", label: "Outreach Email Open Rate (%)", category: "Engagement" },
  { id: "outreach_click_rate", label: "Outreach Click-Through Rate (%)", category: "Engagement" },
  { id: "positive_replies", label: "Positive Inbox Replies", category: "Engagement" },
  { id: "pipeline_value", label: "Active Pipeline Value ($)", category: "Revenue" },
  { id: "weighted_forecast", label: "Weighted Revenue Forecast ($)", category: "Revenue" },
  { id: "won_revenue", label: "Closed-Won Revenue ($)", category: "Revenue" },
  { id: "win_rate", label: "Pipeline Win Conversion Rate (%)", category: "Revenue" },
  { id: "avg_deal_size", label: "Average Prospect Deal Value ($)", category: "Revenue" },
  { id: "custom_composite_score", label: "Custom Weighted Opportunity Index", category: "Custom Formula" },
  { id: "generated_sites_count", label: "AI Websites & Review Shields Built", category: "Revenue" },
];

const GROUP_BY_OPTIONS = [
  { id: "category", label: "Business Category / Vertical" },
  { id: "city", label: "City / Territory" },
  { id: "stage", label: "CRM Pipeline Stage" },
  { id: "primaryOffer", label: "Matched Service Offer" },
  { id: "cmsPlatform", label: "Detected CMS Platform" },
] as const;

const DATE_RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "all", label: "All Time" },
] as const;

export function CustomMetricsReportBuilder({
  prospects,
}: {
  prospects: any[];
}) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "total_prospects",
    "verified_email_rate",
    "avg_intent_score",
    "avg_website_score",
    "audit_report_views",
    "outreach_open_rate",
    "pipeline_value",
    "weighted_forecast",
    "win_rate",
    "custom_composite_score",
  ]);
  const [groupBy, setGroupBy] = useState<"category" | "city" | "stage" | "primaryOffer" | "cmsPlatform">("category");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [websiteScoreWeight, setWebsiteScoreWeight] = useState<number>(35);
  const [intentScoreWeight, setIntentScoreWeight] = useState<number>(40);
  const [dealValueWeight, setDealValueWeight] = useState<number>(25);

  const [targetWinRate, setTargetWinRate] = useState<number>(20);
  const [targetOpenRate, setTargetOpenRate] = useState<number>(38);
  const [targetPipelineValue, setTargetPipelineValue] = useState<number>(50000);
  const [targetIntentScore, setTargetIntentScore] = useState<number>(70);

  const [reportSnapshot, setReportSnapshot] = useState<any | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  const [templateName, setTemplateName] = useState<string>("");
  const [templateDesc, setTemplateDesc] = useState<string>("");
  const [publishShareableLink, setPublishShareableLink] = useState<boolean>(true);
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string; link?: string } | null>(null);

  const buildMetricsConfig = useCallback(
    () => ({
      selectedMetrics,
      groupBy,
      dateRange,
      kpiTargets: {
        win_rate: targetWinRate,
        outreach_open_rate: targetOpenRate,
        pipeline_value: targetPipelineValue,
        avg_intent_score: targetIntentScore,
      },
      weights: {
        websiteScoreWeight,
        intentScoreWeight,
        dealValueWeight,
      },
    }),
    [
      selectedMetrics,
      groupBy,
      dateRange,
      targetWinRate,
      targetOpenRate,
      targetPipelineValue,
      targetIntentScore,
      websiteScoreWeight,
      intentScoreWeight,
      dealValueWeight,
    ]
  );

  const generateLiveReport = useCallback(
    async (overrideCfg?: any) => {
      setGenerating(true);
      try {
        const cfg = overrideCfg || buildMetricsConfig();
        const res = await saasFetch<{ report: any }>("/api/crm/custom-reports/generate", {
          method: "POST",
          body: JSON.stringify({
            metricsConfig: cfg,
            clientProspects: prospects,
          }),
        });
        if (res?.report) {
          setReportSnapshot(res.report);
        }
      } catch (err: any) {
        setNotice({ type: "error", text: err?.message || "Failed to compute custom report" });
      } finally {
        setGenerating(false);
        setLoading(false);
      }
    },
    [buildMetricsConfig, prospects]
  );

  const loadTemplatesAndInitialReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await saasFetch<{ templates: any[]; liveReport: any }>("/api/crm/custom-reports");
      if (data?.templates) setSavedTemplates(data.templates);
      await generateLiveReport();
    } catch {
      setLoading(false);
    }
  }, [generateLiveReport]);

  useEffect(() => {
    loadTemplatesAndInitialReport();
  }, []);

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );
  };

  const applyTemplate = (tpl: any) => {
    const cfg = tpl.metricsConfig || {};
    if (Array.isArray(cfg.selectedMetrics) && cfg.selectedMetrics.length > 0) {
      setSelectedMetrics(cfg.selectedMetrics);
    }
    if (cfg.groupBy) setGroupBy(cfg.groupBy);
    if (cfg.dateRange) setDateRange(cfg.dateRange);
    if (cfg.kpiTargets) {
      if (cfg.kpiTargets.win_rate) setTargetWinRate(Number(cfg.kpiTargets.win_rate));
      if (cfg.kpiTargets.outreach_open_rate) setTargetOpenRate(Number(cfg.kpiTargets.outreach_open_rate));
      if (cfg.kpiTargets.pipeline_value) setTargetPipelineValue(Number(cfg.kpiTargets.pipeline_value));
      if (cfg.kpiTargets.avg_intent_score) setTargetIntentScore(Number(cfg.kpiTargets.avg_intent_score));
    }
    if (cfg.weights) {
      if (cfg.weights.websiteScoreWeight !== undefined) setWebsiteScoreWeight(Number(cfg.weights.websiteScoreWeight));
      if (cfg.weights.intentScoreWeight !== undefined) setIntentScoreWeight(Number(cfg.weights.intentScoreWeight));
      if (cfg.weights.dealValueWeight !== undefined) setDealValueWeight(Number(cfg.weights.dealValueWeight));
    }
    generateLiveReport(cfg);
    setNotice({ type: "success", text: `Loaded report template "${tpl.name}"` });
  };

  const saveReportTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setNotice(null);
    try {
      const cfg = buildMetricsConfig();
      const res = await saasFetch<{
        template: any;
        publishedReportId?: string;
        publishedReportUrl?: string;
      }>("/api/crm/custom-reports", {
        method: "POST",
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDesc.trim(),
          metricsConfig: cfg,
          clientProspects: prospects,
          publishShareableLink,
        }),
      });
      if (res?.template) {
        setSavedTemplates((prev) => [res.template, ...prev]);
        setReportSnapshot(res.template.generatedSnapshot);
      }
      setTemplateName("");
      setTemplateDesc("");
      setNotice({
        type: "success",
        text: `Saved custom report "${res.template?.name || "Report"}" to database.`,
        link: res?.publishedReportId ? `/report/${res.publishedReportId}` : undefined,
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Could not save report template" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await saasFetch(`/api/crm/custom-reports/${id}`, { method: "DELETE" });
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const exportReportCsv = () => {
    if (!reportSnapshot) return;
    const rows: string[][] = [
      ["Section", "Metric / Segment", "Value / Count", "Verified Email %", "Avg Intent", "Avg Website Score", "Custom Score", "Pipeline Value ($)"],
    ];
    for (const m of reportSnapshot.summaryMetrics || []) {
      rows.push(["KPI Summary", m.label, String(m.formatted || m.value), "", "", "", "", ""]);
    }
    for (const g of reportSnapshot.groupedBreakdown || []) {
      rows.push([
        `Grouped by ${groupBy}`,
        g.dimension,
        String(g.leadsCount),
        `${g.verifiedEmailRate}%`,
        String(g.avgIntentScore),
        String(g.avgWebsiteScore),
        String(g.avgCustomScore),
        String(g.pipelineValue),
      ]);
    }
    const csvContent = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-business-hunter-custom-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReportJson = () => {
    if (!reportSnapshot) return;
    const blob = new Blob([JSON.stringify(reportSnapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-business-hunter-custom-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>Customizable Report Builder &amp; User-Defined Metrics Engine</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Define custom KPI combinations, composite lead scoring weights, and segment breakdowns across your live CRM database and Website Audit telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportReportCsv}
            disabled={!reportSnapshot}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportReportJson}
            disabled={!reportSnapshot}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export JSON</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>Print / PDF</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => generateLiveReport()}
            disabled={generating}
            className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Computing…" : "Run Custom Report"}</span>
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{notice.text}</span>
          {notice.link && (
            <a
              href={notice.link}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
            >
              <span>Open Shareable Report</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Configuration Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1 & 2: User-Defined Metric Picker */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">1. Select User-Defined Metrics ({selectedMetrics.length} active)</h4>
              <p className="text-xs text-slate-500">Toggle which database KPIs and diagnostic ratios are included in your custom report.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedMetrics(METRIC_DEFINITIONS.map((m) => m.id))}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() =>
                  setSelectedMetrics([
                    "total_prospects",
                    "verified_email_rate",
                    "avg_intent_score",
                    "avg_website_score",
                    "pipeline_value",
                    "win_rate",
                  ])
                }
                className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
              >
                Default Set
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {METRIC_DEFINITIONS.map((m) => {
              const active = selectedMetrics.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMetric(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Grouping & Timeframe Row */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Group Breakdown Dimension
              </label>
              <div className="flex flex-wrap gap-1">
                {GROUP_BY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGroupBy(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      groupBy === opt.id
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Report Timeframe Window
              </label>
              <div className="flex flex-wrap gap-1">
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDateRange(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      dateRange === opt.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Custom Scoring Weights & KPI Targets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">2. Custom Formula Weights &amp; KPI Goals</h4>
            <p className="text-xs text-slate-500">Adjust how the Custom Opportunity Index ranks your leads.</p>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Website Audit Gap Weight</span>
                <span className="font-mono tabular-nums font-bold text-indigo-700">{websiteScoreWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={websiteScoreWeight}
                onChange={(e) => setWebsiteScoreWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Buyer Intent Signal Weight</span>
                <span className="font-mono tabular-nums font-bold text-indigo-700">{intentScoreWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={intentScoreWeight}
                onChange={(e) => setIntentScoreWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Deal Value Potential Weight</span>
                <span className="font-mono tabular-nums font-bold text-indigo-700">{dealValueWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={dealValueWeight}
                onChange={(e) => setDealValueWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Win Rate (%)</label>
              <Input
                type="number"
                value={targetWinRate}
                onChange={(e) => setTargetWinRate(Number(e.target.value) || 0)}
                className="h-8 text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Open Rate (%)</label>
              <Input
                type="number"
                value={targetOpenRate}
                onChange={(e) => setTargetOpenRate(Number(e.target.value) || 0)}
                className="h-8 text-xs font-mono tabular-nums"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Pipeline Value ($)</label>
              <Input
                type="number"
                step={5000}
                value={targetPipelineValue}
                onChange={(e) => setTargetPipelineValue(Number(e.target.value) || 0)}
                className="h-8 text-xs font-mono tabular-nums"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Generated KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
              <div className="h-6 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        reportSnapshot && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(reportSnapshot.summaryMetrics || []).map((m: any) => {
                const hasTarget = typeof m.target === "number" && m.target > 0;
                const pct = hasTarget ? Math.min(100, Math.round((Number(m.value) / m.target) * 100)) : null;
                return (
                  <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                    <div className="text-xs font-medium text-slate-500">{m.label}</div>
                    <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                      {m.formatted}
                    </div>
                    {pct !== null ? (
                      <div className="mt-2">
                        <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mb-1">
                          <span>Goal: {m.unit === "USD" ? `$${m.target.toLocaleString()}` : `${m.target}${m.unit === "%" ? "%" : ""}`}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 80 ? "bg-emerald-600" : pct >= 50 ? "bg-amber-500" : "bg-indigo-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 mt-2 font-mono tabular-nums">
                        Live DB metric · {m.unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grouped Segment Breakdown Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Segmented Performance Matrix (Grouped by{" "}
                    {GROUP_BY_OPTIONS.find((g) => g.id === groupBy)?.label || groupBy})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Real-time aggregation across {(reportSnapshot.groupedBreakdown || []).reduce((s: number, g: any) => s + g.leadsCount, 0)} leads
                  </p>
                </div>
              </div>

              {(reportSnapshot.groupedBreakdown || []).length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No leads match the selected filters yet. Run AI Hunter or adjust your timeframe filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/50">
                        <th className="py-2.5 px-4">Segment</th>
                        <th className="py-2.5 px-3 text-right">Leads</th>
                        <th className="py-2.5 px-3 text-right">Verified Email</th>
                        <th className="py-2.5 px-3 text-right">Avg Intent</th>
                        <th className="py-2.5 px-3 text-right">Avg Web Score</th>
                        <th className="py-2.5 px-3 text-right">Custom Index</th>
                        <th className="py-2.5 px-4 text-right">Pipeline Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {(reportSnapshot.groupedBreakdown || []).map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{row.dimension}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                            {row.leadsCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                            {row.verifiedEmailRate}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-amber-700">
                            {row.avgIntentScore}/100
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                            {row.avgWebsiteScore}/100
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-indigo-700">
                            {row.avgCustomScore}/100
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                            ${Number(row.pipelineValue || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Save Custom Report Template & Shareable Link Generator */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    3. Save Custom Report Template &amp; Generate Shareable Executive Link
                  </h4>
                  <p className="text-xs text-slate-500">
                    Persist this metric configuration to your database and optionally create a public client/stakeholder report URL.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Report Name *</label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Q4 Austin Dental & MedSpa Conversion Report"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Executive Summary Note</label>
                  <Input
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="e.g. Weekly KPI tracking for high-intent outreach"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer mr-2">
                    <Switch checked={publishShareableLink} onCheckedChange={setPublishShareableLink} />
                    <span className="whitespace-nowrap">Publish /report/:id link</span>
                  </label>
                  <Button
                    type="button"
                    disabled={savingTemplate || !templateName.trim()}
                    onClick={saveReportTemplate}
                    className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{savingTemplate ? "Saving…" : "Save Report"}</span>
                  </Button>
                </div>
              </div>

              {savedTemplates.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-600">Saved Custom Report Templates in Database:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {savedTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {tpl.name}{" "}
                            <span className="font-mono text-[11px] font-normal text-slate-500">
                              · {tpl.reportCode}
                            </span>
                          </div>
                          {tpl.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{tpl.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyTemplate(tpl)}
                            className="h-7 text-xs font-semibold"
                          >
                            Load
                          </Button>
                          {tpl.generatedSnapshot?.publishedReportId && (
                            <a
                              href={`/report/${tpl.generatedSnapshot.publishedReportId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View</span>
                            </a>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTemplate(tpl.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── Part B: Salesforce & HubSpot CRM Integrations Hub ────────────────────────

const HUNTER_SOURCE_FIELDS = [
  { key: "businessName", label: "Business Name" },
  { key: "ownerName", label: "Decision-Maker / Owner Name" },
  { key: "email", label: "Verified Email" },
  { key: "phone", label: "Phone Number" },
  { key: "website", label: "Website URL" },
  { key: "city", label: "City / Location" },
  { key: "category", label: "Business Category / Industry" },
  { key: "expectedValue", label: "Expected Deal Value ($)" },
  { key: "buyerIntentScore", label: "Buyer Intent Score (0-100)" },
  { key: "primaryOffer", label: "Matched Primary Offer" },
  { key: "reportUrl", label: "Website Audit Report URL" },
];

const INTERNAL_STAGES = [
  { key: "new", label: "New Lead" },
  { key: "contacted", label: "Contacted" },
  { key: "proposal_sent", label: "Proposal / Audit Sent" },
  { key: "meeting", label: "Meeting Set" },
  { key: "negotiating", label: "Negotiating" },
  { key: "won", label: "Won ✓" },
  { key: "lost", label: "Lost" },
];

export function CrmIntegrationsHub({
  prospects,
  onProspectsPulled,
}: {
  prospects: any[];
  onProspectsPulled?: (newLeads: any[]) => void;
}) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeProviderTab, setActiveProviderTab] = useState<string>("hubspot");
  const [busyAction, setBusyAction] = useState<string>("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await saasFetch<{ integrations: any[]; syncLogs: any[] }>("/api/crm/integrations");
      if (data?.integrations) setIntegrations(data.integrations);
      if (data?.syncLogs) setSyncLogs(data.syncLogs);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const currentConnector =
    integrations.find((i) => i.provider === activeProviderTab) || integrations[0] || null;

  const updateConnectorField = (field: string, value: any) => {
    if (!currentConnector) return;
    setIntegrations((prev) =>
      prev.map((item) => (item.id === currentConnector.id ? { ...item, [field]: value } : item))
    );
  };

  const updateFieldMapping = (sourceKey: string, targetValue: string) => {
    if (!currentConnector) return;
    const nextMap = { ...(currentConnector.fieldMapping || {}), [sourceKey]: targetValue };
    updateConnectorField("fieldMapping", nextMap);
  };

  const updateStageMapping = (stageKey: string, remoteStageVal: string) => {
    if (!currentConnector) return;
    const nextStageMap = { ...(currentConnector.stageMapping || {}), [stageKey]: remoteStageVal };
    updateConnectorField("stageMapping", nextStageMap);
  };

  const saveConnector = async (connectorToSave = currentConnector) => {
    if (!connectorToSave) return;
    setBusyAction("save");
    setNotice(null);
    try {
      const res = await saasFetch<{ integration: any }>("/api/crm/integrations", {
        method: "POST",
        body: JSON.stringify(connectorToSave),
      });
      if (res?.integration) {
        setIntegrations((prev) =>
          prev.map((item) => (item.id === res.integration.id ? res.integration : item))
        );
      }
      setNotice({
        type: "success",
        text: `Saved ${connectorToSave.name} configuration, field mappings, and stage rules.`,
      });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Failed to save CRM integration" });
    } finally {
      setBusyAction("");
    }
  };

  const testConnector = async () => {
    if (!currentConnector) return;
    setBusyAction("test");
    setNotice(null);
    try {
      await saveConnector(currentConnector);
      const res = await saasFetch<{ success: boolean; message: string }>(
        `/api/crm/integrations/${currentConnector.id}/test`,
        { method: "POST" }
      );
      setNotice({ type: "success", text: res?.message || "Connection verified!" });
      await loadIntegrations();
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Connection test failed" });
    } finally {
      setBusyAction("");
    }
  };

  const runCrmSync = async (direction: "push" | "pull") => {
    if (!currentConnector) return;
    setBusyAction(direction);
    setNotice(null);
    try {
      await saveConnector(currentConnector);
      const res = await saasFetch<{
        success: boolean;
        syncedCount?: number;
        pulledLeads?: any[];
        log?: any;
      }>(`/api/crm/integrations/${currentConnector.id}/sync`, {
        method: "POST",
        body: JSON.stringify({
          direction,
          prospects,
        }),
      });
      if (direction === "pull" && Array.isArray(res?.pulledLeads) && res.pulledLeads.length > 0) {
        onProspectsPulled?.(res.pulledLeads);
        setNotice({
          type: "success",
          text: `Pulled ${res.pulledLeads.length} leads from ${currentConnector.name} directly into your CRM pipeline!`,
        });
      } else {
        setNotice({
          type: "success",
          text: `Pushed ${res?.syncedCount ?? prospects.length} prospects to ${currentConnector.name} with mapped fields & deal stages.`,
        });
      }
      await loadIntegrations();
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "CRM sync failed" });
    } finally {
      setBusyAction("");
    }
  };

  const addWebhookConnector = async () => {
    setBusyAction("add_webhook");
    try {
      const res = await saasFetch<{ integration: any }>("/api/crm/integrations", {
        method: "POST",
        body: JSON.stringify({
          provider: "webhook",
          name: "Custom Outbound CRM Webhook (Pipedrive / Zoho / HighLevel / Zapier)",
          enabled: true,
          authType: "webhook",
          instanceUrl: "https://hooks.zapier.com/hooks/catch/vanguard-crm-sync",
          syncDirection: "push",
          autoSyncOnImport: true,
          autoSyncOnStageChange: true,
          fieldMapping: {
            businessName: "company_name",
            ownerName: "contact_name",
            email: "email",
            phone: "phone",
            website: "website",
            expectedValue: "deal_value",
          },
          stageMapping: {
            new: "Lead In",
            contacted: "Contact Made",
            proposal_sent: "Proposal Made",
            won: "Won",
            lost: "Lost",
          },
        }),
      });
      if (res?.integration) {
        setIntegrations((prev) => [...prev, res.integration]);
        setActiveProviderTab("webhook");
      }
    } catch {
    } finally {
      setBusyAction("");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-xl border border-slate-200 bg-white p-5" />
        <div className="h-80 rounded-xl border border-slate-200 bg-white p-5" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>External CRM Integrations — Salesforce &amp; HubSpot Bi-Directional Sync</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Connect HubSpot CRM (Contacts &amp; Deals v3) and Salesforce Enterprise (Lead &amp; Opportunity SObjects) with custom field mapping, pipeline stage rules, and 1-click push/pull synchronization.
          </p>
        </div>

        {/* Provider Switcher Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {integrations.map((conn) => {
            const active = currentConnector?.id === conn.id;
            return (
              <button
                key={conn.id}
                type="button"
                onClick={() => setActiveProviderTab(conn.provider)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    conn.enabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                <span>
                  {conn.provider === "hubspot"
                    ? "HubSpot CRM"
                    : conn.provider === "salesforce"
                    ? "Salesforce CRM"
                    : "Webhook / Pipedrive"}
                </span>
                <span className="font-mono tabular-nums text-[11px] opacity-75">
                  ({conn.totalSyncedCount || 0} synced)
                </span>
              </button>
            );
          })}
          {!integrations.some((i) => i.provider === "webhook") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyAction === "add_webhook"}
              onClick={addWebhookConnector}
              className="h-8 text-xs font-semibold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Webhook / Pipedrive</span>
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-between ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{notice.text}</span>
        </div>
      )}

      {currentConnector && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Columns: Connection Credentials, Triggers & Action Bar */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{currentConnector.name}</h4>
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    Status: {currentConnector.enabled ? "Active & Enabled" : "Paused"} · Total Synced:{" "}
                    {currentConnector.totalSyncedCount || 0} records
                    {currentConnector.lastSyncAt
                      ? ` · Last Sync: ${new Date(currentConnector.lastSyncAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Connector Enabled</span>
                  <Switch
                    checked={Boolean(currentConnector.enabled)}
                    onCheckedChange={(v) => updateConnectorField("enabled", v)}
                  />
                </div>
              </div>

              {/* Credentials Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    {currentConnector.provider === "hubspot"
                      ? "HubSpot API Endpoint"
                      : currentConnector.provider === "salesforce"
                      ? "Salesforce Instance URL *"
                      : "Target Webhook / API Endpoint URL *"}
                  </label>
                  <Input
                    value={currentConnector.instanceUrl || ""}
                    onChange={(e) => updateConnectorField("instanceUrl", e.target.value)}
                    placeholder={
                      currentConnector.provider === "salesforce"
                        ? "https://your-domain.my.salesforce.com"
                        : "https://api.hubapi.com"
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    {currentConnector.provider === "hubspot"
                      ? "HubSpot Portal / Hub ID"
                      : currentConnector.provider === "salesforce"
                      ? "Salesforce Organization ID (00D...)"
                      : "Workspace / Account Identifier"}
                  </label>
                  <Input
                    value={currentConnector.portalOrOrgId || ""}
                    onChange={(e) => updateConnectorField("portalOrOrgId", e.target.value)}
                    placeholder={
                      currentConnector.provider === "hubspot" ? "HS-PORTAL-849201" : "00D8c000004Vngd"
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    {currentConnector.provider === "hubspot"
                      ? "HubSpot Private App Access Token (pat-na1-... or pat-eu1-...)"
                      : currentConnector.provider === "salesforce"
                      ? "Salesforce OAuth 2.0 / REST API Access Token"
                      : "Bearer Token / Signing Secret (optional)"}
                  </label>
                  <Input
                    type="password"
                    value={currentConnector.accessToken || ""}
                    onChange={(e) => updateConnectorField("accessToken", e.target.value)}
                    placeholder={
                      currentConnector.hasAccessToken
                        ? `Configured (${currentConnector.accessTokenPreview}) — enter new token to replace`
                        : "Paste API Access Token (or leave blank to run in verified schema sandbox mode)"
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Auto-Sync Triggers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Auto-Sync on Lead Import</div>
                    <div className="text-[11px] text-slate-500">Push new AI Hunter leads automatically</div>
                  </div>
                  <Switch
                    checked={Boolean(currentConnector.autoSyncOnImport)}
                    onCheckedChange={(v) => updateConnectorField("autoSyncOnImport", v)}
                  />
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Sync Stage Changes</div>
                    <div className="text-[11px] text-slate-500">Update remote Deal/Lead status</div>
                  </div>
                  <Switch
                    checked={Boolean(currentConnector.autoSyncOnStageChange)}
                    onCheckedChange={(v) => updateConnectorField("autoSyncOnStageChange", v)}
                  />
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Sync Direction</div>
                    <div className="text-[11px] text-slate-500 font-mono uppercase">
                      {currentConnector.syncDirection || "bidirectional"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const order = ["bidirectional", "push", "pull"];
                      const next =
                        order[(order.indexOf(currentConnector.syncDirection || "bidirectional") + 1) % order.length];
                      updateConnectorField("syncDirection", next);
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    Cycle Mode
                  </button>
                </div>
              </div>

              {/* Primary Sync & Verification Actions */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => runCrmSync("push")}
                    disabled={Boolean(busyAction)}
                    className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>
                      {busyAction === "push"
                        ? "Pushing Leads…"
                        : `Push ${prospects.length > 0 ? prospects.length : "All"} Leads to ${
                            currentConnector.provider === "hubspot"
                              ? "HubSpot"
                              : currentConnector.provider === "salesforce"
                              ? "Salesforce"
                              : "CRM"
                          }`}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => runCrmSync("pull")}
                    disabled={Boolean(busyAction)}
                    className="h-9 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 gap-1.5"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {busyAction === "pull"
                        ? "Pulling Records…"
                        : `Pull Leads from ${
                            currentConnector.provider === "hubspot"
                              ? "HubSpot"
                              : currentConnector.provider === "salesforce"
                              ? "Salesforce"
                              : "CRM"
                          }`}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={testConnector}
                    disabled={Boolean(busyAction)}
                    className="h-9 text-xs font-semibold gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{busyAction === "test" ? "Testing…" : "Test Connection"}</span>
                  </Button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => saveConnector(currentConnector)}
                  disabled={Boolean(busyAction)}
                  className="h-9 text-xs font-semibold"
                >
                  {busyAction === "save" ? "Saving…" : "Save Settings"}
                </Button>
              </div>
            </div>

            {/* Field Mapping Matrix */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Property &amp; SObject Field Mapping ({currentConnector.provider.toUpperCase()})
                </h4>
                <p className="text-xs text-slate-500">
                  Map AI Business Hunter lead intelligence fields to remote{" "}
                  {currentConnector.provider === "salesforce" ? "Salesforce Lead/Opportunity SObject" : "HubSpot CRM v3"}{" "}
                  properties.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {HUNTER_SOURCE_FIELDS.map((sf) => (
                  <div
                    key={sf.key}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-medium text-slate-700 truncate">{sf.label}</span>
                    <Input
                      value={(currentConnector.fieldMapping || {})[sf.key] || ""}
                      onChange={(e) => updateFieldMapping(sf.key, e.target.value)}
                      placeholder="Remote property name"
                      className="h-7 w-40 text-xs font-mono bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Pipeline Stage Mapping & Live Sync Audit Logs */}
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pipeline Stage Mapping</h4>
                <p className="text-xs text-slate-500">
                  Translate internal CRM stages into{" "}
                  {currentConnector.provider === "salesforce" ? "Salesforce Statuses" : "HubSpot Deal Stages"}.
                </p>
              </div>

              <div className="space-y-2">
                {INTERNAL_STAGES.map((st) => (
                  <div key={st.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-700">{st.label}</span>
                    <Input
                      value={(currentConnector.stageMapping || {})[st.key] || ""}
                      onChange={(e) => updateStageMapping(st.key, e.target.value)}
                      className="h-7 w-44 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent CRM Sync Audit Logs */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Recent CRM Sync Ledger</h4>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {syncLogs.length} events
                </span>
              </div>

              {syncLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No sync operations logged yet. Click Push Leads or Test Connection above.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {syncLogs.map((log) => {
                    const isOpen = expandedLogId === log.id;
                    return (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">{log.action}</span>
                          <span className="font-mono tabular-nums text-[11px] text-emerald-700 font-semibold shrink-0">
                            {log.recordsSucceeded}/{log.recordsProcessed} OK
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                          <span>
                            {String(log.provider || "").toUpperCase()} · {String(log.direction || "").toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                            className="text-indigo-600 hover:underline font-sans font-semibold cursor-pointer"
                          >
                            {isOpen ? "Hide Payload" : "Inspect Payload"}
                          </button>
                        </div>
                        {isOpen && log.details && (
                          <pre className="mt-2 p-2 rounded bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto max-h-48">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
