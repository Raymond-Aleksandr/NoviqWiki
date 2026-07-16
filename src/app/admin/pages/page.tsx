import Link from "next/link";
import { MoreVertical, Plus, Search } from "lucide-react";
import { deletePageAction, restorePageAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listPages } from "@/modules/pages/service";

export default async function AdminPagesPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await listPages({ siteId: site!.site.id, includeDeleted: true, limit: 200 });
  return (
    <section className="admin-page">
      <h1>Pages</h1>
      <div className="data-panel admin-table">
        <div className="admin-filter-bar">
          <div className="admin-filter-control">
            <Search size={15} aria-hidden="true" />
            Filter pages...
          </div>
          <div className="admin-filter-control">Status: All</div>
          <div style={{ flex: 1 }} />
          <Link className="button primary" href="/edit/new">
            <Plus size={15} aria-hidden="true" />
            Create page
          </Link>
        </div>
        <div className="admin-grid-header admin-pages-grid">
          <div>Title</div>
          <div>Slug</div>
          <div>Status</div>
          <div>Updated</div>
          <div>Actions</div>
        </div>
        {rows.map((page) => (
          <article className="admin-grid-row admin-pages-grid" key={page.id}>
            <Link href={`/page/${page.slug}`}>{page.title}</Link>
            <div className="muted">{page.slug}</div>
            <div>
              <span
                className={`badge ${page.status === "published" ? "success" : page.status === "deleted" ? "danger" : "warning"}`}
              >
                {page.status}
              </span>
            </div>
            <div className="mono muted">{page.updatedAt.toLocaleString()}</div>
            <div className="admin-action-list">
              <Link href={`/edit/${page.slug}`}>Edit</Link>
              <Link href={`/history/${page.slug}`}>Revisions</Link>
              {page.status === "deleted" ? (
                <ActionForm action={restorePageAction} className="inline-form">
                  <input type="hidden" name="pageId" value={page.id} />
                  <button>Restore</button>
                </ActionForm>
              ) : (
                <ActionForm action={deletePageAction} className="inline-form">
                  <input type="hidden" name="pageId" value={page.id} />
                  <button className="danger">Delete</button>
                </ActionForm>
              )}
              <MoreVertical size={18} aria-hidden="true" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
