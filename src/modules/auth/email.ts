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
  if (!env.NOVIQWIKI_SMTP_URL || !env.NOVIQWIKI_EMAIL_FROM) {
    return false;
  }
  const transport = nodemailer.createTransport(env.NOVIQWIKI_SMTP_URL);
  await transport.sendMail({
    from: env.NOVIQWIKI_EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text
  });
  return true;
}

export function isSystemEmailConfigured() {
  const env = getEnv();
  return Boolean(env.NOVIQWIKI_SMTP_URL?.trim() && env.NOVIQWIKI_EMAIL_FROM?.trim());
}

export function requireSystemEmailConfigured() {
  if (!isSystemEmailConfigured()) {
    throw new AppError(
      "Email verification requires NOVIQWIKI_SMTP_URL and NOVIQWIKI_EMAIL_FROM.",
      "email_unavailable",
      503
    );
  }
}
