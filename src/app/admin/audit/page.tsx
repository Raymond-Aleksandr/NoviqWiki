import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { getPrimarySiteWithSettings } from "@/db/site";
import { auditActionLabel } from "@/i18n/audit-actions";
import { getRequestI18n } from "@/i18n/server";
import { auditActionValue, auditActionValues, listAuditLogs } from "@/modules/audit/service";

type Props = {
  searchParams: Promise<{ action?: string; page?: string; q?: string }>;
};

const pageSize = 50;

export default async function AdminAuditPage({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const action = auditActionValue(params.action);
  const page = Math.max(1, Number(params.page) || 1);
  const [logs, i18n] = await Promise.all([
    listAuditLogs({
      siteId: site!.site.id,
      action,
      query: query || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize
    }),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  const totalPages = Math.max(1, Math.ceil(logs.count / pageSize));
  const hasFilters = Boolean(query || action);
  return (
    <section className="admin-page">
      <h1>{messages.audit}</h1>
      <div className="data-panel admin-table">
        <form className="admin-filter-bar" action="/admin/audit">
          <label className="admin-filter-control admin-filter-search">
            <Search size={15} aria-hidden="true" />
            <input name="q" defaultValue={query} placeholder={messages.filterAuditLogs} />
          </label>
          <label className="admin-filter-control admin-filter-select">
            <span className="sr-only">{messages.auditEvent}</span>
            <select name="action" defaultValue={action ?? ""}>
              <option value="">{messages.actionAll}</option>
              {auditActionValues.map((value) => (
                <option key={value} value={value}>
                  {auditActionLabel(value, messages)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <button className="button compact">
            <Search size={14} aria-hidden="true" />
            {messages.search}
          </button>
          {hasFilters ? (
            <Link className="button compact" href="/admin/audit">
              <X size={14} aria-hidden="true" />
              {messages.clearFilters}
            </Link>
          ) : null}
          <div className="admin-filter-spacer" />
        </form>
        <div className="admin-grid-header admin-audit-grid">
          <div>{messages.auditEvent}</div>
          <div>{messages.target}</div>
          <div>{messages.actor}</div>
          <div>{messages.time}</div>
        </div>
        {logs.rows.length === 0 ? (
          <div className="admin-empty-state">{messages.noResults}</div>
        ) : null}
        {logs.rows.map((log) => (
          <article className="admin-grid-row admin-audit-grid" key={log.id}>
            <div className="audit-action" data-label={messages.auditEvent} title={log.action}>
              {auditActionLabel(log.action, messages)}
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
        <footer className="admin-pagination">
          <span className="muted">
            {logs.count} {messages.auditEntries}
          </span>
          <div className="admin-pagination-actions">
            <Link
              aria-disabled={page <= 1}
              className={`button compact ${page <= 1 ? "disabled-link" : ""}`}
              href={
                page <= 1
                  ? auditHref({ action, query, page })
                  : auditHref({ action, query, page: page - 1 })
              }
            >
              <ChevronLeft size={14} aria-hidden="true" />
              {messages.previousPage}
            </Link>
            <span className="filter-pill active">
              {messages.page} {page} / {totalPages}
            </span>
            <Link
              aria-disabled={page >= totalPages}
              className={`button compact ${page >= totalPages ? "disabled-link" : ""}`}
              href={
                page >= totalPages
                  ? auditHref({ action, query, page })
                  : auditHref({ action, query, page: page + 1 })
              }
            >
              {messages.nextPage}
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </footer>
      </div>
    </section>
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
