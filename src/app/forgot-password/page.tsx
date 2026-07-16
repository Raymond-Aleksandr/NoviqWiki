import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";

export default async function ForgotPasswordPage() {
  const site = await getPrimarySiteWithSettings();
  return (
    <section className="panel">
      <h1>Reset password</h1>
      <p className="meta">
        Enter your username or email address. If SMTP is configured, NoviqWiki sends a reset link.
      </p>
      <ActionForm action={requestPasswordResetAction}>
        <label>
          Username or email
          <input className="field" name="identifier" autoComplete="username" required />
        </label>
        <button className="primary">Request reset link</button>
      </ActionForm>
      <p>
        <Link href="/login">Return to login</Link>
      </p>
      {!site ? (
        <p className="meta">Setup is required before account recovery is available.</p>
      ) : null}
    </section>
  );
}
