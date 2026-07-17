import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
import {
  actionsForRecentChangeFilter,
  listRecentChangesPage,
  recentChangeFilterValue,
  type RecentChangeFilter
} from "@/modules/activity/service";

type Props = {
  searchParams: Promise<{ page?: string; type?: string }>;
};

const pageSize = 50;

const recentChangeFilters: RecentChangeFilter[] = [
  "all",
  "created",
  "edited",
  "published",
  "rollback",
  "media"
];

export default async function RecentChangesPage({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const activeFilter = recentChangeFilterValue(params.type);
  const page = Math.max(1, Number(params.page) || 1);
  const [{ rows: changes, count }, i18n] = await Promise.all([
    listRecentChangesPage({
      siteId: site.site.id,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      publicOnly: true,
      actions: actionsForRecentChangeFilter(activeFilter)
    }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <section className="page-frame">
      <header className="page-header stack">
        <h1 className="page-title">{messages.recentChanges}</h1>
        <p className="page-description">{messages.recentChangesDescription}</p>
      </header>
      <div className="filter-pills" aria-label={messages.recentChangesFilters}>
        {recentChangeFilters.map((filter) => (
          <Link
            aria-current={activeFilter === filter ? "page" : undefined}
            className={`filter-pill ${activeFilter === filter ? "active" : ""}`}
            href={recentHref({ type: filter })}
            key={filter}
          >
            {filterLabel(filter, messages)}
          </Link>
        ))}
      </div>
      <div className="timeline-panel">
        {changes.length === 0 ? (
          <div className="empty-state">
            <strong>{messages.noChangesYet}</strong>
            <p className="muted">{messages.activityAppears}</p>
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
                <span className="muted">{auditActionLabel(change.action, messages)}</span>
              </span>
              <span className="timeline-meta">
                <span>{change.actorDisplayName ?? messages.system}</span>
                <span className="mono">{change.createdAt.toLocaleString(locale)}</span>
              </span>
            </article>
          ))
        )}
        <footer className="timeline-row">
          <span className="muted">
            {count} {messages.changes}
          </span>
          <nav className="timeline-pagination" aria-label={messages.recentChangesPagination}>
            <Link
              aria-disabled={page <= 1}
              className={`button compact ${page <= 1 ? "disabled-link" : ""}`}
              href={
                page <= 1
                  ? recentHref({ type: activeFilter, page })
                  : recentHref({ type: activeFilter, page: page - 1 })
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
                  ? recentHref({ type: activeFilter, page })
                  : recentHref({ type: activeFilter, page: page + 1 })
              }
            >
              {messages.nextPage}
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </footer>
      </div>
    </section>
  );
}

function recentHref({ page, type }: { page?: number; type: RecentChangeFilter }) {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/recent?${query}` : "/recent";
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
