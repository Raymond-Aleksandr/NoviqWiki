import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { AuthPage } from "@/features/auth/auth-page";
import { AuthField } from "@/features/auth/auth-field";
import { AuthSubmitButton } from "@/features/auth/auth-submit-button";
import { registerAction } from "@/app/actions";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";
import { isSetupRequired } from "@/modules/setup/service";

export default async function RegisterPage() {
  if (await isSetupRequired()) {
    redirect("/setup");
  }
  const site = await getRequestSite();
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
    <AuthPage
      title={messages.createAccount}
      description={messages.registerDescription}
      siteName={site.site.name}
      linksIntro={messages.alreadyHaveAccount}
      links={[{ href: "/login", label: messages.login }]}
    >
      <ActionForm action={registerAction} pendingLabel={messages.working}>
        <AuthField
          name="username"
          label={messages.username}
          autoComplete="username"
          minLength={2}
          maxLength={80}
          pattern={"[A-Za-z0-9_.\\-]+"}
          hint={messages.usernameCharacters}
          required
        />
        <AuthField
          name="email"
          label={messages.email}
          type="email"
          autoComplete="email"
          maxLength={320}
          required
        />
        <AuthField
          name="displayName"
          label={messages.displayName}
          autoComplete="nickname"
          maxLength={160}
        />
        <AuthField
          name="password"
          label={messages.password}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={200}
          hint={`${messages.passwordLength} ${messages.passwordComplexity}`}
          required
        />
        <AuthSubmitButton pendingLabel={messages.working}>
          <UserPlus size={16} aria-hidden="true" />
          {messages.createAccount}
        </AuthSubmitButton>
      </ActionForm>
    </AuthPage>
  );
}
