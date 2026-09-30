import Link from "next/link";
import {
  Edit3, FileQuestion, GitBranch, Info, Link2, Link2Off, ListChecks, ListTree,
  Quote, Ruler, RouteOff, ShieldCheck, Star, StarOff, Tags
} from "lucide-react";
import { toggleWatchPageAction } from "@/app/actions";
import type { Messages } from "@/i18n";
import type { ArticlePermissions } from "./types";

export function ArticleTools({
  pageId,
  slug,
  revisionNumber,
  permissions,
  messages
}: {
  pageId: string;
  slug: string;
  revisionNumber: number;
  permissions: ArticlePermissions;
  messages: Pick<
    Messages,
    "pageTools" | "tools" | "unwatchPage" | "watchPage" | "whatLinksHere" |
    "recentChanges" | "specialPages" | "wantedPages" | "orphanedPages" | "deadEndPages" |
    "shortPages" | "protectedPages" | "uncategorizedPages" | "redirectPages" |
    "permanentLink" | "pageInformation" | "citeThisPage" | "editSource"
  >;
}) {
  const links = [
    { href: `/page/${slug}/backlinks`, label: messages.whatLinksHere, Icon: Link2 },
    { href: "/recent", label: messages.recentChanges, Icon: ListTree },
    { href: "/special", label: messages.specialPages, Icon: ListChecks },
    { href: "/wanted", label: messages.wantedPages, Icon: FileQuestion },
    { href: "/orphaned", label: messages.orphanedPages, Icon: Link2Off },
    { href: "/dead-end", label: messages.deadEndPages, Icon: RouteOff },
    { href: "/short-pages", label: messages.shortPages, Icon: Ruler },
    { href: "/protected-pages", label: messages.protectedPages, Icon: ShieldCheck },
    { href: "/uncategorized", label: messages.uncategorizedPages, Icon: Tags },
    { href: "/redirects", label: messages.redirectPages, Icon: GitBranch },
    {
      href: `/page/${slug}?revision=${revisionNumber}`,
      label: messages.permanentLink,
      Icon: Link2
    }
  ];

  return (
    <nav className="aside-actions" aria-label={messages.pageTools}>
      <strong>{messages.tools}</strong>
      {permissions.canWatch ? (
        <form action={toggleWatchPageAction} className="aside-action-form">
          <input type="hidden" name="pageId" value={pageId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intent" value={permissions.watched ? "unwatch" : "watch"} />
          <input type="hidden" name="returnTo" value={`/page/${slug}`} />
          <button type="submit">
            {permissions.watched ? <StarOff size={15} aria-hidden="true" /> : <Star size={15} aria-hidden="true" />}
            {permissions.watched ? messages.unwatchPage : messages.watchPage}
          </button>
        </form>
      ) : null}
      {links.map(({ href, label, Icon }) => (
        <Link key={href} href={href}><Icon size={15} aria-hidden="true" />{label}</Link>
      ))}
      <a href="#page-information"><Info size={15} aria-hidden="true" />{messages.pageInformation}</a>
      <Link href={`/page/${slug}/cite`}><Quote size={15} aria-hidden="true" />{messages.citeThisPage}</Link>
      {permissions.canEdit ? (
        <Link href={`/edit/${slug}`}><Edit3 size={15} aria-hidden="true" />{messages.editSource}</Link>
      ) : null}
    </nav>
  );
}
