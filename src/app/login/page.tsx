import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, LogIn } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { getCurrentSession } from "@/modules/auth/session";
import { loginAction } from "@/app/actions";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";

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
  const { messages } = await getRequestI18n(site.settings?.defaultLocale);
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
          <h1>{messages.loginTitle}</h1>
          {params.registered ? (
            <p role="status" className="notice">
              {messages.accountCreatedNotice}
            </p>
          ) : null}
          {params.reset ? (
            <p role="status" className="notice">
              {messages.passwordResetComplete}
            </p>
          ) : null}
          {params.verified ? (
            <p role="status" className="notice">
              {messages.emailVerifiedNotice}
            </p>
          ) : null}
          <ActionForm action={loginAction} pendingLabel={messages.working}>
            <label>
              {messages.usernameOrEmail}
              <input className="field input" name="identifier" autoComplete="username" required />
            </label>
            <label>
              {messages.password}
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
              {messages.login}
            </button>
          </ActionForm>
          <div className="auth-links">
            <Link href="/forgot-password">{messages.forgotPassword}</Link>
            {site.settings?.registrationMode === "open" ||
            site.settings?.registrationMode === "email_verification" ? (
              <Link href="/register">{messages.createAccount}</Link>
            ) : null}
          </div>
        </div>
        <div className="auth-art" aria-hidden="true">
          <span>{messages.authBrandImage}</span>
        </div>
      </div>
    </section>
  );
}
