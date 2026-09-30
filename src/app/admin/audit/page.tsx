import { requireAuthenticatedPermission } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { AdminAuditView } from "@/features/admin/audit-view";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
import { auditActionValue, auditActionValues, listAuditLogs } from "@/modules/audit/service";

type Props = { searchParams: Promise<{ action?: string; page?: string; q?: string }> };
const pageSize = 50;

export default async function AdminAuditPage({ searchParams }: Props) {
  const site = await getRequestSite();
  await requireAuthenticatedPermission(site!.site.id, "audit.read");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const action = auditActionValue(params.action);
  const parsedPage = Number(params.page);
  let page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= Math.floor(Number.MAX_SAFE_INTEGER / pageSize) ? parsedPage : 1;
  const [result, { locale, messages }] = await Promise.all([
    listAuditLogs({ siteId: site!.site.id, action, query: query || undefined, limit: pageSize, offset: (page - 1) * pageSize }),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  const totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  // A bookmark can outlive the entries it used to contain; show the last available page.
  let rows = result.rows;
  if (page > totalPages) {
    page = totalPages;
    const lastPage = await listAuditLogs({ siteId: site!.site.id, action, query: query || undefined, limit: pageSize, offset: (page - 1) * pageSize });
    rows = lastPage.rows;
  }
  return (
    <AdminAuditView
      messages={messages}
      query={query}
      action={action}
      count={result.count}
      actionOptions={auditActionValues.map((value) => ({ value, label: auditActionLabel(value, messages) }))}
      rows={rows.map((log) => ({
        id: log.id,
        action: log.action,
        actionLabel: auditActionLabel(log.action, messages),
        target: [log.targetType, log.targetId].filter(Boolean).join(":"),
        actor: log.actorDisplayName ?? messages.system,
        time: { dateTime: log.createdAt.toISOString(), label: log.createdAt.toLocaleString(locale) }
      }))}
      pagination={{ page, totalPages, previousHref: auditHref({ action, query, page: Math.max(1, page - 1) }), nextHref: auditHref({ action, query, page: Math.min(totalPages, page + 1) }) }}
    />
  );
}

function auditHref({ action, page, query }: { action?: string; page: number; query: string }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (action) params.set("action", action);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/admin/audit?${queryString}` : "/admin/audit";
}
