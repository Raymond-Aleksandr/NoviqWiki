import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import type { Messages } from "@/i18n";
import { DiscoveryFilters } from "./activity";
import { discoveryHref, type PaginationNavigation } from "./query";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Props = {
  query: string;
  prefix?: string;
  pages: readonly { id: string; title: string; slug: string; updated: string }[];
  count: number;
  pagination: PaginationNavigation;
  messages: Pick<Messages,
    "allPages" | "allPagesDescription" | "filterPages" | "search" | "clearFilters" | "all"
    | "pageIndexPrefixes" | "pagesLower" | "noPagesFound" | "noPagesFoundBody" | "updated"
    | "page" | "previousPage" | "nextPage"
  >;
};

export function PageIndexView({ query, prefix, pages, count, pagination, messages }: Props) {
  return (
    <section className="page-frame">
      <PageHeader title={messages.allPages} description={messages.allPagesDescription} />
      <form className="admin-filter-bar page-index-filter" action="/pages">
        <label className="admin-filter-control admin-filter-search">
          <span className="sr-only">{messages.filterPages}</span>
          <Search size={15} aria-hidden="true" />
          <input type="search" name="q" defaultValue={query} placeholder={messages.filterPages} />
        </label>
        {prefix ? <input type="hidden" name="prefix" value={prefix} /> : null}
        <button className="button compact" type="submit"><Search size={14} aria-hidden="true" />{messages.search}</button>
        {query || prefix ? <Link className="button compact" href="/pages">{messages.clearFilters}</Link> : null}
      </form>
      <DiscoveryFilters label={messages.pageIndexPrefixes} active={prefix ?? ""} links={[
        { value: "", label: messages.all, href: discoveryHref("/pages", { q: query }) },
        ...alphabet.map((letter) => ({
          value: letter, label: letter, href: discoveryHref("/pages", { prefix: letter, q: query })
        }))
      ]} />
      <section className="data-panel page-index-panel">
        <div className="admin-panel-heading">{count} {messages.pagesLower}</div>
        {pages.length === 0 ? (
          <EmptyState title={messages.noPagesFound} description={messages.noPagesFoundBody}
            action={query || prefix ? <Link className="button" href="/pages">{messages.clearFilters}</Link> : undefined} />
        ) : <div className="page-index-list">{pages.map((page) => (
          <Link className="page-index-row" href={`/page/${page.slug}`} key={page.id}>
            <span><strong>{page.title}</strong><small>/page/{page.slug}</small></span>
            <span className="muted">{messages.updated} {page.updated}</span>
          </Link>
        ))}</div>}
        <Pagination {...pagination} messages={messages} />
      </section>
    </section>
  );
}
