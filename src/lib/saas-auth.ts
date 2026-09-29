export interface SaasUser {
  id: number;
  email: string;
  fullName: string;
  companyName: string;
  role: "admin" | "user";
  planId: string;
  billingCycle: "monthly" | "annual";
  subscriptionStatus: string;
  huntsUsedThisMonth: number;
  emailsSentThisMonth: number;
  auditsRunThisMonth: number;
  creditsBalance: number;
  status: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface SaasPlan {
  id: string;
  name: string;
  audience: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyHuntLimit: number;
  monthlyEmailLimit: number;
  maxEmailAccounts: number;
  bulkHuntEnabled: boolean;
  autoPilotEnabled: boolean;
  lemonCheckoutUrl: string;
  lemonVariantId: string;
  features: string[];
  isPopular: boolean;
  active: boolean;
}

export interface SaasPayment {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  planId: string;
  billingCycle: string;
  amountUsd: number;
  paymentMethod: string;
  cryptoNetwork: string;
  walletAddress: string;
  txHashOrRef: string;
  status: "completed" | "pending" | "rejected";
  adminNote: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface UserActivity {
  id: number;
  userId?: number;
  userEmail: string;
  userName: string;
  category: "auth" | "hunt" | "audit" | "email" | "billing" | "admin" | "system" | "support";
  action: string;
  details: string;
  createdAt: string;
}

export interface SupportMessage {
  id: number;
  threadId: string;
  userId: number;
  userEmail: string;
  userName: string;
  senderRole: "user" | "admin";
  senderName: string;
  subject: string;
  category: "general" | "billing" | "technical" | "plan_upgrade" | "announcement";
  body: string;
  status: "open" | "replied" | "resolved";
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

export interface TrainedServiceOffer {
  id: string;
  name: string;
  description: string;
  targetSignals: string;
}

export interface AiTrainingProfile {
  userId?: number | null;
  senderName: string;
  businessName: string;
  websiteUrl: string;
  senderEmail: string;
  servicesOffered?: TrainedServiceOffer[];
  offerDetails: string;
  targetPainPoints: string;
  staticEmailExample: string;
  subjectLineGuide: string;
  aiInstructions: string;
  tone: "conversational" | "direct" | "friendly" | "analytical";
  callToAction: string;
  includeAuditReportLink: boolean;
  isTrained: boolean;
  updatedAt: string;
}

export interface SeededAccountInfo {
  label: string;
  badge: string;
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  role: "admin" | "user";
  planId: string;
  description: string;
}

export function getSaasToken(): string {
  if (localStorage.getItem("vh_logged_out") === "true") {
    return "";
  }
  return localStorage.getItem("ds_api_token") || "";
}

export function isUserAdmin(user?: SaasUser | null): boolean {
  if (!user) return false;
  const email = (user.email || "").trim().toLowerCase();
  return (
    user.role === "admin" ||
    email === "jwandersonar@gmail.com" ||
    email === "admin@vanguardhunter.io"
  );
}

export function getCachedSaasUser(): SaasUser | null {
  try {
    if (localStorage.getItem("vh_logged_out") === "true") {
      return null;
    }
    const token = localStorage.getItem("ds_api_token");
    if (!token) return null;
    const raw = localStorage.getItem("vh_saas_user");
    if (raw) return JSON.parse(raw) as SaasUser;
  } catch {}
  return null;
}

export function getAdminToken(): string {
  if (localStorage.getItem("vh_logged_out") === "true") {
    return "";
  }
  const explicitAdmin = localStorage.getItem("vh_admin_token");
  if (explicitAdmin) return explicitAdmin;
  const cachedUser = getCachedSaasUser();
  if (isUserAdmin(cachedUser)) {
    return getSaasToken();
  }
  return "";
}

export function getUserStorageScope(): string {
  const user = getCachedSaasUser();
  if (user && user.id) {
    return `u_${user.id}`;
  }
  if (user && user.email) {
    return `u_${user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  }
  return "anon";
}

export function setSaasSession(token: string, user?: SaasUser): void {
  localStorage.removeItem("vh_logged_out");
  localStorage.setItem("ds_api_token", token);
  if (user) {
    localStorage.setItem("vh_saas_user", JSON.stringify(user));
    if (isUserAdmin(user)) {
      localStorage.setItem("vh_admin_token", token);
      localStorage.setItem("vh_admin_unlocked", "true");
    } else {
      localStorage.removeItem("vh_admin_token");
      localStorage.removeItem("vh_admin_unlocked");
    }
  }
  try {
    window.dispatchEvent(new Event("vh-auth-change"));
  } catch {}
}

export function clearSaasSession(): void {
  const prevToken = localStorage.getItem("ds_api_token") || localStorage.getItem("vh_admin_token") || "";
  localStorage.setItem("vh_logged_out", "true");
  localStorage.removeItem("vh_saas_user");
  localStorage.removeItem("ds_api_token");
  localStorage.removeItem("vh_admin_token");
  localStorage.removeItem("vh_admin_unlocked");
  if (prevToken) {
    fetch("/api/saas/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${prevToken}`,
      },
    }).catch(() => {});
  }
  try {
    window.dispatchEvent(new Event("vh-auth-change"));
  } catch {}
}

export async function saasFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getSaasToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function adminFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}
