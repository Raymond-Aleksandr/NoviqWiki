import Link from "next/link";
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
    <div className="article-layout">
      <article className="article">
        <div className="article-tabs" aria-label="Article actions">
          <Link className="button" href={`/page/${page.slug}`}>
            Read
          </Link>
          {canEdit ? (
            <Link className="button" href={`/edit/${page.slug}`}>
              Edit
            </Link>
          ) : null}
          <Link className="button" href={`/history/${page.slug}`}>
            History
          </Link>
        </div>
        <h1>{page.title}</h1>
        <p className="meta">
          Revision {revision.revisionNumber} by {revision.editorDisplayName} on{" "}
          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
            revision.createdAt
          )}
        </p>
        <div className="article-body" dangerouslySetInnerHTML={{ __html: revision.html }} />
      </article>
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
    </div>
  );
}
