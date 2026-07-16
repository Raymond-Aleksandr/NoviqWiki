import { redirect } from "next/navigation";
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
    <section className="panel">
      <h1>Register</h1>
      <ActionForm action={registerAction}>
        <label>
          Username
          <input className="field" name="username" autoComplete="username" required />
        </label>
        <label>
          Email
          <input className="field" name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Display name
          <input className="field" name="displayName" />
        </label>
        <label>
          Password
          <input
            className="field"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        <button className="primary">Create account</button>
      </ActionForm>
    </section>
  );
}
