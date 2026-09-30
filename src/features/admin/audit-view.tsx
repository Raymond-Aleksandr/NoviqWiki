import { Pagination } from "@/components/ui/pagination";
import type { Messages } from "@/i18n";
import { AdminFilters, AdminPage, AdminTable, type AdminOption } from "./structures";

type AuditMessages = Pick<Messages,
  | "audit" | "filterAuditLogs" | "auditEvent" | "actionAll" | "search" | "clearFilters"
  | "target" | "actor" | "time" | "noResults" | "auditEntries" | "page" | "previousPage" | "nextPage"
>;

export type AdminAuditRow = {
  id: string;
  action: string;
  actionLabel: string;
  target: string;
  actor: string;
  time: { dateTime: string; label: string };
};

export function AdminAuditView({ rows, count, query, action, actionOptions, pagination, messages }: {
  rows: AdminAuditRow[];
  count: number;
  query: string;
  action?: string;
  actionOptions: AdminOption[];
  pagination: { page: number; totalPages: number; previousHref: string; nextHref: string };
  messages: AuditMessages;
}) {
  return (
    <AdminPage title={messages.audit}>
      <AdminTable
        title={messages.audit}
        gridClassName="admin-audit-grid"
        columns={[messages.auditEvent, messages.target, messages.actor, messages.time]}
        empty={rows.length === 0}
        emptyLabel={messages.noResults}
        filters={<AdminFilters action="/admin/audit" query={query} queryLabel={messages.filterAuditLogs} searchLabel={messages.search} clearLabel={messages.clearFilters} filter={{ name: "action", label: messages.auditEvent, value: action ?? "", options: [{ value: "", label: messages.actionAll }, ...actionOptions] }} />}
        footer={
          <footer className="admin-pagination">
            <span className="muted">{count} {messages.auditEntries}</span>
            <Pagination {...pagination} messages={messages} />
          </footer>
        }
      >
        {rows.map((log) => (
          <article className="admin-grid-row admin-audit-grid" key={log.id} role="row">
            <div className="audit-action" data-label={messages.auditEvent} title={log.action} role="cell">{log.actionLabel}</div>
            <div className="muted" data-label={messages.target} role="cell">{log.target}</div>
            <div className="muted" data-label={messages.actor} role="cell">{log.actor}</div>
            <div className="mono muted" data-label={messages.time} role="cell"><time dateTime={log.time.dateTime}>{log.time.label}</time></div>
          </article>
        ))}
      </AdminTable>
    </AdminPage>
  );
}
