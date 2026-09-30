import { ArrowLeft, Send } from "lucide-react";
import { requestPasswordResetAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { AuthPage } from "@/features/auth/auth-page";
import { AuthField } from "@/features/auth/auth-field";
import { AuthSubmitButton } from "@/features/auth/auth-submit-button";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";

export default async function ForgotPasswordPage() {
  const site = await getRequestSite();
  const { messages } = await getRequestI18n(site?.settings?.defaultLocale);
  return (
    <AuthPage
      title={messages.resetPassword}
      description={messages.forgotPasswordDescription}
      links={[{
        href: "/login",
        label: messages.returnToLogin,
        icon: <ArrowLeft size={14} aria-hidden="true" />
      }]}
      note={!site ? <p className="meta">{messages.setupRequiredRecovery}</p> : undefined}
    >
      <ActionForm action={requestPasswordResetAction} pendingLabel={messages.working}>
        <AuthField
          name="identifier"
          label={messages.usernameOrEmail}
          autoComplete="username"
          maxLength={320}
          required
        />
        <AuthSubmitButton pendingLabel={messages.working}>
          <Send size={16} aria-hidden="true" />
          {messages.requestResetLink}
        </AuthSubmitButton>
      </ActionForm>
    </AuthPage>
  );
}
