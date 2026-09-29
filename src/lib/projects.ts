import { saasFetch, getUserStorageScope, getCachedSaasUser, isUserAdmin } from "./saas-auth";

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
  ownerRole?: string;
  cmsPlatform?: string;
  techStack?: string[];
  missingSignals?: string[];
  buyerIntentScore?: number;
  intentTier?: "hot" | "warm" | "cold";
  intentReasons?: string[];
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

const LEGACY_PROJECTS_KEY = "ds_crm_projects";
const LEGACY_ACTIVE_PROJECT_KEY = "ds_crm_active_project_id";
const LEGACY_HUNTED_PREFIX = "ds_crm_hunted_project_";
const LEGACY_PROSPECTS_KEY = "ds_crm_prospects";

function getProjectsStorageKey(): string {
  return `ds_crm_projects_${getUserStorageScope()}`;
}

function getActiveProjectStorageKey(): string {
  return `ds_crm_active_project_id_${getUserStorageScope()}`;
}

function getHuntedProjectStorageKey(projectId: string): string {
  return `ds_crm_hunted_project_${getUserStorageScope()}_${projectId}`;
}

export function getProspectsStorageKey(): string {
  return `ds_crm_prospects_${getUserStorageScope()}`;
}

/**
 * One-time migration of legacy unscoped keys ONLY for the Platform Owner/Admin,
 * and immediate cleanup of unscoped keys so they can never leak to another user on the same browser.
 */
function migrateAndCleanLegacyKeys(): void {
  try {
    const user = getCachedSaasUser();
    const isAdmin = isUserAdmin(user);

    const legacyProjects = localStorage.getItem(LEGACY_PROJECTS_KEY);
    if (legacyProjects) {
      if (isAdmin && !localStorage.getItem(getProjectsStorageKey())) {
        localStorage.setItem(getProjectsStorageKey(), legacyProjects);
      }
      localStorage.removeItem(LEGACY_PROJECTS_KEY);
    }

    const legacyActive = localStorage.getItem(LEGACY_ACTIVE_PROJECT_KEY);
    if (legacyActive) {
      if (isAdmin && !localStorage.getItem(getActiveProjectStorageKey())) {
        localStorage.setItem(getActiveProjectStorageKey(), legacyActive);
      }
      localStorage.removeItem(LEGACY_ACTIVE_PROJECT_KEY);
    }

    const legacyProspects = localStorage.getItem(LEGACY_PROSPECTS_KEY);
    if (legacyProspects) {
      if (isAdmin && !localStorage.getItem(getProspectsStorageKey())) {
        localStorage.setItem(getProspectsStorageKey(), legacyProspects);
      }
      localStorage.removeItem(LEGACY_PROSPECTS_KEY);
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith(LEGACY_HUNTED_PREFIX) &&
        !k.startsWith("ds_crm_hunted_project_u_") &&
        !k.startsWith("ds_crm_hunted_project_anon_")
      ) {
        const projId = k.slice(LEGACY_HUNTED_PREFIX.length);
        const val = localStorage.getItem(k);
        if (isAdmin && val && projId && !localStorage.getItem(getHuntedProjectStorageKey(projId))) {
          localStorage.setItem(getHuntedProjectStorageKey(projId), val);
        }
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {}
}

export const DEFAULT_PROJECT_ID = "proj_default";

export function makeDefaultProjects(): LeadProject[] {
  const now = new Date().toISOString();
  return [
    {
      id: DEFAULT_PROJECT_ID,
      name: "Untitled",
      description: "",
      targetCategory: "",
      targetCity: "",
      targetCountry: "",
      extraContext: "",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export const DEFAULT_PROJECTS: LeadProject[] = makeDefaultProjects();

export function loadProjects(): LeadProject[] {
  migrateAndCleanLegacyKeys();
  const key = getProjectsStorageKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const defaults = makeDefaultProjects();
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = makeDefaultProjects();
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
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
    return makeDefaultProjects();
  }
}

export function saveProjects(projects: LeadProject[], syncRemote = true): void {
  migrateAndCleanLegacyKeys();
  const valid = projects.length > 0 ? projects : makeDefaultProjects();
  try {
    localStorage.setItem(getProjectsStorageKey(), JSON.stringify(valid));
  } catch {}
  if (syncRemote) {
    const huntedByProject: Record<string, any[]> = {};
    for (const p of valid) {
      const h = loadProjectHuntedResults(p.id);
      if (h.length > 0) huntedByProject[p.id] = h;
    }
    saasFetch("/api/saas/projects", {
      method: "PUT",
      body: JSON.stringify({ projects: valid, huntedByProject }),
    }).catch(() => {});
  }
}

export async function syncProjectsFromServer(): Promise<LeadProject[]> {
  migrateAndCleanLegacyKeys();
  try {
    const data = await saasFetch<{
      projects?: LeadProject[];
      huntedByProject?: Record<string, any[]>;
    }>("/api/saas/projects");
    if (data?.huntedByProject && typeof data.huntedByProject === "object") {
      for (const [projId, list] of Object.entries(data.huntedByProject)) {
        if (Array.isArray(list) && list.length > 0) {
          const existingLocal = loadProjectHuntedResults(projId);
          if (existingLocal.length === 0) {
            try {
              localStorage.setItem(getHuntedProjectStorageKey(projId), JSON.stringify(list));
            } catch {}
          }
        }
      }
    }
    if (Array.isArray(data?.projects) && data.projects.length > 0) {
      const local = loadProjects();
      const map = new Map<string, LeadProject>();
      for (const p of data.projects) map.set(p.id, p);
      for (const p of local) {
        // Only merge local custom projects or modified default projects belonging to this user
        const isUnmodifiedDefault =
          p.id === DEFAULT_PROJECT_ID &&
          p.name === "Untitled" &&
          !p.targetCategory &&
          !p.targetCity &&
          map.has(DEFAULT_PROJECT_ID);
        if (isUnmodifiedDefault) continue;
        const existing = map.get(p.id);
        if (!existing || new Date(p.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          map.set(p.id, p);
        }
      }
      const merged = Array.from(map.values());
      saveProjects(merged, false);
      return merged;
    } else if (Array.isArray(data?.projects) && data.projects.length === 0) {
      // Server confirms this user has no saved projects yet; return this user's scoped local projects
      return loadProjects();
    }
  } catch {}
  return loadProjects();
}

export function getActiveProjectId(projects?: LeadProject[]): string {
  migrateAndCleanLegacyKeys();
  const list = projects && projects.length > 0 ? projects : loadProjects();
  const activeKey = getActiveProjectStorageKey();
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("project");
    if (fromUrl && (fromUrl === "all" || list.some((p) => p.id === fromUrl))) {
      localStorage.setItem(activeKey, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(activeKey);
    if (saved && (saved === "all" || list.some((p) => p.id === saved))) {
      return saved;
    }
  } catch {}
  return list[0]?.id || DEFAULT_PROJECT_ID;
}

export function setActiveProjectId(projectId: string): void {
  try {
    localStorage.setItem(getActiveProjectStorageKey(), projectId);
  } catch {}
}

export function loadProjectHuntedResults<T = any>(projectId: string): T[] {
  if (!projectId || projectId === "all") return [];
  migrateAndCleanLegacyKeys();
  try {
    const raw = localStorage.getItem(getHuntedProjectStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjectHuntedResults<T = any>(projectId: string, results: T[]): void {
  if (!projectId || projectId === "all") return;
  migrateAndCleanLegacyKeys();
  try {
    localStorage.setItem(getHuntedProjectStorageKey(projectId), JSON.stringify(results));
  } catch {}
  // Sync this user's project hunted results privately to their user workspace on the server
  try {
    const projects = loadProjects();
    const huntedByProject: Record<string, any[]> = {};
    for (const p of projects) {
      const list = p.id === projectId ? results : loadProjectHuntedResults(p.id);
      if (Array.isArray(list) && list.length > 0) {
        huntedByProject[p.id] = list;
      }
    }
    saasFetch("/api/saas/projects", {
      method: "PUT",
      body: JSON.stringify({ projects, huntedByProject }),
    }).catch(() => {});
  } catch {}
}

export function loadUserProspects<T = any>(): T[] {
  migrateAndCleanLegacyKeys();
  const key = getProspectsStorageKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(
      (p: any) =>
        p &&
        !String(p.email || "").includes("example.com") &&
        !String(p.website || "").includes("example.com")
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveUserProspects<T = any>(prospects: T[]): void {
  migrateAndCleanLegacyKeys();
  try {
    localStorage.setItem(getProspectsStorageKey(), JSON.stringify(prospects));
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
    "Decision-Maker Role",
    "Email",
    "Phone",
    "Website",
    "CMS / Website Builder",
    "Detected Tech Stack",
    "Missing Revenue Signals",
    "Buyer Intent Score",
    "Intent Tier",
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
      lead.ownerRole || "",
      lead.email || "",
      lead.phone || "",
      lead.website || "",
      lead.cmsPlatform || "",
      Array.isArray(lead.techStack) ? lead.techStack.join(" | ") : "",
      Array.isArray(lead.missingSignals) ? lead.missingSignals.join(" | ") : "",
      lead.buyerIntentScore ?? "",
      lead.intentTier ? lead.intentTier.toUpperCase() : "",
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
    const userProspects = loadUserProspects<ExportableLead>();
    if (Array.isArray(userProspects)) userProspects.forEach(addUnique);
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
    "Role",
    "Email",
    "Phone",
    "Website",
    "CMS",
    "Missing Signals",
    "Intent Score",
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
        l.ownerRole || "",
        l.email,
        l.phone,
        l.website,
        l.cmsPlatform || "",
        Array.isArray(l.missingSignals) ? l.missingSignals.join(", ") : "",
        l.buyerIntentScore ?? "",
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
