import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import type { Messages } from "@/i18n";
import type { ActivityItem, FilterLink } from "./model";
import type { PaginationNavigation } from "./query";

export function DiscoveryFilters({
  label, active, links
}: { label: string; active: string | number; links: readonly FilterLink[] }) {
  return (
    <nav className="filter-pills" aria-label={label}>
      {links.map((link) => (
        <Link
          key={link.value}
          className={`filter-pill ${String(active) === link.value ? "active" : ""}`}
          aria-current={String(active) === link.value ? "page" : undefined}
          href={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function ActivityRow({ item, compact = false }: { item: ActivityItem; compact?: boolean }) {
  return (
    <article className={compact ? "activity-row" : "timeline-row"}>
      <span className={`badge ${compact ? "audit-action" : "timeline-action"} ${item.tone}`}>
        {item.actionLabel}
      </span>
      <span className={compact ? "activity-main" : "timeline-title"}>
        {item.targetHref ? (
          <Link href={item.targetHref}><strong>{item.targetLabel}</strong></Link>
        ) : <strong>{item.targetLabel}</strong>}
      </span>
      <span className={compact ? "activity-meta" : "timeline-meta"}>
        <span>{item.actorLabel}</span>
        <time className="mono" dateTime={item.dateTime}>{item.timestamp}</time>
      </span>
    </article>
  );
}

export type ActivityTimelineProps = {
  items: readonly ActivityItem[];
  count: number;
  emptyTitle: string;
  emptyDescription: string;
  label: string;
  pagination: PaginationNavigation;
  messages: Pick<Messages, "changes" | "page" | "previousPage" | "nextPage">;
};

export function ActivityTimeline({
  items, count, emptyTitle, emptyDescription, label, pagination, messages
}: ActivityTimelineProps) {
  return (
    <section className="timeline-panel" aria-label={label}>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : items.map((item) => <ActivityRow key={item.id} item={item} />)}
      <footer className="timeline-row timeline-footer">
        <span className="muted">{count} {messages.changes}</span>
        <Pagination {...pagination} messages={messages} />
      </footer>
    </section>
  );
}
