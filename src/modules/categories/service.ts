import { and, eq, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { categories, pageCategories, pages } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

export async function listCategories(siteId: string, database: Database = db) {
  return database
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      pageCount: sql<number>`count(${pageCategories.pageId})::int`
    })
    .from(categories)
    .leftJoin(pageCategories, eq(pageCategories.categoryId, categories.id))
    .where(eq(categories.siteId, siteId))
    .groupBy(categories.id)
    .orderBy(categories.name);
}

export async function getCategoryWithPages(
  input: { siteId: string; slug: string; limit?: number; offset?: number },
  database: Database = db
) {
  const [category] = await database
    .select()
    .from(categories)
    .where(and(eq(categories.siteId, input.siteId), eq(categories.slug, input.slug)))
    .limit(1);
  if (!category) {
    throw new NotFoundError("Category not found.");
  }
  const rows = await database
    .select({ page: pages })
    .from(pageCategories)
    .innerJoin(pages, eq(pages.id, pageCategories.pageId))
    .where(and(eq(pageCategories.categoryId, category.id), eq(pages.status, "published")))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return { category, pages: rows.map((row) => row.page) };
}
