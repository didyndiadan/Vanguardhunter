import React, { useEffect, useState } from "react";
import {
  Radar,
  Globe,
  BarChart3,
  CheckCircle2,
  Sparkles,
  FileText,
  Layers,
  RefreshCw,
} from "lucide-react";

/**
 * Simulates smooth, realistic progress up to 92% while an async scraping or
 * report-generation task is in flight, or uses determinate (current/total)
 * progress when provided.
 */
function useSimulatedProgress(active: boolean, determinatePct?: number) {
  const [pct, setPct] = useState(12);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!active) {
      setPct(12);
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - start) / 1000);
      setElapsedSec(sec);
      setPct((prev) => {
        if (prev >= 92) return 92;
        const step = prev < 45 ? 7 : prev < 75 ? 4 : 1.5;
        return Math.min(92, Math.round((prev + step) * 10) / 10);
      });
    }, 450);
    return () => clearInterval(timer);
  }, [active]);

  const effectivePct =
    typeof determinatePct === "number" && determinatePct > 0
      ? Math.min(98, Math.max(8, Math.round(determinatePct)))
      : Math.round(pct);

  return { pct: effectivePct, elapsedSec };
}

export function LeadScrapingProgressSkeleton({
  categories,
  cityLabel,
  targetCount,
  bulkMode = false,
  completedSteps = 0,
  totalSteps = 1,
  statusText,
}: {
  categories: string[];
  cityLabel: string;
  targetCount: number | string;
  bulkMode?: boolean;
  completedSteps?: number;
  totalSteps?: number;
  statusText?: string;
}) {
  const determinate =
    totalSteps > 1 && completedSteps > 0
      ? Math.round((completedSteps / totalSteps) * 90)
      : undefined;
  const { pct, elapsedSec } = useSimulatedProgress(true, determinate);

  const stages = [
    {
      idx: "01",
      title: "Querying Live Business Directories",
      detail: `Scanning ${categories.join(", ") || "target vertical"} in ${cityLabel || "selected market"}`,
      threshold: 0,
    },
    {
      idx: "02",
      title: "Verifying Active Domains & SSL",
      detail: "Filtering dead links and unreachable domains",
      threshold: 28,
    },
    {
      idx: "03",
      title: "Extracting Contact & Owner Signals",
      detail: "Resolving business emails, phone numbers, and decision-makers",
      threshold: 55,
    },
    {
      idx: "04",
      title: "Scoring Software & Conversion Gaps",
      detail: `Ranking up to ${targetCount} prospects by need & buyer intent`,
      threshold: 78,
    },
  ];

  const activeStageIdx = stages.reduce(
    (acc, stage, index) => (pct >= stage.threshold ? index : acc),
    0
  );

  return (
    <div className="rounded-xl border border-[#E4E2DD] bg-white overflow-hidden shadow-xs">
      {/* Top Live Scraping Progress Header */}
      <div className="p-4 sm:p-5 bg-[#0B0F17] text-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1D4ED8] flex items-center justify-center shrink-0">
              <Radar className="w-4 h-4 text-white animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {bulkMode ? "Multi-City Bulk Discovery Active" : "Live Lead Discovery Active"}
                </span>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  · {elapsedSec}s elapsed
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                {statusText ||
                  `Scraping ${categories.join(", ") || "businesses"} in ${
                    cityLabel || "target cities"
                  }…`}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {totalSteps > 1 && (
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono tabular-nums text-slate-300">
                Batch {Math.min(completedSteps + 1, totalSteps)} of {totalSteps}
              </span>
            )}
            <span className="text-lg font-extrabold font-mono tabular-nums text-amber-400">
              {pct}%
            </span>
          </div>
        </div>

        {/* Smooth Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1D4ED8] via-sky-400 to-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* 4-Stage Pipeline Indicator */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {stages.map((st, idx) => {
            const isDone = idx < activeStageIdx;
            const isCurrent = idx === activeStageIdx;
            return (
              <div
                key={st.idx}
                className={`p-2.5 rounded-lg border text-xs transition-colors ${
                  isCurrent
                    ? "bg-slate-900 border-[#1D4ED8] text-white"
                    : isDone
                    ? "bg-slate-900/60 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-900/30 border-slate-800/80 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[11px] font-bold mb-0.5">
                  <span>STAGE {st.idx}</span>
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  ) : null}
                </div>
                <div className="font-semibold truncate">{st.title}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{st.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shimmering Prospect Row Skeletons */}
      <div className="p-3 bg-[#FAF9F5] border-b border-[#E4E2DD] flex items-center justify-between text-xs text-[#525866]">
        <span className="font-semibold">
          Preparing verified prospect rows &amp; domain diagnostics…
        </span>
        <span className="font-mono tabular-nums">Target: up to {targetCount} leads</span>
      </div>

      <div className="divide-y divide-[#E4E2DD]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
            <div className="w-5 h-5 rounded border border-slate-200 bg-slate-100 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="h-4 w-44 sm:w-56 bg-slate-200 rounded" />
                  <div className="h-4 w-28 bg-indigo-50 border border-indigo-100 rounded-full" />
                  <div className="h-4 w-24 bg-sky-50 border border-sky-100 rounded-full" />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-5 w-20 bg-amber-100/70 rounded-full" />
                  <div className="h-5 w-16 bg-rose-100/70 rounded-full" />
                  <div className="h-4 w-14 bg-slate-200 rounded" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-3 w-36 bg-slate-100 rounded" />
                <div className="h-3 w-28 bg-slate-100 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-blue-50 rounded" />
                <div className="h-4 w-32 bg-rose-50 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BatchOperationProgressBanner({
  title,
  subtitle,
  current,
  total,
  currentItemLabel,
}: {
  title: string;
  subtitle: string;
  current: number;
  total: number;
  currentItemLabel?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(5, Math.round((current / total) * 100))) : 25;

  return (
    <div className="rounded-xl border border-[#1D4ED8]/30 bg-[#EFF6FF] p-4 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0B0F17] flex items-center gap-2">
              <span>{title}</span>
              <span className="font-mono tabular-nums text-[#1D4ED8]">
                ({current} of {total})
              </span>
            </div>
            <div className="text-xs text-[#525866] truncate">
              {currentItemLabel ? `Processing: ${currentItemLabel} — ` : ""}
              {subtitle}
            </div>
          </div>
        </div>
        <span className="text-sm font-extrabold font-mono tabular-nums text-[#1D4ED8]">
          {pct}%
        </span>
      </div>

      <div className="w-full h-2 bg-blue-200/70 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function WebsiteAuditReportSkeleton({
  businessName,
  website,
  fullPage = false,
}: {
  businessName?: string;
  website?: string;
  fullPage?: boolean;
}) {
  const { pct, elapsedSec } = useSimulatedProgress(true);

  const steps = [
    { label: "01. Fetching Website DOM & SSL", doneAt: 25 },
    { label: "02. Auditing Mobile UX & SEO", doneAt: 50 },
    { label: "03. Detecting CMS & Revenue Gaps", doneAt: 75 },
    { label: "04. Compiling Shareable Audit Report", doneAt: 95 },
  ];

  const content = (
    <div className="space-y-6">
      {/* Progress Banner */}
      <div className="rounded-2xl bg-[#0B0F17] text-white p-5 sm:p-6 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  AI Website &amp; Conversion Audit in Progress
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  · {elapsedSec}s
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                {businessName
                  ? `Analyzing ${businessName}${website ? ` (${website})` : ""}…`
                  : "Generating Website Performance & Opportunity Report…"}
              </h3>
            </div>
          </div>
          <span className="text-xl font-extrabold font-mono tabular-nums text-amber-400">
            {pct}%
          </span>
        </div>

        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1D4ED8] via-sky-400 to-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {steps.map((st, idx) => {
            const prevThreshold = idx === 0 ? 0 : steps[idx - 1].doneAt;
            const isDone = pct >= st.doneAt;
            const isCurrent = pct >= prevThreshold && pct < st.doneAt;
            return (
              <div
                key={st.label}
                className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-between gap-1.5 ${
                  isCurrent
                    ? "bg-slate-900 border-[#1D4ED8] text-white"
                    : isDone
                    ? "bg-slate-900/60 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-900/30 border-slate-800 text-slate-500"
                }`}
              >
                <span className="truncate">{st.label}</span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6 Score Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
        {[
          "Website Score",
          "Lead Generation",
          "Conversion",
          "Mobile Experience",
          "SEO Score",
          "Growth Potential",
        ].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-[#E4E2DD] bg-white p-4 flex flex-col items-center justify-center space-y-2"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {label}
            </div>
            <div className="w-14 h-8 rounded-lg bg-slate-200" />
            <div className="w-20 h-2 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Feature Checklist Skeleton */}
      <div className="rounded-xl border border-[#E4E2DD] bg-white overflow-hidden animate-pulse">
        <div className="p-3.5 bg-[#FAF9F5] border-b border-[#E4E2DD] flex items-center justify-between">
          <div className="h-4 w-36 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded-lg bg-slate-100 border border-slate-200/60 px-3 flex items-center gap-2"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-slate-300 shrink-0" />
              <div className="h-3 flex-1 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Issues & Opportunities Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        <div className="rounded-xl border border-[#E4E2DD] bg-white p-4 space-y-3">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#E4E2DD] bg-white p-4 space-y-3">
          <div className="h-4 w-44 bg-slate-200 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!fullPage) return content;

  return (
    <div className="min-h-screen w-full bg-[#FAF9F5] text-[#0B0F17]">
      <div className="bg-[#0B0F17] text-white/80 text-xs px-6 py-3 flex items-center justify-between border-b border-slate-800">
        <span className="font-semibold">Client Website &amp; AI Opportunity Audit Report</span>
        <span className="font-mono">Loading live diagnostics…</span>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-10">{content}</div>
    </div>
  );
}

export function ProposalGenerationSkeleton({ businessName }: { businessName?: string }) {
  const { pct, elapsedSec } = useSimulatedProgress(true);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#0B0F17] text-white p-5 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1D4ED8] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                AI Commercial Proposal Builder · {elapsedSec}s
              </div>
              <div className="text-sm font-bold text-white">
                Drafting scope, timeline &amp; ROI proposal for {businessName || "prospect"}…
              </div>
            </div>
          </div>
          <span className="text-lg font-extrabold font-mono tabular-nums text-amber-400">
            {pct}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-3 animate-pulse">
        {["Executive Summary", "Identified Conversion Bottlenecks", "Recommended Solution & Timeline"].map(
          (sec) => (
            <div key={sec} className="rounded-xl border border-[#E4E2DD] bg-white p-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase">{sec}</div>
              <div className="h-3.5 w-5/6 bg-slate-200 rounded" />
              <div className="h-3.5 w-full bg-slate-100 rounded" />
              <div className="h-3.5 w-2/3 bg-slate-100 rounded" />
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function OutreachCopySkeleton({ label }: { label: string }) {
  const { pct } = useSimulatedProgress(true);
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between text-xs text-[#1D4ED8] font-semibold">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>{label}</span>
        </span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="h-8 w-full bg-slate-100 rounded-lg" />
      <div className="space-y-2 pt-1">
        <div className="h-3 w-5/6 bg-slate-100 rounded" />
        <div className="h-3 w-full bg-slate-100 rounded" />
        <div className="h-3 w-4/5 bg-slate-100 rounded" />
        <div className="h-3 w-2/3 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

export function WebsiteBuilderProgressSkeleton({
  businessName,
  category,
  mode = "generating",
}: {
  businessName?: string;
  category?: string;
  mode?: "generating" | "loading_list" | "loading_preview";
}) {
  const { pct, elapsedSec } = useSimulatedProgress(true);

  if (mode === "loading_list") {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 animate-pulse space-y-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-5 w-56 bg-slate-800 rounded" />
                <div className="h-3.5 w-72 bg-slate-800/70 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-28 bg-slate-800 rounded-lg" />
                <div className="h-8 w-32 bg-amber-400/20 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
              <div className="h-10 bg-slate-800/50 rounded-lg" />
              <div className="h-10 bg-slate-800/50 rounded-lg" />
              <div className="h-10 bg-slate-800/50 rounded-lg" />
              <div className="h-10 bg-slate-800/50 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-slate-950 text-white p-5 sm:p-6 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {mode === "loading_preview"
                  ? "Loading Custom 4-Tap Website Preview"
                  : "Autonomous 4-Tap Website & Audit Builder"}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                · {elapsedSec}s
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">
              {businessName
                ? `Building ${businessName}${category ? ` (${category})` : ""}…`
                : "Assembling high-converting 4-Tap Estimate Funnel & industry visuals…"}
            </h4>
          </div>
        </div>
        <span className="text-xl font-extrabold font-mono tabular-nums text-amber-400">
          {pct}%
        </span>
      </div>

      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
        {[
          { label: "01. Conversion Gap Audit", threshold: 0 },
          { label: "02. Industry Visuals & Theme", threshold: 25 },
          { label: "03. 4-Tap Estimate Funnel", threshold: 55 },
          { label: "04. AI Chatbot & Claim Link", threshold: 80 },
        ].map((st) => {
          const active = pct >= st.threshold;
          return (
            <div
              key={st.label}
              className={`px-3 py-2 rounded-lg border font-medium flex items-center justify-between ${
                active
                  ? "bg-slate-900 border-amber-400/40 text-amber-300"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <span className="truncate">{st.label}</span>
              {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
