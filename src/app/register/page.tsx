import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, LogIn, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { registerAction } from "@/app/actions";
import { getPrimarySiteWithSettings } from "@/db/site";

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
  return (
    <section className="auth-compact auth-shell">
      <div className="auth-compact-card">
        <div className="auth-brand">
          <span>
            <BookOpen size={18} aria-hidden="true" />
          </span>
          <strong>{site.site.name}</strong>
        </div>
        <h1>Create account</h1>
        <p>Register a local NoviqWiki account using the site access policy.</p>
        <ActionForm action={registerAction}>
          <label>
            Username
            <input className="field input" name="username" autoComplete="username" required />
          </label>
          <label>
            Email
            <input
              className="field input"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Display name
            <input className="field input" name="displayName" />
          </label>
          <label>
            Password
            <input
              className="field input"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <button className="primary button-primary">
            <UserPlus size={16} aria-hidden="true" />
            Create account
          </button>
        </ActionForm>
        <p className="muted" style={{ marginTop: "14px", marginBottom: 0 }}>
          Already have an account?{" "}
          <Link href="/login">
            <LogIn size={14} aria-hidden="true" />
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}
