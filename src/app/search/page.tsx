import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrimarySiteWithSettings } from "@/db/site";
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
  return (
    <section>
      <h1>Search</h1>
      <form className="global-search">
        <input name="q" defaultValue={q} aria-label="Search query" />
        <input name="category" defaultValue={category ?? ""} aria-label="Category filter" />
        <button className="primary">Search</button>
      </form>
      <p className="meta">{results.count} result(s)</p>
      {results.rows.map((row) => (
        <article className="card" key={row.pageId}>
          <h2>
            <Link href={`/page/${row.slug}`}>{row.title}</Link>
          </h2>
          <p dangerouslySetInnerHTML={{ __html: row.excerpt }} />
        </article>
      ))}
      {q && results.rows.length === 0 ? <p>No results.</p> : null}
    </section>
  );
}
