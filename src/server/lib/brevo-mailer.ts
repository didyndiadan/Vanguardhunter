import { getConfigKey } from "../routes/api-keys";
import { makeSmartTransporter } from "./smtp-mailer";

async function getBrevoCredentials(): Promise<{ user: string; pass: string }> {
  const user =
    process.env.BREVO_SMTP_USER ||
    (await getConfigKey("BREVO_SMTP_USER")) ||
    "";
  const pass =
    process.env.BREVO_API_KEY ||
    process.env.BREVO_PASS ||
    process.env.BREVO_SMTP_PASSWORD ||
    (await getConfigKey("BREVO_API_KEY")) ||
    (await getConfigKey("BREVO_SMTP_KEY")) ||
    "";
  if (!user && !pass.startsWith("xkeysib-")) {
    throw new Error("Brevo SMTP not configured. Add BREVO_SMTP_USER and BREVO_SMTP_KEY in Admin → AI Setup.");
  }
  if (!pass) {
    throw new Error("Brevo SMTP not configured. Add BREVO_SMTP_USER and BREVO_SMTP_KEY in Admin → AI Setup.");
  }
  return { user: user || "noreply@devstudio.ai", pass };
}

function makeBrevoTransport(user: string, pass: string) {
  return makeSmartTransporter(
    {
      host: "smtp-relay.brevo.com",
      port: process.env.RENDER ? 2525 : 587,
      secure: false,
      user,
      password: pass,
      provider: "brevo",
    },
    { type: "LOGIN" }
  );
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
