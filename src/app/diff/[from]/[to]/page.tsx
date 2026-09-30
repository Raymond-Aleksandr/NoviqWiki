import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { rollbackAction } from "@/app/actions";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { rewriteLegacyMediaUrls } from "@/modules/media/service";
import { compareRevisionsForRead } from "@/modules/pages/service";
import { getSiteSettings } from "@/modules/settings/service";

type Props = {
  params: Promise<{ from: string; to: string }>;
};

export default async function DiffPage({ params }: Props) {
  const { from, to } = await params;
  const { page, ...diff } = await compareRevisionsForRead({
    fromRevisionId: from,
    toRevisionId: to
  });
  const session = await requirePageReadAccess(page.siteId);
  const lineCount = diff.lines.length;
  const displayContents = [
    ...diff.lines.map((line) => line.text),
    ...diff.sideBySide.flatMap((row) => [row.oldText, row.newText])
  ];
  const [canRollback, settings, rewrittenContents] = await Promise.all([
    hasPermission(session?.user.id, page.siteId, "page.rollback"),
    getSiteSettings(page.siteId),
    rewriteLegacyMediaUrls({ siteId: page.siteId, contents: displayContents })
  ]);
  const displayLines = diff.lines.map((line, index) => ({
    ...line,
    text: rewrittenContents[index] ?? line.text
  }));
  const displaySideBySide = diff.sideBySide.map((row, index) => ({
    ...row,
    oldText: rewrittenContents[lineCount + index * 2] ?? row.oldText,
    newText: rewrittenContents[lineCount + index * 2 + 1] ?? row.newText
  }));
  const i18n = await getRequestI18n(settings?.defaultLocale);
  const { messages } = i18n;
  const added = displayLines.filter((line) => line.type === "add").length;
  const removed = displayLines.filter((line) => line.type === "remove").length;
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
                value: messages.rollbackFromDiffSummary.replace(
                  "{revision}",
                  String(diff.from.revisionNumber)
                )
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
      <section className="diff-section">
        <h2>{messages.sideBySideDiff}</h2>
        <div className="side-by-side-diff" aria-label={messages.sideBySideDiff}>
          <div className="side-by-side-diff-header">
            <div>
              {messages.oldRevision} r{diff.from.revisionNumber}
            </div>
            <div>
              {messages.newRevision} r{diff.to.revisionNumber}
            </div>
          </div>
          {displaySideBySide.map((row, index) => (
            <div className={`side-by-side-diff-row side-by-side-${row.type}`} key={index}>
              <div className="side-by-side-cell">
                <span className="diff-line-number">{row.oldLineNumber ?? ""}</span>
                <code>{row.oldText || " "}</code>
              </div>
              <div className="side-by-side-cell">
                <span className="diff-line-number">{row.newLineNumber ?? ""}</span>
                <code>{row.newText || " "}</code>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="diff-section">
        <h2>{messages.unifiedDiff}</h2>
        <div className="diff diff-panel" aria-label={messages.unifiedDiff}>
          {displayLines.map((line, index) => (
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
      </section>
      <div className="diff-summary">
        <span className="diff-count add">
          +{added} {messages.added}
        </span>
        <span className="diff-count remove">
          -{removed} {messages.removed}
        </span>
        <Link className="button compact diff-return-link" href={`/page/${page.slug}`}>
          <ArrowLeft size={14} aria-hidden="true" />
          {messages.returnToPage}
        </Link>
      </div>
    </section>
  );
}
