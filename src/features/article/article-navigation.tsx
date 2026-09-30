import Link from "next/link";
import { ArrowLeft, BookOpen, Edit3, History } from "lucide-react";
import type { Messages } from "@/i18n";

type PageLink = { title: string; slug: string };

export function ArticleBreadcrumbs({
  page,
  currentLabel,
  messages
}: {
  page: PageLink;
  currentLabel?: string;
  messages: Pick<Messages, "breadcrumb" | "read">;
}) {
  return (
    <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
      {currentLabel ? (
        <Link href={`/page/${page.slug}`}>{page.title}</Link>
      ) : (
        <Link href="/">{messages.read}</Link>
      )}
      <span aria-hidden="true">/</span>
      <span aria-current="page">{currentLabel ?? page.title}</span>
    </nav>
  );
}

export function ArticleTabs({
  slug,
  canEdit,
  messages
}: {
  slug: string;
  canEdit: boolean;
  messages: Pick<Messages, "articleActions" | "read" | "edit" | "history">;
}) {
  return (
    <nav className="article-tabs" aria-label={messages.articleActions}>
      <Link className="button active" href={`/page/${slug}`} aria-current="page">
        <BookOpen size={16} aria-hidden="true" />
        {messages.read}
      </Link>
      {canEdit ? (
        <Link className="button" href={`/edit/${slug}`}>
          <Edit3 size={16} aria-hidden="true" />
          {messages.edit}
        </Link>
      ) : null}
      <Link className="button" href={`/history/${slug}`}>
        <History size={16} aria-hidden="true" />
        {messages.history}
      </Link>
    </nav>
  );
}

export function ArticleReturnActions({
  slug,
  includeHistory = true,
  messages
}: {
  slug: string;
  includeHistory?: boolean;
  messages: Pick<Messages, "article" | "history">;
}) {
  return (
    <>
      <Link className="button" href={`/page/${slug}`}>
        <ArrowLeft size={16} aria-hidden="true" />
        {messages.article}
      </Link>
      {includeHistory ? (
        <Link className="button" href={`/history/${slug}`}>
          <History size={16} aria-hidden="true" />
          {messages.history}
        </Link>
      ) : null}
    </>
  );
}
