import Link from "next/link";
import { ArrowLeft, Bell, StarOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { Messages } from "@/i18n";
import { ActivityTimeline, DiscoveryFilters, type ActivityTimelineProps } from "./activity";
import type { FilterLink } from "./model";

type WatchlistMessages = Pick<Messages,
  "breadcrumb" | "read" | "watchlist" | "watchlistDescription" | "specialPages"
  | "watchlistFilters" | "watchedPages" | "pagesLower" | "noWatchedPagesYet"
  | "noWatchedPagesBody" | "updated" | "unwatchPage" | "changes" | "page" | "previousPage" | "nextPage"
>;

type Props = {
  timeline: Omit<ActivityTimelineProps, "messages">;
  filters: readonly FilterLink[];
  activeFilter: string;
  watchedPages: readonly { id: string; title: string; slug: string; updated: string }[];
  watchedCount: number;
  unwatchAction: (formData: FormData) => Promise<void>;
  messages: WatchlistMessages;
};

export function WatchlistView({
  timeline, filters, activeFilter, watchedPages, watchedCount, unwatchAction, messages
}: Props) {
  return (
    <section className="page-frame watchlist-page">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{messages.watchlist}</span>
      </nav>
      <PageHeader title={messages.watchlist} description={messages.watchlistDescription}
        actions={<Link className="button" href="/special">
          <ArrowLeft size={16} aria-hidden="true" />{messages.specialPages}
        </Link>} />
      <DiscoveryFilters label={messages.watchlistFilters} active={activeFilter} links={filters} />
      <div className="watchlist-layout">
        <ActivityTimeline {...timeline} messages={messages} />
        <section className="data-panel watched-pages-panel" aria-label={messages.watchedPages}>
          <div className="admin-panel-heading watchlist-heading">
            <span><Bell size={16} aria-hidden="true" />{messages.watchedPages}</span>
            <small>{watchedCount} {messages.pagesLower}</small>
          </div>
          {watchedPages.length === 0 ? (
            <EmptyState title={messages.noWatchedPagesYet} description={messages.noWatchedPagesBody} />
          ) : <div className="watchlist-pages">{watchedPages.map((page) => (
            <article className="watchlist-page-row" key={page.id}>
              <span className="watchlist-page-copy">
                <Link href={`/page/${page.slug}`}><strong>{page.title}</strong></Link>
                <small>{messages.updated} {page.updated}</small>
              </span>
              <form action={unwatchAction} className="inline-form">
                <input type="hidden" name="pageId" value={page.id} />
                <input type="hidden" name="slug" value={page.slug} />
                <input type="hidden" name="intent" value="unwatch" />
                <input type="hidden" name="returnTo" value="/watchlist" />
                <button className="button compact" type="submit" aria-label={`${messages.unwatchPage}: ${page.title}`}>
                  <StarOff size={14} aria-hidden="true" />{messages.unwatchPage}
                </button>
              </form>
            </article>
          ))}</div>}
        </section>
      </div>
    </section>
  );
}
