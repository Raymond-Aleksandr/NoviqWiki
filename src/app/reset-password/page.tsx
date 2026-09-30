import { ArrowLeft, KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { AuthPage } from "@/features/auth/auth-page";
import { AuthField } from "@/features/auth/auth-field";
import { AuthSubmitButton } from "@/features/auth/auth-submit-button";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const site = await getRequestSite();
  const { messages } = await getRequestI18n(site?.settings?.defaultLocale);
  return (
    <AuthPage
      title={messages.chooseNewPassword}
      description={messages.resetPasswordDescription}
      links={[{
        href: "/login",
        label: messages.returnToLogin,
        icon: <ArrowLeft size={14} aria-hidden="true" />
      }]}
    >
      {token ? (
        <ActionForm action={resetPasswordAction} pendingLabel={messages.working}>
          <input type="hidden" name="token" value={token} />
          <AuthField
            name="password"
            label={messages.newPassword}
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            hint={`${messages.passwordLength} ${messages.passwordComplexity}`}
            required
          />
          <AuthSubmitButton pendingLabel={messages.working}>
            <KeyRound size={16} aria-hidden="true" />
            {messages.resetPassword}
          </AuthSubmitButton>
        </ActionForm>
      ) : (
        <p role="alert" className="error">
          {messages.resetTokenMissing}
        </p>
      )}
    </AuthPage>
  );
}
