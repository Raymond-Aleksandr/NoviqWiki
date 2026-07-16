import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listCategories } from "@/modules/categories/service";
import { searchPages } from "@/modules/search/service";

type Props = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const { q = "", category } = await searchParams;
  const results = q
    ? await searchPages({ siteId: site.site.id, query: q, category })
    : { rows: [], count: 0 };
  const categories = await listCategories(site.site.id);
  return (
    <section className="page-frame">
      <h1 className="page-title">Search</h1>
      <form className="search-form-main" role="search">
        <label className="search-input-main">
          <Search size={18} aria-hidden="true" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Search query"
            placeholder="Search this wiki..."
          />
        </label>
        <input type="hidden" name="category" value={category ?? ""} />
        <button className="primary">Search</button>
      </form>
      <div className="search-layout">
        <aside>
          <div className="search-filter-title">Filter · Categories</div>
          <div className="search-filter-list">
            <Link
              className={`search-filter-link ${!category ? "active" : ""}`}
              href={`/search?q=${encodeURIComponent(q)}`}
            >
              <span>All</span>
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
              ? `${results.count} result${results.count === 1 ? "" : "s"}`
              : "Enter a query to search pages."}
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
              <strong>No results.</strong>
              <p className="muted">Try a different title, alias, body term, or category.</p>
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
