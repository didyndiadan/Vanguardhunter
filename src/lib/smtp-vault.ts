/**
 * Persistent Client-Side + Server-Synced SMTP Vault
 * Ensures that user-configured Gmail & SMTP accounts NEVER get cleared or lost
 * after pushing a new deployment to Render (even if the container restarts with an empty DB).
 */

const VAULT_STORAGE_KEY = "vh_smtp_accounts_vault_v1";

export interface VaultSmtpAccount {
  id?: number;
  label: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  dailyLimit: number;
  active: boolean;
}

export function loadSmtpVault(): VaultSmtpAccount[] {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a && typeof a.user === "string" && a.user.trim().length > 0);
  } catch {
    return [];
  }
}

export function saveSmtpVault(accounts: VaultSmtpAccount[]): void {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage quota errors
  }
}

export function upsertAccountInSmtpVault(acct: Partial<VaultSmtpAccount> & { user: string }): VaultSmtpAccount[] {
  const current = loadSmtpVault();
  const cleanUser = acct.user.trim().toLowerCase();
  const cleanHost = (acct.host || "smtp.gmail.com").trim().toLowerCase();

  const existingIdx = current.findIndex(
    (item) =>
      item.user.trim().toLowerCase() === cleanUser &&
      (item.host || "smtp.gmail.com").trim().toLowerCase() === cleanHost
  );

  const existing = existingIdx >= 0 ? current[existingIdx] : undefined;
  const incomingPassword =
    acct.password && acct.password !== "••••••••" ? acct.password.replace(/\s+/g, "") : undefined;

  const merged: VaultSmtpAccount = {
    id: acct.id ?? existing?.id,
    label: acct.label || existing?.label || acct.user.trim(),
    provider: acct.provider || existing?.provider || "gmail",
    host: acct.host || existing?.host || "smtp.gmail.com",
    port: Number(acct.port ?? existing?.port ?? 587) || 587,
    secure: acct.secure ?? existing?.secure ?? Number(acct.port ?? existing?.port ?? 587) === 465,
    user: acct.user.trim(),
    password: incomingPassword || existing?.password || "",
    fromName: acct.fromName ?? existing?.fromName ?? "Vanguard Outreach",
    fromEmail: acct.fromEmail ?? existing?.fromEmail ?? acct.user.trim(),
    dailyLimit: Number(acct.dailyLimit ?? existing?.dailyLimit ?? 80) || 80,
    active: acct.active ?? existing?.active ?? true,
  };

  if (existingIdx >= 0) {
    current[existingIdx] = merged;
  } else {
    current.push(merged);
  }

  saveSmtpVault(current);
  return current;
}

export function removeAccountFromSmtpVault(userOrId: { id?: number; user?: string; host?: string }): VaultSmtpAccount[] {
  const current = loadSmtpVault();
  const filtered = current.filter((item) => {
    if (userOrId.user) {
      const sameUser = item.user.trim().toLowerCase() === userOrId.user.trim().toLowerCase();
      if (userOrId.host) {
        const sameHost = (item.host || "").trim().toLowerCase() === userOrId.host.trim().toLowerCase();
        return !(sameUser && sameHost);
      }
      return !sameUser;
    }
    if (userOrId.id !== undefined && item.id !== undefined) {
      return item.id !== userOrId.id;
    }
    return true;
  });
  saveSmtpVault(filtered);
  return filtered;
}

/**
 * Synchronizes the local browser SMTP vault with the backend server.
 * - Any accounts present on the server are backed up into localStorage (including their password if returned).
 * - Any accounts in localStorage that are missing on the server (e.g. after pushing a new deploy on Render)
 *   are automatically re-created on the server so settings never clear.
 */
export async function syncSmtpVaultWithServer(
  headers: Record<string, string>,
  apiPrefix = ""
): Promise<any[]> {
  const localVault = loadSmtpVault();

  let serverAccounts: any[] = [];
  try {
    const res = await fetch(`${apiPrefix}/api/crm/email-accounts`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        serverAccounts = data;
      }
    }
  } catch {
    // ignore network error
  }

  // 1. Back up server accounts into local vault
  for (const sa of serverAccounts) {
    if (sa && sa.user) {
      upsertAccountInSmtpVault({
        id: sa.id,
        label: sa.label,
        provider: sa.provider,
        host: sa.host,
        port: sa.port,
        secure: sa.secure,
        user: sa.user,
        password: sa.passwordPlain || undefined,
        fromName: sa.fromName,
        fromEmail: sa.fromEmail,
        dailyLimit: sa.dailyLimit,
        active: sa.active,
      });
    }
  }

  // 2. Find any local vault accounts (with passwords) that are missing on the server
  const updatedVault = loadSmtpVault();
  const missingOnServer = updatedVault.filter((va) => {
    if (!va.user || !va.password) return false;
    return !serverAccounts.some(
      (sa) =>
        String(sa.user || "").trim().toLowerCase() === va.user.trim().toLowerCase() &&
        String(sa.host || "").trim().toLowerCase() === (va.host || "smtp.gmail.com").trim().toLowerCase()
    );
  });

  if (missingOnServer.length > 0) {
    try {
      const syncRes = await fetch(`${apiPrefix}/api/crm/email-accounts/sync-vault`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ accounts: missingOnServer }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (Array.isArray(syncData?.accounts)) {
          serverAccounts = syncData.accounts;
        }
      }
    } catch {
      // ignore sync error
    }
  }

  return serverAccounts;
}
