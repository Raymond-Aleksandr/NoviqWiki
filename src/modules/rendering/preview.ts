import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { pages } from "@/db/schema";
import { renderMarkdown } from "@/modules/rendering/markdown";
import { decorateWikiLinkHtml, type ResolvedWikiLink } from "@/modules/rendering/wiki-link-html";

export async function renderEditorPreview(
  input: {
    siteId: string;
    markdown: string;
    canCreatePage: boolean;
  },
  database: Database = db
) {
  const rendered = await renderMarkdown(input.markdown);
  const outboundLinks = await resolvePreviewWikiLinks(input.siteId, rendered.links, database);

  return {
    ...rendered,
    html: decorateWikiLinkHtml(rendered.html, outboundLinks, input.canCreatePage),
    outboundLinks
  };
}

async function resolvePreviewWikiLinks(
  siteId: string,
  links: Array<{ target: string; normalizedTarget: string; label: string }>,
  database: Database
): Promise<ResolvedWikiLink[]> {
  if (links.length === 0) {
    return [];
  }

  const targetPages = await database
    .select({
      id: pages.id,
      slug: pages.slug,
      normalizedTitle: pages.normalizedTitle
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        inArray(
          pages.normalizedTitle,
          links.map((link) => link.normalizedTarget)
        )
      )
    );
  const targets = new Map(targetPages.map((page) => [page.normalizedTitle, page]));

  return links.map((link) => {
    const target = targets.get(link.normalizedTarget);
    return {
      targetTitle: link.target,
      label: link.label,
      targetPageId: target?.id ?? null,
      targetSlug: target?.slug ?? null,
      exists: Boolean(target)
    };
  });
}
