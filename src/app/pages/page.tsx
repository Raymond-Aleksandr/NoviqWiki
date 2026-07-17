import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listPublishedPageIndex } from "@/modules/pages/service";

type Props = {
  searchParams: Promise<{ page?: string; prefix?: string; q?: string }>;
};

const pageSize = 50;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default async function PagesIndex({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const prefix = prefixValue(params.prefix);
  const page = Math.max(1, Number(params.page) || 1);
  const [{ rows, count }, i18n] = await Promise.all([
    listPublishedPageIndex({
      siteId: site.site.id,
      query,
      prefix,
      limit: pageSize,
      offset: (page - 1) * pageSize
    }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <section className="page-frame">
      <header className="page-header stack">
        <h1 className="page-title">{messages.allPages}</h1>
        <p className="page-description">{messages.allPagesDescription}</p>
      </header>
      <form className="admin-filter-bar page-index-filter" action="/pages">
        <label className="admin-filter-control admin-filter-search">
          <Search size={15} aria-hidden="true" />
          <input name="q" defaultValue={query} placeholder={messages.filterPages} />
        </label>
        {prefix ? <input type="hidden" name="prefix" value={prefix} /> : null}
        <button className="button compact">
          <Search size={14} aria-hidden="true" />
          {messages.search}
        </button>
        {query || prefix ? (
          <Link className="button compact" href="/pages">
            {messages.clearFilters}
          </Link>
        ) : null}
      </form>
      <nav className="filter-pills" aria-label={messages.pageIndexPrefixes}>
        <Link
          aria-current={!prefix ? "page" : undefined}
          className={`filter-pill ${!prefix ? "active" : ""}`}
          href={pagesHref({ q: query })}
        >
          {messages.all}
        </Link>
        {alphabet.map((letter) => (
          <Link
            aria-current={prefix === letter ? "page" : undefined}
            className={`filter-pill ${prefix === letter ? "active" : ""}`}
            href={pagesHref({ prefix: letter, q: query })}
            key={letter}
          >
            {letter}
          </Link>
        ))}
      </nav>
      <section className="data-panel page-index-panel">
        <div className="admin-panel-heading">
          {count} {messages.pagesLower}
        </div>
        {rows.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noPagesFound}</strong>
            <p className="muted">{messages.noPagesFoundBody}</p>
          </div>
        ) : (
          <div className="page-index-list">
            {rows.map((pageRow) => (
              <Link className="page-index-row" href={`/page/${pageRow.slug}`} key={pageRow.pageId}>
                <span>
                  <strong>{pageRow.title}</strong>
                  <small>/page/{pageRow.slug}</small>
                </span>
                <span className="muted">
                  {messages.updated} {pageRow.updatedAt.toLocaleString(locale)}
                </span>
              </Link>
            ))}
          </div>
        )}
        <footer className="admin-pagination">
          <span className="muted">
            {messages.page} {page} / {totalPages}
          </span>
          <div className="admin-pagination-actions">
            <Link
              aria-disabled={page <= 1}
              className={`button compact ${page <= 1 ? "disabled-link" : ""}`}
              href={pagesHref({ page: page <= 1 ? page : page - 1, prefix, q: query })}
            >
              <ChevronLeft size={14} aria-hidden="true" />
              {messages.previousPage}
            </Link>
            <Link
              aria-disabled={page >= totalPages}
              className={`button compact ${page >= totalPages ? "disabled-link" : ""}`}
              href={pagesHref({ page: page >= totalPages ? page : page + 1, prefix, q: query })}
            >
              {messages.nextPage}
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </footer>
      </section>
    </section>
  );
}

function prefixValue(value: string | undefined) {
  const prefix = value?.trim().slice(0, 1).toUpperCase();
  return prefix && /^[A-Z]$/.test(prefix) ? prefix : undefined;
}

function pagesHref({ page, prefix, q }: { page?: number; prefix?: string; q?: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (prefix) params.set("prefix", prefix);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/pages?${query}` : "/pages";
}
