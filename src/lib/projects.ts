import { saasFetch } from "./saas-auth";

export interface LeadProject {
  id: string;
  name: string;
  description: string;
  targetCategory: string;
  targetCity: string;
  targetCountry: string;
  extraContext?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportableLead {
  id?: number | string;
  projectId?: string;
  projectName?: string;
  businessName: string;
  ownerName?: string;
  category?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  country?: string;
  status?: string;
  priority?: string;
  expectedValue?: number;
  estimatedValue?: number;
  softwareNeedScore?: number;
  aiAgentScore?: number;
  aiAgentType?: string;
  painPoint?: string;
  notes?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  emailSentAt?: string;
  generatedEmail?: {
    subject?: string;
    body?: string;
  };
  generatedWhatsApp?: string;
  generatedLinkedIn?: string;
  reportUrl?: string;
  addedAt?: string;
}

const PROJECTS_STORAGE_KEY = "ds_crm_projects";
const ACTIVE_PROJECT_KEY = "ds_crm_active_project_id";
const HUNTED_BY_PROJECT_PREFIX = "ds_crm_hunted_project_";

export const DEFAULT_PROJECT_ID = "proj_default";

export const DEFAULT_PROJECTS: LeadProject[] = [
  {
    id: DEFAULT_PROJECT_ID,
    name: "Untitled",
    description: "",
    targetCategory: "",
    targetCity: "",
    targetCountry: "",
    extraContext: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function loadProjects(): LeadProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS));
      return DEFAULT_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS));
      return DEFAULT_PROJECTS;
    }
    const normalized = parsed.map((p: LeadProject) => {
      if (p.id === DEFAULT_PROJECT_ID && p.name === "Project 1 — General B2B Outreach") {
        return {
          ...p,
          name: "Untitled",
          description: "",
          targetCategory: "",
          targetCity: "",
          targetCountry: "",
        };
      }
      return {
        ...p,
        name: (p.name || "").trim() || "Untitled",
      };
    });
    return normalized;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export function saveProjects(projects: LeadProject[], syncRemote = true): void {
  const valid = projects.length > 0 ? projects : DEFAULT_PROJECTS;
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(valid));
  } catch {}
  if (syncRemote) {
    saasFetch("/api/saas/projects", {
      method: "PUT",
      body: JSON.stringify({ projects: valid }),
    }).catch(() => {});
  }
}

export async function syncProjectsFromServer(): Promise<LeadProject[]> {
  try {
    const data = await saasFetch<{ projects?: LeadProject[] }>("/api/saas/projects");
    if (Array.isArray(data?.projects) && data.projects.length > 0) {
      const local = loadProjects();
      // Merge local and remote projects by id, preferring newer updatedAt
      const map = new Map<string, LeadProject>();
      for (const p of data.projects) map.set(p.id, p);
      for (const p of local) {
        const existing = map.get(p.id);
        if (!existing || new Date(p.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          map.set(p.id, p);
        }
      }
      const merged = Array.from(map.values());
      saveProjects(merged, false);
      return merged;
    }
  } catch {}
  return loadProjects();
}

export function getActiveProjectId(projects?: LeadProject[]): string {
  const list = projects && projects.length > 0 ? projects : loadProjects();
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("project");
    if (fromUrl && (fromUrl === "all" || list.some((p) => p.id === fromUrl))) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (saved && (saved === "all" || list.some((p) => p.id === saved))) {
      return saved;
    }
  } catch {}
  return list[0]?.id || DEFAULT_PROJECT_ID;
}

export function setActiveProjectId(projectId: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  } catch {}
}

export function loadProjectHuntedResults<T = any>(projectId: string): T[] {
  if (!projectId || projectId === "all") return [];
  try {
    const raw = localStorage.getItem(`${HUNTED_BY_PROJECT_PREFIX}${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjectHuntedResults<T = any>(projectId: string, results: T[]): void {
  if (!projectId || projectId === "all") return;
  try {
    localStorage.setItem(`${HUNTED_BY_PROJECT_PREFIX}${projectId}`, JSON.stringify(results));
  } catch {}
}

export function slugifyFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "leads"
  );
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function buildLeadsCSV(
  leads: ExportableLead[],
  projectName = "Untitled",
  projectsMap?: Record<string, string>
): { csvContent: string; filename: string } {
  const headers = [
    "Project",
    "Business Name",
    "Owner / Contact Name",
    "Email",
    "Phone",
    "Website",
    "Category",
    "City",
    "Country",
    "Pipeline Status",
    "Priority",
    "Deal Value (USD)",
    "Need / AI Score",
    "Pain Point / Opportunity",
    "Email Sent Date",
    "Personalized Email Subject",
    "Personalized Email Body",
    "WhatsApp Message",
    "LinkedIn Message",
    "Audit Report URL",
    "Instagram",
    "Facebook",
    "LinkedIn URL",
    "Notes",
    "Added At",
  ];

  const rows = leads.map((lead) => {
    const resolvedProject =
      lead.projectName ||
      (lead.projectId && projectsMap?.[lead.projectId]) ||
      projectName;
    const dealValue = lead.expectedValue ?? lead.estimatedValue ?? 0;
    const score = lead.aiAgentScore ?? (lead.softwareNeedScore ? lead.softwareNeedScore * 10 : "");

    return [
      resolvedProject,
      lead.businessName || "",
      lead.ownerName || "",
      lead.email || "",
      lead.phone || "",
      lead.website || "",
      lead.category || "",
      lead.city || "",
      lead.country || "",
      lead.status || "new",
      lead.priority || "medium",
      dealValue || "",
      score,
      lead.painPoint || "",
      lead.emailSentAt ? new Date(lead.emailSentAt).toISOString() : "",
      lead.generatedEmail?.subject || "",
      lead.generatedEmail?.body || "",
      lead.generatedWhatsApp || "",
      lead.generatedLinkedIn || "",
      lead.reportUrl || "",
      lead.instagram || "",
      lead.facebook || "",
      lead.linkedin || "",
      lead.notes || "",
      lead.addedAt || "",
    ].map(escapeCsvCell);
  });

  // Include UTF-8 BOM so Excel opens special characters and multi-line emails cleanly
  const csvContent = "\uFEFF" + [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${slugifyFilename(projectName)}-leads-${dateStamp}.csv`;
  return { csvContent, filename };
}

export function loadAllWorkspaceLeads(): ExportableLead[] {
  const combined: ExportableLead[] = [];
  const seen = new Set<string>();
  const addUnique = (lead: ExportableLead) => {
    if (!lead || !lead.businessName) return;
    const key = `${lead.businessName}|${lead.email || ""}|${lead.city || ""}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    combined.push(lead);
  };

  try {
    const rawProspects = localStorage.getItem("ds_crm_prospects");
    if (rawProspects) {
      const parsed = JSON.parse(rawProspects);
      if (Array.isArray(parsed)) parsed.forEach(addUnique);
    }
  } catch {}

  try {
    const projects = loadProjects();
    for (const p of projects) {
      const hunted = loadProjectHuntedResults<ExportableLead>(p.id);
      hunted.forEach((h) => addUnique({ ...h, projectId: p.id, projectName: p.name }));
    }
  } catch {}

  return combined;
}

export function exportLeadsToCSV(
  leads: ExportableLead[],
  projectName = "Untitled",
  projectsMap?: Record<string, string>
): void {
  const { csvContent, filename } = buildLeadsCSV(leads, projectName, projectsMap);
  triggerFileDownload(csvContent, filename, "text/csv;charset=utf-8;");
}

export function exportEmailsOnlyCSV(
  leads: ExportableLead[],
  projectName = "Vanguard-Leads",
  projectsMap?: Record<string, string>
): void {
  const headers = [
    "Email",
    "Business Name",
    "Contact Name",
    "Category",
    "City",
    "Country",
    "Website",
    "Phone",
    "Project",
    "Personalized Subject",
    "Personalized Email Body",
  ];

  const validEmailLeads = leads.filter((l) => l.email && String(l.email).includes("@"));
  const sourceList = validEmailLeads.length > 0 ? validEmailLeads : leads;

  const rows = sourceList.map((lead) => {
    const resolvedProject =
      lead.projectName ||
      (lead.projectId && projectsMap?.[lead.projectId]) ||
      projectName;
    return [
      lead.email || "",
      lead.businessName || "",
      lead.ownerName || "",
      lead.category || "",
      lead.city || "",
      lead.country || "",
      lead.website || "",
      lead.phone || "",
      resolvedProject,
      lead.generatedEmail?.subject || "",
      lead.generatedEmail?.body || "",
    ].map(escapeCsvCell);
  });

  const csvContent = "\uFEFF" + [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${slugifyFilename(projectName)}-email-list-${dateStamp}.csv`;
  triggerFileDownload(csvContent, filename, "text/csv;charset=utf-8;");
}

export function exportLeadsToJSON(
  leads: ExportableLead[],
  projectName = "Vanguard-Leads",
  projectsMap?: Record<string, string>
): void {
  const payload = {
    project: projectName,
    exportedAt: new Date().toISOString(),
    totalLeads: leads.length,
    leadsWithEmail: leads.filter((l) => l.email && String(l.email).includes("@")).length,
    leads: leads.map((lead) => ({
      ...lead,
      projectName:
        lead.projectName ||
        (lead.projectId && projectsMap?.[lead.projectId]) ||
        projectName,
    })),
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${slugifyFilename(projectName)}-leads-${dateStamp}.json`;
  triggerFileDownload(jsonContent, filename, "application/json;charset=utf-8;");
}

export async function copyLeadsForSheets(leads: ExportableLead[]): Promise<number> {
  const headers = [
    "Business Name",
    "Contact Name",
    "Email",
    "Phone",
    "Website",
    "Category",
    "City",
    "Country",
    "Pain Point",
    "Deal Value",
  ];
  const sanitizeTab = (v: unknown) =>
    String(v ?? "")
      .replace(/[\t\r\n]+/g, " ")
      .trim();

  const lines = [
    headers.join("\t"),
    ...leads.map((l) =>
      [
        l.businessName,
        l.ownerName,
        l.email,
        l.phone,
        l.website,
        l.category,
        l.city,
        l.country,
        l.painPoint || l.notes,
        l.expectedValue ?? l.estimatedValue ?? "",
      ]
        .map(sanitizeTab)
        .join("\t")
    ),
  ];

  await navigator.clipboard.writeText(lines.join("\n"));
  return leads.length;
}
