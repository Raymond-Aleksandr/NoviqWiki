import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

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
