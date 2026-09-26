import nodemailer from "nodemailer";
import { getConfigKey } from "../routes/api-keys";

async function getBrevoCredentials(): Promise<{ user: string; pass: string }> {
  const user =
    process.env.BREVO_SMTP_USER ||
    (await getConfigKey("BREVO_SMTP_USER")) ||
    "";
  const pass =
    process.env.BREVO_PASS ||
    process.env.BREVO_SMTP_PASSWORD ||
    (await getConfigKey("BREVO_SMTP_KEY")) ||
    "";
  if (!user || !pass) {
    throw new Error("Brevo SMTP not configured. Add BREVO_SMTP_USER and BREVO_SMTP_KEY in Admin → AI Setup.");
  }
  return { user, pass };
}

function makeBrevoTransport(user: string, pass: string) {
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { type: "LOGIN", user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    authMethod: "PLAIN",
  } as any);
}

export async function verifyBrevo(): Promise<void> {
  const { user, pass } = await getBrevoCredentials();
  const t = makeBrevoTransport(user, pass);
  await t.verify();
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
}) {
  const { user, pass } = await getBrevoCredentials();
  const t = makeBrevoTransport(user, pass);
  const from = `"${opts.fromName ?? "DevStudio"}" <${opts.fromEmail ?? user}>`;
  return t.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

// Legacy named export kept for automation.ts compatibility
export const brevoTransporter = {
  verify: verifyBrevo,
  sendMail: async (opts: {
    from?: string; to: string; subject: string; html?: string; text?: string;
  }) => sendMail({ to: opts.to, subject: opts.subject, html: opts.html ?? "", text: opts.text }),
};
