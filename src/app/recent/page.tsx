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
    <section className="panel">
      <h1>Recent changes</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Actor</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.id}>
              <td>{change.createdAt.toLocaleString()}</td>
              <td>{change.action}</td>
              <td>{change.actorDisplayName ?? "System"}</td>
              <td>{change.targetType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
