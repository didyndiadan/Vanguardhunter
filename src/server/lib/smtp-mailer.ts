import dns from "node:dns";
import net from "node:net";
import nodemailer from "nodemailer";

// ─── Force IPv4 Globally & Disable Unreachable IPv6 in Nodemailer v10 ─────────
try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
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
    code === "ECONNRESET" ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENETUNREACH") ||
    msg.includes("EHOSTUNREACH") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("CONNECTION TIMEOUT") ||
    msg.includes("GREETING NEVER RECEIVED") ||
    msg.includes("SOCKET CLOSE") ||
    msg.includes("UNEXPECTED SOCKET CLOSE")
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

function isGmailAccount(host: string, user: string, provider?: string): boolean {
  const h = (host || "").toLowerCase();
  const u = (user || "").toLowerCase();
  const p = (provider || "").toLowerCase();
  return (
    h.includes("gmail.com") ||
    h.includes("googlemail.com") ||
    h.includes("script.google.com") ||
    u.endsWith("@gmail.com") ||
    u.endsWith("@googlemail.com") ||
    p === "gmail" ||
    p === "gmail_https" ||
    p === "gworkspace"
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

function extractEmailAddress(raw: string): string {
  const m = String(raw || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(raw || "")).trim();
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
    .map((e) => extractEmailAddress(e))
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
      ...(mailOpts.replyTo ? { replyTo: { email: extractEmailAddress(mailOpts.replyTo) } } : {}),
      subject: mailOpts.subject || "",
      htmlContent: mailOpts.html || `<p>${mailOpts.text || ""}</p>`,
      ...(mailOpts.text ? { textContent: mailOpts.text } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Brevo API error (${res.status}): ${(data as any)?.message || JSON.stringify(data)}`);
  }
  return { messageId: (data as any)?.messageId || `<brevo-${Date.now()}>`, accepted: toList.map((t) => t.email), via: "brevo-api" };
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
    throw new Error(`Resend API error (${res.status}): ${(data as any)?.message || JSON.stringify(data)}`);
  }
  return { messageId: (data as any)?.id || `<resend-${Date.now()}>`, accepted: [mailOpts.to], via: "resend-api" };
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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  } as any);
}

function buildCandidatePorts(host: string, configuredPort?: number, secureFlag?: boolean): number[] {
  let primary = Number(configuredPort) || (secureFlag ? 465 : 587);
  if (primary === 443 || primary === 993 || primary <= 0) {
    primary = secureFlag ? 465 : 587;
  }
  const ports: number[] = [];

  if (supportsPort2525(host)) {
    if (!ports.includes(primary)) ports.push(primary);
    if (!ports.includes(587)) ports.push(587);
    if (!ports.includes(2525)) ports.push(2525);
    if (!ports.includes(465)) ports.push(465);
    return ports;
  }

  if (secureFlag && !ports.includes(465)) {
    ports.push(465);
  }
  if (!ports.includes(primary)) ports.push(primary);
  if (!ports.includes(587)) ports.push(587);
  if (!ports.includes(465)) ports.push(465);
  return ports;
}

function normalizeGmailMailOptions(
  acct: SmtpAccountConfig,
  cleanUser: string,
  mailOpts: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: any[];
  }
) {
  if (!isGmailAccount(acct.host, cleanUser, acct.provider)) {
    return mailOpts;
  }
  const sender = parseFromHeader(
    mailOpts.from,
    acct.fromName || "DevStudio",
    cleanUser
  );
  const customFromEmail = (acct.fromEmail || sender.email || "").trim();
  const hasDifferentFrom =
    customFromEmail &&
    customFromEmail.includes("@") &&
    customFromEmail.toLowerCase() !== cleanUser.toLowerCase();

  return {
    ...mailOpts,
    from: `"${sender.name.replace(/"/g, "")}" <${cleanUser}>`,
    ...(hasDifferentFrom && !mailOpts.replyTo ? { replyTo: customFromEmail } : {}),
  };
}

export function makeSmartTransporter(acct: SmtpAccountConfig, extraAuth?: Record<string, any>) {
  const cleanUser = (acct.user || "").trim();
  const cleanPass = (acct.password || "").replace(/\s/g, "");
  const rawHost = (acct.host || "smtp.gmail.com").trim();
  const isGmail = isGmailAccount(rawHost, cleanUser, acct.provider);
  const originalHost =
    isGmail && (rawHost === "script.google.com" || rawHost.startsWith("http") || !rawHost.includes("."))
      ? "smtp.gmail.com"
      : rawHost;

  return {
    async verify(): Promise<boolean> {
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
      const candidatePorts = buildCandidatePorts(originalHost, acct.port, acct.secure);
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

      throw lastErr || new Error(`Could not connect to ${originalHost}`);
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
      const normalizedMail = normalizeGmailMailOptions(acct, cleanUser, mailOpts);

      if (isBrevoHttpApi(acct)) {
        return sendViaBrevoHttpApi(cleanPass, acct, normalizedMail);
      }

      if (isResendHttpApi(acct)) {
        return sendViaResendHttpApi(cleanPass, acct, normalizedMail);
      }

      const ipv4Host = await resolveIpv4Host(originalHost);
      const candidatePorts = buildCandidatePorts(originalHost, acct.port, acct.secure);
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
          return await t.sendMail(normalizedMail);
        } catch (err: any) {
          lastErr = err;
          if (!isNetworkOrPortError(err)) {
            throw err;
          }
        }
      }

      throw lastErr || new Error(`Failed to send email via ${originalHost}`);
    },
  };
}
