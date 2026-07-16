import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requestPasswordResetAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";

export default async function ForgotPasswordPage() {
  const site = await getPrimarySiteWithSettings();
  return (
    <section className="auth-compact auth-shell">
      <div className="auth-compact-card">
        <h1>Reset password</h1>
        <p>
          Enter your username or email address. If SMTP is configured, NoviqWiki sends a reset link.
        </p>
        <ActionForm action={requestPasswordResetAction}>
          <label>
            Username or email
            <input className="field input" name="identifier" autoComplete="username" required />
          </label>
          <button className="primary button-primary">Request reset link</button>
        </ActionForm>
        <p style={{ marginTop: "14px", marginBottom: 0 }}>
          <Link href="/login">
            <ArrowLeft size={14} aria-hidden="true" />
            Return to login
          </Link>
        </p>
        {!site ? (
          <p className="meta">Setup is required before account recovery is available.</p>
        ) : null}
      </div>
    </section>
  );
}
