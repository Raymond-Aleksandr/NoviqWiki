import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { SpecialPagesView } from "@/features/discovery/special";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { getSpecialPageSections } from "@/modules/pages/special-pages";

export default async function SpecialPages() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  const session = await requirePageReadAccess(site.site.id);
  const [canConfigureSite, { messages }] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "site.configure"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const sections = getSpecialPageSections(messages, { includeAdmin: canConfigureSite });
  return <SpecialPagesView sections={sections} messages={messages} />;
}
