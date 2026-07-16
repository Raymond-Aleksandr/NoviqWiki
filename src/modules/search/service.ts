import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { pageAliases, pageRevisions, pages, searchIndex } from "@/db/schema";

export async function upsertSearchIndex(
  input: {
    siteId: string;
    pageId: string;
    title: string;
    plainText: string;
    categories: string[];
  },
  database: Database = db
) {
  const aliases = await database
    .select({ aliasTitle: pageAliases.aliasTitle })
    .from(pageAliases)
    .where(eq(pageAliases.pageId, input.pageId));
  await database
    .insert(searchIndex)
    .values({
      pageId: input.pageId,
      siteId: input.siteId,
      title: input.title,
      aliases: aliases.map((alias) => alias.aliasTitle).join(" "),
      plainText: input.plainText,
      categories: input.categories.join(" "),
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: searchIndex.pageId,
      set: {
        title: input.title,
        aliases: aliases.map((alias) => alias.aliasTitle).join(" "),
        plainText: input.plainText,
        categories: input.categories.join(" "),
        updatedAt: new Date()
      }
    });
}

export async function removeSearchIndex(pageId: string, database: Database = db) {
  await database.delete(searchIndex).where(eq(searchIndex.pageId, pageId));
}

export async function searchPages(
  input: {
    siteId: string;
    query: string;
    category?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  },
  database: Database = db
) {
  const trimmed = input.query.trim();
  if (!trimmed) {
    return { rows: [], count: 0 };
  }
  const tsQuery = sql`websearch_to_tsquery('simple', ${trimmed})`;
  const categoryWhere = input.category
    ? ilike(searchIndex.categories, `%${input.category}%`)
    : undefined;
  const visibility = input.includeDeleted
    ? undefined
    : and(eq(pages.status, "published"), sql`${pages.deletedAt} is null`);
  const where = and(
    eq(searchIndex.siteId, input.siteId),
    or(sql`${searchIndex.searchVector} @@ ${tsQuery}`, ilike(searchIndex.title, `%${trimmed}%`)),
    categoryWhere,
    visibility
  );
  const rows = await database
    .select({
      pageId: searchIndex.pageId,
      title: searchIndex.title,
      slug: pages.slug,
      excerpt: sql<string>`ts_headline('simple', ${searchIndex.plainText}, ${tsQuery}, 'StartSel=<mark>,StopSel=</mark>,MaxWords=32,MinWords=8')`,
      rank: sql<number>`ts_rank_cd(${searchIndex.searchVector}, ${tsQuery}) + case when lower(${searchIndex.title}) = lower(${trimmed}) then 5 else 0 end`
    })
    .from(searchIndex)
    .innerJoin(pages, eq(pages.id, searchIndex.pageId))
    .where(where)
    .orderBy(desc(sql`ts_rank_cd(${searchIndex.searchVector}, ${tsQuery})`))
    .limit(input.limit ?? 20)
    .offset(input.offset ?? 0);
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(searchIndex)
    .innerJoin(pages, eq(pages.id, searchIndex.pageId))
    .where(where);
  return { rows, count };
}

export async function rebuildSearchIndex(siteId: string, database: Database = db) {
  const current = await database
    .select({
      pageId: pages.id,
      siteId: pages.siteId,
      title: pages.title,
      plainText: pageRevisions.plainText,
      categories: pageRevisions.categories
    })
    .from(pages)
    .innerJoin(pageRevisions, eq(pages.currentRevisionId, pageRevisions.id))
    .where(and(eq(pages.siteId, siteId), eq(pages.status, "published")));
  for (const row of current) {
    await upsertSearchIndex(
      {
        siteId: row.siteId,
        pageId: row.pageId,
        title: row.title,
        plainText: row.plainText,
        categories: row.categories
      },
      database
    );
  }
  return current.length;
}
