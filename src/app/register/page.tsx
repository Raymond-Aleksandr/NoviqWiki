import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { registerAction } from "@/app/actions";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";

export default async function RegisterPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  if (
    site.settings?.registrationMode !== "open" &&
    site.settings?.registrationMode !== "email_verification"
  ) {
    redirect("/login");
  }
  const { messages } = await getRequestI18n(site.settings?.defaultLocale);
  return (
    <section className="auth-compact auth-shell">
      <div className="auth-compact-card">
        <div className="auth-brand">
          <span>
            <BookOpen size={18} aria-hidden="true" />
          </span>
          <strong>{site.site.name}</strong>
        </div>
        <h1>{messages.createAccount}</h1>
        <p>{messages.registerDescription}</p>
        <ActionForm action={registerAction} pendingLabel={messages.working}>
          <label>
            {messages.username}
            <input className="field input" name="username" autoComplete="username" required />
          </label>
          <label>
            {messages.email}
            <input
              className="field input"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            {messages.displayName}
            <input className="field input" name="displayName" />
          </label>
          <label>
            {messages.password}
            <input
              className="field input"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <button className="primary button-primary">{messages.createAccount}</button>
        </ActionForm>
        <p className="muted" style={{ marginTop: "14px", marginBottom: 0 }}>
          {messages.alreadyHaveAccount} <Link href="/login">{messages.login}</Link>
        </p>
      </div>
    </section>
  );
}
