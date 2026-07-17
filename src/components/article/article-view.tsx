import Link from "next/link";
import {
  BookOpen,
  Edit3,
  FileQuestion,
  GitBranch,
  History,
  Info,
  Link2,
  Link2Off,
  ListTree,
  RouteOff,
  Tags
} from "lucide-react";
import type { Page, PageRevision } from "@/db/schema";
import type { Messages } from "@/i18n";
import type { PageOutboundLink } from "@/modules/pages/service";
import { decorateWikiLinkHtml } from "./wiki-link-html";

export function ArticleView({
  page,
  revision,
  canEdit = false,
  canCreatePage = false,
  redirectedFrom = null,
  categories = [],
  outboundLinks = [],
  backlinkCount = 0,
  revisionCount = revision.revisionNumber,
  currentRevisionNumber = revision.revisionNumber,
  locale,
  messages
}: {
  page: Page;
  revision: PageRevision;
  canEdit?: boolean;
  canCreatePage?: boolean;
  redirectedFrom?: string | null;
  categories?: Array<{ name: string; slug: string }>;
  outboundLinks?: PageOutboundLink[];
  backlinkCount?: number;
  revisionCount?: number;
  currentRevisionNumber?: number;
  locale: string;
  messages: Messages;
}) {
  const isHistoricalRevision = revision.revisionNumber !== currentRevisionNumber;
  const articleHtml = decorateWikiLinkHtml(revision.html, outboundLinks, canCreatePage);
  const displayedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(revision.createdAt);
  const articleFacts = [
    { label: messages.type, value: messages.article },
    { label: messages.pageStatus, value: pageStatusLabel(page.status, messages) },
    { label: messages.pageRevision, value: `r${revision.revisionNumber}` },
    { label: messages.pageRevisions, value: String(revisionCount) },
    {
      label: messages.pageLinks,
      value: `${outboundLinks.length} ${messages.outboundShort} · ${backlinkCount} ${messages.inboundShort}`
    },
    { label: messages.pageLength, value: `${revision.plainText.length} ${messages.chars}` }
  ];

  return (
    <div className="article-page article-shell">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{page.title}</span>
      </nav>
      <div className="article-layout">
        <article className="article">
          <div className="article-tabs" aria-label={messages.articleActions}>
            <Link className="button active" href={`/page/${page.slug}`}>
              <BookOpen size={16} aria-hidden="true" />
              {messages.read}
            </Link>
            {canEdit ? (
              <Link className="button" href={`/edit/${page.slug}`}>
                <Edit3 size={16} aria-hidden="true" />
                {messages.edit}
              </Link>
            ) : null}
            <Link className="button" href={`/history/${page.slug}`}>
              <History size={16} aria-hidden="true" />
              {messages.history}
            </Link>
          </div>
          {redirectedFrom ? (
            <div className="redirect-notice">
              <span className="badge info">{messages.redirected}</span>
              <span>
                {messages.redirectedFrom} <code>/page/{redirectedFrom}</code>
              </span>
            </div>
          ) : null}
          {isHistoricalRevision ? (
            <div className="revision-notice">
              <span className="badge warning">{messages.historicalRevision}</span>
              <span>
                {messages.viewingHistoricalRevision}{" "}
                <Link href={`/page/${page.slug}`}>{messages.openCurrentRevision}</Link>
              </span>
            </div>
          ) : null}
          <h1>{page.title}</h1>
          <p className="meta">
            {messages.revisionLabel} {revision.revisionNumber} {messages.by}{" "}
            {revision.editorDisplayName} {messages.on} {displayedDate}
          </p>
          <div className="article-body" dangerouslySetInnerHTML={{ __html: articleHtml }} />
          {categories.length > 0 ? (
            <footer className="article-categories" aria-label={messages.pageCategories}>
              <span>{messages.categoriesLabel}</span>
              {categories.map((category) => (
                <Link key={category.slug} href={`/categories/${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </footer>
          ) : null}
        </article>
        <aside className="article-aside">
          <section
            className="article-info-card"
            id="page-information"
            aria-label={messages.pageInformation}
          >
            <div className="article-info-heading">{messages.pageInformation}</div>
            <div className="article-info-cover" aria-hidden="true">
              <span>page · {page.id.slice(0, 8)}</span>
            </div>
            <dl className="article-facts">
              {articleFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {revision.headings.length > 1 ? (
            <nav className="toc toc-card" aria-label={messages.tableOfContents}>
              <strong>{messages.contents}</strong>
              {revision.headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  style={{ paddingLeft: `${(heading.depth - 1) * 0.6}rem` }}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          ) : null}
          <nav className="aside-actions" aria-label={messages.pageTools}>
            <strong>{messages.tools}</strong>
            <Link href={`/page/${page.slug}/backlinks`}>
              <Link2 size={15} aria-hidden="true" />
              {messages.whatLinksHere}
            </Link>
            <Link href="/recent">
              <ListTree size={15} aria-hidden="true" />
              {messages.recentChanges}
            </Link>
            <Link href="/wanted">
              <FileQuestion size={15} aria-hidden="true" />
              {messages.wantedPages}
            </Link>
            <Link href="/orphaned">
              <Link2Off size={15} aria-hidden="true" />
              {messages.orphanedPages}
            </Link>
            <Link href="/dead-end">
              <RouteOff size={15} aria-hidden="true" />
              {messages.deadEndPages}
            </Link>
            <Link href="/uncategorized">
              <Tags size={15} aria-hidden="true" />
              {messages.uncategorizedPages}
            </Link>
            <Link href="/redirects">
              <GitBranch size={15} aria-hidden="true" />
              {messages.redirectPages}
            </Link>
            <Link href={`/page/${page.slug}?revision=${revision.revisionNumber}`}>
              <Link2 size={15} aria-hidden="true" />
              {messages.permanentLink}
            </Link>
            <a href="#page-information">
              <Info size={15} aria-hidden="true" />
              {messages.pageInformation}
            </a>
            {canEdit ? (
              <Link href={`/edit/${page.slug}`}>
                <Edit3 size={15} aria-hidden="true" />
                {messages.editSource}
              </Link>
            ) : null}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function pageStatusLabel(status: string, messages: Messages) {
  if (status === "published") return messages.statusPublished;
  if (status === "draft") return messages.statusDraft;
  if (status === "archived") return messages.statusArchived;
  if (status === "deleted") return messages.statusDeleted;
  return status;
}
