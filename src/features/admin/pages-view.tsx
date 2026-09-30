import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageActions } from "./page-actions";
import type { AdminPageRow, AdminPageStatus, PageMessages } from "./page-types";
import { AdminFilters, AdminPage, AdminTable } from "./structures";

export function AdminPagesView({ rows, query, status, messages }: {
  rows: AdminPageRow[];
  query: string;
  status?: AdminPageStatus;
  messages: PageMessages;
}) {
  const labels = {
    published: messages.statusPublished,
    draft: messages.statusDraft,
    archived: messages.statusArchived,
    deleted: messages.statusDeleted
  };
  const tones = { published: "success", draft: "warning", archived: "info", deleted: "danger" };
  return (
    <AdminPage title={messages.pages}>
      <AdminTable
        title={messages.pages}
        gridClassName="admin-pages-grid"
        columns={[messages.title, messages.slug, messages.status, messages.updatedColumn, messages.actions]}
        empty={rows.length === 0}
        emptyLabel={messages.noResults}
        filters={
          <AdminFilters
            action="/admin/pages"
            query={query}
            queryLabel={messages.filterPages}
            searchLabel={messages.search}
            clearLabel={messages.clearFilters}
            filter={{ name: "status", label: messages.status, value: status ?? "", options: [{ value: "", label: messages.statusAll }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))] }}
          >
            <Link className="button primary" href="/edit/new"><Plus size={15} aria-hidden="true" />{messages.createPage}</Link>
          </AdminFilters>
        }
      >
        {rows.map((page) => (
          <article className="admin-grid-row admin-pages-grid" key={page.id} role="row">
            <div role="cell" data-label={messages.title}><Link href={`/page/${page.slug}`}>{page.title}</Link></div>
            <div className="muted" data-label={messages.slug} role="cell">{page.slug}</div>
            <div className="page-status-stack" data-label={messages.status} role="cell">
              <span className={`badge ${tones[page.status]}`}>{labels[page.status]}</span>
              {page.protected ? <span className="badge info">{messages.pageProtected}</span> : null}
            </div>
            <div className="mono muted" data-label={messages.updatedColumn} role="cell"><time dateTime={page.updated.dateTime}>{page.updated.label}</time></div>
            <AdminPageActions page={page} messages={messages} />
          </article>
        ))}
      </AdminTable>
    </AdminPage>
  );
}
