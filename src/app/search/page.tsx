import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listCategories } from "@/modules/categories/service";
import { searchPages } from "@/modules/search/service";

type Props = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const { q = "", category } = await searchParams;
  const results = q
    ? await searchPages({ siteId: site.site.id, query: q, category })
    : { rows: [], count: 0 };
  const [categories, i18n] = await Promise.all([
    listCategories(site.site.id),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  return (
    <section className="page-frame">
      <h1 className="page-title">{messages.search}</h1>
      <form className="search-form-main" role="search">
        <label className="search-input-main">
          <Search size={18} aria-hidden="true" />
          <input
            name="q"
            defaultValue={q}
            aria-label={messages.searchQuery}
            placeholder={messages.searchThisWikiPlaceholder}
          />
        </label>
        <input type="hidden" name="category" value={category ?? ""} />
        <button className="primary">
          <Search size={16} aria-hidden="true" />
          {messages.search}
        </button>
      </form>
      <div className="search-layout">
        <aside>
          <div className="search-filter-title">{messages.filterCategories}</div>
          <div className="search-filter-list">
            <Link
              className={`search-filter-link ${!category ? "active" : ""}`}
              href={`/search?q=${encodeURIComponent(q)}`}
            >
              <span>{messages.all}</span>
              <span>{results.count}</span>
            </Link>
            {categories.slice(0, 8).map((item) => (
              <Link
                className={`search-filter-link ${category === item.slug ? "active" : ""}`}
                key={item.id}
                href={`/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(item.slug)}`}
              >
                <span>{item.name}</span>
                <span>{item.pageCount}</span>
              </Link>
            ))}
          </div>
        </aside>
        <div>
          <p className="meta">
            {q
              ? `${results.count} ${results.count === 1 ? messages.result : messages.results}`
              : messages.enterQueryToSearch}
          </p>
          <div className="search-results">
            {results.rows.map((row) => (
              <Link className="search-result" href={`/page/${row.slug}`} key={row.pageId}>
                <h2>{row.title}</h2>
                <div className="search-result-url">/page/{row.slug}</div>
                {renderExcerpt(row.excerpt)}
              </Link>
            ))}
          </div>
          {q && results.rows.length === 0 ? (
            <section className="empty-state">
              <strong>{messages.noResultsWithPeriod}</strong>
              <p className="muted">{messages.searchNoResultsHint}</p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function renderExcerpt(excerpt: string) {
  const parts = excerpt.split(/(<mark>|<\/mark>)/g);
  let marked = false;
  return (
    <p>
      {parts.map((part, index) => {
        if (part === "<mark>") {
          marked = true;
          return null;
        }
        if (part === "</mark>") {
          marked = false;
          return null;
        }
        return marked ? <mark key={index}>{part}</mark> : part;
      })}
    </p>
  );
}
