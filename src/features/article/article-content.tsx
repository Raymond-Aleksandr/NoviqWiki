import Link from "next/link";
import type { Messages } from "@/i18n";
import { addHeadingPermalinks } from "./article-html";
import { RevisionMeta } from "./revision-meta";
import type { ArticleCategory, ArticleRevision } from "./types";

export function ArticleContent({
  title,
  slug,
  revision,
  currentRevisionNumber,
  redirectedFrom,
  categories,
  locale,
  messages
}: {
  title: string;
  slug: string;
  revision: ArticleRevision;
  currentRevisionNumber: number;
  redirectedFrom: string | null;
  categories: ArticleCategory[];
  locale: string;
  messages: Pick<
    Messages,
    "redirected" | "redirectedFrom" | "historicalRevision" | "viewingHistoricalRevision" |
    "openCurrentRevision" | "revisionLabel" | "by" | "on" | "permanentLink" |
    "pageCategories" | "categoriesLabel"
  >;
}) {
  return (
    <>
      {redirectedFrom ? (
        <div className="redirect-notice">
          <span className="badge info">{messages.redirected}</span>
          <span>{messages.redirectedFrom} <code>/page/{redirectedFrom}</code></span>
        </div>
      ) : null}
      {revision.revisionNumber !== currentRevisionNumber ? (
        <div className="revision-notice">
          <span className="badge warning">{messages.historicalRevision}</span>
          <span>
            {messages.viewingHistoricalRevision}{" "}
            <Link href={`/page/${slug}`}>{messages.openCurrentRevision}</Link>
          </span>
        </div>
      ) : null}
      <h1>{title}</h1>
      <RevisionMeta revision={revision} locale={locale} messages={messages} />
      <div
        className="article-body"
        dangerouslySetInnerHTML={{
          __html: addHeadingPermalinks(revision.html, revision.headings, messages.permanentLink)
        }}
      />
      {categories.length > 0 ? (
        <footer className="article-categories" aria-label={messages.pageCategories}>
          <span>{messages.categoriesLabel}</span>
          {categories.map((category) => (
            <Link key={category.slug} href={`/categories/${category.slug}`}>{category.name}</Link>
          ))}
        </footer>
      ) : null}
    </>
  );
}
