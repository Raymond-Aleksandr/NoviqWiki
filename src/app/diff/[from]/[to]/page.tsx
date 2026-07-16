import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { rollbackAction } from "@/app/actions";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { compareRevisions, getPageById } from "@/modules/pages/service";

type Props = {
  params: Promise<{ from: string; to: string }>;
};

export default async function DiffPage({ params }: Props) {
  const { from, to } = await params;
  const diff = await compareRevisions({ fromRevisionId: from, toRevisionId: to });
  const page = await getPageById(diff.to.pageId);
  const session = await getCurrentSession();
  const [canRollback, i18n] = await Promise.all([
    hasPermission(session?.user.id, page.siteId, "page.rollback"),
    getRequestI18n()
  ]);
  const { messages } = i18n;
  const added = diff.lines.filter((line) => line.type === "add").length;
  const removed = diff.lines.filter((line) => line.type === "remove").length;
  return (
    <section className="page-frame">
      <header className="diff-page-header">
        <div>
          <h1 className="page-title small">
            {messages.compareRevision} {diff.from.revisionNumber} {messages.to}{" "}
            {diff.to.revisionNumber}
          </h1>
          <p className="page-description">
            {diff.from.editorDisplayName} → {diff.to.editorDisplayName}
          </p>
        </div>
        {canRollback && page.currentRevisionId !== diff.from.id ? (
          <ConfirmActionForm
            action={rollbackAction}
            hiddenFields={[
              { name: "pageId", value: page.id },
              { name: "slug", value: page.slug },
              { name: "targetRevisionId", value: diff.from.id },
              {
                name: "reason",
                value: `Rollback from diff to revision ${diff.from.revisionNumber}`
              }
            ]}
            triggerLabel={`${messages.rollBackToRevision} r${diff.from.revisionNumber}`}
            triggerClassName="button danger"
            icon="rollback"
            title={`${messages.rollback} · r${diff.from.revisionNumber}`}
            body={messages.rollbackConfirmBody}
            warning={messages.destructiveActionWarning}
            confirmLabel={messages.rollback}
            cancelLabel={messages.cancel}
            pendingLabel={messages.working}
            danger
          />
        ) : null}
      </header>
      <div className="diff diff-panel" aria-label={messages.unifiedDiff}>
        {diff.lines.map((line, index) => (
          <div
            key={`${index}-${line.text}`}
            className={`diff-line ${
              line.type === "add"
                ? "diff-add"
                : line.type === "remove"
                  ? "diff-remove"
                  : line.type === "meta"
                    ? "diff-meta"
                    : ""
            }`}
          >
            {line.text || " "}
          </div>
        ))}
      </div>
      <div className="diff-summary">
        <span className="diff-count add">
          +{added} {messages.added}
        </span>
        <span className="diff-count remove">
          -{removed} {messages.removed}
        </span>
        <Link className="button compact" href={`/page/${page.slug}`} style={{ marginLeft: "auto" }}>
          <ArrowLeft size={14} aria-hidden="true" />
          {messages.returnToPage}
        </Link>
      </div>
    </section>
  );
}
