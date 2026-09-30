import Link from "next/link";
import { ChevronRight, Clock3, Plus, Puzzle, Search, Tags } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Messages } from "@/i18n";
import type { HomepageContribution } from "@/modules/plugins/registry";
import type { NormalizedHomepageSections } from "@/modules/settings/homepage";
import { ActivityRow } from "./activity";
import type { ActivityItem, ArticleSummary, CategorySummary } from "./model";

type HomeMessages = Pick<Messages,
  | "selfHostedKnowledgeBase" | "search" | "createPage" | "featuredPages" | "browseAll"
  | "noPublishedPagesYet" | "createFirstArticle" | "article" | "openLatestRevision"
  | "recentlyUpdated" | "noRecentActivity" | "activityAppears" | "featuredCategories"
  | "pagesLower" | "pluginExtensions" | "noCategoriesYet" | "categoryDeclarationHint"
>;

type FeaturedArticle = ArticleSummary & { cover?: { src: string; alt: string } };

type Props = {
  title: string;
  logoUrl?: string | null;
  intro?: string | null;
  sections: Pick<NormalizedHomepageSections, "layout" | "showLogo" | "search" | "featured" | "recent" | "categories">;
  featuredPages: readonly FeaturedArticle[];
  categories: readonly CategorySummary[];
  activity: readonly ActivityItem[];
  contributions: readonly HomepageContribution[];
  messages: HomeMessages;
};

export function HomeView({
  title, logoUrl, intro, sections, featuredPages, categories, activity, contributions, messages
}: Props) {
  const panelCount = [sections.recent, sections.categories, contributions.length > 0]
    .filter(Boolean).length;
  const createAction = <Link className="button primary" href="/edit/new">
    <Plus size={15} aria-hidden="true" />{messages.createPage}
  </Link>;

  return (
    <section className={`home-page wiki-home home-layout-${sections.layout}`}>
      <div className="home-hero">
        <div className="home-hero-media" aria-hidden="true" />
        <div className="home-hero-content">
          {sections.showLogo && logoUrl ? <img className="home-logo" src={logoUrl} alt="" /> : null}
          <p className="eyebrow">{messages.selfHostedKnowledgeBase}</p>
          <h1>{title}</h1>
          {intro ? <p>{intro}</p> : null}
          {sections.search ? (
            <div className="home-actions">
              <Link className="button primary home-action" href="/search">
                <Search size={16} aria-hidden="true" />{messages.search}
              </Link>
              <Link className="button secondary home-action" href="/edit/new">
                <Plus size={16} aria-hidden="true" />{messages.createPage}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
      {sections.featured ? (
        <>
          <div className="section-heading">
            <h2>{messages.featuredPages}</h2>
            <Link className="section-action" href="/categories">
              {messages.browseAll}<ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="featured-grid">
            {featuredPages.length === 0 ? (
              <EmptyState title={messages.noPublishedPagesYet}
                description={messages.createFirstArticle} action={createAction} />
            ) : featuredPages.map((page) => (
              <Link className="feature-card" key={page.id} href={`/page/${page.slug}`}>
                {page.cover ? (
                  <span className="feature-card-media">
                    <img src={page.cover.src} alt={page.cover.alt || page.title} loading="lazy" />
                  </span>
                ) : null}
                <span className="feature-card-body">
                  <span className="badge info">{messages.article}</span>
                  <strong>{page.title}</strong>
                  <span className="muted">{messages.openLatestRevision}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
      {panelCount > 0 ? (
        <div className={`home-panels ${panelCount === 1 ? "single" : ""}`}>
          {sections.recent ? (
            <section className="panel flush">
              <header className="panel-header"><h2>
                <Clock3 size={17} aria-hidden="true" />{messages.recentlyUpdated}
              </h2></header>
              <div className="activity-list">
                {activity.length === 0 ? (
                  <EmptyState title={messages.noRecentActivity} description={messages.activityAppears} />
                ) : activity.map((item) => <ActivityRow key={item.id} item={item} compact />)}
              </div>
            </section>
          ) : null}
          {sections.categories ? (
            <section className="panel flush">
              <header className="panel-header"><h2>
                <Tags size={17} aria-hidden="true" />{messages.featuredCategories}
              </h2></header>
              <div className="category-list">
                {categories.length === 0 ? (
                  <EmptyState title={messages.noCategoriesYet} description={messages.categoryDeclarationHint} />
                ) : categories.map((category) => (
                  <Link key={category.id} href={`/categories/${category.slug}`}>
                    <span className="category-swatch" aria-hidden="true" />
                    <span><strong>{category.name}</strong>
                      <small>{category.pageCount} {messages.pagesLower}</small>
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {contributions.length > 0 ? (
            <section className="panel flush">
              <header className="panel-header"><h2>
                <Puzzle size={17} aria-hidden="true" />{messages.pluginExtensions}
              </h2></header>
              <div className="category-list">
                {contributions.map((contribution) => (
                  <Link key={contribution.id} href={contribution.href ?? "/"}>
                    <span className="category-swatch" aria-hidden="true" />
                    <span><strong>{contribution.title}</strong>
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
