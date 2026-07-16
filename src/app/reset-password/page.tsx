import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resetPasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  return (
    <section className="auth-compact auth-shell">
      <div className="auth-compact-card">
        <h1>Choose a new password</h1>
        <p>Enter a replacement password for this account recovery token.</p>
        {token ? (
          <ActionForm action={resetPasswordAction}>
            <input type="hidden" name="token" value={token} />
            <label>
              New password
              <input
                className="field input"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
            <button className="primary button-primary">Reset password</button>
          </ActionForm>
        ) : (
          <p role="alert" className="error">
            Reset token is missing.
          </p>
        )}
        <p style={{ marginTop: "14px", marginBottom: 0 }}>
          <Link href="/login">
            <ArrowLeft size={14} aria-hidden="true" />
            Return to login
          </Link>
        </p>
      </div>
    </section>
  );
}
