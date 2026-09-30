import { redirect } from "next/navigation";
import { Ruler } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { DiscoveryFilters } from "@/features/discovery/activity";
import { PageReport } from "@/features/discovery/reports";
import { shortPageThreshold, shortPageThresholds, type DiscoverySearchParams } from "@/features/discovery/query";
import { getRequestI18n } from "@/i18n/server";
import { listShortPages } from "@/modules/pages/service";

type Props = { searchParams: Promise<DiscoverySearchParams> };

export default async function ShortPages({ searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const maxLength = shortPageThreshold(params.max);
  const [pages, { locale, messages }] = await Promise.all([
    listShortPages({ siteId: site.site.id, maxLength, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <PageReport title={messages.shortPages} description={messages.shortPagesDescription}
    messages={messages} icon={Ruler} emptyTitle={messages.noShortPagesYet}
    emptyDescription={messages.noShortPagesBody} panelTitle={`${pages.length} ${messages.shortPagesLower}`}
    filters={<DiscoveryFilters label={messages.shortPagesThresholds} active={maxLength}
      links={shortPageThresholds.map((threshold) => ({
        value: String(threshold), label: `≤ ${threshold} ${messages.chars}`,
        href: `/short-pages?max=${threshold}`
      }))} />}
    items={pages.map((page) => ({
      id: page.pageId, title: page.title, href: `/page/${page.slug}`,
      description: `${page.plainTextLength} ${messages.chars} · ${messages.updated} ${page.updatedAt.toLocaleString(locale)}`
    }))} />;
}
