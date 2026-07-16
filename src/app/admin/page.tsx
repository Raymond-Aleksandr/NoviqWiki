import { sql } from "drizzle-orm";
import type { ReactNode } from "react";
import {
  Activity,
  CheckCircle2,
  Database,
  FileText,
  HardDrive,
  ImageIcon,
  Layers3,
  Server,
  Users
} from "lucide-react";
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
    <section className="admin-page">
      <h1>Admin dashboard</h1>
      <div className="admin-stat-grid">
        <Stat icon={<FileText size={18} />} value={stats.pageCount} label="Pages" />
        <Stat icon={<Layers3 size={18} />} value={stats.publishedPageCount} label="Published" />
        <Stat icon={<Activity size={18} />} value={stats.draftCount} label="Drafts" />
        <Stat icon={<Users size={18} />} value={stats.userCount} label="Users" />
        <Stat icon={<ImageIcon size={18} />} value={stats.mediaCount} label="Media" />
      </div>
      <div className="admin-panels">
        <section className="data-panel activity-card">
          <div className="admin-panel-heading">Recent activity</div>
          {changes.length === 0 ? (
            <div className="admin-panel-row muted">No recent activity.</div>
          ) : (
            changes.map((change) => (
              <div className="admin-panel-row" key={change.id}>
                <span className={`badge audit-action ${badgeForAction(change.action)}`}>
                  <Activity size={13} aria-hidden="true" />
                  {change.action}
                </span>
                <span className="mono muted" style={{ marginLeft: "auto", fontSize: "11px" }}>
                  {change.actorDisplayName ?? "System"} · {change.createdAt.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </section>
        <section className="data-panel admin-status-panel">
          <div className="admin-panel-heading">Operational status</div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">
              <Database size={15} aria-hidden="true" />
              Database
            </span>
            <span className="status-ok">
              <span className="admin-dot" /> Ready
            </span>
          </div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">
              <HardDrive size={15} aria-hidden="true" />
              Storage
            </span>
            <span className="status-ok">
              <span className="admin-dot" /> Configured
            </span>
          </div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">
              <CheckCircle2 size={15} aria-hidden="true" />
              Migrations
            </span>
            <span className="status-ok">
              <span className="admin-dot" /> Drizzle
            </span>
          </div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">
              <Server size={15} aria-hidden="true" />
              Application
            </span>
            <span className="status-ok">
              <span className="admin-dot" /> v0.1.0
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}

function badgeForAction(action: string) {
  if (action.includes("delete") || action.includes("failed") || action.includes("suspend")) {
    return "danger";
  }
  if (action.includes("rollback") || action.includes("draft") || action.includes("reset")) {
    return "warning";
  }
  if (action.includes("create") || action.includes("publish") || action.includes("upload")) {
    return "success";
  }
  return "info";
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="admin-stat-card">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
