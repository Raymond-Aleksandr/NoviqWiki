import { redirect } from "next/navigation";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listRecentChanges } from "@/modules/activity/service";

export default async function RecentChangesPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const [changes, i18n] = await Promise.all([
    listRecentChanges({ siteId: site.site.id, limit: 100 }),
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
        <span className="filter-pill active">{messages.all}</span>
        <span className="filter-pill">{messages.created}</span>
        <span className="filter-pill">{messages.edited}</span>
        <span className="filter-pill">{messages.publishedLower}</span>
        <span className="filter-pill">{messages.rollbackLower}</span>
        <span className="filter-pill">{messages.mediaLower}</span>
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
                {shortAction(change.action)}
              </span>
              <span className="timeline-title">
                <strong>
                  {change.targetType}
                  {change.targetId ? `:${change.targetId.slice(0, 8)}` : ""}
                </strong>
                <span className="mono muted">{change.action}</span>
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

function shortAction(action: string) {
  const short = action.split(".").at(-1) ?? action;
  return short.length > 10 ? short.slice(0, 10) : short;
}

function badgeForAction(action: string) {
  if (action.includes("deleted") || action.includes("failed")) return "danger";
  if (action.includes("rollback") || action.includes("draft")) return "warning";
  if (action.includes("published") || action.includes("created") || action.includes("uploaded")) {
    return "success";
  }
  return "info";
}
