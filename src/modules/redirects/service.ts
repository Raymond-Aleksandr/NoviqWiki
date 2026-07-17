import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { pageAliases, pageRevisions, pages, type Page } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { parseRedirectDirective } from "./directive";

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
