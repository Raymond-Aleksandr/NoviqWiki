import { rollbackAction } from "@/app/actions";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import type { Messages } from "@/i18n";
import type { RevisionSummary } from "./types";

export function RevisionRollbackAction({
  pageId,
  slug,
  revision,
  reason,
  label,
  danger = false,
  messages
}: {
  pageId: string;
  slug: string;
  revision: Pick<RevisionSummary, "id" | "revisionNumber">;
  reason: string;
  label?: string;
  danger?: boolean;
  messages: Pick<
    Messages,
    "rollback" | "rollbackConfirmBody" | "destructiveActionWarning" | "cancel" | "working"
  >;
}) {
  return (
    <ConfirmActionForm
      action={rollbackAction}
      hiddenFields={[
        { name: "pageId", value: pageId },
        { name: "slug", value: slug },
        { name: "targetRevisionId", value: revision.id },
        { name: "reason", value: reason }
      ]}
      triggerLabel={label ?? messages.rollback}
      triggerClassName={danger ? "button danger" : "button compact"}
      icon="rollback"
      title={`${messages.rollback} · r${revision.revisionNumber}`}
      body={messages.rollbackConfirmBody}
      warning={messages.destructiveActionWarning}
      confirmLabel={messages.rollback}
      cancelLabel={messages.cancel}
      pendingLabel={messages.working}
      danger={danger}
    />
  );
}
