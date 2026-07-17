import { sql } from "drizzle-orm";
import type { ReactNode } from "react";
import { Activity, FileText, ImageIcon, Layers3, Users } from "lucide-react";
import { db } from "@/db/client";
import { mediaAssets, pageDrafts, pages, users } from "@/db/schema";
import { getPrimarySiteWithSettings } from "@/db/site";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
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
  const [changes, i18n] = await Promise.all([
    listRecentChanges({ siteId, limit: 8 }),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  return (
    <section className="admin-page">
      <h1>{messages.dashboard}</h1>
      <div className="admin-stat-grid">
        <Stat icon={<FileText size={18} />} value={stats.pageCount} label={messages.pages} />
        <Stat
          icon={<Layers3 size={18} />}
          value={stats.publishedPageCount}
          label={messages.published}
        />
        <Stat icon={<Activity size={18} />} value={stats.draftCount} label={messages.drafts} />
        <Stat icon={<Users size={18} />} value={stats.userCount} label={messages.users} />
        <Stat icon={<ImageIcon size={18} />} value={stats.mediaCount} label={messages.media} />
      </div>
      <div className="admin-panels">
        <section className="data-panel activity-card">
          <div className="admin-panel-heading">{messages.recentActivity}</div>
          {changes.length === 0 ? (
            <div className="admin-panel-row muted">{messages.noRecentActivity}</div>
          ) : (
            changes.map((change) => (
              <div className="admin-panel-row" key={change.id}>
                <span className="admin-event-name">
                  {auditActionLabel(change.action, messages)}
                </span>
                <span className="mono muted admin-panel-meta">
                  {change.actorDisplayName ?? messages.system} ·{" "}
                  {change.createdAt.toLocaleString(locale)}
                </span>
              </div>
            ))
          )}
        </section>
        <section className="data-panel admin-status-panel">
          <div className="admin-panel-heading">{messages.operationalStatus}</div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">{messages.database}</span>
            <span className="status-ok">
              <span className="admin-dot" /> {messages.ready}
            </span>
          </div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">{messages.storage}</span>
            <span className="status-ok">
              <span className="admin-dot" /> {messages.configured}
            </span>
          </div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">{messages.migrations}</span>
            <span className="status-ok">
              <span className="admin-dot" /> Drizzle
            </span>
          </div>
          <div className="admin-panel-row admin-status-row">
            <span className="admin-status-label">{messages.application}</span>
            <span className="status-ok">
              <span className="admin-dot" /> v0.1.0
            </span>
          </div>
        </section>
      </div>
    </section>
  );
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
