import Link from "next/link";
import { Eye, GitCompare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Messages } from "@/i18n";
import {
  formatRevisionSummary, formatRollbackRevisionSummary, type RevisionSummaryMessages
} from "@/i18n/revisions";
import { RevisionTime } from "./revision-meta";
import { RevisionRollbackAction } from "./revision-rollback-action";
import type { RevisionHistoryPage, RevisionSummary } from "./types";

type HistoryMessages = RevisionSummaryMessages & Pick<
  Messages,
  "noResults" | "history" | "revisionShort" | "summary" | "editor" | "actions" |
  "current" | "noEditSummary" | "view" | "compare" | "rollback" | "rollbackConfirmBody" |
  "destructiveActionWarning" | "cancel" | "working"
>;

export function RevisionHistory({
  page,
  revisions,
  canRollback,
  locale,
  messages
}: {
  page: RevisionHistoryPage;
  revisions: RevisionSummary[];
  canRollback: boolean;
  locale: string;
  messages: HistoryMessages;
}) {
  if (revisions.length === 0) return <EmptyState title={messages.noResults} />;
  return (
    <div className="history-panel" role="table" aria-label={messages.history}>
      <div className="history-row header" role="row">
        <div role="columnheader">{messages.revisionShort}</div>
        <div role="columnheader">{messages.summary}</div>
        <div role="columnheader">{messages.editor}</div>
        <div role="columnheader">{messages.actions}</div>
      </div>
      {revisions.map((revision, index) => (
        <RevisionHistoryRow
          key={revision.id}
          page={page}
          revision={revision}
          previousRevisionId={revisions[index + 1]?.id}
          canRollback={canRollback}
          locale={locale}
          messages={messages}
        />
      ))}
    </div>
  );
}

function RevisionHistoryRow({
  page,
  revision,
  previousRevisionId,
  canRollback,
  locale,
  messages
}: {
  page: RevisionHistoryPage;
  revision: RevisionSummary;
  previousRevisionId?: string;
  canRollback: boolean;
  locale: string;
  messages: HistoryMessages;
}) {
  const isCurrent = page.currentRevisionId === revision.id;
  return (
    <div className="history-row" role="row">
      <div className="history-revision-cell mono" data-label={messages.revisionShort} role="cell">
        <span className="history-revision-value">
          <span className="history-revision-number">r{revision.revisionNumber}</span>
          {isCurrent ? <span className="badge success history-current-badge">{messages.current}</span> : null}
        </span>
      </div>
      <div className="history-summary-cell" data-label={messages.summary} role="cell">
        <div className="history-summary-text">
          {formatRevisionSummary(revision.editSummary, messages) || messages.noEditSummary}
        </div>
        <div className="history-summary-date mono muted">
          <RevisionTime date={revision.createdAt} locale={locale} />
        </div>
      </div>
      <div className="muted" data-label={messages.editor} role="cell">{revision.editorDisplayName}</div>
      <div className="history-actions" data-label={messages.actions} role="cell">
        <div className="history-action-buttons">
          <Link
            className="button compact"
            href={`/page/${page.slug}?revision=${revision.revisionNumber}&redirect=no`}
            aria-label={`${messages.view} · r${revision.revisionNumber}`}
          >
            <Eye size={14} aria-hidden="true" />{messages.view}
          </Link>
          {previousRevisionId ? (
            <Link
              className="button compact"
              href={`/diff/${previousRevisionId}/${revision.id}`}
              aria-label={`${messages.compare} · r${revision.revisionNumber}`}
            >
              <GitCompare size={14} aria-hidden="true" />{messages.compare}
            </Link>
          ) : null}
          {canRollback && !isCurrent ? (
            <RevisionRollbackAction
              pageId={page.id}
              slug={page.slug}
              revision={revision}
              reason={formatRollbackRevisionSummary(messages, revision.revisionNumber)}
              messages={messages}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
