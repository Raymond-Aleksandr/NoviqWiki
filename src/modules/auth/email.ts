import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

type MailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendSystemEmail(input: MailInput) {
  const env = getEnv();
  if (!env.NEXTWIKI_SMTP_URL || !env.NEXTWIKI_EMAIL_FROM) {
    return false;
  }
  const transport = nodemailer.createTransport(env.NEXTWIKI_SMTP_URL);
  await transport.sendMail({
    from: env.NEXTWIKI_EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text
  });
  return true;
}

export function isSystemEmailConfigured() {
  const env = getEnv();
  return Boolean(env.NEXTWIKI_SMTP_URL?.trim() && env.NEXTWIKI_EMAIL_FROM?.trim());
}

export function requireSystemEmailConfigured() {
  if (!isSystemEmailConfigured()) {
    throw new AppError(
      "Email verification requires NEXTWIKI_SMTP_URL and NEXTWIKI_EMAIL_FROM.",
      "email_unavailable",
      503
    );
  }
}
