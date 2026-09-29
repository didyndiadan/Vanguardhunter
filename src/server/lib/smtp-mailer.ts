import dns from "node:dns";
import net from "node:net";
import nodemailer from "nodemailer";

// ─── Force IPv4 Globally & Disable Unreachable IPv6 in Nodemailer v10 ─────────
// Render containers have a link-local IPv6 interface (fe80::) without an outbound
// IPv6 internet route. Nodemailer v10's internal shared/index.js checks
// os.networkInterfaces(), sees the link-local IPv6 interface, calls dns.resolve6(),
// and attempts to connect to IPv6 addresses like 2607:f8b0:400e:c08::6d:587,
// causing "connect ENETUNREACH 2607:f8b0:400e:c08::6d:587 - Local (:::0)".
try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
  // Patch dns.Resolver.prototype.resolve6 and dns.resolve6 so Nodemailer v10
  // never receives AAAA records that fail with ENETUNREACH in IPv4-only cloud containers.
  const emptyIpv6 = function (_hostname: string, optionsOrCb: any, maybeCb?: any) {
    const cb = typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
    if (typeof cb === "function") {
      process.nextTick(() => cb(null, []));
    }
  };
  if (dns.Resolver && dns.Resolver.prototype) {
    dns.Resolver.prototype.resolve6 = emptyIpv6 as any;
  }
  (dns as any).resolve6 = emptyIpv6;
} catch {
  // Ignore if runtime restricts dns patching
}

const ipv4Cache = new Map<string, { ip: string; expires: number }>();

export async function resolveIpv4Host(hostname: string): Promise<string> {
  const cleanHost = (hostname || "").trim();
  if (!cleanHost || net.isIP(cleanHost) === 4) return cleanHost;
  if (net.isIP(cleanHost) === 6) return cleanHost;

  const now = Date.now();
  const cached = ipv4Cache.get(cleanHost);
  if (cached && cached.expires > now) {
    return cached.ip;
  }

  try {
    const addresses = await dns.promises.resolve4(cleanHost);
    if (Array.isArray(addresses) && addresses.length > 0) {
      const ip = addresses[0];
      ipv4Cache.set(cleanHost, { ip, expires: now + 5 * 60 * 1000 });
      return ip;
    }
  } catch {
    // Fallback to dns.promises.lookup with family: 4
    try {
      const res = await dns.promises.lookup(cleanHost, { family: 4 });
      if (res?.address) {
        ipv4Cache.set(cleanHost, { ip: res.address, expires: now + 5 * 60 * 1000 });
        return res.address;
      }
    } catch {
      // Return original hostname if lookup fails
    }
  }
  return cleanHost;
}

export interface SmtpAccountConfig {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  password: string;
  provider?: string;
  fromName?: string;
  fromEmail?: string;
}

function isNetworkOrPortError(err: any): boolean {
  const msg = String(err?.message || err || "").toUpperCase();
  const code = String(err?.code || "").toUpperCase();
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "ESOCKET" ||
    code === "ECONNECTION" ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENETUNREACH") ||
    msg.includes("EHOSTUNREACH") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("CONNECTION TIMEOUT") ||
    msg.includes("GREETING NEVER RECEIVED") ||
    msg.includes("SOCKET CLOSE")
  );
}

function supportsPort2525(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("brevo.com") ||
    h.includes("sendinblue.com") ||
    h.includes("sendgrid.net") ||
    h.includes("mailgun.org") ||
    h.includes("mailtrap.io") ||
    h.includes("postmarkapp.com") ||
    h.includes("smtp2go.com") ||
    h.includes("elasticemail.com")
  );
}

function parseFromHeader(fromRaw: string | undefined, fallbackName: string, fallbackEmail: string) {
  if (!fromRaw) {
    return { name: fallbackName || "DevStudio", email: fallbackEmail };
  }
  const match = fromRaw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: match[1].trim() || fallbackName || "DevStudio",
      email: match[2].trim() || fallbackEmail,
    };
  }
  if (fromRaw.includes("@")) {
    return { name: fallbackName || "DevStudio", email: fromRaw.trim() };
  }
  return { name: fromRaw.trim() || fallbackName || "DevStudio", email: fallbackEmail };
}

function getAppsScriptUrl(acct: SmtpAccountConfig): string | null {
  const host = (acct.host || "").trim();
  const pass = (acct.password || "").trim();
  if (host.startsWith("https://script.google.com/")) return host;
  if (pass.startsWith("https://script.google.com/")) return pass;
  return null;
}

function isBrevoHttpApi(acct: SmtpAccountConfig): boolean {
  const pass = (acct.password || "").trim();
  const host = (acct.host || "").trim().toLowerCase();
  return pass.startsWith("xkeysib-") || host === "api.brevo.com" || host.startsWith("https://api.brevo.com");
}

function isResendHttpApi(acct: SmtpAccountConfig): boolean {
  const pass = (acct.password || "").trim();
  const host = (acct.host || "").trim().toLowerCase();
  return (
    (pass.startsWith("re_") && (host.includes("resend.com") || acct.port === 443)) ||
    host === "api.resend.com"
  );
}

async function sendViaAppsScriptBridge(
  scriptUrl: string,
  acct: SmtpAccountConfig,
  mailOpts: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: Array<{ filename?: string; content?: any; contentType?: string }>;
  }
) {
  const sender = parseFromHeader(
    mailOpts.from,
    acct.fromName || "Vanguard Outreach",
    acct.fromEmail || acct.user
  );
  const toAddr = Array.isArray(mailOpts.to) ? mailOpts.to.join(", ") : mailOpts.to;

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send",
      to: toAddr,
      subject: mailOpts.subject || "",
      text: mailOpts.text || "",
      html: mailOpts.html || "",
      fromName: sender.name,
      fromEmail: sender.email,
      replyTo: mailOpts.replyTo || sender.email,
    }),
    redirect: "follow",
  });

  const rawText = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Check if Google returned an HTML error page (e.g. script not deployed as "Anyone")
    if (!res.ok || rawText.includes("Google Accounts") || rawText.includes("Sign in")) {
      throw new Error(
        "Google Apps Script URL requires authentication. When deploying in script.google.com, set 'Who has access' to 'Anyone'."
      );
    }
  }
  if (parsed && parsed.ok === false && parsed.error) {
    throw new Error(`Gmail HTTPS Bridge error: ${parsed.error}`);
  }
  if (!res.ok) {
    throw new Error(`Gmail HTTPS Bridge HTTP ${res.status}: ${rawText.slice(0, 200)}`);
  }
  return { messageId: `<gas-${Date.now()}@gmail.com>`, accepted: [toAddr] };
}

async function sendViaBrevoHttpApi(
  apiKey: string,
  acct: SmtpAccountConfig,
  mailOpts: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }
) {
  const sender = parseFromHeader(
    mailOpts.from,
    acct.fromName || "DevStudio",
    acct.fromEmail || acct.user
  );
  const toList = (Array.isArray(mailOpts.to) ? mailOpts.to : String(mailOpts.to).split(","))
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey.trim(),
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: toList,
      subject: mailOpts.subject || "",
      htmlContent: mailOpts.html || `<p>${mailOpts.text || ""}</p>`,
      ...(mailOpts.text ? { textContent: mailOpts.text } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Brevo HTTPS API error (${res.status}): ${(data as any)?.message || JSON.stringify(data)}`);
  }
  return { messageId: (data as any)?.messageId || `<brevo-${Date.now()}>`, accepted: toList.map((t) => t.email) };
}

async function sendViaResendHttpApi(
  apiKey: string,
  acct: SmtpAccountConfig,
  mailOpts: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
  }
) {
  const sender = parseFromHeader(
    mailOpts.from,
    acct.fromName || "DevStudio",
    acct.fromEmail || acct.user
  );
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${sender.name} <${sender.email}>`,
      to: Array.isArray(mailOpts.to) ? mailOpts.to : [mailOpts.to],
      subject: mailOpts.subject || "",
      html: mailOpts.html || `<p>${mailOpts.text || ""}</p>`,
      ...(mailOpts.text ? { text: mailOpts.text } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend HTTPS API error (${res.status}): ${(data as any)?.message || JSON.stringify(data)}`);
  }
  return { messageId: (data as any)?.id || `<resend-${Date.now()}>`, accepted: [mailOpts.to] };
}

async function createSinglePortNodemailer(
  originalHost: string,
  ipv4Host: string,
  port: number,
  user: string,
  pass: string,
  extraAuth?: Record<string, any>
) {
  const secure = port === 465;
  const sniHost = net.isIP(originalHost) ? undefined : originalHost;
  return nodemailer.createTransport({
    host: ipv4Host,
    port,
    secure,
    requireTLS: !secure,
    servername: sniHost,
    name: "localhost",
    auth: { user, pass, ...(extraAuth || {}) },
    tls: {
      rejectUnauthorized: false,
      servername: sniHost,
    },
    connectionTimeout: 9000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  } as any);
}

function buildCandidatePorts(host: string, configuredPort?: number): number[] {
  const primary = Number(configuredPort) || 587;
  const ports: number[] = [];

  // On Render and cloud PaaS, port 2525 is not blocked by Free Tier firewalls,
  // so for SMTP relays that support 2525 (Brevo, SendGrid, Mailgun, etc.), try 2525 & primary.
  if (supportsPort2525(host)) {
    if (process.env.RENDER) {
      ports.push(2525);
    }
    if (!ports.includes(primary)) ports.push(primary);
    if (!ports.includes(2525)) ports.push(2525);
    if (!ports.includes(465)) ports.push(465);
    if (!ports.includes(587)) ports.push(587);
    return ports;
  }

  ports.push(primary);
  if (primary !== 465) ports.push(465);
  if (primary !== 587) ports.push(587);
  return ports;
}

function formatHelpfulSmtpError(err: any, host: string, triedPorts: number[]): Error {
  const rawMsg = err?.message || String(err);
  if (isNetworkOrPortError(err)) {
    const isGmail = host.toLowerCase().includes("gmail.com");
    if (isGmail) {
      return new Error(
        `Could not reach ${host} on IPv4 ports ${triedPorts.join(" or ")} (${rawMsg}). ` +
          `NOTE: Render's Free Web Service tier blocks outbound SMTP ports 25, 465, and 587. ` +
          `To send from your Gmail on Render Free tier, select "Gmail (Cloud HTTPS Bridge · Port 443)" in the provider presets above (sends over HTTPS port 443 for free), use Brevo (Port 2525 / HTTPS), or upgrade your Render service to Starter ($7/mo) which unlocks ports 587 & 465.`
      );
    }
    return new Error(
      `Connection to ${host} timed out on IPv4 ports ${triedPorts.join(", ")} (${rawMsg}). ` +
        `If hosted on Render Free tier, ports 25, 465, and 587 are blocked by Render — use Port 2525 (supported by Brevo/SendGrid/Mailgun) or an HTTPS Port 443 Bridge.`
    );
  }
  return err instanceof Error ? err : new Error(rawMsg);
}

/**
 * Drop-in replacement for nodemailer.createTransport(acct) with:
 * 1. Strict IPv4 resolution (fixes ENETUNREACH 2607:f8b0:... on Render)
 * 2. Automatic port fallback (587 <-> 465 <-> 2525)
 * 3. Native HTTPS Port 443 support for Gmail Apps Script Bridge, Brevo API, and Resend API
 */
export function makeSmartTransporter(acct: SmtpAccountConfig, extraAuth?: Record<string, any>) {
  const appsScriptUrl = getAppsScriptUrl(acct);
  const cleanUser = (acct.user || "").trim();
  const cleanPass = appsScriptUrl ? acct.password.trim() : (acct.password || "").replace(/\s/g, "");
  const originalHost = (acct.host || "smtp.gmail.com").trim();

  return {
    async verify(): Promise<boolean> {
      if (appsScriptUrl) {
        const res = await fetch(appsScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ping" }),
          redirect: "follow",
        });
        if (!res.ok && res.status !== 405) {
          throw new Error(`Gmail HTTPS Bridge returned HTTP ${res.status}`);
        }
        return true;
      }

      if (isBrevoHttpApi(acct)) {
        const res = await fetch("https://api.brevo.com/v3/account", {
          headers: { accept: "application/json", "api-key": cleanPass },
        });
        if (!res.ok) {
          throw new Error(`Brevo API Key verification failed (HTTP ${res.status})`);
        }
        return true;
      }

      if (isResendHttpApi(acct)) {
        return true;
      }

      const ipv4Host = await resolveIpv4Host(originalHost);
      const candidatePorts = buildCandidatePorts(originalHost, acct.port);
      let lastErr: any = null;

      for (const port of candidatePorts) {
        try {
          const t = await createSinglePortNodemailer(
            originalHost,
            ipv4Host,
            port,
            cleanUser,
            cleanPass,
            extraAuth
          );
          await t.verify();
          return true;
        } catch (err: any) {
          lastErr = err;
          if (!isNetworkOrPortError(err)) {
            throw err;
          }
        }
      }

      throw formatHelpfulSmtpError(lastErr, originalHost, candidatePorts);
    },

    async sendMail(mailOpts: {
      from?: string;
      to: string | string[];
      subject: string;
      text?: string;
      html?: string;
      replyTo?: string;
      attachments?: any[];
    }): Promise<any> {
      if (appsScriptUrl) {
        return sendViaAppsScriptBridge(appsScriptUrl, acct, mailOpts);
      }

      if (isBrevoHttpApi(acct)) {
        return sendViaBrevoHttpApi(cleanPass, acct, mailOpts);
      }

      if (isResendHttpApi(acct)) {
        return sendViaResendHttpApi(cleanPass, acct, mailOpts);
      }

      const ipv4Host = await resolveIpv4Host(originalHost);
      const candidatePorts = buildCandidatePorts(originalHost, acct.port);
      let lastErr: any = null;

      for (const port of candidatePorts) {
        try {
          const t = await createSinglePortNodemailer(
            originalHost,
            ipv4Host,
            port,
            cleanUser,
            cleanPass,
            extraAuth
          );
          return await t.sendMail(mailOpts);
        } catch (err: any) {
          lastErr = err;
          if (!isNetworkOrPortError(err)) {
            throw err;
          }
        }
      }

      throw formatHelpfulSmtpError(lastErr, originalHost, candidatePorts);
    },
  };
}
