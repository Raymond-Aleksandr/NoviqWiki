import { GitCompare } from "lucide-react";
import type { PageRevision } from "@/db/schema";
import type { Messages } from "@/i18n";

type RevisionOption = Pick<
  PageRevision,
  "id" | "revisionNumber" | "editSummary" | "editorDisplayName" | "createdAt"
>;

export function RevisionCompareForm({
  pageSlug,
  revisions,
  locale,
  messages
}: {
  pageSlug: string;
  revisions: RevisionOption[];
  locale: string;
  messages: Messages;
}) {
  if (revisions.length < 2) {
    return null;
  }
  const newest = revisions[0]!;
  const previous = revisions[1]!;

  return (
    <form
      className="history-compare-form"
      action={`/history/${encodeURIComponent(pageSlug)}/compare`}
      method="get"
    >
      <div className="history-compare-heading">
        <GitCompare size={16} aria-hidden="true" />
        <strong>{messages.compareSelectedRevisions}</strong>
      </div>
      <label>
        <span>{messages.fromRevision}</span>
        <select name="from" defaultValue={previous.id}>
          {revisions.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revisionOptionLabel(revision, locale, messages)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{messages.toRevision}</span>
        <select name="to" defaultValue={newest.id}>
          {revisions.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revisionOptionLabel(revision, locale, messages)}
            </option>
          ))}
        </select>
      </label>
      <button className="primary compact" type="submit">
        <GitCompare size={14} aria-hidden="true" />
        {messages.compare}
      </button>
    </form>
  );
}

function revisionOptionLabel(revision: RevisionOption, locale: string, messages: Messages) {
  const summary = revision.editSummary || messages.noEditSummary;
  return `r${revision.revisionNumber} · ${summary} · ${revision.editorDisplayName} · ${revision.createdAt.toLocaleString(locale)}`;
}
