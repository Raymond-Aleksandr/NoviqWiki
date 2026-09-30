import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { PageIndexView } from "@/features/discovery/page-index";
import {
  discoveryHref, discoveryPagination, pagePrefix, paginationNavigation, queryValue, totalPageCount,
  type DiscoverySearchParams
} from "@/features/discovery/query";
import { getRequestI18n } from "@/i18n/server";
import { listPublishedPageIndex } from "@/modules/pages/service";

type Props = { searchParams: Promise<DiscoverySearchParams> };
const pageSize = 50;

export default async function PagesIndex({ searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const query = queryValue(params.q);
  const prefix = pagePrefix(params.prefix);
  const { page, limit, offset } = discoveryPagination(params.page, pageSize);
  const [{ rows, count }, { locale, messages }] = await Promise.all([
    listPublishedPageIndex({ siteId: site.site.id, query, prefix, limit, offset }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const totalPages = totalPageCount(count, pageSize);
  if (page > totalPages) redirect(discoveryHref("/pages", { q: query, prefix, page: totalPages }));

  return <PageIndexView query={query} prefix={prefix} count={count} messages={messages}
    pages={rows.map((row) => ({
      id: row.pageId, title: row.title, slug: row.slug, updated: row.updatedAt.toLocaleString(locale)
    }))}
    pagination={paginationNavigation("/pages", page, totalPages, { q: query, prefix })} />;
}
