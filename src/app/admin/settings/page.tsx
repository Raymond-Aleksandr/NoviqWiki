import { getRequestSite } from "@/lib/request-context";
import { AdminSettingsView } from "@/features/admin/settings-view";
import { getRequestI18n } from "@/i18n/server";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/modules/settings/service";

export default async function AdminSettingsPage() {
  const site = await getRequestSite();
  const settings = site!.settings!;
  const { messages } = await getRequestI18n(settings.defaultLocale);
  return <AdminSettingsView siteName={site!.site.name} settings={settings} maxUploadBytes={MAX_MEDIA_UPLOAD_BYTES} messages={messages} />;
}
