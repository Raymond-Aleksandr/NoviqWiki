import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { AuthPage } from "@/features/auth/auth-page";
import { AuthField } from "@/features/auth/auth-field";
import { AuthSubmitButton } from "@/features/auth/auth-submit-button";
import { getRequestSession } from "@/lib/request-context";
import { loginAction } from "@/app/actions";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";
import { isSetupRequired } from "@/modules/setup/service";

type Props = {
  searchParams: Promise<{ registered?: string; reset?: string; verified?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  if (await getRequestSession()) {
    redirect("/");
  }
  if (await isSetupRequired()) {
    redirect("/setup");
  }
  const site = await getRequestSite();
  if (!site) {
    redirect("/setup");
  }
  const { messages } = await getRequestI18n(site.settings?.defaultLocale);
  const params = await searchParams;
  const registrationEnabled =
    site.settings?.registrationMode === "open" ||
    site.settings?.registrationMode === "email_verification";
  return (
    <AuthPage
      title={messages.loginTitle}
      siteName={site.site.name}
      illustration={messages.authBrandImage}
      links={[
        { href: "/forgot-password", label: messages.forgotPassword },
        { href: "/resend-verification", label: messages.resendVerificationEmail },
        ...(registrationEnabled ? [{ href: "/register", label: messages.createAccount }] : [])
      ]}
    >
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
        <AuthField
          name="identifier"
          label={messages.usernameOrEmail}
          autoComplete="username"
          maxLength={320}
          required
        />
        <AuthField
          name="password"
          label={messages.password}
          type="password"
          autoComplete="current-password"
          maxLength={200}
          required
        />
        <AuthSubmitButton pendingLabel={messages.working}>
          <LogIn size={16} aria-hidden="true" />
          {messages.login}
        </AuthSubmitButton>
      </ActionForm>
    </AuthPage>
  );
}
