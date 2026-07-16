import { redirect } from "next/navigation";
import Link from "next/link";
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
    <section className="panel">
      <h1>Log in</h1>
      {params.registered ? (
        <p role="status" className="meta">
          Account created. If email verification is enabled, open the verification link before
          logging in.
        </p>
      ) : null}
      {params.reset ? (
        <p role="status" className="meta">
          Password reset complete. You can log in with the new password.
        </p>
      ) : null}
      {params.verified ? (
        <p role="status" className="meta">
          Email verified. You can log in now.
        </p>
      ) : null}
      <ActionForm action={loginAction}>
        <label>
          Username or email
          <input className="field" name="identifier" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            className="field"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary">Log in</button>
      </ActionForm>
      {site.settings?.registrationMode === "open" ||
      site.settings?.registrationMode === "email_verification" ? (
        <p>
          Need an account? <Link href="/register">Register</Link>
        </p>
      ) : null}
      <p>
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
    </section>
  );
}
