import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { WantedReport } from "@/features/discovery/reports";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { listWantedPages } from "@/modules/pages/service";

export default async function WantedPages() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  const session = await requirePageReadAccess(site.site.id);
  const [wantedPages, canCreate, { locale, messages }] = await Promise.all([
    listWantedPages({ siteId: site.site.id, limit: 100 }),
    hasPermission(session?.user.id, site.site.id, "page.create"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <WantedReport canCreate={canCreate} messages={messages} pages={wantedPages.map((page) => ({
    id: page.targetNormalizedTitle, title: page.targetTitle, sourceCount: page.sourceCount,
    updated: page.updatedAt.toLocaleString(locale)
  }))} />;
}
