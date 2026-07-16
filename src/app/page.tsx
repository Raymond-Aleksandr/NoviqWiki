import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Clock3, Plus, Search, Tags } from "lucide-react";
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
    <section className="home-page wiki-home">
      <div className="home-hero">
        <div className="home-hero-media" aria-hidden="true">
          <span>cover image · 2400×900</span>
        </div>
        <div className="home-hero-content">
          <p className="eyebrow">Self-hosted knowledge base</p>
          <h1>{settings?.homepageTitle ?? site.site.name}</h1>
          <p>{settings?.homepageIntro ?? settings?.tagline}</p>
          <form action="/search" className="home-search" role="search">
            <input name="q" aria-label="Search this wiki" placeholder="Search this wiki..." />
            <button className="primary">
              <Search size={16} aria-hidden="true" />
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="section-heading">
        <h2>Featured pages</h2>
        <Link className="section-action" href="/categories">
          Browse all
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="featured-grid">
        {recentPages.length === 0 ? (
          <section className="empty-state">
            <h3>No published pages yet.</h3>
            <p>Create the first article to start shaping this wiki.</p>
            <Link className="button primary" href="/edit/new">
              <Plus size={15} aria-hidden="true" />
              Create page
            </Link>
          </section>
        ) : (
          recentPages.slice(0, 3).map((page) => (
            <Link className="feature-card" key={page.id} href={`/page/${page.slug}`}>
              <span className="feature-card-media" aria-hidden="true">
                Article
              </span>
              <span className="feature-card-body">
                <span className="badge info">Article</span>
                <strong>{page.title}</strong>
                <span className="muted">Open the latest published revision.</span>
              </span>
            </Link>
          ))
        )}
      </div>

      <div className="home-panels">
        <section className="panel flush">
          <header className="panel-header">
            <h2>
              <Clock3 size={17} aria-hidden="true" />
              Recently updated
            </h2>
          </header>
          <div className="activity-list">
            {changes.map((change) => (
              <p key={change.id}>
                <span className={`badge audit-action ${badgeForAction(change.action)}`}>
                  {change.action}
                </span>
                <span>{change.actorDisplayName}</span>
                <span className="muted">{change.createdAt.toLocaleString()}</span>
              </p>
            ))}
          </div>
        </section>
        <section className="panel flush">
          <header className="panel-header">
            <h2>
              <Tags size={17} aria-hidden="true" />
              Featured categories
            </h2>
          </header>
          <div className="category-list">
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`}>
                <span className="category-swatch" aria-hidden="true" />
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.pageCount} pages</small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
          {recentPages.length === 0 ? (
            <Link className="button" href="/edit/new">
              <Plus size={15} aria-hidden="true" />
              Create page
            </Link>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function badgeForAction(action: string) {
  if (action.includes("delete") || action.includes("failed") || action.includes("suspend")) {
    return "danger";
  }
  if (action.includes("rollback") || action.includes("reset")) {
    return "warning";
  }
  if (action.includes("create") || action.includes("publish") || action.includes("upload")) {
    return "success";
  }
  return "info";
}
