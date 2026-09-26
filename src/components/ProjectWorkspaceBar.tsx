import React, { useState } from "react";
import {
  FolderKanban,
  Plus,
  Download,
  FileSpreadsheet,
  FileJson,
  Mail,
  Send,
  Copy,
  Check,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  LeadProject,
  ExportableLead,
  buildLeadsCSV,
  loadAllWorkspaceLeads,
  exportLeadsToCSV,
  exportLeadsToJSON,
  copyLeadsForSheets,
} from "@/lib/projects";
import { saasFetch } from "@/lib/saas-auth";

export function ExportLeadsBar({
  leads,
  projectName,
  projectsMap,
  label = "Export Generated Leads",
  compact = false,
}: {
  leads: ExportableLead[];
  projectName: string;
  projectsMap?: Record<string, string>;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailNote, setEmailNote] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: "ok" | "warn" | "err";
    text: string;
  } | null>(null);

  const getEffectiveLeads = (): ExportableLead[] => {
    if (leads && leads.length > 0) return leads;
    return loadAllWorkspaceLeads();
  };

  const handleCopy = async () => {
    const source = getEffectiveLeads();
    if (source.length === 0) {
      setExportNotice("No leads generated yet to copy.");
      setTimeout(() => setExportNotice(""), 2500);
      return;
    }
    try {
      const count = await copyLeadsForSheets(source);
      setCopied(true);
      setExportNotice(`Copied ${count} lead${count !== 1 ? "s" : ""} for Google Sheets / Excel`);
      setTimeout(() => {
        setCopied(false);
        setExportNotice("");
      }, 2500);
    } catch {}
  };

  const triggerExport = (type: "csv" | "json") => {
    const source = getEffectiveLeads();
    if (source.length === 0) {
      setExportNotice("Scrape or add leads first before exporting.");
      setTimeout(() => setExportNotice(""), 3000);
      return;
    }
    if (type === "csv") {
      exportLeadsToCSV(source, projectName, projectsMap);
      setExportNotice(`Downloaded ${source.length} lead${source.length !== 1 ? "s" : ""} to CSV`);
    } else {
      exportLeadsToJSON(source, projectName, projectsMap);
      setExportNotice(`Downloaded ${source.length} lead${source.length !== 1 ? "s" : ""} to JSON`);
    }
    setTimeout(() => setExportNotice(""), 2500);
  };

  const handleSendEmailCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = recipientEmail.trim();
    if (!to || !to.includes("@")) {
      setEmailStatus({ type: "err", text: "Please enter a valid email address." });
      return;
    }
    const source = getEffectiveLeads();
    if (source.length === 0) {
      setEmailStatus({
        type: "err",
        text: "There are no leads to email yet. Run AI Hunter or add leads first.",
      });
      return;
    }

    setSendingEmail(true);
    setEmailStatus(null);
    const { csvContent, filename } = buildLeadsCSV(source, projectName, projectsMap);

    try {
      const resp = await saasFetch<{
        success?: boolean;
        message?: string;
        error?: string;
        sentVia?: string;
      }>("/api/crm/email-csv", {
        method: "POST",
        body: JSON.stringify({
          to,
          note: emailNote.trim(),
          projectName: projectName || "Untitled",
          csvContent,
          filename,
          leads: source,
        }),
      });

      setEmailStatus({
        type: "ok",
        text:
          resp?.message ||
          `✓ CSV & ${source.length} lead${source.length !== 1 ? "s" : ""} emailed to ${to}!`,
      });
      setEmailNote("");
    } catch (err: any) {
      // If SMTP is not configured yet, download the CSV and open the user's mail client pre-filled with the recipient and lead summary so it still works immediately
      exportLeadsToCSV(source, projectName, projectsMap);
      const subject = encodeURIComponent(
        `Lead Export (${source.length} leads) — ${projectName || "Untitled"}`
      );
      const previewLines = source
        .slice(0, 25)
        .map(
          (l, i) =>
            `${i + 1}. ${l.businessName || "Business"} | ${l.email || "No email"} | ${l.phone || ""} | ${l.website || ""} (${[l.city, l.country].filter(Boolean).join(", ")})`
        )
        .join("\n");
      const body = encodeURIComponent(
        `${emailNote.trim() ? emailNote.trim() + "\n\n" : ""}Here are the ${source.length} generated leads for project "${projectName || "Untitled"}" (CSV file "${filename}" has also been downloaded to attach):\n\n${previewLines}`
      );
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
      setEmailStatus({
        type: "warn",
        text: `Downloaded "${filename}" & opened your email app addressed to ${to}. (Connect an SMTP inbox in Email Accounts for direct server-side sending.)`,
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenMailtoDirectly = () => {
    const to = recipientEmail.trim();
    const source = getEffectiveLeads();
    if (source.length === 0) {
      setEmailStatus({
        type: "err",
        text: "No leads available yet. Scrape or add leads first.",
      });
      return;
    }
    const { filename } = buildLeadsCSV(source, projectName, projectsMap);
    exportLeadsToCSV(source, projectName, projectsMap);
    const subject = encodeURIComponent(
      `Lead Export (${source.length} leads) — ${projectName || "Untitled"}`
    );
    const previewLines = source
      .slice(0, 25)
      .map(
        (l, i) =>
          `${i + 1}. ${l.businessName || "Business"} | ${l.email || "No email"} | ${l.phone || ""} | ${l.website || ""} (${[l.city, l.country].filter(Boolean).join(", ")})`
      )
      .join("\n");
    const body = encodeURIComponent(
      `${emailNote.trim() ? emailNote.trim() + "\n\n" : ""}Lead export for "${projectName || "Untitled"}" (${source.length} leads — CSV "${filename}" downloaded):\n\n${previewLines}`
    );
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
    setEmailStatus({
      type: "ok",
      text: `✓ Downloaded CSV & opened email compose for ${to || "recipient"}!`,
    });
  };

  const renderEmailPopover = () => {
    if (!showEmailForm) return null;
    const effectiveCount = getEffectiveLeads().length;
    return (
      <div className="w-full mt-2.5 p-3.5 rounded-xl border-2 border-blue-600 bg-white shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Email CSV Data to Someone ({effectiveCount} {effectiveCount === 1 ? "lead" : "leads"})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowEmailForm(false);
              setEmailStatus(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSendEmailCSV} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="email"
            required
            autoFocus
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="Enter recipient email (e.g. partner@company.com)"
            className="flex-1 px-3 py-1.5 text-xs sm:text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
          />
          <input
            type="text"
            value={emailNote}
            onChange={(e) => setEmailNote(e.target.value)}
            placeholder="Optional message / note"
            className="sm:w-56 px-3 py-1.5 text-xs sm:text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            disabled={sendingEmail}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sendingEmail ? "Sending CSV..." : "Send CSV Email"}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenMailtoDirectly}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 cursor-pointer"
            title="Download CSV and open your email app with lead data pre-filled"
          >
            <span>Open in Mail App</span>
          </button>
        </form>

        {emailStatus && (
          <div
            className={`text-xs font-medium px-3 py-2 rounded-lg border ${
              emailStatus.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : emailStatus.type === "warn"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {emailStatus.text}
          </div>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex flex-col items-end w-full sm:w-auto">
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => triggerExport("csv")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
            title="Download full lead list as CSV for Excel or Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV ({leads.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowEmailForm((v) => !v);
              setEmailStatus(null);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              showEmailForm
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300"
            }`}
            title="Email the CSV file and lead data to someone"
          >
            <Mail className={`w-3.5 h-3.5 ${showEmailForm ? "text-white" : "text-blue-600"}`} />
            <span>Email CSV</span>
          </button>
          <button
            type="button"
            onClick={() => triggerExport("json")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
            title="Download JSON data"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-600" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
            title="Copy tab-separated rows to paste directly into Google Sheets"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            <span>{copied ? "Copied!" : "Copy for Sheets"}</span>
          </button>
          {exportNotice && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
              ✓ {exportNotice}
            </span>
          )}
        </div>
        {renderEmailPopover()}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {label} ({leads.length} {leads.length === 1 ? "lead" : "leads"})
            </div>
            <div className="text-[11px] text-slate-500">
              Download generated leads for <span className="font-semibold text-slate-700">{projectName}</span> as CSV, email the CSV data to someone, or copy to clipboard.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => triggerExport("csv")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-white transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowEmailForm((v) => !v);
              setEmailStatus(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              showEmailForm
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-slate-100 text-slate-800 border-slate-300"
            }`}
          >
            <Mail className={`w-3.5 h-3.5 ${showEmailForm ? "text-white" : "text-blue-600"}`} />
            <span>Email CSV to Someone</span>
          </button>
          <button
            type="button"
            onClick={() => triggerExport("json")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-600" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            <span>{copied ? "Copied for Sheets!" : "Copy for Sheets"}</span>
          </button>
        </div>
      </div>
      {exportNotice && (
        <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-md inline-block">
          ✓ {exportNotice}
        </div>
      )}
      {renderEmailPopover()}
    </div>
  );
}

interface ProjectWorkspaceBarProps {
  projects: LeadProject[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (project: Omit<LeadProject, "id" | "createdAt" | "updatedAt">) => void;
  onUpdateProject: (project: LeadProject) => void;
  onDeleteProject: (projectId: string) => void;
  projectLeadCounts: Record<string, number>;
  totalLeadsCount: number;
  activeProjectLeads: ExportableLead[];
  categories?: string[];
}

export default function ProjectWorkspaceBar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  projectLeadCounts,
  totalLeadsCount,
  activeProjectLeads,
}: ProjectWorkspaceBarProps) {
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const projectsMap: Record<string, string> = {};
  for (const p of projects) {
    projectsMap[p.id] = p.name;
  }

  const openCreateModal = () => {
    setName("");
    setModalMode("create");
  };

  const openEditModal = () => {
    if (!activeProject) return;
    setName(activeProject.name);
    setModalMode("edit");
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || "Untitled";
    if (modalMode === "create") {
      onCreateProject({
        name: finalName,
        description: "",
        targetCategory: "",
        targetCity: "",
        targetCountry: "",
        extraContext: "",
      });
    } else if (modalMode === "edit" && activeProject) {
      onUpdateProject({
        ...activeProject,
        name: finalName,
        updatedAt: new Date().toISOString(),
      });
    }
    setName("");
    setModalMode(null);
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Top Row: Project Switcher Pills + New Project Button */}
      <div className="px-4 py-3 bg-slate-950 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 shrink-0 mr-1">
            <FolderKanban className="w-4 h-4" />
            <span>Projects:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {projects.map((proj) => {
              const isSelected = activeProjectId === proj.id;
              const count = projectLeadCounts[proj.id] || 0;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => onSelectProject(proj.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                  }`}
                >
                  <span className="truncate max-w-[200px]">{proj.name}</span>
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                      isSelected ? "bg-blue-800 text-blue-100" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {projects.length > 1 && (
              <button
                type="button"
                onClick={() => onSelectProject("all")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeProjectId === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                <span>All Projects</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {totalLeadsCount}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
          {activeProjectId !== "all" && activeProject && (
            <>
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Rename project"
              >
                <Pencil className="w-3 h-3" />
                <span>Rename</span>
              </button>
              {projects.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteProject(activeProject.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-red-950/70 text-slate-400 hover:text-red-300 border border-slate-800 transition-colors cursor-pointer"
                  title="Delete this project"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Row: Active Project Details + Instant Export Controls */}
      <div className="px-4 py-3 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          {activeProjectId === "all" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900">All Projects</span>
              <span className="text-xs text-slate-500">
                · {totalLeadsCount} total leads across {projects.length} projects
              </span>
            </div>
          ) : activeProject ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900">{activeProject.name}</span>
              <span className="text-xs text-slate-500">
                · {activeProjectLeads.length} generated {activeProjectLeads.length === 1 ? "lead" : "leads"}
              </span>
            </div>
          ) : null}
        </div>

        <ExportLeadsBar
          leads={activeProjectLeads}
          projectName={activeProjectId === "all" ? "All-Projects" : activeProject?.name || "Untitled"}
          projectsMap={projectsMap}
          compact
        />
      </div>

      {/* Create / Rename Project Simple Inline Form (Project Name Only) */}
      {modalMode && (
        <div className="border-t border-slate-200 bg-white px-4 py-3.5">
          <form onSubmit={handleSaveProject} className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <label className="text-xs font-bold text-slate-800 shrink-0">
              {modalMode === "create" ? "Project Name:" : "Rename Project:"}
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name (leave empty for Untitled)"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                {modalMode === "create" ? "Create Project" : "Save Name"}
              </button>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
