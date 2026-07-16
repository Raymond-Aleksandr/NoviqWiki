import Link from "next/link";
import { ChevronDown, History, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { deletePageAction, restorePageAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listPages } from "@/modules/pages/service";

export default async function AdminPagesPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await listPages({ siteId: site!.site.id, includeDeleted: true, limit: 200 });
  const { locale, messages } = await getRequestI18n(site!.settings?.defaultLocale);
  return (
    <section className="admin-page">
      <h1>{messages.pages}</h1>
      <div className="data-panel admin-table">
        <div className="admin-filter-bar">
          <div className="admin-filter-control">
            <Search size={15} aria-hidden="true" />
            {messages.filterPages}
          </div>
          <div className="admin-filter-control">
            {messages.statusAll}
            <ChevronDown size={14} aria-hidden="true" />
          </div>
          <div style={{ flex: 1 }} />
          <Link className="button primary" href="/edit/new">
            <Plus size={15} aria-hidden="true" />
            {messages.createPage}
          </Link>
        </div>
        <div className="admin-grid-header admin-pages-grid">
          <div>{messages.title}</div>
          <div>{messages.slug}</div>
          <div>{messages.status}</div>
          <div>{messages.updatedColumn}</div>
          <div>{messages.actions}</div>
        </div>
        {rows.map((page) => (
          <article className="admin-grid-row admin-pages-grid" key={page.id}>
            <Link href={`/page/${page.slug}`} data-label={messages.title}>
              {page.title}
            </Link>
            <div className="muted" data-label={messages.slug}>
              {page.slug}
            </div>
            <div data-label={messages.status}>
              <span
                className={`badge ${page.status === "published" ? "success" : page.status === "deleted" ? "danger" : "warning"}`}
              >
                {pageStatusLabel(page.status, messages)}
              </span>
            </div>
            <div className="mono muted" data-label={messages.updatedColumn}>
              {page.updatedAt.toLocaleString(locale)}
            </div>
            <div className="admin-action-list" data-label={messages.actions}>
              <Link className="button compact" href={`/edit/${page.slug}`}>
                <Pencil size={14} aria-hidden="true" />
                {messages.edit}
              </Link>
              <Link className="button compact" href={`/history/${page.slug}`}>
                <History size={14} aria-hidden="true" />
                {messages.revisions}
              </Link>
              {page.status === "deleted" ? (
                <ActionForm
                  action={restorePageAction}
                  className="inline-form"
                  pendingLabel={messages.working}
                >
                  <input type="hidden" name="pageId" value={page.id} />
                  <button>
                    <RotateCcw size={14} aria-hidden="true" />
                    {messages.restore}
                  </button>
                </ActionForm>
              ) : (
                <ConfirmActionForm
                  action={deletePageAction}
                  hiddenFields={[{ name: "pageId", value: page.id }]}
                  triggerLabel={messages.delete}
                  triggerClassName="button compact danger"
                  icon="trash"
                  title={`${messages.delete} · ${page.title}`}
                  body={messages.deletePageConfirmBody}
                  warning={messages.destructiveActionWarning}
                  confirmLabel={messages.delete}
                  cancelLabel={messages.cancel}
                  pendingLabel={messages.working}
                  danger
                />
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function pageStatusLabel(
  status: string,
  messages: Awaited<ReturnType<typeof getRequestI18n>>["messages"]
) {
  if (status === "published") return messages.statusPublished;
  if (status === "draft") return messages.statusDraft;
  if (status === "archived") return messages.statusArchived;
  if (status === "deleted") return messages.statusDeleted;
  return status;
}
