import Link from "next/link";
import { Activity, FileText, ImageIcon, Layers3, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Messages } from "@/i18n";
import { AdminPage, AdminPanel } from "./structures";

type DashboardMessages = Pick<Messages,
  | "dashboard" | "pages" | "published" | "drafts" | "users" | "media" | "recentActivity"
  | "noRecentActivity" | "admin" | "settings" | "audit" | "operationalStatus"
>;

export type AdminDashboardStats = {
  pageCount: number;
  publishedPageCount: number;
  draftCount: number;
  userCount: number;
  mediaCount: number;
};

export function AdminDashboardView({ stats, changes, messages }: {
  stats: AdminDashboardStats;
  changes: { id: string; actionLabel: string; actor: string; time: { dateTime: string; label: string } }[];
  messages: DashboardMessages;
}) {
  const cards = [
    { key: "pages", Icon: FileText, value: stats.pageCount, label: messages.pages },
    { key: "published", Icon: Layers3, value: stats.publishedPageCount, label: messages.published },
    { key: "drafts", Icon: Activity, value: stats.draftCount, label: messages.drafts },
    { key: "users", Icon: Users, value: stats.userCount, label: messages.users },
    { key: "media", Icon: ImageIcon, value: stats.mediaCount, label: messages.media }
  ];
  return (
    <AdminPage title={messages.dashboard}>
      <div className="admin-stat-grid">
        {cards.map(({ key, Icon, value, label }) => (
          <div className="admin-stat-card" key={key}>
            <Icon size={18} aria-hidden="true" />
            <strong>{value}</strong><span>{label}</span>
          </div>
        ))}
      </div>
      <div className="admin-panels">
        <AdminPanel title={messages.recentActivity} className="activity-card">
          {changes.length === 0 ? <EmptyState title={messages.noRecentActivity} /> : changes.map((change) => (
            <div className="admin-panel-row" key={change.id}>
              <span className="admin-event-name">{change.actionLabel}</span>
              <span className="mono muted admin-panel-meta">{change.actor} · <time dateTime={change.time.dateTime}>{change.time.label}</time></span>
            </div>
          ))}
        </AdminPanel>
        <AdminPanel title={messages.admin} className="admin-status-panel">
          {[
            { href: "/admin/status", label: messages.operationalStatus },
            { href: "/admin/settings", label: messages.settings },
            { href: "/admin/audit", label: messages.audit }
          ].map((link) => <div className="admin-panel-row" key={link.href}><Link href={link.href}>{link.label}</Link></div>)}
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
