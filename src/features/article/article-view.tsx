import type { ComponentProps } from "react";
import { ArticleContent } from "./article-content";
import { ArticleInformation } from "./article-information";
import { ArticleBreadcrumbs, ArticleTabs } from "./article-navigation";
import { ArticleToc } from "./article-toc";
import { ArticleTools } from "./article-tools";
import type {
  ArticleCategory, ArticlePageSummary, ArticlePermissions, ArticleRevision, ArticleStatistics
} from "./types";

type ArticleMessages = ComponentProps<typeof ArticleContent>["messages"] &
  ComponentProps<typeof ArticleInformation>["messages"] &
  ComponentProps<typeof ArticleBreadcrumbs>["messages"] &
  ComponentProps<typeof ArticleTabs>["messages"] &
  ComponentProps<typeof ArticleToc>["messages"] &
  ComponentProps<typeof ArticleTools>["messages"];

export function ArticleView({
  page,
  revision,
  currentRevisionNumber,
  redirectedFrom,
  categories,
  statistics,
  permissions,
  locale,
  messages
}: {
  page: ArticlePageSummary;
  revision: ArticleRevision;
  currentRevisionNumber: number;
  redirectedFrom: string | null;
  categories: ArticleCategory[];
  statistics: ArticleStatistics;
  permissions: ArticlePermissions;
  locale: string;
  messages: ArticleMessages;
}) {
  return (
    <div className="article-page article-shell">
      <ArticleBreadcrumbs page={page} messages={messages} />
      <div className="article-layout">
        <article className="article">
          <ArticleTabs slug={page.slug} canEdit={permissions.canEdit} messages={messages} />
          <ArticleContent
            title={page.title}
            slug={page.slug}
            revision={revision}
            currentRevisionNumber={currentRevisionNumber}
            redirectedFrom={redirectedFrom}
            categories={categories}
            locale={locale}
            messages={messages}
          />
        </article>
        <aside className="article-aside">
          <ArticleInformation
            page={page}
            revisionNumber={revision.revisionNumber}
            characterCount={revision.characterCount}
            html={revision.html}
            statistics={statistics}
            messages={messages}
          />
          <ArticleToc headings={revision.headings} messages={messages} />
          <ArticleTools
            pageId={page.id}
            slug={page.slug}
            revisionNumber={revision.revisionNumber}
            permissions={permissions}
            messages={messages}
          />
        </aside>
      </div>
    </div>
  );
}
