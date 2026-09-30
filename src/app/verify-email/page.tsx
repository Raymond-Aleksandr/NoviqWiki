import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { verifyEmailAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { AuthPage } from "@/features/auth/auth-page";
import { AuthSubmitButton } from "@/features/auth/auth-submit-button";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const site = await getRequestSite();
  const { messages } = await getRequestI18n(site?.settings?.defaultLocale);
  return (
    <AuthPage
      title={messages.verifyEmail}
      description={messages.verifyEmailDescription}
      centered
      icon={<CheckCircle2 size={26} aria-hidden="true" />}
      links={[
        {
          href: "/login",
          label: messages.returnToLogin,
          icon: <ArrowLeft size={14} aria-hidden="true" />
        },
        { href: "/resend-verification", label: messages.resendVerificationEmail }
      ]}
      note={
        <div className="auth-note">
          <AlertCircle size={16} aria-hidden="true" />
          {messages.verificationExpiredHint}
        </div>
      }
    >
      {token ? (
        <ActionForm action={verifyEmailAction} pendingLabel={messages.working}>
          <input type="hidden" name="token" value={token} />
          <AuthSubmitButton pendingLabel={messages.working}>
            <CheckCircle2 size={16} aria-hidden="true" />
            {messages.verifyEmailAddress}
          </AuthSubmitButton>
        </ActionForm>
      ) : (
        <p role="alert" className="error">
          {messages.verificationTokenMissing}
        </p>
      )}
    </AuthPage>
  );
}
