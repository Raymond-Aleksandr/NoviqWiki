import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { verifyEmailAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  return (
    <section className="auth-compact auth-shell wide">
      <div className="auth-compact-card center">
        <div className="verify-icon">
          <CheckCircle2 size={26} aria-hidden="true" />
        </div>
        <h1>Verify email</h1>
        <p>Confirm the email address associated with this NoviqWiki account.</p>
        {token ? (
          <ActionForm action={verifyEmailAction}>
            <input type="hidden" name="token" value={token} />
            <button className="primary button-primary">
              <CheckCircle2 size={16} aria-hidden="true" />
              Verify email address
            </button>
          </ActionForm>
        ) : (
          <p role="alert" className="error">
            Verification token is missing.
          </p>
        )}
        <p style={{ marginTop: "14px", marginBottom: 0 }}>
          <Link href="/login">
            <ArrowLeft size={14} aria-hidden="true" />
            Return to login
          </Link>
        </p>
        <div className="auth-note">
          <AlertCircle size={16} aria-hidden="true" />
          If this link has expired, request a new verification email from an administrator.
        </div>
      </div>
    </section>
  );
}
