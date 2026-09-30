import { redirect } from "next/navigation";
import { Link2Off } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { PageReport } from "@/features/discovery/reports";
import { getRequestI18n } from "@/i18n/server";
import { listOrphanedPages } from "@/modules/pages/service";

export default async function OrphanedPages() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const [pages, { locale, messages }] = await Promise.all([
    listOrphanedPages({ siteId: site.site.id, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <PageReport title={messages.orphanedPages} description={messages.orphanedPagesDescription}
    messages={messages} icon={Link2Off} emptyTitle={messages.noOrphanedPagesYet}
    emptyDescription={messages.noOrphanedPagesBody}
    items={pages.map((page) => ({
      id: page.pageId, title: page.title, href: `/page/${page.slug}`,
      description: `${messages.updated} ${page.updatedAt.toLocaleString(locale)}`
    }))} />;
}
