import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Clock3, Plus, Search, Tags } from "lucide-react";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
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
  const { locale, messages } = await getRequestI18n(settings?.defaultLocale);
  return (
    <section className="home-page wiki-home">
      <div className="home-hero">
        <div className="home-hero-media" aria-hidden="true">
          <span>cover image · 2400×900</span>
        </div>
        <div className="home-hero-content">
          <p className="eyebrow">{messages.selfHostedKnowledgeBase}</p>
          <h1>{settings?.homepageTitle ?? site.site.name}</h1>
          <p>{settings?.homepageIntro ?? settings?.tagline}</p>
          <form action="/search" className="home-search" role="search">
            <input
              name="q"
              aria-label={messages.searchThisWiki}
              placeholder={messages.searchThisWikiPlaceholder}
            />
            <button className="primary">
              <Search size={16} aria-hidden="true" />
              {messages.search}
            </button>
          </form>
        </div>
      </div>

      <div className="section-heading">
        <h2>{messages.featuredPages}</h2>
        <Link className="section-action" href="/categories">
          {messages.browseAll}
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="featured-grid">
        {recentPages.length === 0 ? (
          <section className="empty-state">
            <h3>{messages.noPublishedPagesYet}</h3>
            <p>{messages.createFirstArticle}</p>
            <Link className="button primary" href="/edit/new">
              <Plus size={15} aria-hidden="true" />
              {messages.createPage}
            </Link>
          </section>
        ) : (
          recentPages.slice(0, 3).map((page) => (
            <Link className="feature-card" key={page.id} href={`/page/${page.slug}`}>
              <span className="feature-card-media" aria-hidden="true">
                {messages.article}
              </span>
              <span className="feature-card-body">
                <span className="badge info">{messages.article}</span>
                <strong>{page.title}</strong>
                <span className="muted">{messages.openLatestRevision}</span>
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
              {messages.recentlyUpdated}
            </h2>
          </header>
          <div className="activity-list">
            {changes.map((change) => (
              <p key={change.id}>
                <span className={`badge audit-action ${badgeForAction(change.action)}`}>
                  {change.action}
                </span>
                <span>{change.actorDisplayName}</span>
                <span className="muted">{change.createdAt.toLocaleString(locale)}</span>
              </p>
            ))}
          </div>
        </section>
        <section className="panel flush">
          <header className="panel-header">
            <h2>
              <Tags size={17} aria-hidden="true" />
              {messages.featuredCategories}
            </h2>
          </header>
          <div className="category-list">
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`}>
                <span className="category-swatch" aria-hidden="true" />
                <span>
                  <strong>{category.name}</strong>
                  <small>
                    {category.pageCount} {messages.pagesLower}
                  </small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
          {recentPages.length === 0 ? (
            <Link className="button" href="/edit/new">
              <Plus size={15} aria-hidden="true" />
              {messages.createPage}
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
