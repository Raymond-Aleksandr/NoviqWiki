import { redirect } from "next/navigation";
import { getRequestSetupState } from "@/lib/request-context";
import { setupAction } from "@/app/actions";
import { getEnv } from "@/lib/env";
import { SetupWizard } from "@/features/setup/setup-wizard";
import { createSetupValues } from "@/features/setup/model";
import { getSetupMessages } from "@/features/setup/messages";
import { getRequestI18n } from "@/i18n/server";

export default async function SetupPage() {
  const setup = await getRequestSetupState().catch(() => ({ mode: "initial" as const, site: null }));
  if (setup.mode === "complete") {
    redirect("/");
  }
  const env = getEnv();
  const { locale, messages } = await getRequestI18n();
  return (
    <SetupWizard
      action={setupAction}
      initialValues={createSetupValues({
        baseUrl: env.NOVIQWIKI_BASE_URL,
        mediaDriver: env.NOVIQWIKI_MEDIA_DRIVER,
        siteName: setup.site?.name ?? "NoviqWiki",
        tagline: messages.modernSelfHostedWiki,
        defaultLocale: locale
      })}
      setupTokenRequired={env.NODE_ENV === "production" || Boolean(env.NOVIQWIKI_SETUP_TOKEN)}
      messages={getSetupMessages(messages)}
      mode={setup.mode}
    />
  );
}
