import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { verifyEmailAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getRequestI18n } from "@/i18n/server";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const { messages } = await getRequestI18n();
  return (
    <section className="auth-compact auth-shell wide">
      <div className="auth-compact-card center">
        <div className="verify-icon">
          <CheckCircle2 size={26} aria-hidden="true" />
        </div>
        <h1>{messages.verifyEmail}</h1>
        <p>{messages.verifyEmailDescription}</p>
        {token ? (
          <ActionForm action={verifyEmailAction} pendingLabel={messages.working}>
            <input type="hidden" name="token" value={token} />
            <button className="primary button-primary">
              <CheckCircle2 size={16} aria-hidden="true" />
              {messages.verifyEmailAddress}
            </button>
          </ActionForm>
        ) : (
          <p role="alert" className="error">
            {messages.verificationTokenMissing}
          </p>
        )}
        <p style={{ marginTop: "14px", marginBottom: 0 }}>
          <Link href="/login">
            <ArrowLeft size={14} aria-hidden="true" />
            {messages.returnToLogin}
          </Link>
        </p>
        <div className="auth-note">
          <AlertCircle size={16} aria-hidden="true" />
          {messages.verificationExpiredHint}
        </div>
      </div>
    </section>
  );
}
