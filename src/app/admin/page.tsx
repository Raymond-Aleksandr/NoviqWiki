import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets, pageDrafts, pages, users } from "@/db/schema";
import { getRequestSite } from "@/lib/request-context";
import { AdminDashboardView } from "@/features/admin/dashboard-view";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
import { listRecentChanges } from "@/modules/activity/service";

export default async function AdminDashboard() {
  const site = await getRequestSite();
  const siteId = site!.site.id;
  const [stats] = await db
    .select({
      pageCount: sql<number>`(select count(*)::int from ${pages} where site_id = ${siteId})`,
      publishedPageCount: sql<number>`(select count(*)::int from ${pages} where site_id = ${siteId} and status = 'published')`,
      draftCount: sql<number>`(select count(*)::int from ${pageDrafts} as drafts join ${pages} as draft_page on drafts.page_id = draft_page.id where draft_page.site_id = ${siteId})`,
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
    <AdminDashboardView
      stats={stats}
      messages={messages}
      changes={changes.map((change) => ({
        id: change.id,
        actionLabel: auditActionLabel(change.action, messages),
        actor: change.actorDisplayName ?? messages.system,
        time: { dateTime: change.createdAt.toISOString(), label: change.createdAt.toLocaleString(locale) }
      }))}
    />
  );
}
