import { redirect } from "next/navigation";
import { isSetupRequired } from "@/modules/setup/service";
import { setupAction } from "@/app/actions";
import { getEnv } from "@/lib/env";
import { SetupWizard } from "@/components/setup/setup-wizard";

export default async function SetupPage() {
  if (!(await isSetupRequired().catch(() => true))) {
    redirect("/");
  }
  const env = getEnv();
  return (
    <SetupWizard
      action={setupAction}
      defaultBaseUrl={env.NEXTWIKI_BASE_URL}
      defaultMediaDriver={env.NEXTWIKI_MEDIA_DRIVER}
    />
  );
}
