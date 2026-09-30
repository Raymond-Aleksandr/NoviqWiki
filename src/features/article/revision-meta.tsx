import type { Messages } from "@/i18n";
import type { RevisionSummary } from "./types";

export function RevisionTime({
  date,
  locale,
  className
}: {
  date: Date;
  locale: string;
  className?: string;
}) {
  return (
    <time className={className} dateTime={date.toISOString()}>
      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date)}
    </time>
  );
}

export function RevisionMeta({
  revision,
  locale,
  messages
}: {
  revision: Pick<RevisionSummary, "revisionNumber" | "editorDisplayName" | "createdAt">;
  locale: string;
  messages: Pick<Messages, "revisionLabel" | "by" | "on">;
}) {
  return (
    <p className="meta">
      <span>{messages.revisionLabel} {revision.revisionNumber}</span>
      <span>{messages.by} {revision.editorDisplayName}</span>
      <span>{messages.on} <RevisionTime date={revision.createdAt} locale={locale} /></span>
    </p>
  );
}
