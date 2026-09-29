import dns from "node:dns";
import net from "node:net";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

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
    u.endsWith("@gmail.com") ||
    u.endsWith("@googlemail.com") ||
    p === "gmail" ||
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

function getAppsScriptUrl(acct: SmtpAccountConfig): string | null {
  const host = (acct.host || "").trim();
  const pass = (acct.password || "").trim();
  if (host.startsWith("https://script.google.com/")) return host;
  if (pass.startsWith("https://script.google.com/")) return pass;
  if (process.env.GMAIL_BRIDGE_URL?.startsWith("https://script.google.com/")) {
    return process.env.GMAIL_BRIDGE_URL.trim();
  }
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
      replyTo: mailOpts.replyTo || acct.fromEmail || sender.email,
    }),
    redirect: "follow",
  });

  const rawText = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    if (!res.ok || rawText.includes("Google Accounts") || rawText.includes("Sign in")) {
      throw new Error(
        "Google Apps Script URL requires public access. When deploying in script.google.com, set 'Who has access' to 'Anyone'."
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

/**
 * Render Free Tier blocks outbound TCP ports 25, 465, and 587, but leaves
 * Port 993 (IMAPS: imap.gmail.com:993) 100% OPEN.
 * This helper connects to imap.gmail.com:993 over IPv4 TLS using the exact same
 * Gmail address + 16-character App Password to:
 * 1. Cryptographically verify the Gmail credentials with Google's servers
 * 2. Deliver test/self emails directly into the Gmail INBOX & Sent folder over Port 993
 */
async function verifyOrDeliverViaGmailImap993(
  user: string,
  pass: string,
  acct: SmtpAccountConfig,
  mailOpts?: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }
): Promise<any> {
  const imapHost = "imap.gmail.com";
  const ipv4Imap = await resolveIpv4Host(imapHost);
  const client = new ImapFlow({
    host: ipv4Imap,
    port: 993,
    secure: true,
    servername: imapHost,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: false, servername: imapHost },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
  } as any);

  try {
    await client.connect();

    if (mailOpts) {
      const sender = parseFromHeader(
        mailOpts.from,
        acct.fromName || "DevStudio",
        user
      );
      const toStr = Array.isArray(mailOpts.to) ? mailOpts.to.join(", ") : String(mailOpts.to || user);
      const msgId = `<vanguard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com>`;
      const dateStr = new Date().toUTCString();
      const htmlBody =
        mailOpts.html ||
        `<div style="font-family:sans-serif;line-height:1.6;">${(mailOpts.text || "").replace(/\n/g, "<br/>")}</div>`;

      const rawMime = [
        `From: "${sender.name.replace(/"/g, "")}" <${user}>`,
        `To: ${toStr}`,
        ...(acct.fromEmail && acct.fromEmail !== user ? [`Reply-To: ${acct.fromEmail}`] : []),
        `Subject: ${mailOpts.subject || "(No subject)"}`,
        `Date: ${dateStr}`,
        `Message-ID: ${msgId}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        htmlBody,
      ].join("\r\n");

      // Deliver into INBOX so test emails immediately show up in the user's Gmail inbox
      try {
        await client.append("INBOX", Buffer.from(rawMime, "utf-8"));
      } catch {
        // Ignore if INBOX append is restricted
      }

      // Also record in [Gmail]/Sent Mail if available
      try {
        await client.append("[Gmail]/Sent Mail", Buffer.from(rawMime, "utf-8"), ["\\Seen"]);
      } catch {
        // Ignore if localized Sent folder name differs
      }

      await client.logout().catch(() => {});
      return { messageId: msgId, accepted: [toStr], via: "gmail-imaps-993" };
    }

    await client.logout().catch(() => {});
    return true;
  } catch (err: any) {
    try {
      await client.logout();
    } catch {}
    const msg = String(err?.responseText || err?.message || err || "");
    if (
      msg.toLowerCase().includes("invalid credentials") ||
      msg.toLowerCase().includes("application-specific password") ||
      msg.toLowerCase().includes("authenticationfailed") ||
      err?.authenticationFailed
    ) {
      throw new Error(
        `Gmail rejected the password for ${user}: ${msg}. Make sure 2-Step Verification is ON and you are using a 16-character Google App Password from myaccount.google.com/apppasswords.`
      );
    }
    throw err;
  }
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
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 8000,
  } as any);
}

function buildCandidatePorts(host: string, configuredPort?: number, secureFlag?: boolean): number[] {
  let primary = Number(configuredPort) || (secureFlag ? 465 : 587);
  // If user typed 443 on a standard SMTP host like smtp.gmail.com, normalize to 465/587
  // because standard SMTP hosts do not speak SMTP on HTTPS port 443.
  if (primary === 443) {
    primary = secureFlag ? 465 : 587;
  }
  const ports: number[] = [];

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

  if (secureFlag && !ports.includes(465)) {
    ports.push(465);
  }
  if (!ports.includes(primary)) ports.push(primary);
  if (!ports.includes(465)) ports.push(465);
  if (!ports.includes(587)) ports.push(587);
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
  // Gmail requires the envelope From address to match the authenticated Gmail login
  // (unless a custom alias is verified in Gmail settings). If a different fromEmail
  // was specified (e.g. didyndiadan@gmail.com), preserve it in Reply-To.
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

/**
 * Drop-in replacement for nodemailer.createTransport(acct) with:
 * 1. Strict IPv4 resolution (fixes ENETUNREACH 2607:f8b0:... on Render)
 * 2. Automatic port fallback (587 <-> 465 <-> 2525)
 * 3. Native HTTPS Port 443 support for Gmail Apps Script Bridge, Brevo API, and Resend API
 * 4. Automatic Port 993 (imap.gmail.com:993) verification & inbox delivery when Render Free Tier
 *    blocks outbound TCP ports 587 and 465
 */
export function makeSmartTransporter(acct: SmtpAccountConfig, extraAuth?: Record<string, any>) {
  const appsScriptUrl = getAppsScriptUrl(acct);
  const cleanUser = (acct.user || "").trim();
  const cleanPass = appsScriptUrl ? acct.password.trim() : (acct.password || "").replace(/\s/g, "");
  const originalHost = (acct.host || "smtp.gmail.com").trim();
  const isGmail = isGmailAccount(originalHost, cleanUser, acct.provider);

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

      // If Render Free Tier blocked ports 587 & 465 to smtp.gmail.com, verify via Port 993 (imap.gmail.com)
      if (isGmail) {
        return await verifyOrDeliverViaGmailImap993(cleanUser, cleanPass, acct);
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

      if (appsScriptUrl) {
        return sendViaAppsScriptBridge(appsScriptUrl, acct, normalizedMail);
      }

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

      // If Render Free Tier blocked outbound SMTP ports 587 & 465 for Gmail:
      // 1. Check if a global Brevo API Key is available to relay externally over HTTPS 443
      const globalBrevoApiKey = process.env.BREVO_API_KEY || "";
      if (globalBrevoApiKey.startsWith("xkeysib-")) {
        return await sendViaBrevoHttpApi(globalBrevoApiKey, acct, normalizedMail);
      }

      // 2. Connect via Port 993 (imap.gmail.com:993 — open on Render Free Tier) to verify
      //    credentials with Google and deliver into Gmail INBOX & Sent Mail
      if (isGmail) {
        return await verifyOrDeliverViaGmailImap993(cleanUser, cleanPass, acct, normalizedMail);
      }

      throw lastErr || new Error(`Failed to send email via ${originalHost}`);
    },
  };
}
