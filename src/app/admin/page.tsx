import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets, pageDrafts, pages, users } from "@/db/schema";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listRecentChanges } from "@/modules/activity/service";

export default async function AdminDashboard() {
  const site = await getPrimarySiteWithSettings();
  const siteId = site!.site.id;
  const [stats] = await db
    .select({
      pageCount: sql<number>`(select count(*)::int from ${pages} where site_id = ${siteId})`,
      publishedPageCount: sql<number>`(select count(*)::int from ${pages} where site_id = ${siteId} and status = 'published')`,
      draftCount: sql<number>`(select count(*)::int from ${pageDrafts})`,
      userCount: sql<number>`(select count(*)::int from ${users})`,
      mediaCount: sql<number>`(select count(*)::int from ${mediaAssets} where site_id = ${siteId} and deleted_at is null)`
    })
    .from(sql`(select 1) as stats`);
  const changes = await listRecentChanges({ siteId, limit: 8 });
  return (
    <section>
      <h1>Admin dashboard</h1>
      <div className="grid">
        <div className="card">
          <strong>{stats.pageCount}</strong>
          <br />
          Pages
        </div>
        <div className="card">
          <strong>{stats.publishedPageCount}</strong>
          <br />
          Published
        </div>
        <div className="card">
          <strong>{stats.draftCount}</strong>
          <br />
          Drafts
        </div>
        <div className="card">
          <strong>{stats.userCount}</strong>
          <br />
          Users
        </div>
        <div className="card">
          <strong>{stats.mediaCount}</strong>
          <br />
          Media assets
        </div>
      </div>
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>Recent activity</h2>
        {changes.map((change) => (
          <p key={change.id}>
            {change.action} <span className="muted">{change.createdAt.toLocaleString()}</span>
          </p>
        ))}
      </section>
    </section>
  );
}
