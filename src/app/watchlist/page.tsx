import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, ChevronLeft, ChevronRight, StarOff } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { toggleWatchPageAction } from "@/app/actions";
import { getPrimarySiteWithSettings } from "@/db/site";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
import {
  actionsForRecentChangeFilter,
  recentChangeFilterValue,
  type RecentChangeFilter
} from "@/modules/activity/service";
import {
  countWatchedPages,
  listWatchedPages,
  listWatchlistChanges
} from "@/modules/watchlist/service";

type Props = {
  searchParams: Promise<{ page?: string; type?: string }>;
};

const pageSize = 50;

const watchlistFilters: RecentChangeFilter[] = [
  "all",
  "created",
  "edited",
  "published",
  "rollback"
];

export default async function WatchlistPage({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  if (!session) {
    redirect("/login");
  }
  const params = await searchParams;
  const requestedFilter = recentChangeFilterValue(params.type);
  const activeFilter = requestedFilter === "media" ? "all" : requestedFilter;
  const page = Math.max(1, Number(params.page) || 1);
  const [{ rows: changes, count }, watchedPages, watchedCount, i18n] = await Promise.all([
    listWatchlistChanges({
      siteId: site.site.id,
      userId: session.user.id,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      actions: actionsForRecentChangeFilter(activeFilter)
    }),
    listWatchedPages({ siteId: site.site.id, userId: session.user.id, limit: 50 }),
    countWatchedPages({ siteId: site.site.id, userId: session.user.id }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <section className="page-frame watchlist-page">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.watchlist}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.watchlist}</h1>
          <p className="page-description">{messages.watchlistDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/special">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.specialPages}
          </Link>
        </div>
      </header>
      <div className="filter-pills" aria-label={messages.watchlistFilters}>
        {watchlistFilters.map((filter) => (
          <Link
            aria-current={activeFilter === filter ? "page" : undefined}
            className={`filter-pill ${activeFilter === filter ? "active" : ""}`}
            href={watchlistHref({ type: filter })}
            key={filter}
          >
            {filterLabel(filter, messages)}
          </Link>
        ))}
      </div>
      <div className="watchlist-layout">
        <section className="timeline-panel" aria-label={messages.watchlistActivity}>
          {changes.length === 0 ? (
            <div className="empty-state">
              <strong>{messages.noWatchlistChangesYet}</strong>
              <p className="muted">{messages.watchlistActivityHint}</p>
            </div>
          ) : (
            changes.map((change) => (
              <article className="timeline-row" key={change.id}>
                <span className={`badge timeline-action ${badgeForAction(change.action)}`}>
                  {auditActionLabel(change.action, messages)}
                </span>
                <span className="timeline-title">
                  {change.targetHref ? (
                    <Link href={change.targetHref}>
                      <strong>{change.targetLabel}</strong>
                    </Link>
                  ) : (
                    <strong>{change.targetLabel}</strong>
                  )}
                </span>
                <span className="timeline-meta">
                  <span>{change.actorDisplayName ?? messages.system}</span>
                  <span className="mono">{change.createdAt.toLocaleString(locale)}</span>
                </span>
              </article>
            ))
          )}
          <footer className="timeline-row timeline-footer">
            <span className="muted">
              {count} {messages.changes}
            </span>
            <nav className="timeline-pagination" aria-label={messages.watchlistPagination}>
              <Link
                aria-disabled={page <= 1}
                className={`button compact ${page <= 1 ? "disabled-link" : ""}`}
                href={
                  page <= 1
                    ? watchlistHref({ type: activeFilter, page })
                    : watchlistHref({ type: activeFilter, page: page - 1 })
                }
              >
                <ChevronLeft size={14} aria-hidden="true" />
                {messages.previousPage}
              </Link>
              <span className="filter-pill active">
                {messages.page} {page} / {totalPages}
              </span>
              <Link
                aria-disabled={page >= totalPages}
                className={`button compact ${page >= totalPages ? "disabled-link" : ""}`}
                href={
                  page >= totalPages
                    ? watchlistHref({ type: activeFilter, page })
                    : watchlistHref({ type: activeFilter, page: page + 1 })
                }
              >
                {messages.nextPage}
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </nav>
          </footer>
        </section>
        <section className="data-panel watched-pages-panel" aria-label={messages.watchedPages}>
          <div className="admin-panel-heading watchlist-heading">
            <span>
              <Bell size={16} aria-hidden="true" />
              {messages.watchedPages}
            </span>
            <small>
              {watchedCount} {messages.pagesLower}
            </small>
          </div>
          {watchedPages.length === 0 ? (
            <div className="empty-state">
              <strong>{messages.noWatchedPagesYet}</strong>
              <p className="muted">{messages.noWatchedPagesBody}</p>
            </div>
          ) : (
            <div className="watchlist-pages">
              {watchedPages.map((watchedPage) => (
                <article className="watchlist-page-row" key={watchedPage.id}>
                  <span className="watchlist-page-copy">
                    <Link href={`/page/${watchedPage.slug}`}>
                      <strong>{watchedPage.title}</strong>
                    </Link>
                    <small>
                      {messages.updated} {watchedPage.updatedAt.toLocaleString(locale)}
                    </small>
                  </span>
                  <form action={toggleWatchPageAction} className="inline-form">
                    <input type="hidden" name="pageId" value={watchedPage.id} />
                    <input type="hidden" name="slug" value={watchedPage.slug} />
                    <input type="hidden" name="intent" value="unwatch" />
                    <input type="hidden" name="returnTo" value="/watchlist" />
                    <button className="button compact" type="submit">
                      <StarOff size={14} aria-hidden="true" />
                      {messages.unwatchPage}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function watchlistHref({ page, type }: { page?: number; type: RecentChangeFilter }) {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/watchlist?${query}` : "/watchlist";
}

function filterLabel(
  filter: RecentChangeFilter,
  messages: Awaited<ReturnType<typeof getRequestI18n>>["messages"]
) {
  switch (filter) {
    case "created":
      return messages.created;
    case "edited":
      return messages.edited;
    case "published":
      return messages.publishedLower;
    case "rollback":
      return messages.rollbackLower;
    case "media":
      return messages.mediaLower;
    case "all":
    default:
      return messages.all;
  }
}

function badgeForAction(action: string) {
  if (action.includes("deleted") || action.includes("failed")) return "danger";
  if (action.includes("rollback") || action.includes("draft")) return "warning";
  if (action.includes("published") || action.includes("created") || action.includes("uploaded")) {
    return "success";
  }
  return "info";
}
