import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight, Clock3, Plus, Puzzle, Search, Tags } from "lucide-react";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listCategories } from "@/modules/categories/service";
import { listPages, listPagesBySlugs } from "@/modules/pages/service";
import { listRecentChanges } from "@/modules/activity/service";
import { collectHomepageContributions } from "@/modules/plugins/registry";
import { normalizeHomepageSections, prioritizeCategories } from "@/modules/settings/homepage";

export default async function HomePage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const settings = site.settings;
  const homepageSections = normalizeHomepageSections(settings?.homepageSections);
  const [recentPages, configuredPages, categories, changes] = await Promise.all([
    listPages({ siteId: site.site.id, status: "published", limit: 6 }),
    listPagesBySlugs({
      siteId: site.site.id,
      slugs: settings?.homepageFeaturedPages ?? [],
      limit: 6
    }),
    listCategories(site.site.id),
    listRecentChanges({ siteId: site.site.id, limit: 8 })
  ]);
  const { locale, messages } = await getRequestI18n(settings?.defaultLocale);
  const featuredPages = configuredPages.length > 0 ? configuredPages : recentPages.slice(0, 3);
  const featuredCategories = prioritizeCategories(
    categories,
    settings?.homepageFeaturedCategories ?? []
  ).slice(0, 8);
  const pluginContributions = collectHomepageContributions({ siteId: site.site.id, locale });
  const showPanels =
    homepageSections.recent || homepageSections.categories || pluginContributions.length > 0;

  return (
    <section className={`home-page wiki-home home-layout-${homepageSections.layout}`}>
      <div className="home-hero">
        <div className="home-hero-media" aria-hidden="true" />
        <div className="home-hero-content">
          {settings?.logoUrl && homepageSections.showLogo ? (
            <img className="home-logo" src={settings.logoUrl} alt="" />
          ) : (
            <span className="home-logo home-logo-fallback" aria-hidden="true">
              <BookOpen size={28} />
            </span>
          )}
          <p className="eyebrow">{messages.selfHostedKnowledgeBase}</p>
          <h1>{settings?.homepageTitle ?? site.site.name}</h1>
          <p>{settings?.homepageIntro ?? settings?.tagline}</p>
          {homepageSections.search ? (
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
          ) : null}
        </div>
      </div>

      {homepageSections.featured ? (
        <>
          <div className="section-heading">
            <h2>{messages.featuredPages}</h2>
            <Link className="section-action" href="/categories">
              {messages.browseAll}
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="featured-grid">
            {featuredPages.length === 0 ? (
              <section className="empty-state">
                <h3>{messages.noPublishedPagesYet}</h3>
                <p>{messages.createFirstArticle}</p>
                <Link className="button primary" href="/edit/new">
                  <Plus size={15} aria-hidden="true" />
                  {messages.createPage}
                </Link>
              </section>
            ) : (
              featuredPages.slice(0, 3).map((page) => (
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
        </>
      ) : null}

      {showPanels ? (
        <div
          className={`home-panels ${
            [
              homepageSections.recent,
              homepageSections.categories,
              pluginContributions.length > 0
            ].filter(Boolean).length === 1
              ? "single"
              : ""
          }`}
        >
          {homepageSections.recent ? (
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
          ) : null}
          {homepageSections.categories ? (
            <section className="panel flush">
              <header className="panel-header">
                <h2>
                  <Tags size={17} aria-hidden="true" />
                  {messages.featuredCategories}
                </h2>
              </header>
              <div className="category-list">
                {featuredCategories.map((category) => (
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
            </section>
          ) : null}
          {pluginContributions.length > 0 ? (
            <section className="panel flush">
              <header className="panel-header">
                <h2>
                  <Puzzle size={17} aria-hidden="true" />
                  {messages.pluginExtensions}
                </h2>
              </header>
              <div className="category-list">
                {pluginContributions.map((contribution) => (
                  <Link key={contribution.id} href={contribution.href ?? "/"}>
                    <span className="category-swatch" aria-hidden="true" />
                    <span>
                      <strong>{contribution.title}</strong>
                      {contribution.description ? <small>{contribution.description}</small> : null}
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
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
