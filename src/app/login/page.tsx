import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, KeyRound, LogIn, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { getCurrentSession } from "@/modules/auth/session";
import { loginAction } from "@/app/actions";
import { getPrimarySiteWithSettings } from "@/db/site";

type Props = {
  searchParams: Promise<{ registered?: string; reset?: string; verified?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  if (await getCurrentSession()) {
    redirect("/");
  }
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const params = await searchParams;
  return (
    <section className="auth-page auth-shell">
      <div className="auth-card">
        <div className="auth-form-panel">
          <div className="auth-brand">
            <span>
              <BookOpen size={19} aria-hidden="true" />
            </span>
            <strong>{site.site.name}</strong>
          </div>
          <h1>Log in</h1>
          {params.registered ? (
            <p role="status" className="notice">
              Account created. If email verification is enabled, open the verification link before
              logging in.
            </p>
          ) : null}
          {params.reset ? (
            <p role="status" className="notice">
              Password reset complete. You can log in with the new password.
            </p>
          ) : null}
          {params.verified ? (
            <p role="status" className="notice">
              Email verified. You can log in now.
            </p>
          ) : null}
          <ActionForm action={loginAction}>
            <label>
              Username or email
              <input className="field input" name="identifier" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                className="field input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary button-primary">
              <LogIn size={16} aria-hidden="true" />
              Log in
            </button>
          </ActionForm>
          <div className="auth-links">
            <Link href="/forgot-password">
              <KeyRound size={14} aria-hidden="true" />
              Forgot password?
            </Link>
            {site.settings?.registrationMode === "open" ||
            site.settings?.registrationMode === "email_verification" ? (
              <Link href="/register">
                <UserPlus size={14} aria-hidden="true" />
                Create account
              </Link>
            ) : null}
          </div>
        </div>
        <div className="auth-art" aria-hidden="true">
          <span>brand image · optional</span>
        </div>
      </div>
    </section>
  );
}
