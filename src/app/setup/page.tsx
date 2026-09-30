import { redirect } from "next/navigation";
import { getSetupState } from "@/modules/setup/service";
import { setupAction } from "@/app/actions";
import { getEnv } from "@/lib/env";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { getRequestI18n } from "@/i18n/server";

export default async function SetupPage() {
  const setup = await getSetupState().catch(() => ({ mode: "initial" as const, site: null }));
  if (setup.mode === "complete") {
    redirect("/");
  }
  const env = getEnv();
  const { locale, messages } = await getRequestI18n();
  return (
    <SetupWizard
      action={setupAction}
      defaultBaseUrl={env.NOVIQWIKI_BASE_URL}
      defaultMediaDriver={env.NOVIQWIKI_MEDIA_DRIVER}
      defaultSiteName={setup.site?.name ?? "NoviqWiki"}
      initialLocale={locale}
      setupTokenRequired={env.NODE_ENV === "production" || Boolean(env.NOVIQWIKI_SETUP_TOKEN)}
      messages={messages}
      ownerOnly={setup.mode === "owner"}
    />
  );
}
