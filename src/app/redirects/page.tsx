import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { RedirectsView } from "@/features/discovery/redirects";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { listRedirectPages } from "@/modules/redirects/service";

export default async function RedirectsPage() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  const session = await requirePageReadAccess(site.site.id);
  const [{ rows: redirects, count }, canCreate, { locale, messages }] = await Promise.all([
    listRedirectPages({ siteId: site.site.id, limit: 100 }),
    hasPermission(session?.user.id, site.site.id, "page.create"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <RedirectsView count={count} canCreate={canCreate} messages={messages}
    redirects={redirects.map(({ targetPageId: _targetPageId, updatedAt, ...entry }) => ({
      ...entry, updated: updatedAt.toLocaleString(locale)
    }))} />;
}
