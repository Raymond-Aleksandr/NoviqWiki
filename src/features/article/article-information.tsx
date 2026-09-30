import type { Messages } from "@/i18n";
import { extractArticleCover } from "./article-html";
import type { ArticlePageSummary, ArticleStatistics } from "./types";

type InformationMessages = Pick<
  Messages,
  "type" | "article" | "pageStatus" | "protected" | "pageProtected" | "pageRevision" |
  "pageRevisions" | "pageLinks" | "outboundShort" | "inboundShort" | "pageLength" |
  "chars" | "pageInformation" | "statusPublished" | "statusDraft" | "statusArchived" |
  "statusDeleted"
>;

export function ArticleInformation({
  page,
  revisionNumber,
  characterCount,
  html,
  statistics,
  messages
}: {
  page: ArticlePageSummary;
  revisionNumber: number;
  characterCount: number;
  html: string;
  statistics: ArticleStatistics;
  messages: InformationMessages;
}) {
  const cover = extractArticleCover(html);
  const statusLabels = {
    published: messages.statusPublished,
    draft: messages.statusDraft,
    archived: messages.statusArchived,
    deleted: messages.statusDeleted
  };
  const facts = [
    { label: messages.type, value: messages.article },
    { label: messages.pageStatus, value: statusLabels[page.status] },
    ...(page.protected ? [{ label: messages.protected, value: messages.pageProtected }] : []),
    { label: messages.pageRevision, value: `r${revisionNumber}` },
    { label: messages.pageRevisions, value: String(statistics.revisionCount) },
    {
      label: messages.pageLinks,
      value: `${statistics.outboundCount} ${messages.outboundShort} · ${statistics.backlinkCount} ${messages.inboundShort}`
    },
    { label: messages.pageLength, value: `${characterCount} ${messages.chars}` }
  ];

  return (
    <section className="article-info-card" id="page-information" aria-label={messages.pageInformation}>
      <h2 className="article-info-heading">{messages.pageInformation}</h2>
      {cover ? (
        <div className="article-info-cover">
          <img src={cover.src} alt={cover.alt || page.title} loading="lazy" />
        </div>
      ) : (
        <div className="article-info-id"><span>{messages.article} · {page.id.slice(0, 8)}</span></div>
      )}
      <dl className="article-facts">
        {facts.map((fact) => (
          <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
