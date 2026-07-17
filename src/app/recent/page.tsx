import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
import {
  actionsForRecentChangeFilter,
  listRecentChanges,
  recentChangeFilterValue,
  type RecentChangeFilter
} from "@/modules/activity/service";

type Props = {
  searchParams: Promise<{ type?: string }>;
};

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
  const [changes, i18n] = await Promise.all([
    listRecentChanges({
      siteId: site.site.id,
      limit: 100,
      publicOnly: true,
      actions: actionsForRecentChangeFilter(activeFilter)
    }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
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
            href={filter === "all" ? "/recent" : `/recent?type=${filter}`}
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
                <strong>
                  {change.targetType}
                  {change.targetId ? `:${change.targetId.slice(0, 8)}` : ""}
                </strong>
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
            {changes.length} {messages.changes}
          </span>
          <span className="timeline-meta">
            <span className="filter-pill active">1</span>
          </span>
        </footer>
      </div>
    </section>
  );
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
