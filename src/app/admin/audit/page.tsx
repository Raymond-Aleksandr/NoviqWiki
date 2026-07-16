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
            <div className="mono">{log.action}</div>
            <div className="muted">
              {log.targetType}:{log.targetId}
            </div>
            <div className="muted">{log.actorDisplayName ?? "System"}</div>
            <div className="mono muted">{log.createdAt.toLocaleString()}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
