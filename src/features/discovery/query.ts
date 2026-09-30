export type SearchParam = string | string[] | undefined;

export type DiscoverySearchParams = Record<string, SearchParam>;

export function queryValue(value: SearchParam) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function discoveryPagination(value: SearchParam, pageSize: number) {
  const text = queryValue(value);
  const requested = /^\d+$/.test(text) ? Number(text) : 1;
  // Keep offsets within PostgreSQL's integer range as well as JavaScript's safe range.
  const maxPage = Math.floor(2_147_483_647 / pageSize) + 1;
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= maxPage
    ? requested
    : 1;
  return { page, limit: pageSize, offset: (page - 1) * pageSize };
}

export function totalPageCount(count: number, pageSize: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function discoveryHref(
  pathname: string,
  values: Record<string, string | number | undefined> = {}
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export type PaginationNavigation = {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
};

export function paginationNavigation(
  pathname: string,
  page: number,
  totalPages: number,
  filters: Record<string, string | undefined> = {}
): PaginationNavigation {
  return {
    page,
    totalPages,
    previousHref: discoveryHref(pathname, { ...filters, page: Math.max(1, page - 1) }),
    nextHref: discoveryHref(pathname, { ...filters, page: Math.min(totalPages, page + 1) })
  };
}

export function pagePrefix(value: SearchParam) {
  const prefix = queryValue(value).slice(0, 1).toUpperCase();
  return /^[A-Z]$/.test(prefix) ? prefix : undefined;
}

export const shortPageThresholds = [200, 600, 1200] as const;

export function shortPageThreshold(value: SearchParam) {
  const text = queryValue(value);
  const parsed = /^\d+$/.test(text) ? Number(text) : NaN;
  return shortPageThresholds.find((threshold) => threshold === parsed) ?? 600;
}
