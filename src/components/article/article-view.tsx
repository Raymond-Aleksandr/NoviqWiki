import Link from "next/link";
import { BookOpen, Edit3, History } from "lucide-react";
import type { Page, PageRevision } from "@/db/schema";

export function ArticleView({
  page,
  revision,
  canEdit = false
}: {
  page: Page;
  revision: PageRevision;
  canEdit?: boolean;
}) {
  return (
    <div className="article-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Read</Link>
        <span aria-hidden="true">/</span>
        <span>{page.title}</span>
      </nav>
      <div className="article-layout">
        <article className="article">
          <div className="article-tabs" aria-label="Article actions">
            <Link className="button active" href={`/page/${page.slug}`}>
              <BookOpen size={16} aria-hidden="true" />
              Read
            </Link>
            {canEdit ? (
              <Link className="button" href={`/edit/${page.slug}`}>
                <Edit3 size={16} aria-hidden="true" />
                Edit
              </Link>
            ) : null}
            <Link className="button" href={`/history/${page.slug}`}>
              <History size={16} aria-hidden="true" />
              History
            </Link>
          </div>
          <h1>{page.title}</h1>
          <p className="meta">
            Revision {revision.revisionNumber} by {revision.editorDisplayName} on{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(revision.createdAt)}
          </p>
          <div className="article-body" dangerouslySetInnerHTML={{ __html: revision.html }} />
        </article>
        <aside className="article-aside">
          {revision.headings.length > 1 ? (
            <nav className="toc" aria-label="Table of contents">
              <strong>Contents</strong>
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
          <div className="aside-actions">
            <Link href={`/history/${page.slug}`}>History</Link>
            {canEdit ? <Link href={`/edit/${page.slug}`}>Edit source</Link> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
