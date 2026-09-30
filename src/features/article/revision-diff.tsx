import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Messages } from "@/i18n";
import type { DiffLine, SideBySideDiffRow } from "@/modules/revisions/diff";

type DiffMessages = Pick<
  Messages,
  "sideBySideDiff" | "oldRevision" | "newRevision" | "unifiedDiff" |
  "added" | "removed" | "returnToPage"
>;

export function RevisionDiff({
  slug,
  fromRevisionNumber,
  toRevisionNumber,
  lines,
  rows,
  messages
}: {
  slug: string;
  fromRevisionNumber: number;
  toRevisionNumber: number;
  lines: DiffLine[];
  rows: SideBySideDiffRow[];
  messages: DiffMessages;
}) {
  const added = lines.filter((line) => line.type === "add").length;
  const removed = lines.filter((line) => line.type === "remove").length;
  return (
    <>
      <SideBySideDiff
        rows={rows}
        fromRevisionNumber={fromRevisionNumber}
        toRevisionNumber={toRevisionNumber}
        messages={messages}
      />
      <UnifiedDiff lines={lines} title={messages.unifiedDiff} />
      <div className="diff-summary">
        <span className="diff-count add">+{added} {messages.added}</span>
        <span className="diff-count remove">-{removed} {messages.removed}</span>
        <Link className="button compact diff-return-link" href={`/page/${slug}`}>
          <ArrowLeft size={14} aria-hidden="true" />{messages.returnToPage}
        </Link>
      </div>
    </>
  );
}

function SideBySideDiff({
  rows,
  fromRevisionNumber,
  toRevisionNumber,
  messages
}: {
  rows: SideBySideDiffRow[];
  fromRevisionNumber: number;
  toRevisionNumber: number;
  messages: Pick<Messages, "sideBySideDiff" | "oldRevision" | "newRevision" | "added" | "removed">;
}) {
  return (
    <section className="diff-section" aria-labelledby="side-by-side-title">
      <h2 id="side-by-side-title">{messages.sideBySideDiff}</h2>
      <div className="side-by-side-diff" role="table" aria-label={messages.sideBySideDiff}>
        <div className="side-by-side-diff-header" role="row">
          <div role="columnheader">{messages.oldRevision} r{fromRevisionNumber}</div>
          <div role="columnheader">{messages.newRevision} r{toRevisionNumber}</div>
        </div>
        {rows.map((row, index) => (
          <div className={`side-by-side-diff-row side-by-side-${row.type}`} key={index} role="row">
            <div className="side-by-side-cell" role="cell">
              <span className="diff-line-number" aria-hidden="true">{row.oldLineNumber ?? ""}</span>
              {row.type === "remove" || row.type === "change" ? (
                <span className="sr-only">{messages.removed}: </span>
              ) : null}
              <code>{row.oldText || " "}</code>
            </div>
            <div className="side-by-side-cell" role="cell">
              <span className="diff-line-number" aria-hidden="true">{row.newLineNumber ?? ""}</span>
              {row.type === "add" || row.type === "change" ? (
                <span className="sr-only">{messages.added}: </span>
              ) : null}
              <code>{row.newText || " "}</code>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UnifiedDiff({ lines, title }: { lines: DiffLine[]; title: string }) {
  const lineClasses = { add: "diff-add", remove: "diff-remove", meta: "diff-meta", context: "" };
  return (
    <section className="diff-section" aria-labelledby="unified-diff-title">
      <h2 id="unified-diff-title">{title}</h2>
      <div className="diff diff-panel" aria-label={title}>
        {lines.map((line, index) => (
          <div key={index} className={`diff-line ${lineClasses[line.type]}`}>{line.text || " "}</div>
        ))}
      </div>
    </section>
  );
}
