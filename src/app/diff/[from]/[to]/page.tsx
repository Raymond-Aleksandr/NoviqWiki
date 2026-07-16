import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { rollbackAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
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
  const canRollback = await hasPermission(session?.user.id, page.siteId, "page.rollback");
  const added = diff.lines.filter((line) => line.type === "add").length;
  const removed = diff.lines.filter((line) => line.type === "remove").length;
  return (
    <section className="page-frame">
      <header className="diff-page-header">
        <div>
          <h1 className="page-title small">
            Compare revision {diff.from.revisionNumber} to {diff.to.revisionNumber}
          </h1>
          <p className="page-description">
            {diff.from.editorDisplayName} → {diff.to.editorDisplayName}
          </p>
        </div>
        {canRollback && page.currentRevisionId !== diff.from.id ? (
          <ActionForm action={rollbackAction} className="inline-form">
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="slug" value={page.slug} />
            <input type="hidden" name="targetRevisionId" value={diff.from.id} />
            <input
              type="hidden"
              name="reason"
              value={`Rollback from diff to revision ${diff.from.revisionNumber}`}
            />
            <button className="danger">
              <RotateCcw size={15} aria-hidden="true" />
              Roll back to r{diff.from.revisionNumber}
            </button>
          </ActionForm>
        ) : null}
      </header>
      <div className="diff diff-panel" aria-label="Unified diff">
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
        <span style={{ color: "var(--diff-add-text)" }}>+{added} added</span>
        <span style={{ color: "var(--diff-del-text)" }}>-{removed} removed</span>
        <Link href={`/page/${page.slug}`} style={{ marginLeft: "auto" }}>
          Return to page
        </Link>
      </div>
    </section>
  );
}
