import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import type { Messages } from "@/i18n";
import type { CategorySummary } from "./model";
import { discoveryHref, type PaginationNavigation } from "./query";

type SearchMessages = Pick<Messages,
  | "search" | "searchQuery" | "searchThisWikiPlaceholder" | "filterCategories" | "all"
  | "pagesLower" | "result" | "results" | "enterQueryToSearch" | "noResultsWithPeriod"
  | "searchNoResultsHint" | "clearFilters" | "browseAll" | "page" | "previousPage" | "nextPage"
>;

type Props = {
  query: string;
  category?: string;
  categories: readonly CategorySummary[];
  results: readonly { pageId: string; title: string; slug: string; excerpt: string }[];
  count: number;
  pagination: PaginationNavigation;
  messages: SearchMessages;
};

export function SearchView({ query, category, categories, results, count, pagination, messages }: Props) {
  return (
    <section className="page-frame">
      <PageHeader title={messages.search} />
      <p className="meta"><label htmlFor="discovery-search-query">{messages.searchQuery}</label></p>
      <form className="search-form-main" role="search" action="/search">
        <div className="search-input-main">
          <Search size={18} aria-hidden="true" />
          <input id="discovery-search-query" type="search" name="q" defaultValue={query}
            placeholder={messages.searchThisWikiPlaceholder} />
        </div>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button className="primary" type="submit">
          <Search size={16} aria-hidden="true" />{messages.search}
        </button>
      </form>
      <div className="search-layout">
        <aside aria-labelledby="discovery-search-filters">
          <h2 className="search-filter-title" id="discovery-search-filters">{messages.filterCategories}</h2>
          <nav className="search-filter-list" aria-labelledby="discovery-search-filters">
            <Link className={`search-filter-link ${!category ? "active" : ""}`}
              aria-current={!category ? "page" : undefined}
              href={discoveryHref("/search", { q: query })}>
              <span>{messages.all}</span>
            </Link>
            {categories.map((item) => (
              <Link className={`search-filter-link ${category === item.slug ? "active" : ""}`}
                aria-current={category === item.slug ? "page" : undefined} key={item.id}
                href={discoveryHref("/search", { q: query, category: item.slug })}>
                <span>{item.name}</span><small>{item.pageCount} {messages.pagesLower}</small>
              </Link>
            ))}
          </nav>
        </aside>
        <div>
          <p className="meta" role="status">
            {query ? `${count} ${count === 1 ? messages.result : messages.results}` : messages.enterQueryToSearch}
          </p>
          <div className="search-results">
            {results.map((row) => (
              <Link className="search-result" href={`/page/${row.slug}`} key={row.pageId}>
                <h2>{row.title}</h2><div className="search-result-url">/page/{row.slug}</div>
                <SearchExcerpt excerpt={row.excerpt} />
              </Link>
            ))}
          </div>
          {query && results.length === 0 ? (
            <EmptyState title={messages.noResultsWithPeriod} description={messages.searchNoResultsHint}
              action={category ? (
                <Link className="button" href={discoveryHref("/search", { q: query })}>{messages.clearFilters}</Link>
              ) : <Link className="button" href="/pages">{messages.browseAll}</Link>} />
          ) : null}
          {query && count > 0 ? <Pagination {...pagination} messages={messages} /> : null}
        </div>
      </div>
    </section>
  );
}

function SearchExcerpt({ excerpt }: { excerpt: string }) {
  let marked = false;
  return <p>{excerpt.split(/(<mark>|<\/mark>)/g).map((part, index) => {
    if (part === "<mark>") { marked = true; return null; }
    if (part === "</mark>") { marked = false; return null; }
    return marked ? <mark key={index}>{part}</mark> : part;
  })}</p>;
}
