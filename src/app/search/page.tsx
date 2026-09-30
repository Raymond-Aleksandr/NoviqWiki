import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { SearchView } from "@/features/discovery/search";
import {
  discoveryHref, discoveryPagination, paginationNavigation, queryValue, totalPageCount,
  type DiscoverySearchParams
} from "@/features/discovery/query";
import { getRequestI18n } from "@/i18n/server";
import { listCategories } from "@/modules/categories/service";
import { searchPages } from "@/modules/search/service";

type Props = { searchParams: Promise<DiscoverySearchParams> };
const pageSize = 20;
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const query = queryValue(params.q);
  const category = queryValue(params.category) || undefined;
  const { page, limit, offset } = discoveryPagination(params.page, pageSize);
  const [results, categories, { messages }] = await Promise.all([
    query ? searchPages({ siteId: site.site.id, query, category, limit, offset }) : { rows: [], count: 0 },
    listCategories(site.site.id),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const totalPages = totalPageCount(results.count, pageSize);
  if (page > totalPages) redirect(discoveryHref("/search", { q: query, category, page: totalPages }));

  return <SearchView query={query} category={category} categories={categories}
    results={results.rows} count={results.count} messages={messages}
    pagination={paginationNavigation("/search", page, totalPages, { q: query, category })} />;
}
