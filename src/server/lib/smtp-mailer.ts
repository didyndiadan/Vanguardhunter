import dns from "node:dns";
import net from "node:net";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { db, emailAccountsTable, siteConfigTable } from "../../db";
import { eq } from "drizzle-orm";

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

function extractEmailAddress(raw: string): string {
  const m = String(raw || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(raw || "")).trim().toLowerCase();
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
  return { messageId: `<gas-${Date.now()}@gmail.com>`, accepted: [toAddr], via: "gmail-https-443" };
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
    throw new Error(`Brevo HTTPS API error (${res.status}): ${(data as any)?.message || JSON.stringify(data)}`);
  }
  return { messageId: (data as any)?.messageId || `<brevo-${Date.now()}>`, accepted: toList.map((t) => t.email), via: "brevo-https-443" };
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
  return { messageId: (data as any)?.id || `<resend-${Date.now()}>`, accepted: [mailOpts.to], via: "resend-https-443" };
}

async function readSiteConfigValue(key: string): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(eq(siteConfigTable.key, key))
      .limit(1);
    return rows[0]?.value?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Attempt to deliver via any configured Port 443 (HTTPS) or Port 2525 relay
 * in the database/env when Render Free Tier blocks direct Gmail ports 587/465.
 */
async function tryDeliverViaConfiguredRelays(
  acct: SmtpAccountConfig,
  cleanUser: string,
  mailOpts: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }
): Promise<any | null> {
  // 1. Check if any account in email_accounts or site_config has a Google Apps Script HTTPS Bridge URL
  try {
    const bridgeFromConfig = await readSiteConfigValue("GMAIL_BRIDGE_URL");
    if (bridgeFromConfig.startsWith("https://script.google.com/")) {
      return await sendViaAppsScriptBridge(bridgeFromConfig, acct, mailOpts);
    }
    const allAccounts = await db.select().from(emailAccountsTable).catch(() => []);
    for (const a of allAccounts) {
      const url = getAppsScriptUrl(a);
      if (url) {
        return await sendViaAppsScriptBridge(url, acct, mailOpts);
      }
    }

    // 2. Check if any account in email_accounts is a Brevo / Port 2525 / HTTPS relay
    for (const a of allAccounts) {
      if (!a.password || !a.user) continue;
      if (isBrevoHttpApi(a)) {
        return await sendViaBrevoHttpApi(a.password, acct, mailOpts);
      }
      if (supportsPort2525(a.host)) {
        const ipv4 = await resolveIpv4Host(a.host);
        const t = await createSinglePortNodemailer(a.host, ipv4, 2525, a.user.trim(), a.password.replace(/\s/g, ""));
        const sender = parseFromHeader(mailOpts.from, acct.fromName || a.fromName || "DevStudio", a.fromEmail || a.user);
        return await t.sendMail({
          ...mailOpts,
          from: `"${sender.name.replace(/"/g, "")}" <${a.fromEmail || a.user}>`,
          replyTo: acct.fromEmail || cleanUser,
        });
      }
    }

    // 3. Check site_config / env for BREVO_API_KEY or BREVO_SMTP_USER + BREVO_SMTP_KEY
    const brevoKey =
      process.env.BREVO_API_KEY ||
      process.env.BREVO_PASS ||
      process.env.BREVO_SMTP_PASSWORD ||
      (await readSiteConfigValue("BREVO_API_KEY")) ||
      (await readSiteConfigValue("BREVO_SMTP_KEY"));
    const brevoUser =
      process.env.BREVO_SMTP_USER ||
      (await readSiteConfigValue("BREVO_SMTP_USER"));

    if (brevoKey.startsWith("xkeysib-")) {
      return await sendViaBrevoHttpApi(brevoKey, acct, mailOpts);
    }
    if (brevoUser && brevoKey) {
      const ipv4 = await resolveIpv4Host("smtp-relay.brevo.com");
      const t = await createSinglePortNodemailer(
        "smtp-relay.brevo.com",
        ipv4,
        2525,
        brevoUser,
        brevoKey,
        { type: "LOGIN" }
      );
      const sender = parseFromHeader(mailOpts.from, acct.fromName || "DevStudio", brevoUser);
      return await t.sendMail({
        ...mailOpts,
        from: `"${sender.name.replace(/"/g, "")}" <${brevoUser}>`,
        replyTo: acct.fromEmail || cleanUser,
      });
    }
  } catch {
    // Continue if relay lookup fails
  }
  return null;
}

/**
 * Connect to imap.gmail.com:993 (Port 993 is OPEN on Render Free Tier)
 * to verify credentials, and:
 * - Only append to INBOX of the TARGET recipient (`to`), NEVER the sender's own INBOX
 *   when `to` is a different email address!
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

    if (!mailOpts) {
      await client.logout().catch(() => {});
      return true;
    }

    const sender = parseFromHeader(
      mailOpts.from,
      acct.fromName || "DevStudio",
      user
    );
    const toList = (Array.isArray(mailOpts.to) ? mailOpts.to : String(mailOpts.to || user).split(","))
      .map((addr) => extractEmailAddress(addr))
      .filter(Boolean);
    const primaryTo = toList[0] || user.toLowerCase();
    const isSendingToSelf = primaryTo.toLowerCase() === user.toLowerCase();

    const msgId = `<vanguard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com>`;
    const dateStr = new Date().toUTCString();
    const htmlBody =
      mailOpts.html ||
      `<div style="font-family:sans-serif;line-height:1.6;">${(mailOpts.text || "").replace(/\n/g, "<br/>")}</div>`;

    const rawMime = [
      `From: "${sender.name.replace(/"/g, "")}" <${user}>`,
      `To: ${toList.join(", ")}`,
      ...(acct.fromEmail && acct.fromEmail.toLowerCase() !== user.toLowerCase()
        ? [`Reply-To: ${acct.fromEmail}`]
        : []),
      `Subject: ${mailOpts.subject || "(No subject)"}`,
      `Date: ${dateStr}`,
      `Message-ID: ${msgId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      htmlBody,
    ].join("\r\n");

    // 1. Record in sender's [Gmail]/Sent Mail (NEVER in sender's INBOX unless sending to self!)
    try {
      await client.append("[Gmail]/Sent Mail", Buffer.from(rawMime, "utf-8"), ["\\Seen"]);
    } catch {
      // Ignore if localized Sent folder differs
    }

    if (isSendingToSelf) {
      try {
        await client.append("INBOX", Buffer.from(rawMime, "utf-8"));
      } catch {}
      await client.logout().catch(() => {});
      return { messageId: msgId, accepted: toList, via: "gmail-imaps-993-self" };
    }

    await client.logout().catch(() => {});

    // 2. If sending to ANOTHER email address (`primaryTo !== user`):
    //    Check if `primaryTo` is another Gmail account saved in `email_accounts`; if so,
    //    we can deliver directly into `primaryTo`'s INBOX over Port 993!
    const allAccounts = await db.select().from(emailAccountsTable).catch(() => []);
    const targetAcct = allAccounts.find(
      (a) => a.user && a.user.trim().toLowerCase() === primaryTo.toLowerCase() && a.password
    );
    if (targetAcct && isGmailAccount(targetAcct.host, targetAcct.user, targetAcct.provider)) {
      const targetClient = new ImapFlow({
        host: ipv4Imap,
        port: 993,
        secure: true,
        servername: imapHost,
        auth: {
          user: targetAcct.user.trim(),
          pass: targetAcct.password.replace(/\s/g, ""),
        },
        logger: false,
        tls: { rejectUnauthorized: false, servername: imapHost },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
      } as any);
      try {
        await targetClient.connect();
        await targetClient.append("INBOX", Buffer.from(rawMime, "utf-8"));
        await targetClient.logout().catch(() => {});
        return { messageId: msgId, accepted: toList, via: "gmail-imaps-993-peer" };
      } catch {
        try {
          await targetClient.logout();
        } catch {}
      }
    }

    // 3. Otherwise, `primaryTo` is an external email address and Render Free Tier blocked
    //    outbound SMTP ports 587 & 465! Do NOT put it in the sender's own inbox — explain
    //    clearly how to enable external delivery over Port 443 (Gmail Bridge) or Port 2525 (Brevo).
    throw new Error(
      `Your Gmail password for ${user} is verified✓, but Render's Free Tier blocks outbound SMTP ports 587 & 465 from sending to external address "${primaryTo}". ` +
        `To send to external addresses on Render Free Tier: click "Gmail Bridge (443)" in this dialog, click "Copy 10-Line Script", deploy it in script.google.com, and paste the Web App URL — or use Brevo (Port 2525).`
    );
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

      // If Render Free Tier blocked direct ports 587 & 465:
      // 1. Try any configured HTTPS (Port 443) or Port 2525 relay in DB / env
      const relayed = await tryDeliverViaConfiguredRelays(acct, cleanUser, normalizedMail);
      if (relayed) {
        return relayed;
      }

      // 2. For Gmail accounts, verify via Port 993 and deliver only to the actual target recipient
      if (isGmail) {
        return await verifyOrDeliverViaGmailImap993(cleanUser, cleanPass, acct, normalizedMail);
      }

      throw lastErr || new Error(`Failed to send email via ${originalHost}`);
    },
  };
}
