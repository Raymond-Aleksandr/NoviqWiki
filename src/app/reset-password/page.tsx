import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getRequestI18n } from "@/i18n/server";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const { messages } = await getRequestI18n();
  return (
    <section className="auth-compact auth-shell">
      <div className="auth-compact-card">
        <h1>{messages.chooseNewPassword}</h1>
        <p>{messages.resetPasswordDescription}</p>
        {token ? (
          <ActionForm action={resetPasswordAction} pendingLabel={messages.working}>
            <input type="hidden" name="token" value={token} />
            <label>
              {messages.newPassword}
              <input
                className="field input"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
            <button className="primary button-primary">
              <KeyRound size={16} aria-hidden="true" />
              {messages.resetPassword}
            </button>
          </ActionForm>
        ) : (
          <p role="alert" className="error">
            {messages.resetTokenMissing}
          </p>
        )}
        <p className="auth-secondary-link">
          <Link href="/login">
            <ArrowLeft size={14} aria-hidden="true" />
            {messages.returnToLogin}
          </Link>
        </p>
      </div>
    </section>
  );
}
