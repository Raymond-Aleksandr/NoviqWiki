import { redirect } from "next/navigation";
import { Tags } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { PageReport } from "@/features/discovery/reports";
import { getRequestI18n } from "@/i18n/server";
import { listUncategorizedPages } from "@/modules/pages/service";

export default async function UncategorizedPages() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const [pages, { locale, messages }] = await Promise.all([
    listUncategorizedPages({ siteId: site.site.id, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <PageReport title={messages.uncategorizedPages} description={messages.uncategorizedPagesDescription}
    messages={messages} icon={Tags} emptyTitle={messages.noUncategorizedPagesYet}
    emptyDescription={messages.noUncategorizedPagesBody}
    items={pages.map((page) => ({
      id: page.pageId, title: page.title, href: `/page/${page.slug}`,
      description: `${messages.updated} ${page.updatedAt.toLocaleString(locale)}`
    }))} />;
}
