import Link from "next/link";
import { ChevronDown, History, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import {
  archivePageAction,
  deletePageAction,
  renamePageAction,
  restorePageAction,
  setPageProtectionAction
} from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listPages } from "@/modules/pages/service";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

type PageStatusFilter = "draft" | "published" | "archived" | "deleted";

export default async function AdminPagesPage({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = pageStatusFilterValue(params.status);
  const rows = await listPages({
    siteId: site!.site.id,
    includeDeleted: true,
    query: query || undefined,
    status,
    limit: 200
  });
  const { locale, messages } = await getRequestI18n(site!.settings?.defaultLocale);
  const hasFilters = Boolean(query || status);
  return (
    <section className="admin-page">
      <h1>{messages.pages}</h1>
      <div className="data-panel admin-table">
        <form className="admin-filter-bar" action="/admin/pages">
          <label className="admin-filter-control admin-filter-search">
            <Search size={15} aria-hidden="true" />
            <input name="q" defaultValue={query} placeholder={messages.filterPages} />
          </label>
          <label className="admin-filter-control admin-filter-select">
            <span className="sr-only">{messages.status}</span>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">{messages.statusAll}</option>
              <option value="published">{messages.statusPublished}</option>
              <option value="draft">{messages.statusDraft}</option>
              <option value="archived">{messages.statusArchived}</option>
              <option value="deleted">{messages.statusDeleted}</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <button className="button compact">
            <Search size={14} aria-hidden="true" />
            {messages.search}
          </button>
          {hasFilters ? (
            <Link className="button compact" href="/admin/pages">
              <X size={14} aria-hidden="true" />
              {messages.clearFilters}
            </Link>
          ) : null}
          <div className="admin-filter-spacer" />
          <Link className="button primary" href="/edit/new">
            <Plus size={15} aria-hidden="true" />
            {messages.createPage}
          </Link>
        </form>
        <div className="admin-grid-header admin-pages-grid">
          <div>{messages.title}</div>
          <div>{messages.slug}</div>
          <div>{messages.status}</div>
          <div>{messages.updatedColumn}</div>
          <div>{messages.actions}</div>
        </div>
        {rows.length === 0 ? <div className="admin-empty-state">{messages.noResults}</div> : null}
        {rows.map((page) => (
          <article className="admin-grid-row admin-pages-grid" key={page.id}>
            <Link href={`/page/${page.slug}`} data-label={messages.title}>
              {page.title}
            </Link>
            <div className="muted" data-label={messages.slug}>
              {page.slug}
            </div>
            <div className="page-status-stack" data-label={messages.status}>
              <span
                className={`badge ${page.status === "published" ? "success" : page.status === "deleted" ? "danger" : page.status === "archived" ? "info" : "warning"}`}
              >
                {pageStatusLabel(page.status, messages)}
              </span>
              {page.protectionLevel === "protected" ? (
                <span className="badge info">{messages.pageProtected}</span>
              ) : null}
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
              {page.status !== "deleted" ? (
                <ConfirmActionForm
                  action={renamePageAction}
                  hiddenFields={[
                    { name: "pageId", value: page.id },
                    { name: "oldSlug", value: page.slug }
                  ]}
                  triggerLabel={messages.rename}
                  triggerClassName="button compact"
                  icon="rename"
                  title={`${messages.renamePage} · ${page.title}`}
                  body={messages.renamePageConfirmBody}
                  confirmLabel={messages.rename}
                  cancelLabel={messages.cancel}
                  pendingLabel={messages.working}
                >
                  <div className="confirm-field-grid">
                    <label>
                      <span>{messages.newTitle}</span>
                      <input className="field" name="newTitle" defaultValue={page.title} required />
                    </label>
                    <label>
                      <span>{messages.newSlug}</span>
                      <input className="field mono" name="newSlug" defaultValue={page.slug} />
                    </label>
                    <label className="checkbox-row">
                      <input type="checkbox" name="createAlias" defaultChecked />
                      <span>{messages.keepPreviousSlugAsRedirect}</span>
                    </label>
                  </div>
                </ConfirmActionForm>
              ) : null}
              <ConfirmActionForm
                action={setPageProtectionAction}
                hiddenFields={[
                  { name: "pageId", value: page.id },
                  {
                    name: "protectionLevel",
                    value: page.protectionLevel === "protected" ? "none" : "protected"
                  }
                ]}
                triggerLabel={
                  page.protectionLevel === "protected" ? messages.unprotect : messages.protect
                }
                triggerClassName="button compact"
                icon={page.protectionLevel === "protected" ? "unprotect" : "protect"}
                title={`${
                  page.protectionLevel === "protected"
                    ? messages.unprotectPage
                    : messages.protectPage
                } · ${page.title}`}
                body={
                  page.protectionLevel === "protected"
                    ? messages.unprotectPageConfirmBody
                    : messages.protectPageConfirmBody
                }
                warning={
                  page.protectionLevel === "protected"
                    ? undefined
                    : messages.protectPageConfirmWarning
                }
                confirmLabel={
                  page.protectionLevel === "protected" ? messages.unprotect : messages.protect
                }
                cancelLabel={messages.cancel}
                pendingLabel={messages.working}
              />
              {page.status !== "deleted" && page.status !== "archived" ? (
                <ConfirmActionForm
                  action={archivePageAction}
                  hiddenFields={[{ name: "pageId", value: page.id }]}
                  triggerLabel={messages.archive}
                  triggerClassName="button compact"
                  icon="archive"
                  title={`${messages.archivePage} · ${page.title}`}
                  body={messages.archivePageConfirmBody}
                  confirmLabel={messages.archive}
                  cancelLabel={messages.cancel}
                  pendingLabel={messages.working}
                />
              ) : null}
              {page.status === "deleted" || page.status === "archived" ? (
                <ActionForm
                  action={restorePageAction}
                  className="inline-form"
                  pendingLabel={messages.working}
                >
                  <input type="hidden" name="pageId" value={page.id} />
                  <input type="hidden" name="slug" value={page.slug} />
                  <button>
                    <RotateCcw size={14} aria-hidden="true" />
                    {page.status === "archived" ? messages.unarchive : messages.restore}
                  </button>
                </ActionForm>
              ) : null}
              {page.status !== "deleted" ? (
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
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function pageStatusFilterValue(value: string | undefined): PageStatusFilter | undefined {
  if (value === "published" || value === "draft" || value === "archived" || value === "deleted") {
    return value;
  }
  return undefined;
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
