import type { Messages } from "@/i18n";
import { formatRevisionSummary, type RevisionSummaryMessages } from "@/i18n/revisions";
import { RevisionCompareForm } from "./revision-compare-form";
import type { RevisionSummary } from "./types";

export function RevisionCompare({
  pageSlug,
  revisions,
  locale,
  messages
}: {
  pageSlug: string;
  revisions: RevisionSummary[];
  locale: string;
  messages: RevisionSummaryMessages & Pick<
    Messages,
    "compareSelectedRevisions" | "fromRevision" | "toRevision" | "compare" | "noEditSummary"
  >;
}) {
  if (revisions.length < 2) return null;
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const options = revisions.map((revision) => {
    const summary = formatRevisionSummary(revision.editSummary, messages) || messages.noEditSummary;
    return {
      id: revision.id,
      label: `r${revision.revisionNumber} · ${summary} · ${revision.editorDisplayName} · ${formatter.format(revision.createdAt)}`
    };
  });
  return (
    <RevisionCompareForm
      pageSlug={pageSlug}
      options={options}
      messages={{
        compareSelectedRevisions: messages.compareSelectedRevisions,
        fromRevision: messages.fromRevision,
        toRevision: messages.toRevision,
        compare: messages.compare
      }}
    />
  );
}
