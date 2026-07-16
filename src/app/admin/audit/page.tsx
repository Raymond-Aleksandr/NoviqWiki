import { getPrimarySiteWithSettings } from "@/db/site";
import { listAuditLogs } from "@/modules/audit/service";

export default async function AdminAuditPage() {
  const site = await getPrimarySiteWithSettings();
  const logs = await listAuditLogs({ siteId: site!.site.id, limit: 100 });
  return (
    <section className="admin-page">
      <h1>Audit log</h1>
      <div className="data-panel admin-table">
        <div className="admin-grid-header admin-audit-grid">
          <div>Event</div>
          <div>Target</div>
          <div>Actor</div>
          <div>Time</div>
        </div>
        {logs.rows.map((log) => (
          <article className="admin-grid-row admin-audit-grid" key={log.id}>
            <div className="mono audit-action" data-label="Event">
              {log.action}
            </div>
            <div className="muted" data-label="Target">
              {log.targetType}:{log.targetId}
            </div>
            <div className="muted" data-label="Actor">
              {log.actorDisplayName ?? "System"}
            </div>
            <div className="mono muted" data-label="Time">
              {log.createdAt.toLocaleString()}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
