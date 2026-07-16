import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listAuditLogs } from "@/modules/audit/service";

export default async function AdminAuditPage() {
  const site = await getPrimarySiteWithSettings();
  const [logs, i18n] = await Promise.all([
    listAuditLogs({ siteId: site!.site.id, limit: 100 }),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  return (
    <section className="admin-page">
      <h1>{messages.audit}</h1>
      <div className="data-panel admin-table">
        <div className="admin-grid-header admin-audit-grid">
          <div>{messages.auditEvent}</div>
          <div>{messages.target}</div>
          <div>{messages.actor}</div>
          <div>{messages.time}</div>
        </div>
        {logs.rows.map((log) => (
          <article className="admin-grid-row admin-audit-grid" key={log.id}>
            <div className="mono audit-action" data-label={messages.auditEvent}>
              {log.action}
            </div>
            <div className="muted" data-label={messages.target}>
              {log.targetType}:{log.targetId}
            </div>
            <div className="muted" data-label={messages.actor}>
              {log.actorDisplayName ?? messages.system}
            </div>
            <div className="mono muted" data-label={messages.time}>
              {log.createdAt.toLocaleString(locale)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
