import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { PageReport } from "@/features/discovery/reports";
import { getRequestI18n } from "@/i18n/server";
import { listProtectedPages } from "@/modules/pages/service";

export default async function ProtectedPages() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const [pages, { locale, messages }] = await Promise.all([
    listProtectedPages({ siteId: site.site.id, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <PageReport title={messages.protectedPages} description={messages.protectedPagesDescription}
    messages={messages} icon={ShieldCheck} emptyTitle={messages.noProtectedPagesYet}
    emptyDescription={messages.noProtectedPagesBody}
    panelTitle={`${pages.length} ${messages.protectedPagesLower}`}
    items={pages.map((page) => ({
      id: page.pageId, title: page.title, href: `/page/${page.slug}`,
      description: `${messages.pageProtected} · ${messages.updated} ${page.updatedAt.toLocaleString(locale)}`
    }))} />;
}
