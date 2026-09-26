import { useEffect, useState } from "react";
import { useParams } from "wouter";
import API_BASE from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, ArrowLeft, Send, ExternalLink } from "lucide-react";

interface Analysis {
  websiteScore?: number;
  leadScore?: number;
  conversionScore?: number;
  mobileScore?: number;
  seoScore?: number;
  growthPotential?: number;
  summary?: string;
  projectType?: string;
  estimatedValue?: { min: number; max: number };
  deliveryWeeks?: { min: number; max: number };
  recommendedFeatures?: string[];
  issues?: { title: string; description: string; priority: "high" | "medium" | "low" }[];
  opportunities?: { title: string; impact: string; effort: string }[];
  checks?: Record<string, boolean>;
}

interface ReportData {
  reportId: string;
  businessName: string;
  website: string;
  analysisData: Analysis;
  reportUrl: string;
  createdAt: string | null;
  totalViews: number;
  proposalRequested?: boolean;
}

const CHECK_LABELS: Record<string, string> = {
  responsiveDesign: "Mobile Responsive",
  sslCertificate: "SSL Certificate (HTTPS)",
  modernUI: "Modern Design",
  whatsappButton: "WhatsApp Button",
  contactForm: "Contact Form",
  bookingSystem: "Booking System",
  onlineOrdering: "Online Ordering",
  paymentIntegration: "Payment Integration",
  customerPortal: "Customer Portal",
  membershipArea: "Membership Area",
  blog: "Blog / Content",
  seoBasics: "SEO Basics",
  analytics: "Analytics Tracking",
  socialMedia: "Social Media Links",
  emailCapture: "Email Capture",
  liveChat: "Live Chat",
  aiChatbot: "AI Chatbot",
  callToAction: "Clear Call-to-Action",
  trustElements: "Trust Elements",
};

function ScoreRing({ score, label, strokeColor }: { score: number; label: string; strokeColor: string }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
          {pct}
        </text>
      </svg>
      <span className="text-xs text-gray-500 font-semibold text-center">{label}</span>
    </div>
  );
}

export default function Report() {
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqWhatsapp, setReqWhatsapp] = useState("");
  const [reqBudget, setReqBudget] = useState("");
  const [reqNotes, setReqNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    fetch(`${API_BASE}/api/reports/${reportId}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setReport(data);
        setReqNotes(`Interested in the Website & AI Opportunity Audit for ${data.businessName}.`);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [reportId]);

  const submitProposalRequest = async () => {
    if (!reqEmail.trim() || !report) return;
    setSubmitting(true);
    try {
      await Promise.all([
        fetch(`${API_BASE}/api/reports/admin/${report.reportId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalRequested: true, status: "proposal_sent" }),
        }),
        fetch(`${API_BASE}/api/custom-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: reqName || report.businessName,
            email: reqEmail,
            whatsapp: reqWhatsapp,
            budget: reqBudget,
            businessType: report.businessName,
            description: reqNotes || `Requested proposal from audit report #${report.reportId}`,
            reportId: report.reportId,
          }),
        }),
      ]);
      setSubmitted(true);
      setReport((prev) => (prev ? { ...prev, proposalRequested: true } : prev));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-700 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-serif">Loading your website analysis report…</p>
        </div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2 font-serif">Report Not Found</h1>
          <p className="text-gray-500 leading-relaxed">
            This report doesn't exist or the link may have expired. Return to the AI Business Hunter dashboard to generate a fresh audit.
          </p>
          <a
            href="/"
            className="inline-block mt-6 bg-purple-700 hover:bg-purple-800 text-white px-6 py-3 rounded-lg font-bold text-sm transition-colors"
          >
            ← Back to AI Business Hunter
          </a>
        </div>
      </div>
    );
  }

  const a = report.analysisData || {};
  const checks = a.checks || {};
  const overallScore = a.websiteScore ?? 0;
  const formattedDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const valueMin = a.estimatedValue?.min ?? 0;
  const valueMax = a.estimatedValue?.max ?? 0;
  const weekMin = a.deliveryWeeks?.min ?? 0;
  const weekMax = a.deliveryWeeks?.max ?? 0;

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 text-slate-900">
      {/* Top bar back to CRM / Dashboard */}
      <div className="bg-purple-950 text-white/90 text-xs px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = "/crm";
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <a href="/dashboard" className="hover:text-white font-medium transition-colors">
            Dashboard
          </a>
          <a href="/crm" className="hover:text-white font-medium transition-colors">
            Hunter CRM
          </a>
        </div>
        <span className="font-mono opacity-75">Report ID: #{report.reportId} · {report.totalViews} view{report.totalViews !== 1 ? "s" : ""}</span>
      </div>

      {/* Hero header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-700 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-12">
          <div className="flex items-center gap-3 mb-5 opacity-90">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">📊</div>
            <span className="text-xs tracking-widest uppercase font-semibold">Free Website & AI Opportunity Audit</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 leading-tight font-serif">{report.businessName}</h1>
          {report.website && (
            <a
              href={report.website.startsWith("http") ? report.website : `https://${report.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-white/75 hover:text-white text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {report.website}
            </a>
          )}
          <div className="flex gap-4 mt-6 flex-wrap">
            <div className="bg-white/15 rounded-xl px-4 py-2.5">
              <div className="text-2xl font-extrabold">
                {overallScore}
                <span className="text-sm opacity-80">/100</span>
              </div>
              <div className="text-[11px] opacity-80 tracking-wider uppercase">Website Score</div>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-2.5">
              <div className="text-2xl font-extrabold">{a.issues?.length ?? 0}</div>
              <div className="text-[11px] opacity-80 tracking-wider uppercase">Issues Found</div>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-2.5">
              <div className="text-2xl font-extrabold">{a.opportunities?.length ?? 0}</div>
              <div className="text-[11px] opacity-80 tracking-wider uppercase">Opportunities</div>
            </div>
            {formattedDate && (
              <div className="bg-white/10 rounded-xl px-4 py-2.5">
                <div className="text-sm font-bold">{formattedDate}</div>
                <div className="text-[11px] opacity-80 tracking-wider uppercase">Report Date</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 pb-20 space-y-6">
        {/* Executive summary */}
        {a.summary && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <h2 className="text-xs uppercase tracking-widest text-purple-700 mb-3 font-bold">Executive Summary</h2>
            <p className="leading-relaxed text-base text-gray-700 font-serif">{a.summary}</p>
          </div>
        )}

        {/* Score cards */}
        <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
          <h2 className="text-xs uppercase tracking-widest text-purple-700 mb-6 font-bold">Performance Scores</h2>
          <div className="flex gap-6 flex-wrap justify-center mb-7">
            <ScoreRing score={a.websiteScore ?? 0} label="Website" strokeColor="#6d28d9" />
            <ScoreRing score={a.leadScore ?? 0} label="Lead Gen" strokeColor="#4f46e5" />
            <ScoreRing score={a.conversionScore ?? 0} label="Conversion" strokeColor="#10b981" />
            <ScoreRing score={a.mobileScore ?? 0} label="Mobile" strokeColor="#f59e0b" />
            <ScoreRing score={a.seoScore ?? 0} label="SEO" strokeColor="#3b82f6" />
            <ScoreRing score={a.growthPotential ?? 0} label="Growth" strokeColor="#ec4899" />
          </div>
          <div className="grid gap-3">
            {[
              { label: "Website Quality", value: a.websiteScore ?? 0, textClass: "text-purple-700" },
              { label: "Lead Generation", value: a.leadScore ?? 0, textClass: "text-indigo-600" },
              { label: "Conversion Rate", value: a.conversionScore ?? 0, textClass: "text-emerald-600" },
              { label: "Mobile Experience", value: a.mobileScore ?? 0, textClass: "text-amber-600" },
              { label: "SEO Optimisation", value: a.seoScore ?? 0, textClass: "text-blue-600" },
              { label: "Growth Potential", value: a.growthPotential ?? 0, textClass: "text-pink-600" },
            ].map(({ label, value, textClass }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs sm:text-sm text-gray-700 w-36 shrink-0">{label}</span>
                <progress value={Math.max(0, Math.min(100, value))} max={100} className="w-full h-2 rounded-full overflow-hidden accent-purple-600" />
                <span className={`text-sm font-bold w-9 text-right ${textClass}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Issues found */}
        {(a.issues?.length ?? 0) > 0 && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <h2 className="text-xs uppercase tracking-widest text-red-600 mb-5 font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Issues Found
            </h2>
            <div className="grid gap-3">
              {a.issues!.map((issue, i) => {
                const boxStyle =
                  issue.priority === "high"
                    ? "bg-red-50 border-l-4 border-red-500"
                    : issue.priority === "medium"
                    ? "bg-amber-50 border-l-4 border-amber-500"
                    : "bg-emerald-50 border-l-4 border-emerald-500";
                const badgeStyle =
                  issue.priority === "high"
                    ? "bg-red-600 text-white"
                    : issue.priority === "medium"
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white";
                return (
                  <div key={i} className={`${boxStyle} rounded-r-xl p-4`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 text-sm">{issue.title}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyle}`}>
                        {issue.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{issue.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revenue opportunities */}
        {(a.opportunities?.length ?? 0) > 0 && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <h2 className="text-xs uppercase tracking-widest text-emerald-600 mb-5 font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Revenue Opportunities
            </h2>
            <div className="grid gap-3">
              {a.opportunities!.map((opp, i) => (
                <div key={i} className="bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl p-4">
                  <div className="font-bold text-sm text-gray-900 mb-1">{opp.title}</div>
                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>
                      Impact: <strong className="text-emerald-700">{opp.impact}</strong>
                    </span>
                    <span>
                      Effort: <strong>{opp.effort}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature checklist */}
        {Object.keys(checks).length > 0 && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <h2 className="text-xs uppercase tracking-widest text-purple-700 mb-5 font-bold">Feature Checklist</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {Object.entries(checks).map(([key, present]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2.5 text-xs sm:text-sm px-3 py-2.5 rounded-lg ${
                    present ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
                  }`}
                >
                  {present ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span>{CHECK_LABELS[key] || key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Growth recommendations */}
        {(a.recommendedFeatures?.length ?? 0) > 0 && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <h2 className="text-xs uppercase tracking-widest text-purple-700 mb-5 font-bold">Growth Recommendations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {a.recommendedFeatures!.map((feat, i) => (
                <div
                  key={i}
                  className="bg-purple-50 border-l-4 border-purple-700 rounded-r-lg px-3.5 py-2.5 text-xs sm:text-sm text-purple-950 font-semibold"
                >
                  {feat}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project estimate */}
        {(valueMax > 0 || weekMax > 0) && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <h2 className="text-xs uppercase tracking-widest text-purple-700 mb-5 font-bold">Project Estimate</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {a.projectType && (
                <div className="bg-purple-50 rounded-xl p-5 text-center">
                  <div className="text-xs text-gray-500 mb-1.5">Project Type</div>
                  <div className="text-base font-extrabold text-purple-950">{a.projectType}</div>
                </div>
              )}
              {valueMax > 0 && (
                <div className="bg-emerald-50 rounded-xl p-5 text-center">
                  <div className="text-xs text-gray-500 mb-1.5">Estimated Value</div>
                  <div className="text-lg font-extrabold text-emerald-800">
                    ${valueMin.toLocaleString()} – ${valueMax.toLocaleString()}
                  </div>
                </div>
              )}
              {weekMax > 0 && (
                <div className="bg-blue-50 rounded-xl p-5 text-center">
                  <div className="text-xs text-gray-500 mb-1.5">Delivery Time</div>
                  <div className="text-lg font-extrabold text-blue-800">
                    {weekMin}–{weekMax} weeks
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-purple-900 via-purple-700 to-indigo-700 rounded-2xl p-8 sm:p-10 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 font-serif">Ready to Improve Your Website & AI Automation?</h2>
          <p className="text-sm sm:text-base text-white/85 mb-7 max-w-xl mx-auto leading-relaxed">
            We've identified high-impact improvements that can capture more leads and automate bookings for{" "}
            <strong>{report.businessName}</strong>.
          </p>
          {report.proposalRequested || submitted ? (
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-300/40 text-white px-6 py-3 rounded-xl font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              Proposal Request Received — We'll follow up shortly!
            </div>
          ) : (
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => setRequestModalOpen(true)}
                className="bg-white text-purple-800 hover:bg-purple-50 px-6 py-3.5 rounded-xl font-extrabold text-sm shadow-md transition-colors cursor-pointer"
              >
                📋 Request Custom Proposal
              </button>
              <button
                onClick={() => setRequestModalOpen(true)}
                className="bg-white/15 hover:bg-white/25 text-white px-6 py-3.5 rounded-xl font-bold text-sm border-2 border-white/30 transition-colors cursor-pointer"
              >
                📅 Book Free Consultation
              </button>
            </div>
          )}
          <p className="mt-6 text-xs text-white/65">
            Prepared exclusively by <strong>DevStudio · AI Business Hunter</strong> · Free of charge · No commitment required
          </p>
        </div>
      </div>

      {/* Proposal / Consultation Request Modal */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Proposal for {report.businessName}</DialogTitle>
          </DialogHeader>
          {submitted ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-lg">Proposal Request Sent!</h3>
              <p className="text-sm text-muted-foreground">
                Your request has been logged in the AI Business Hunter Inbox and our team will send over your tailored proposal.
              </p>
              <Button onClick={() => setRequestModalOpen(false)} className="w-full mt-2">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Your Name</label>
                <Input value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="e.g. Dr. Elena Rostova" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Email Address *</label>
                <Input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Phone / WhatsApp</label>
                  <Input value={reqWhatsapp} onChange={(e) => setReqWhatsapp(e.target.value)} placeholder="+1 555 000 0000" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Estimated Budget</label>
                  <Input value={reqBudget} onChange={(e) => setReqBudget(e.target.value)} placeholder="e.g. $2,500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Project Goals / Notes</label>
                <Textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRequestModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitProposalRequest} disabled={submitting || !reqEmail.trim()} className="gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Submitting…" : "Send Proposal Request"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
