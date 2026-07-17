import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { pageAliases, pages } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function resolvePageBySlug(
  input: { siteId: string; slug: string; maxDepth?: number },
  database: Database = db
) {
  const maxDepth = input.maxDepth ?? 8;
  let currentSlug = input.slug;
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
      return { page, redirectedFrom: currentSlug === input.slug ? null : input.slug };
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
    currentSlug = target.slug;
  }
  throw new ConflictError("Redirect depth exceeded.");
}
