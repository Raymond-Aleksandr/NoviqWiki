import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { pageWatchlist, pages, type AuditLog } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { listRecentChangesPage } from "@/modules/activity/service";

export type WatchPageInput = {
  siteId: string;
  userId: string;
  pageId: string;
};

export type ListWatchlistInput = {
  siteId: string;
  userId: string;
  limit?: number;
  offset?: number;
  actions?: readonly AuditLog["action"][];
};

export type WatchedPage = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: Date;
  watchedAt: Date;
};

export async function watchPage(input: WatchPageInput, database: Database = db) {
  await assertPageInSite(input.siteId, input.pageId, database);
  const [watch] = await database
    .insert(pageWatchlist)
    .values(input)
    .onConflictDoNothing()
    .returning();
  return watch ?? (await getWatchedPage(input, database));
}

export async function unwatchPage(input: WatchPageInput, database: Database = db) {
  await database
    .delete(pageWatchlist)
    .where(
      and(
        eq(pageWatchlist.siteId, input.siteId),
        eq(pageWatchlist.userId, input.userId),
        eq(pageWatchlist.pageId, input.pageId)
      )
    );
}

export async function isPageWatched(input: WatchPageInput, database: Database = db) {
  const [watch] = await database
    .select({ pageId: pageWatchlist.pageId })
    .from(pageWatchlist)
    .where(
      and(
        eq(pageWatchlist.siteId, input.siteId),
        eq(pageWatchlist.userId, input.userId),
        eq(pageWatchlist.pageId, input.pageId)
      )
    )
    .limit(1);
  return Boolean(watch);
}

export async function listWatchedPages(input: ListWatchlistInput, database: Database = db) {
  const rows = await database
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      updatedAt: pages.updatedAt,
      watchedAt: pageWatchlist.createdAt
    })
    .from(pageWatchlist)
    .innerJoin(pages, eq(pages.id, pageWatchlist.pageId))
    .where(
      and(
        eq(pageWatchlist.siteId, input.siteId),
        eq(pageWatchlist.userId, input.userId),
        ne(pages.status, "deleted"),
        isNull(pages.deletedAt)
      )
    )
    .orderBy(desc(pageWatchlist.createdAt))
    .limit(input.limit ?? 25)
    .offset(input.offset ?? 0);
  return rows satisfies WatchedPage[];
}

export async function countWatchedPages(input: ListWatchlistInput, database: Database = db) {
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(pageWatchlist)
    .innerJoin(pages, eq(pages.id, pageWatchlist.pageId))
    .where(
      and(
        eq(pageWatchlist.siteId, input.siteId),
        eq(pageWatchlist.userId, input.userId),
        ne(pages.status, "deleted"),
        isNull(pages.deletedAt)
      )
    );
  return count;
}

export async function listWatchlistChanges(input: ListWatchlistInput, database: Database = db) {
  const pageIds = await listWatchedPageIds(input, database);
  if (pageIds.length === 0) {
    return { rows: [], count: 0 };
  }
  return listRecentChangesPage(
    {
      siteId: input.siteId,
      limit: input.limit,
      offset: input.offset,
      actions: input.actions,
      pageIds,
      publicOnly: true
    },
    database
  );
}

async function listWatchedPageIds(input: ListWatchlistInput, database: Database) {
  const rows = await database
    .select({ pageId: pageWatchlist.pageId })
    .from(pageWatchlist)
    .where(and(eq(pageWatchlist.siteId, input.siteId), eq(pageWatchlist.userId, input.userId)));
  return rows.map((row) => row.pageId);
}

async function assertPageInSite(siteId: string, pageId: string, database: Database) {
  const [page] = await database
    .select({ id: pages.id, status: pages.status, deletedAt: pages.deletedAt })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
    .limit(1);
  if (!page || page.status === "deleted" || page.deletedAt) {
    throw new AppError("Page not found.", "page_not_found", 404);
  }
}

async function getWatchedPage(input: WatchPageInput, database: Database) {
  const [watch] = await database
    .select()
    .from(pageWatchlist)
    .where(
      and(
        eq(pageWatchlist.siteId, input.siteId),
        eq(pageWatchlist.userId, input.userId),
        eq(pageWatchlist.pageId, input.pageId)
      )
    )
    .limit(1);
  return watch ?? null;
}
