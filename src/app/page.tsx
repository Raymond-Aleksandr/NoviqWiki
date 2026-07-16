import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listCategories } from "@/modules/categories/service";
import { listPages } from "@/modules/pages/service";
import { listRecentChanges } from "@/modules/activity/service";

export default async function HomePage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const settings = site.settings;
  const recentPages = await listPages({ siteId: site.site.id, status: "published", limit: 6 });
  const categories = await listCategories(site.site.id);
  const changes = await listRecentChanges({ siteId: site.site.id, limit: 8 });
  return (
    <section>
      <div className="article">
        <h1>{settings?.homepageTitle ?? site.site.name}</h1>
        <p className="meta">{settings?.homepageIntro ?? settings?.tagline}</p>
        <form action="/search" className="global-search" role="search">
          <input name="q" aria-label="Search this wiki" />
          <button className="primary">Search</button>
        </form>
      </div>
      <div className="grid" style={{ marginTop: "1rem" }}>
        <section className="card">
          <h2>Featured pages</h2>
          {recentPages.length === 0 ? (
            <p className="muted">No published pages yet.</p>
          ) : (
            recentPages.map((page) => (
              <p key={page.id}>
                <Link href={`/page/${page.slug}`}>{page.title}</Link>
              </p>
            ))
          )}
          <Link className="button" href="/edit/new">
            Create page
          </Link>
        </section>
        <section className="card">
          <h2>Categories</h2>
          {categories.slice(0, 8).map((category) => (
            <p key={category.id}>
              <Link href={`/categories/${category.slug}`}>{category.name}</Link>{" "}
              <span className="muted">({category.pageCount})</span>
            </p>
          ))}
        </section>
        <section className="card">
          <h2>Recently updated</h2>
          {changes.map((change) => (
            <p key={change.id}>
              <span>{change.action}</span> <span className="muted">{change.actorDisplayName}</span>
            </p>
          ))}
        </section>
      </div>
    </section>
  );
}
