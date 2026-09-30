import Link from "next/link";
import { History, Pencil, RotateCcw } from "lucide-react";
import { archivePageAction, deletePageAction, renamePageAction, restorePageAction, setPageProtectionAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import type { AdminPageRow, PageMessages } from "./page-types";

export function AdminPageActions({ page, messages }: {
  page: Pick<AdminPageRow, "id" | "slug" | "title" | "status" | "protected">;
  messages: Pick<PageMessages,
    | "actions" | "edit" | "revisions" | "rename" | "renamePage" | "renamePageConfirmBody"
    | "newTitle" | "newSlug" | "keepPreviousSlugAsRedirect" | "protect" | "unprotect"
    | "protectPage" | "unprotectPage" | "protectPageConfirmBody" | "unprotectPageConfirmBody"
    | "protectPageConfirmWarning" | "archive" | "archivePage" | "archivePageConfirmBody"
    | "unarchive" | "restore" | "delete" | "deletePageConfirmBody" | "destructiveActionWarning"
    | "cancel" | "working"
  >;
}) {
  return (
    <div className="admin-action-list" data-label={messages.actions} role="cell">
      <Link className="button compact" href={`/edit/${page.slug}`}>
        <Pencil size={14} aria-hidden="true" />
        {messages.edit}
        <span className="sr-only"> · {page.title}</span>
      </Link>
      <Link className="button compact" href={`/history/${page.slug}`}>
        <History size={14} aria-hidden="true" />
        {messages.revisions}
        <span className="sr-only"> · {page.title}</span>
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
              <input className="field" name="newSlug" defaultValue={page.slug} />
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
            value: page.protected ? "none" : "protected"
          }
        ]}
        triggerLabel={page.protected ? messages.unprotect : messages.protect}
        triggerClassName="button compact"
        icon={page.protected ? "unprotect" : "protect"}
        title={`${page.protected ? messages.unprotectPage : messages.protectPage} · ${page.title}`}
        body={page.protected ? messages.unprotectPageConfirmBody : messages.protectPageConfirmBody}
        warning={page.protected ? undefined : messages.protectPageConfirmWarning}
        confirmLabel={page.protected ? messages.unprotect : messages.protect}
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
            <span className="sr-only"> · {page.title}</span>
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
  );
}
