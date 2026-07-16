import { redirect } from "next/navigation";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listRecentChanges } from "@/modules/activity/service";

export default async function RecentChangesPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const changes = await listRecentChanges({ siteId: site.site.id, limit: 100 });
  return (
    <section className="page-frame">
      <header className="page-header stack">
        <h1 className="page-title">Recent changes</h1>
        <p className="page-description">
          Created pages, edits, publications, rollbacks, deletions, restores, and media activity.
        </p>
      </header>
      <div className="filter-pills" aria-label="Recent changes filters">
        <span className="filter-pill active">All</span>
        <span className="filter-pill">created</span>
        <span className="filter-pill">edited</span>
        <span className="filter-pill">published</span>
        <span className="filter-pill">rollback</span>
        <span className="filter-pill">media</span>
      </div>
      <div className="timeline-panel">
        {changes.length === 0 ? (
          <div className="empty-state">
            <strong>No changes yet.</strong>
            <p className="muted">Activity appears here after pages or media are changed.</p>
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
                <span>{change.actorDisplayName ?? "System"}</span>
                <span className="mono">{change.createdAt.toLocaleString()}</span>
              </span>
            </article>
          ))
        )}
        <footer className="timeline-row">
          <span className="muted">{changes.length} changes</span>
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
