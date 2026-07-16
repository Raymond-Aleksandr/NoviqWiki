import { getPrimarySiteWithSettings } from "@/db/site";
import { listAuditLogs } from "@/modules/audit/service";

export default async function AdminAuditPage() {
  const site = await getPrimarySiteWithSettings();
  const logs = await listAuditLogs({ siteId: site!.site.id, limit: 100 });
  return (
    <section className="panel">
      <h1>Audit log</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {logs.rows.map((log) => (
            <tr key={log.id}>
              <td>{log.createdAt.toLocaleString()}</td>
              <td>{log.actorDisplayName ?? "System"}</td>
              <td>{log.action}</td>
              <td>
                {log.targetType}:{log.targetId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
