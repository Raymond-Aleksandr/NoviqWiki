import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { requestEmailVerificationAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";

export default async function ResendVerificationPage() {
  const site = await getPrimarySiteWithSettings();
  const { messages } = await getRequestI18n(site?.settings?.defaultLocale);
  return (
    <section className="auth-compact auth-shell">
      <div className="auth-compact-card">
        <h1>{messages.resendVerificationEmail}</h1>
        <p>{messages.resendVerificationDescription}</p>
        <ActionForm action={requestEmailVerificationAction} pendingLabel={messages.working}>
          <label>
            {messages.usernameOrEmail}
            <input className="field input" name="identifier" autoComplete="username" required />
          </label>
          <button className="primary button-primary">
            <Send size={16} aria-hidden="true" />
            {messages.requestVerificationLink}
          </button>
        </ActionForm>
        <p className="auth-secondary-link">
          <Link href="/login">
            <ArrowLeft size={14} aria-hidden="true" />
            {messages.returnToLogin}
          </Link>
        </p>
        {!site ? <p className="meta">{messages.setupRequiredRecovery}</p> : null}
      </div>
    </section>
  );
}
