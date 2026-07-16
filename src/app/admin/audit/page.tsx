import { Box, Clock3, ShieldCheck, UserRound } from "lucide-react";
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
            <div data-label="Event">
              <span className={`badge audit-action ${badgeForAudit(log.action)}`}>
                <ShieldCheck size={13} aria-hidden="true" />
                {log.action}
              </span>
            </div>
            <div className="muted audit-cell" data-label="Target">
              <Box size={14} aria-hidden="true" />
              {log.targetType}:{log.targetId}
            </div>
            <div className="muted audit-cell" data-label="Actor">
              <UserRound size={14} aria-hidden="true" />
              {log.actorDisplayName ?? "System"}
            </div>
            <div className="mono muted audit-cell" data-label="Time">
              <Clock3 size={14} aria-hidden="true" />
              {log.createdAt.toLocaleString()}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function badgeForAudit(action: string) {
  if (action.includes("delete") || action.includes("failed") || action.includes("suspend")) {
    return "danger";
  }
  if (action.includes("rollback") || action.includes("reset")) {
    return "warning";
  }
  if (action.includes("create") || action.includes("publish") || action.includes("upload")) {
    return "success";
  }
  return "info";
}
