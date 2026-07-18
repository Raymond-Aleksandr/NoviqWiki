import { redirect } from "next/navigation";
import { isSetupRequired } from "@/modules/setup/service";
import { setupAction } from "@/app/actions";
import { getEnv } from "@/lib/env";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { getRequestI18n } from "@/i18n/server";

export default async function SetupPage() {
  if (!(await isSetupRequired().catch(() => true))) {
    redirect("/");
  }
  const env = getEnv();
  const { locale, messages } = await getRequestI18n();
  return (
    <SetupWizard
      action={setupAction}
      defaultBaseUrl={env.NEXTWIKI_BASE_URL}
      defaultMediaDriver={env.NEXTWIKI_MEDIA_DRIVER}
      initialLocale={locale}
      setupTokenRequired={env.NODE_ENV === "production" || Boolean(env.NEXTWIKI_SETUP_TOKEN)}
      messages={messages}
    />
  );
}
