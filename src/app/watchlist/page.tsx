import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { toggleWatchPageAction } from "@/app/actions";
import { getRequestSite } from "@/lib/request-context";
import { WatchlistView } from "@/features/discovery/watchlist";
import { activityFilterLabel, activityItem, recentChangeFilters } from "@/features/discovery/model";
import {
  discoveryHref, discoveryPagination, paginationNavigation, queryValue, totalPageCount,
  type DiscoverySearchParams
} from "@/features/discovery/query";
import { getRequestI18n } from "@/i18n/server";
import { actionsForRecentChangeFilter, recentChangeFilterValue } from "@/modules/activity/service";
import { countWatchedPages, listWatchedPages, listWatchlistChanges } from "@/modules/watchlist/service";

type Props = { searchParams: Promise<DiscoverySearchParams> };
const pageSize = 50;

export default async function WatchlistPage({ searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  const session = await requirePageReadAccess(site.site.id);
  if (!session) redirect("/login");
  const params = await searchParams;
  const requestedFilter = recentChangeFilterValue(queryValue(params.type));
  const activeFilter = requestedFilter === "media" ? "all" : requestedFilter;
  const { page, limit, offset } = discoveryPagination(params.page, pageSize);
  const [{ rows: changes, count }, watchedPages, watchedCount, { locale, messages }] = await Promise.all([
    listWatchlistChanges({
      siteId: site.site.id, userId: session.user.id, limit, offset,
      actions: actionsForRecentChangeFilter(activeFilter)
    }),
    listWatchedPages({ siteId: site.site.id, userId: session.user.id, limit: 50 }),
    countWatchedPages({ siteId: site.site.id, userId: session.user.id }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const type = activeFilter === "all" ? undefined : activeFilter;
  const totalPages = totalPageCount(count, pageSize);
  if (page > totalPages) redirect(discoveryHref("/watchlist", { type, page: totalPages }));

  return <WatchlistView activeFilter={activeFilter} watchedCount={watchedCount}
    unwatchAction={toggleWatchPageAction} messages={messages}
    watchedPages={watchedPages.map((page) => ({
      id: page.id, title: page.title, slug: page.slug, updated: page.updatedAt.toLocaleString(locale)
    }))}
    filters={recentChangeFilters.filter((filter) => filter !== "media").map((filter) => ({
      value: filter, label: activityFilterLabel(filter, messages),
      href: discoveryHref("/watchlist", { type: filter === "all" ? undefined : filter })
    }))}
    timeline={{
      items: changes.map((change) => activityItem(change, locale, messages)), count,
      emptyTitle: messages.noWatchlistChangesYet, emptyDescription: messages.watchlistActivityHint,
      label: messages.watchlistActivity,
      pagination: paginationNavigation("/watchlist", page, totalPages, { type })
    }} />;
}
