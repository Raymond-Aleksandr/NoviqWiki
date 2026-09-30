import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { PageHeader } from "@/components/ui/page-header";
import { getRequestSite } from "@/lib/request-context";
import { ActivityTimeline, DiscoveryFilters } from "@/features/discovery/activity";
import { activityFilterLabel, activityItem, recentChangeFilters } from "@/features/discovery/model";
import {
  discoveryHref, discoveryPagination, paginationNavigation, queryValue, totalPageCount,
  type DiscoverySearchParams
} from "@/features/discovery/query";
import { getRequestI18n } from "@/i18n/server";
import { actionsForRecentChangeFilter, listRecentChangesPage, recentChangeFilterValue } from "@/modules/activity/service";

type Props = { searchParams: Promise<DiscoverySearchParams> };
const pageSize = 50;

export default async function RecentChangesPage({ searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const activeFilter = recentChangeFilterValue(queryValue(params.type));
  const { page, limit, offset } = discoveryPagination(params.page, pageSize);
  const [{ rows: changes, count }, { locale, messages }] = await Promise.all([
    listRecentChangesPage({
      siteId: site.site.id, limit, offset, publicOnly: true,
      actions: actionsForRecentChangeFilter(activeFilter)
    }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const type = activeFilter === "all" ? undefined : activeFilter;
  const totalPages = totalPageCount(count, pageSize);
  if (page > totalPages) redirect(discoveryHref("/recent", { type, page: totalPages }));

  return <section className="page-frame">
    <PageHeader title={messages.recentChanges} description={messages.recentChangesDescription} />
    <DiscoveryFilters label={messages.recentChangesFilters} active={activeFilter}
      links={recentChangeFilters.map((filter) => ({
        value: filter, label: activityFilterLabel(filter, messages),
        href: discoveryHref("/recent", { type: filter === "all" ? undefined : filter })
      }))} />
    <ActivityTimeline items={changes.map((change) => activityItem(change, locale, messages))}
      count={count} emptyTitle={messages.noChangesYet} emptyDescription={messages.activityAppears}
      label={messages.recentChanges} messages={messages}
      pagination={paginationNavigation("/recent", page, totalPages, { type })} />
  </section>;
}
