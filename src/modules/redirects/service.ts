import { and, asc, eq, isNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { pageAliases, pageRevisions, pages, type Page } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { parseRedirectDirective } from "./directive";

export type RedirectTargetStatus =
  "valid" | "missing" | "draft" | "archived" | "deleted" | "double";

export type RedirectPageEntry = {
  pageId: string;
  title: string;
  slug: string;
  targetTitle: string;
  targetSlug: string;
  targetPageId: string | null;
  targetPageTitle: string | null;
  targetPageSlug: string | null;
  targetStatus: RedirectTargetStatus;
  updatedAt: Date;
};

export async function resolvePageBySlug(
  input: { siteId: string; slug: string; maxDepth?: number; followContentRedirects?: boolean },
  database: Database = db
) {
  const maxDepth = input.maxDepth ?? 8;
  const followContentRedirects = input.followContentRedirects ?? true;
  let currentSlug = input.slug;
  let redirectedFrom: string | null = null;
  const seen = new Set<string>();
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    if (seen.has(currentSlug)) {
      throw new ConflictError("Redirect loop detected.");
    }
    seen.add(currentSlug);

    const [page] = await database
      .select()
      .from(pages)
      .where(and(eq(pages.siteId, input.siteId), eq(pages.slug, currentSlug)))
      .limit(1);
    if (page) {
      if (followContentRedirects && shouldFollowContentRedirect(page)) {
        const directive = await getCurrentRedirectDirective(page, database);
        if (directive) {
          redirectedFrom ??= currentSlug;
          currentSlug = directive.targetSlug;
          continue;
        }
      }
      return { page, redirectedFrom };
    }

    const [alias] = await database
      .select()
      .from(pageAliases)
      .where(and(eq(pageAliases.siteId, input.siteId), eq(pageAliases.aliasSlug, currentSlug)))
      .limit(1);
    if (!alias) {
      throw new NotFoundError("Page not found.");
    }
    const [target] = await database
      .select()
      .from(pages)
      .where(and(eq(pages.siteId, input.siteId), eq(pages.id, alias.pageId)))
      .limit(1);
    if (!target) {
      throw new NotFoundError("Redirect target not found.");
    }
    redirectedFrom ??= currentSlug;
    currentSlug = target.slug;
  }
  throw new ConflictError("Redirect depth exceeded.");
}

export async function listRedirectPages(
  input: { siteId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<{ rows: RedirectPageEntry[]; count: number }> {
  const sourceRows = await database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt,
      markdown: pageRevisions.markdown
    })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.id, pages.currentRevisionId))
    .where(
      and(eq(pages.siteId, input.siteId), eq(pages.status, "published"), isNull(pages.deletedAt))
    )
    .orderBy(asc(pages.title), asc(pages.slug));

  const entries: RedirectPageEntry[] = [];
  for (const row of sourceRows) {
    const directive = parseRedirectDirective(row.markdown);
    if (!directive) {
      continue;
    }
    const target = await findPageOrAliasTarget(input.siteId, directive.targetSlug, database);
    const targetStatus = await redirectTargetStatus(target, database);
    entries.push({
      pageId: row.pageId,
      title: row.title,
      slug: row.slug,
      targetTitle: directive.targetTitle,
      targetSlug: directive.targetSlug,
      targetPageId: target?.id ?? null,
      targetPageTitle: target?.title ?? null,
      targetPageSlug: target?.slug ?? null,
      targetStatus,
      updatedAt: row.updatedAt
    });
  }

  const offset = input.offset ?? 0;
  return {
    rows: entries.slice(offset, offset + (input.limit ?? 100)),
    count: entries.length
  };
}

export async function assertNoRedirectLoopForRevision(
  input: {
    siteId: string;
    pageId: string;
    pageSlug: string;
    markdown: string;
    maxDepth?: number;
  },
  database: Database = db
) {
  const directive = parseRedirectDirective(input.markdown);
  if (!directive) {
    return;
  }

  const maxDepth = input.maxDepth ?? 8;
  const seen = new Set<string>([input.pageSlug]);
  let currentSlug = directive.targetSlug;

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    if (seen.has(currentSlug)) {
      throw new ConflictError("Redirect loop detected.");
    }
    seen.add(currentSlug);

    const target = await findPageOrAliasTarget(input.siteId, currentSlug, database);
    if (!target) {
      return;
    }
    if (target.id === input.pageId) {
      throw new ConflictError("Redirect loop detected.");
    }
    if (!shouldFollowContentRedirect(target)) {
      return;
    }
    const next = await getCurrentRedirectDirective(target, database);
    if (!next) {
      return;
    }
    currentSlug = next.targetSlug;
  }

  throw new ConflictError("Redirect depth exceeded.");
}

async function redirectTargetStatus(
  target: Page | null,
  database: Database
): Promise<RedirectTargetStatus> {
  if (!target) {
    return "missing";
  }
  if (target.deletedAt || target.status === "deleted") {
    return "deleted";
  }
  if (target.status === "archived") {
    return "archived";
  }
  if (target.status === "draft") {
    return "draft";
  }
  const directive = await getCurrentRedirectDirective(target, database);
  return directive ? "double" : "valid";
}

async function findPageOrAliasTarget(siteId: string, slug: string, database: Database) {
  const [page] = await database
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug)))
    .limit(1);
  if (page) {
    return page;
  }

  const [alias] = await database
    .select()
    .from(pageAliases)
    .where(and(eq(pageAliases.siteId, siteId), eq(pageAliases.aliasSlug, slug)))
    .limit(1);
  if (!alias) {
    return null;
  }
  const [target] = await database
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, alias.pageId)))
    .limit(1);
  return target ?? null;
}

function shouldFollowContentRedirect(
  page: Pick<Page, "currentRevisionId" | "deletedAt" | "status">
) {
  return Boolean(page.currentRevisionId && !page.deletedAt && page.status === "published");
}

async function getCurrentRedirectDirective(
  page: Pick<Page, "currentRevisionId">,
  database: Database
) {
  if (!page.currentRevisionId) {
    return null;
  }
  const [revision] = await database
    .select({ markdown: pageRevisions.markdown })
    .from(pageRevisions)
    .where(eq(pageRevisions.id, page.currentRevisionId))
    .limit(1);
  return revision ? parseRedirectDirective(revision.markdown) : null;
}
