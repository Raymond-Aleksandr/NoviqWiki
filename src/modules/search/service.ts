import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  categories,
  pageAliases,
  pageCategories,
  pageRevisions,
  pages,
  searchIndex
} from "@/db/schema";

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
  const prefixQueryText = buildPrefixTsQuery(trimmed);
  const prefixTsQuery = prefixQueryText ? sql`to_tsquery('simple', ${prefixQueryText})` : undefined;
  const likePattern = `%${escapeLikePattern(trimmed)}%`;
  const startsWithPattern = `${escapeLikePattern(trimmed)}%`;
  const categoryWhere = input.category
    ? sql`exists (
        select 1
        from ${pageCategories}
        inner join ${categories} on ${categories.id} = ${pageCategories.categoryId}
        where ${pageCategories.pageId} = ${searchIndex.pageId}
          and ${categories.siteId} = ${input.siteId}
          and ${categories.slug} = ${input.category}
      )`
    : undefined;
  const visibility = input.includeDeleted
    ? undefined
    : and(eq(pages.status, "published"), sql`${pages.deletedAt} is null`);
  const textMatches = or(
    sql`${searchIndex.searchVector} @@ ${tsQuery}`,
    prefixTsQuery ? sql`${searchIndex.searchVector} @@ ${prefixTsQuery}` : undefined,
    sql`${searchIndex.title} ilike ${likePattern} escape '\\'`,
    sql`${searchIndex.aliases} ilike ${likePattern} escape '\\'`,
    sql`${searchIndex.categories} ilike ${likePattern} escape '\\'`,
    sql`${searchIndex.plainText} ilike ${likePattern} escape '\\'`
  );
  const rankExpression = sql<number>`
    ts_rank_cd(${searchIndex.searchVector}, ${tsQuery})
    + ${prefixTsQuery ? sql`ts_rank_cd(${searchIndex.searchVector}, ${prefixTsQuery}) * 0.75` : sql`0`}
    + case
        when lower(${searchIndex.title}) = lower(${trimmed}) then 5
        when ${searchIndex.title} ilike ${startsWithPattern} escape '\\' then 2
        when ${searchIndex.title} ilike ${likePattern} escape '\\' then 1
        when ${searchIndex.aliases} ilike ${likePattern} escape '\\' then 0.75
        when ${searchIndex.categories} ilike ${likePattern} escape '\\' then 0.5
        when ${searchIndex.plainText} ilike ${likePattern} escape '\\' then 0.25
        else 0
      end
  `;
  const where = and(eq(searchIndex.siteId, input.siteId), textMatches, categoryWhere, visibility);
  const rows = await database
    .select({
      pageId: searchIndex.pageId,
      title: searchIndex.title,
      slug: pages.slug,
      excerpt: sql<string>`ts_headline('simple', ${searchIndex.plainText}, ${prefixTsQuery ?? tsQuery}, 'StartSel=<mark>,StopSel=</mark>,MaxWords=32,MinWords=8')`,
      rank: rankExpression
    })
    .from(searchIndex)
    .innerJoin(pages, eq(pages.id, searchIndex.pageId))
    .where(where)
    .orderBy(desc(rankExpression))
    .limit(input.limit ?? 20)
    .offset(input.offset ?? 0);
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(searchIndex)
    .innerJoin(pages, eq(pages.id, searchIndex.pageId))
    .where(where);
  return { rows, count };
}

function buildPrefixTsQuery(query: string) {
  const tokens = Array.from(query.matchAll(/[\p{L}\p{N}]+/gu))
    .map((match) => match[0])
    .filter(Boolean)
    .slice(0, 12);
  if (tokens.length === 0) {
    return null;
  }
  return tokens.map((token) => `${token}:*`).join(" & ");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function rebuildSearchIndex(siteId: string, database: Database = db) {
  await database.delete(searchIndex).where(eq(searchIndex.siteId, siteId));
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
    .where(
      and(eq(pages.siteId, siteId), eq(pages.status, "published"), sql`${pages.deletedAt} is null`)
    );
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
