import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  X,
  Send,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Pencil,
  Play,
  Pause,
  Layers,
  KeyRound,
  CheckCircle2,
  Copy,
  Sparkles,
} from "lucide-react";
import { getSaasToken } from "@/lib/saas-auth";

export interface SmtpAccountItem {
  id: number;
  label: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
  active: boolean;
  sentCount: number;
  dailyLimit: number;
  sentToday: number;
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorAt: string | null;
  autoPaused: boolean;
  hasPassword?: boolean;
  createdAt?: string;
}

export const SMTP_PROVIDER_PRESETS = [
  {
    id: "gmail",
    name: "Gmail (Personal)",
    badge: "Most Popular · 16-Digit App Password",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    recommendedLimit: 80,
    userPlaceholder: "yourname@gmail.com",
    passLabel: "16-Character Google App Password *",
    passPlaceholder: "abcd efgh ijkl mnop (16 letters)",
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    securityUrl: "https://myaccount.google.com/security",
    steps: [
      "1. Go to your Google Account Security page (myaccount.google.com/security).",
      "2. Under 'How you sign in to Google', make sure 2-Step Verification is turned ON.",
      "3. Open Google App Passwords directly (myaccount.google.com/apppasswords) or search 'App passwords' in the top search bar.",
      "4. Type a name like 'Vanguard Mailer' and click Create.",
      "5. Copy the 16-letter App Password shown in the yellow box and paste it into the App Password field below (spaces are removed automatically).",
    ],
  },
  {
    id: "gworkspace",
    name: "Google Workspace (Business Gmail)",
    badge: "High Deliverability · Custom Domain",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    recommendedLimit: 150,
    userPlaceholder: "you@yourcompany.com",
    passLabel: "16-Character Google App Password *",
    passPlaceholder: "abcd efgh ijkl mnop (16 letters)",
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    securityUrl: "https://myaccount.google.com/security",
    steps: [
      "1. Sign into your Google Workspace email account at myaccount.google.com/security.",
      "2. Enable 2-Step Verification (if your Workspace Admin hasn't enabled it, allow 2-Step Verification in admin.google.com → Security → Authentication).",
      "3. Visit myaccount.google.com/apppasswords, enter 'Outreach CRM', and click Create.",
      "4. Copy the 16-character App Password and paste it below with Host smtp.gmail.com and Port 587.",
    ],
  },
  {
    id: "outlook",
    name: "Outlook / Office 365 / Hotmail",
    badge: "Microsoft 365 App Password",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    recommendedLimit: 100,
    userPlaceholder: "you@outlook.com or you@company.com",
    passLabel: "Microsoft App Password *",
    passPlaceholder: "Paste Microsoft App Password",
    appPasswordUrl: "https://account.live.com/proofs/Manage/additional",
    securityUrl: "https://mysignins.microsoft.com/security-info",
    steps: [
      "1. Open Microsoft Account Security (account.live.com/proofs/Manage/additional) or Microsoft 365 Security Info (mysignins.microsoft.com/security-info).",
      "2. Turn ON Two-step verification.",
      "3. Scroll down to the 'App passwords' section and click 'Create a new app password'.",
      "4. Copy the generated password and paste it below. (For Microsoft 365 business tenants, ensure 'Authenticated SMTP' is enabled for the mailbox).",
    ],
  },
  {
    id: "yahoo",
    name: "Yahoo Mail",
    badge: "Yahoo App Password",
    host: "smtp.mail.yahoo.com",
    port: 587,
    secure: false,
    recommendedLimit: 80,
    userPlaceholder: "yourname@yahoo.com",
    passLabel: "Yahoo 16-Character App Password *",
    passPlaceholder: "Paste Yahoo App Password",
    appPasswordUrl: "https://login.yahoo.com/account/security",
    securityUrl: "https://login.yahoo.com/account/security",
    steps: [
      "1. Go to Yahoo Account Security (login.yahoo.com/account/security).",
      "2. Turn on 2-Step Verification.",
      "3. Click 'Generate app password' (or 'Manage app passwords') at the bottom of the page.",
      "4. Enter 'Website CRM' and click Generate, then copy the 16-character password into the field below.",
    ],
  },
  {
    id: "zoho",
    name: "Zoho Mail",
    badge: "Zoho App-Specific Password",
    host: "smtp.zoho.com",
    port: 587,
    secure: false,
    recommendedLimit: 100,
    userPlaceholder: "you@zoho.com or you@yourdomain.com",
    passLabel: "Zoho App-Specific Password *",
    passPlaceholder: "Paste Zoho App Password",
    appPasswordUrl: "https://accounts.zoho.com/home#security/security_pwd",
    securityUrl: "https://accounts.zoho.com",
    steps: [
      "1. Log in to Zoho Accounts (accounts.zoho.com) and click Security → App Passwords.",
      "2. Click 'Generate New Password' and enter an application name.",
      "3. Copy the generated App-Specific Password and paste it below.",
      "4. Note: If you use a custom domain on Zoho Mail Pro, you can use either smtp.zoho.com or smtppro.zoho.com on Port 587.",
    ],
  },
  {
    id: "brevo",
    name: "Brevo (Sendinblue) SMTP",
    badge: "High-Volume Transactional Relay",
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    recommendedLimit: 300,
    userPlaceholder: "Your Brevo Login Email (or 7a8b9c...@smtp-brevo.com)",
    passLabel: "Brevo Master SMTP Key (xsmtpsib-...) *",
    passPlaceholder: "xsmtpsib-...",
    appPasswordUrl: "https://app.brevo.com/settings/keys/smtp",
    securityUrl: "https://app.brevo.com/settings/keys/smtp",
    steps: [
      "1. Log in to your Brevo dashboard and open Settings → SMTP & API (app.brevo.com/settings/keys/smtp).",
      "2. Under the SMTP tab, copy your 'SMTP Login' into the Email/Username field.",
      "3. Click 'Generate a new SMTP key', copy the key starting with 'xsmtpsib-...', and paste it into the Password field.",
      "4. Set your verified sender email in the 'From Email' field.",
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid / Mailgun / Amazon SES",
    badge: "Dedicated API / Cloud SMTP",
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    recommendedLimit: 500,
    userPlaceholder: "apikey (for SendGrid) or postmaster@yourdomain.com",
    passLabel: "SMTP API Key / Secret *",
    passPlaceholder: "SG.xxxx (SendGrid) or Mailgun SMTP password",
    appPasswordUrl: "https://app.sendgrid.com/settings/api_keys",
    securityUrl: "https://app.sendgrid.com/settings/sender_auth",
    steps: [
      "• SendGrid: Set Host to smtp.sendgrid.net, Port 587, Username to the exact word 'apikey', and Password to your SendGrid API Key (SG.xxx).",
      "• Mailgun: Go to Sending → Domain Settings → SMTP credentials. Set Host to smtp.mailgun.org, Port 587, Username to postmaster@mg.yourdomain.com, and paste your Mailgun password.",
      "• Amazon SES: Create SMTP Credentials in AWS SES Console. Use regional host (e.g. email-smtp.us-east-1.amazonaws.com), Port 587, and your SES SMTP Username & Password.",
    ],
  },
  {
    id: "custom",
    name: "Custom Domain / cPanel / Hostinger / Namecheap",
    badge: "Standard Webmail SMTP",
    host: "smtp.hostinger.com",
    port: 587,
    secure: false,
    recommendedLimit: 100,
    userPlaceholder: "contact@yourdomain.com",
    passLabel: "Mailbox Password *",
    passPlaceholder: "Your mailbox password",
    appPasswordUrl: "",
    securityUrl: "",
    steps: [
      "• Hostinger Email: Host smtp.hostinger.com · Port 587 (or 465) · Use your full email address and normal mailbox password.",
      "• Namecheap PrivateEmail: Host mail.privateemail.com · Port 587 (or 465) · Use your full email address and mailbox password.",
      "• cPanel / Plesk Hosting: Host mail.yourdomain.com · Port 587 (STARTTLS) or Port 465 (SSL) · Use the email account password created in cPanel → Email Accounts.",
    ],
  },
];

function buildAuthHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("vh_admin_token") ||
    getSaasToken() ||
    localStorage.getItem("ds_api_token") ||
    localStorage.getItem("crm_token") ||
    "admin123";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Standalone interactive instructions panel for getting a Gmail App Password
 * and configuring all other supported SMTP providers. Can be embedded in Admin,
 * User Dashboard, and CRM Email Settings.
 */
export const SmtpAppPasswordGuide: React.FC<{
  defaultOpen?: boolean;
  defaultProvider?: string;
  selectedProviderId?: string;
  onSelectPreset?: (presetId: string) => void;
}> = ({ defaultOpen = true, defaultProvider, selectedProviderId = "gmail", onSelectPreset }) => {
  const initialProvider = defaultProvider || selectedProviderId || "gmail";
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [activeGuideTab, setActiveGuideTab] = useState<string>(initialProvider);

  useEffect(() => {
    const nextProv = defaultProvider || selectedProviderId;
    if (nextProv && SMTP_PROVIDER_PRESETS.some((p) => p.id === nextProv)) {
      setActiveGuideTab(nextProv);
    }
  }, [defaultProvider, selectedProviderId]);

  const activePreset =
    SMTP_PROVIDER_PRESETS.find((p) => p.id === activeGuideTab) || SMTP_PROVIDER_PRESETS[0];

  return (
    <div className="bg-amber-50/70 border border-amber-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-amber-100/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
            <KeyRound className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-950 flex flex-wrap items-center gap-2">
              <span>Step-by-Step Guide: How to Get Your Gmail App Password &amp; Other SMTP Credentials</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                Required for Gmail / Outlook / Yahoo
              </span>
            </div>
            <p className="text-[11px] text-slate-600 truncate">
              Click any email provider below for exact instructions, server hosts, ports, and direct App Password links
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-900 shrink-0">
          {isOpen ? "Hide Guide ▲" : "Show Instructions ▼"}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-amber-200/80 space-y-4 bg-white">
          {/* Provider Guide Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {SMTP_PROVIDER_PRESETS.map((preset) => {
              const active = activeGuideTab === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setActiveGuideTab(preset.id);
                    if (onSelectPreset) onSelectPreset(preset.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    active
                      ? "bg-slate-950 text-white border-slate-950 shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          {/* Active Provider Step-by-Step Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                  {activePreset.badge}
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-950 mt-0.5">
                  {activePreset.name} — Setup Instructions
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-semibold">
                  Host: <strong>{activePreset.host}</strong>
                </span>
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-semibold">
                  Port: <strong>{activePreset.port}</strong>
                </span>
                <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  Safe Daily Limit: <strong>{activePreset.recommendedLimit}/day</strong>
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
              {activePreset.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {(activePreset.appPasswordUrl || activePreset.securityUrl) && (
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                {activePreset.appPasswordUrl && (
                  <a
                    href={activePreset.appPasswordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-2xs"
                  >
                    <span>Open {activePreset.name.split(" ")[0]} App Passwords Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {activePreset.securityUrl &&
                  activePreset.securityUrl !== activePreset.appPasswordUrl && (
                    <a
                      href={activePreset.securityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold"
                    >
                      <span>Open 2-Step Verification Settings</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] text-blue-950 leading-relaxed">
              <strong>💡 Pro Tip for Multiple Gmails:</strong> Google allows up to ~80–150 outreach emails per day on a single Gmail account. By connecting <strong>5 to 10 Gmail accounts</strong> below, the system automatically rotates round-robin across all of your Gmails so you can safely dispatch <strong>500 to 1,500+ messages per day</strong> with automatic failover!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface MultiSmtpManagerPanelProps {
  mode?: "admin" | "user";
  title?: string;
  subtitle?: string;
  onAccountsChanged?: (count: number) => void;
}

export const MultiSmtpManagerPanel: React.FC<MultiSmtpManagerPanelProps> = ({
  mode = "admin",
  onAccountsChanged,
}) => {
  const [accounts, setAccounts] = useState<SmtpAccountItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Mode: 'single' | 'bulk_gmail'
  const [addMode, setAddMode] = useState<"single" | "bulk_gmail">("single");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("gmail");

  // Single account form state
  const [label, setLabel] = useState<string>("");
  const [host, setHost] = useState<string>("smtp.gmail.com");
  const [port, setPort] = useState<number>(587);
  const [user, setUser] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [fromName, setFromName] = useState<string>("Vanguard Outreach");
  const [fromEmail, setFromEmail] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState<number>(80);
  const [savingSingle, setSavingSingle] = useState<boolean>(false);

  // Bulk Multiple Gmails state (both interactive rows + paste box)
  const [bulkRows, setBulkRows] = useState<
    Array<{ user: string; password: string; fromName: string; provider: string; host: string; port: number }>
  >([
    { user: "", password: "", fromName: "Vanguard Outreach", provider: "gmail", host: "smtp.gmail.com", port: 587 },
    { user: "", password: "", fromName: "Vanguard Outreach", provider: "gmail", host: "smtp.gmail.com", port: 587 },
    { user: "", password: "", fromName: "Vanguard Outreach", provider: "gmail", host: "smtp.gmail.com", port: 587 },
  ]);
  const [bulkRawLines, setBulkRawLines] = useState<string>("");
  const [savingBulk, setSavingBulk] = useState<boolean>(false);

  // Editing an existing account
  const [editingAccount, setEditingAccount] = useState<SmtpAccountItem | null>(null);
  const [editPassword, setEditPassword] = useState<string>("");

  // Testing state
  const [testingAccountId, setTestingAccountId] = useState<number | null>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>("");
  const [testingRotation, setTestingRotation] = useState<boolean>(false);

  const showNotice = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/email-accounts", {
        headers: buildAuthHeaders(),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAccounts(data);
        if (onAccountsChanged) onAccountsChanged(data.length);
      }
    } catch (err: any) {
      console.error("Failed to load SMTP accounts:", err);
    } finally {
      setLoading(false);
    }
  }, [onAccountsChanged]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = SMTP_PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setHost(preset.host);
      setPort(preset.port);
      setDailyLimit(preset.recommendedLimit);
      if (preset.id === "sendgrid" && !user) {
        setUser("apikey");
      }
    }
  };

  const handleAddSingleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !password.trim() || !host.trim()) {
      showNotice("error", "Please enter your email/username, App Password, and SMTP host.");
      return;
    }

    setSavingSingle(true);
    try {
      const cleanEmail = user.trim();
      const res = await fetch("/api/crm/email-accounts", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          label: label.trim() || `${selectedPresetId.toUpperCase()} · ${cleanEmail}`,
          provider: selectedPresetId,
          host: host.trim(),
          port: Number(port) || 587,
          secure: Number(port) === 465,
          user: cleanEmail,
          password: password.replace(/\s+/g, ""),
          fromName: fromName.trim() || "Vanguard Outreach",
          fromEmail: fromEmail.trim() || (cleanEmail.includes("@") ? cleanEmail : ""),
          dailyLimit: Number(dailyLimit) || 80,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add SMTP account");

      setLabel("");
      setUser("");
      setPassword("");
      setFromEmail("");
      showNotice(
        "success",
        `Connected ${cleanEmail} to your Multi-SMTP Rotational Pool! Click "Test Send" on the account row below to verify delivery.`
      );
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to add SMTP account");
    } finally {
      setSavingSingle(false);
    }
  };

  const handleBulkAddAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = bulkRows.filter((r) => r.user.trim() && r.password.trim());
    if (validRows.length === 0 && !bulkRawLines.trim()) {
      showNotice("error", "Please fill in at least one Gmail/SMTP row or paste lines in the bulk box.");
      return;
    }

    setSavingBulk(true);
    try {
      const res = await fetch("/api/crm/email-accounts/bulk", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          accounts: validRows,
          rawLines: bulkRawLines,
          defaultFromName: fromName || "Vanguard Outreach",
          defaultDailyLimit: dailyLimit || 80,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to bulk add accounts");

      setBulkRows([
        { user: "", password: "", fromName: fromName || "Vanguard Outreach", provider: "gmail", host: "smtp.gmail.com", port: 587 },
        { user: "", password: "", fromName: fromName || "Vanguard Outreach", provider: "gmail", host: "smtp.gmail.com", port: 587 },
      ]);
      setBulkRawLines("");
      showNotice(
        "success",
        `Added ${data.addedCount} Gmail / SMTP account(s) to the Multi-SMTP Rotational Pool!`
      );
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to bulk add accounts");
    } finally {
      setSavingBulk(false);
    }
  };

  const handleTestSingleAccount = async (acct: SmtpAccountItem) => {
    setTestingAccountId(acct.id);
    try {
      const res = await fetch(`/api/crm/email-accounts/${acct.id}/test`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          to: testRecipientEmail.trim() || acct.fromEmail || acct.user,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "SMTP connection test failed");
      showNotice(
        "success",
        `✓ Verified! Test email successfully sent via "${acct.label}" (${acct.user}) to ${
          testRecipientEmail.trim() || acct.fromEmail || acct.user
        }.`
      );
      await loadAccounts();
    } catch (err: any) {
      showNotice(
        "error",
        `✗ Test failed for ${acct.user}: ${err.message}. (If using Gmail, make sure you used a 16-character Google App Password, not your normal password).`
      );
      await loadAccounts();
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleTestRotationPool = async () => {
    setTestingRotation(true);
    try {
      const res = await fetch("/api/crm/test-email", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          to: testRecipientEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rotation test failed");
      showNotice(
        "success",
        `✓ Multi-SMTP Rotation Active! Test message dispatched via inbox "${data.sentVia}".`
      );
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", `Rotation test error: ${err.message}`);
    } finally {
      setTestingRotation(false);
    }
  };

  const handleToggleActive = async (acct: SmtpAccountItem) => {
    try {
      const res = await fetch(`/api/crm/email-accounts/${acct.id}`, {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          active: !acct.active,
          resetFailures: !acct.active,
        }),
      });
      if (!res.ok) throw new Error("Failed to update account status");
      showNotice(
        "success",
        `${acct.user} is now ${!acct.active ? "ACTIVE in rotation" : "PAUSED"}.`
      );
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to update account");
    }
  };

  const handleResetFailures = async (acct: SmtpAccountItem) => {
    try {
      await fetch(`/api/crm/email-accounts/${acct.id}`, {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          active: true,
          resetFailures: true,
        }),
      });
      showNotice("success", `Cleared error flags and resumed ${acct.user} in rotation.`);
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to reset account");
    }
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const res = await fetch(`/api/crm/email-accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          label: editingAccount.label,
          provider: editingAccount.provider,
          host: editingAccount.host,
          port: Number(editingAccount.port) || 587,
          secure: Number(editingAccount.port) === 465,
          user: editingAccount.user,
          password: editPassword.trim() ? editPassword.replace(/\s+/g, "") : undefined,
          fromName: editingAccount.fromName,
          fromEmail: editingAccount.fromEmail,
          dailyLimit: Number(editingAccount.dailyLimit) || 80,
          resetFailures: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      setEditingAccount(null);
      setEditPassword("");
      showNotice("success", "Updated SMTP inbox settings.");
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to update account");
    }
  };

  const handleDeleteAccount = async (id: number, emailLabel: string) => {
    try {
      await fetch(`/api/crm/email-accounts/${id}`, {
        method: "DELETE",
        headers: buildAuthHeaders(),
      });
      showNotice("success", `Removed ${emailLabel} from Multi-SMTP pool.`);
      await loadAccounts();
    } catch (err: any) {
      showNotice("error", err.message || "Failed to delete account");
    }
  };

  const activeAccounts = accounts.filter((a) => a.active && !a.autoPaused);
  const totalDailyCapacity = activeAccounts.reduce(
    (sum, a) => sum + (a.dailyLimit > 0 ? a.dailyLimit : 150),
    0
  );
  const totalSentToday = accounts.reduce((sum, a) => sum + (a.sentToday || 0), 0);
  const totalAllTimeSent = accounts.reduce((sum, a) => sum + (a.sentCount || 0), 0);
  const activePreset =
    SMTP_PROVIDER_PRESETS.find((p) => p.id === selectedPresetId) || SMTP_PROVIDER_PRESETS[0];

  return (
    <div className="space-y-6">
      {/* Top Summary & Wired Activities Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
              <Mail className="w-3.5 h-3.5" />
              <span>Multi-SMTP &amp; Multi-Gmail Rotational Cluster</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
              {mode === "admin"
                ? "Admin Multi-SMTP & Multiple Gmails Dispatcher (Wired to All Sending Activities)"
                : "Connect Multiple Gmails & SMTP Inboxes for Automated Outreach"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              Connect unlimited Gmail accounts (using 16-character App Passwords) or custom SMTP relays. Every outgoing message automatically rotates round-robin across your active accounts with instant failover if an inbox hits its daily limit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="email"
              value={testRecipientEmail}
              onChange={(e) => setTestRecipientEmail(e.target.value)}
              placeholder="Optional test recipient email..."
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg w-52"
            />
            <button
              type="button"
              onClick={handleTestRotationPool}
              disabled={testingRotation || accounts.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testingRotation ? "Testing Pool..." : "Test Multi-SMTP Rotation"}</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards + Wired Activities Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">Connected Inboxes</div>
            <div className="font-mono-num text-xl font-bold text-slate-950 mt-0.5">
              {activeAccounts.length} Active{" "}
              <span className="text-xs font-normal text-slate-400">/ {accounts.length} total</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">Daily Sending Capacity</div>
            <div className="font-mono-num text-xl font-bold text-emerald-700 mt-0.5">
              {totalDailyCapacity.toLocaleString()} / day
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">Dispatched Today</div>
            <div className="font-mono-num text-xl font-bold text-blue-700 mt-0.5">
              {totalSentToday.toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">All-Time Dispatched</div>
            <div className="font-mono-num text-xl font-bold text-slate-950 mt-0.5">
              {totalAllTimeSent.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Wired Sending Activities Strip */}
        <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span className="font-bold text-slate-900">Wired Sending Activities:</span>
          <span>✓ Cold Outreach &amp; Bulk Campaigns</span>
          <span aria-hidden="true">·</span>
          <span>✓ 24/7 Autopilot &amp; Follow-Up Queue</span>
          <span aria-hidden="true">·</span>
          <span>✓ AI Website Pitch &amp; Audit Emails</span>
          <span aria-hidden="true">·</span>
          <span>✓ Website Chatbot &amp; 4-Tap Lead Alerts</span>
          <span aria-hidden="true">·</span>
          <span>✓ Admin Support Replies &amp; User Broadcasts</span>
        </div>
      </div>

      {/* Status Toast Notice */}
      {notice && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-800"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step-by-Step Instructions on How to Get App Passwords for Gmail & All Other SMTPs */}
      <SmtpAppPasswordGuide
        defaultOpen={true}
        selectedProviderId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
      />

      {/* Add Single Account OR Bulk Add Multiple Gmails Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              Add Gmail or SMTP Accounts to Rotational Pool
            </h3>
            <p className="text-xs text-slate-500">
              Add a single inbox or bulk-add multiple Gmail accounts at once for automatic round-robin rotation
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setAddMode("single")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                addMode === "single"
                  ? "bg-white text-slate-950 shadow-2xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              + Add Single Gmail / SMTP
            </button>
            <button
              type="button"
              onClick={() => setAddMode("bulk_gmail")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                addMode === "bulk_gmail"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              ⚡ Bulk Add Multiple Gmails
            </button>
          </div>
        </div>

        {addMode === "single" ? (
          <form onSubmit={handleAddSingleAccount} className="space-y-4">
            {/* Quick Provider Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                1. Choose Email / SMTP Provider (Auto-fills Host &amp; Port)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SMTP_PROVIDER_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        active
                          ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-950 truncate">{preset.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        {preset.host}:{preset.port}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address / SMTP Username *
                </label>
                <input
                  type="text"
                  required
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder={activePreset.userPlaceholder}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activePreset.passLabel}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activePreset.passPlaceholder}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="e.g. Alex from Vanguard"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inbox Label (Optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Gmail Outreach #1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-end pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Server Host *
                </label>
                <input
                  type="text"
                  required
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Port *
                </label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Emails / Day (Per Inbox)
                </label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={savingSingle}
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{savingSingle ? "Connecting Inbox..." : "Connect Inbox to Pool"}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* BULK ADD MULTIPLE GMAILS / SMTPS FORM */
          <form onSubmit={handleBulkAddAccounts} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 space-y-1">
              <div className="font-bold">⚡ Fast Multi-Gmail Onboarding</div>
              <p className="text-[11px] text-blue-800">
                Enter multiple Gmail addresses and their 16-character Google App Passwords below (or paste a list). All accounts will be added to your rotational pool immediately.
              </p>
            </div>

            {/* Interactive Multi-Row Gmail Builder */}
            <div className="space-y-2.5">
              {bulkRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="email"
                      value={row.user}
                      onChange={(e) => {
                        const next = [...bulkRows];
                        next[idx] = { ...next[idx], user: e.target.value };
                        setBulkRows(next);
                      }}
                      placeholder={`Gmail / Email #${idx + 1} (e.g. team${idx + 1}@gmail.com)`}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="password"
                      value={row.password}
                      onChange={(e) => {
                        const next = [...bulkRows];
                        next[idx] = { ...next[idx], password: e.target.value };
                        setBulkRows(next);
                      }}
                      placeholder="16-Character Google App Password"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={row.fromName}
                      onChange={(e) => {
                        const next = [...bulkRows];
                        next[idx] = { ...next[idx], fromName: e.target.value };
                        setBulkRows(next);
                      }}
                      placeholder="Sender Display Name"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                      disabled={bulkRows.length <= 1}
                      className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setBulkRows([
                    ...bulkRows,
                    {
                      user: "",
                      password: "",
                      fromName: fromName || "Vanguard Outreach",
                      provider: "gmail",
                      host: "smtp.gmail.com",
                      port: 587,
                    },
                  ])
                }
                className="px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Gmail Row</span>
              </button>
            </div>

            {/* Optional Paste Box for 10+ Gmails */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Or Paste Multiple Gmails / SMTPs (One per line: <code className="font-mono bg-slate-100 px-1 rounded">email@gmail.com | app_password | Sender Name</code>)
              </label>
              <textarea
                rows={3}
                value={bulkRawLines}
                onChange={(e) => setBulkRawLines(e.target.value)}
                placeholder={`outreach1@gmail.com | abcd efgh ijkl mnop | Alex Marketing\noutreach2@gmail.com | qrst uvwx yzab cdef | Alex Marketing`}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBulk}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{savingBulk ? "Adding Gmails to Pool..." : "Connect All Gmails to Rotational Pool"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Inline Edit Modal / Card when editing an existing account */}
      {editingAccount && (
        <form
          onSubmit={handleSaveEditAccount}
          className="bg-blue-50/60 rounded-xl border-2 border-blue-600 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-slate-950">
              Edit SMTP Inbox: {editingAccount.user}
            </div>
            <button
              type="button"
              onClick={() => setEditingAccount(null)}
              className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Label</label>
              <input
                type="text"
                value={editingAccount.label}
                onChange={(e) => setEditingAccount({ ...editingAccount, label: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email / User</label>
              <input
                type="text"
                value={editingAccount.user}
                onChange={(e) => setEditingAccount({ ...editingAccount, user: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                New App Password (optional)
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Sender Name</label>
              <input
                type="text"
                value={editingAccount.fromName}
                onChange={(e) => setEditingAccount({ ...editingAccount, fromName: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Host &amp; Port</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={editingAccount.host}
                  onChange={(e) => setEditingAccount({ ...editingAccount, host: e.target.value })}
                  className="w-2/3 px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  value={editingAccount.port}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, port: Number(e.target.value) })
                  }
                  className="w-1/3 px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Daily Limit</label>
              <input
                type="number"
                value={editingAccount.dailyLimit}
                onChange={(e) =>
                  setEditingAccount({ ...editingAccount, dailyLimit: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingAccount(null)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Save Inbox Changes
            </button>
          </div>
        </form>
      )}

      {/* Connected Multi-SMTP & Gmail Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              Connected Rotational Gmail &amp; SMTP Inboxes ({accounts.length})
            </h3>
            <p className="text-xs text-slate-500">
              Active inboxes automatically share the load across outreach, autopilot, website lead alerts, and support replies
            </p>
          </div>
          <button
            type="button"
            onClick={loadAccounts}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-sm font-bold text-slate-800">
              No Gmail or SMTP inboxes connected yet
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Use the form above to add your first Gmail (with a 16-character App Password) or custom SMTP relay. You can add as many Gmails as you want for automatic rotation!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-4">Inbox Label &amp; Sender</th>
                  <th className="py-3 px-3">SMTP Server</th>
                  <th className="py-3 px-3">Today / Daily Cap</th>
                  <th className="py-3 px-3">Total Sent</th>
                  <th className="py-3 px-3">Rotation Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {accounts.map((acct) => {
                  const isTesting = testingAccountId === acct.id;
                  return (
                    <tr key={acct.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-950">{acct.label}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {acct.fromName} &lt;{acct.user}&gt;
                        </div>
                        {acct.lastError && (
                          <div className="text-[11px] text-red-600 mt-1 max-w-md truncate" title={acct.lastError}>
                            ⚠️ Last error: {acct.lastError}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                        {acct.host}:{acct.port}
                      </td>
                      <td className="py-3.5 px-3 font-mono-num">
                        <span className="font-bold text-slate-900">{acct.sentToday || 0}</span>
                        <span className="text-slate-400">
                          {" "}
                          / {acct.dailyLimit > 0 ? acct.dailyLimit : "∞"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono-num font-semibold text-slate-800">
                        {(acct.sentCount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3">
                        {acct.autoPaused ? (
                          <span className="inline-flex items-center gap-1 text-red-700 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Auto-Paused (3 Errors)
                          </span>
                        ) : acct.active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active in Rotation
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold text-[11px]">Paused</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTestSingleAccount(acct)}
                          disabled={isTesting}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isTesting ? "Testing..." : "Test Send"}</span>
                        </button>

                        {acct.autoPaused && (
                          <button
                            type="button"
                            onClick={() => handleResetFailures(acct)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded cursor-pointer"
                          >
                            Resume
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleActive(acct)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                        >
                          {acct.active ? "Pause" : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingAccount(acct);
                            setEditPassword("");
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acct.id, acct.user)}
                          className="px-2 py-1 text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded inline-flex items-center cursor-pointer"
                          title="Delete inbox"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSmtpManagerPanel;
