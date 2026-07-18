import { and, asc, desc, eq, ilike, inArray, isNull, max, or, sql } from "drizzle-orm";
import {
  lockPageGraphForTransaction,
  lockSearchIndexWriterForTransaction
} from "@/db/advisory-locks";
import { db, type Database, type RootDatabase } from "@/db/client";
import {
  categories,
  pageAliases,
  pageCategories,
  pageDrafts,
  pageLinks,
  pageRevisions,
  pages,
  type Page,
  type PageRevision
} from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { contentHash } from "@/lib/crypto";
import { normalizeTitle, slugifyTitle } from "@/lib/normalize";
import { writeAuditLog } from "@/modules/audit/service";
import { hasPermission, requirePermissionsForMutation } from "@/modules/authorization/permissions";
import { renderMarkdown, type RenderedHeading } from "@/modules/rendering/markdown";
import { assertNoRedirectLoopForRevision } from "@/modules/redirects/service";
import { parseRedirectDirective } from "@/modules/redirects/directive";
import {
  createSideBySideDiff,
  createUnifiedDiff,
  parseUnifiedDiff
} from "@/modules/revisions/diff";
import { removeSearchIndex, upsertSearchIndex } from "@/modules/search/service";
import { derivePageIdentity } from "./title";

export type PublicationState = "draft" | "published";
export type PageProtectionLevel = "none" | "protected";
export const MAX_PAGE_MARKDOWN_LENGTH = 1_000_000;
export const MAX_PAGE_RELATIONSHIPS = 500;
export const MAX_PAGE_EDIT_SUMMARY_LENGTH = 1_000;

export async function createPage(
  input: {
    siteId: string;
    title: string;
    slug?: string;
    markdown: string;
    actorId: string;
    actorDisplayName: string;
    editSummary?: string;
    publish: boolean;
  },
  database: RootDatabase = db
) {
  assertMarkdownWithinLimits(input.markdown);
  assertEditSummaryWithinLimits(input.editSummary, "editSummary");
  const identity = derivePageIdentity(input.title, input.slug);
  const canonicalTitleSlug = slugifyTitle(identity.title);
  const preparedRevision = input.publish ? await prepareRevision(input.markdown) : null;
  return database.transaction(async (tx) => {
    await requirePermissionsForMutation(
      input.actorId,
      input.siteId,
      input.publish ? ["page.create", "page.publish"] : ["page.create"],
      tx
    );
    if (input.publish) {
      await lockSearchIndexWriterForTransaction(input.siteId, tx);
    }
    await lockPageGraphForTransaction(input.siteId, tx);
    const duplicate = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.siteId, input.siteId),
          or(
            eq(pages.slug, identity.slug),
            eq(pages.slug, canonicalTitleSlug),
            eq(pages.normalizedTitle, identity.normalizedTitle)
          )
        )
      )
      .limit(1);
    if (duplicate.length > 0) {
      throw new ConflictError("A page with this title or slug already exists.");
    }
    await assertAliasSlugAvailable({ siteId: input.siteId, slug: identity.slug, pageId: null }, tx);
    if (canonicalTitleSlug !== identity.slug) {
      await assertAliasSlugAvailable(
        { siteId: input.siteId, slug: canonicalTitleSlug, pageId: null },
        tx
      );
    }

    const [page] = await tx
      .insert(pages)
      .values({
        siteId: input.siteId,
        title: identity.title,
        normalizedTitle: identity.normalizedTitle,
        slug: identity.slug,
        creatorId: input.actorId,
        status: input.publish ? "published" : "draft"
      })
      .returning();

    if (canonicalTitleSlug !== identity.slug) {
      await tx.insert(pageAliases).values({
        siteId: input.siteId,
        pageId: page.id,
        aliasSlug: canonicalTitleSlug,
        aliasTitle: identity.title
      });
    }
    await bindUnresolvedPageLinks(page, tx);

    if (input.publish) {
      if (!preparedRevision) {
        throw new Error("Published page content was not prepared.");
      }
      await assertNoRedirectLoopForRevision(
        {
          siteId: input.siteId,
          pageId: page.id,
          pageSlug: page.slug,
          markdown: input.markdown
        },
        tx
      );
      const revision = await createRevision(
        {
          page,
          prepared: preparedRevision,
          parentRevisionId: null,
          revisionNumber: 1,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          editSummary: input.editSummary ?? "Initial publication",
          state: "published"
        },
        tx
      );
      await tx
        .update(pages)
        .set({ currentRevisionId: revision.id, status: "published", updatedAt: new Date() })
        .where(eq(pages.id, page.id));
      await updateRelationships(page.id, input.siteId, revision, tx);
      await upsertSearchIndex(
        {
          siteId: input.siteId,
          pageId: page.id,
          title: page.title,
          plainText: revision.plainText,
          categories: revision.categories
        },
        tx
      );
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: "page.created",
          targetType: "page",
          targetId: page.id,
          details: { title: page.title, revisionId: revision.id }
        },
        tx
      );
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: "page.published",
          targetType: "page",
          targetId: page.id,
          details: { title: page.title, revisionId: revision.id }
        },
        tx
      );
      return {
        page: { ...page, currentRevisionId: revision.id, status: "published" as const },
        revision
      };
    }

    const [draft] = await tx
      .insert(pageDrafts)
      .values({
        pageId: page.id,
        baseRevisionId: null,
        markdown: input.markdown,
        editorId: input.actorId,
        editSummary: input.editSummary ?? ""
      })
      .returning();
    await writeAuditLog(
      {
        siteId: input.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.draft_saved",
        targetType: "page",
        targetId: page.id,
        details: { title: page.title, draftId: draft.id }
      },
      tx
    );
    return { page, draft };
  });
}

export async function saveDraft(
  input: {
    pageId: string;
    actorId: string;
    actorDisplayName: string;
    markdown: string;
    editSummary?: string;
    baseRevisionId?: string | null;
  },
  database: RootDatabase = db
) {
  assertMarkdownWithinLimits(input.markdown);
  assertEditSummaryWithinLimits(input.editSummary, "editSummary");
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(input.actorId, page.siteId, ["page.edit"], tx);
    if (page.deletedAt || page.status === "deleted") {
      throw new ConflictError("Deleted pages must be restored before editing.");
    }
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    await lockPageGraphForTransaction(page.siteId, tx);
    const [draft] = await tx
      .insert(pageDrafts)
      .values({
        pageId: input.pageId,
        baseRevisionId: input.baseRevisionId ?? page.currentRevisionId,
        markdown: input.markdown,
        editorId: input.actorId,
        editSummary: input.editSummary ?? ""
      })
      .onConflictDoUpdate({
        target: [pageDrafts.pageId, pageDrafts.editorId],
        set: {
          baseRevisionId: input.baseRevisionId ?? page.currentRevisionId,
          markdown: input.markdown,
          editSummary: input.editSummary ?? "",
          updatedAt: new Date()
        }
      })
      .returning();
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.draft_saved",
        targetType: "page",
        targetId: page.id,
        details: { draftId: draft.id }
      },
      tx
    );
    return draft;
  });
}

export async function publishPage(
  input: {
    pageId: string;
    actorId: string;
    actorDisplayName: string;
    markdown: string;
    editSummary?: string;
    baseRevisionId?: string | null;
  },
  database: RootDatabase = db
) {
  assertMarkdownWithinLimits(input.markdown);
  assertEditSummaryWithinLimits(input.editSummary, "editSummary");
  const preparedRevision = await prepareRevision(input.markdown);
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(
      input.actorId,
      page.siteId,
      ["page.edit", "page.publish"],
      tx
    );
    if (page.deletedAt || page.status === "deleted") {
      throw new ConflictError("Deleted pages must be restored before editing.");
    }
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const expectedBase = input.baseRevisionId ?? null;
    if ((page.currentRevisionId ?? null) !== expectedBase) {
      throw new ConflictError("The page changed after this editor loaded it.");
    }
    await lockSearchIndexWriterForTransaction(page.siteId, tx);
    await lockPageGraphForTransaction(page.siteId, tx);
    const revisionNumber = await getNextRevisionNumber(page.id, tx);
    const revision = await createRevision(
      {
        page,
        prepared: preparedRevision,
        parentRevisionId: page.currentRevisionId,
        revisionNumber,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        editSummary: input.editSummary ?? "",
        state: "published"
      },
      tx
    );
    await assertNoRedirectLoopForRevision(
      {
        siteId: page.siteId,
        pageId: page.id,
        pageSlug: page.slug,
        markdown: preparedRevision.markdown
      },
      tx
    );
    const updated = await tx
      .update(pages)
      .set({
        currentRevisionId: revision.id,
        status: "published",
        archivedAt: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(pages.id, page.id),
          expectedBase
            ? eq(pages.currentRevisionId, expectedBase)
            : isNull(pages.currentRevisionId),
          isNull(pages.deletedAt)
        )
      )
      .returning({ id: pages.id });
    if (updated.length !== 1) {
      throw new ConflictError("The page changed after this editor loaded it.");
    }
    await tx
      .delete(pageDrafts)
      .where(and(eq(pageDrafts.pageId, page.id), eq(pageDrafts.editorId, input.actorId)));
    await updateRelationships(page.id, page.siteId, revision, tx);
    await upsertSearchIndex(
      {
        siteId: page.siteId,
        pageId: page.id,
        title: page.title,
        plainText: revision.plainText,
        categories: revision.categories
      },
      tx
    );
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.published",
        targetType: "page",
        targetId: page.id,
        details: { title: page.title, revisionId: revision.id }
      },
      tx
    );
    return revision;
  });
}

export async function listPages(
  input: {
    siteId: string;
    query?: string;
    status?: "draft" | "published" | "archived" | "deleted";
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  },
  database: RootDatabase = db
) {
  const conditions = [
    eq(pages.siteId, input.siteId),
    input.query
      ? or(ilike(pages.title, `%${input.query}%`), ilike(pages.slug, `%${input.query}%`))
      : undefined,
    input.status ? eq(pages.status, input.status) : undefined,
    input.includeDeleted ? undefined : isNull(pages.deletedAt)
  ].filter(Boolean);
  return database
    .select()
    .from(pages)
    .where(and(...conditions))
    .orderBy(desc(pages.updatedAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
}

export async function listPagesBySlugs(
  input: { siteId: string; slugs: string[]; limit?: number },
  database: RootDatabase = db
) {
  const uniqueSlugs = Array.from(new Set(input.slugs.map((slug) => slug.trim()).filter(Boolean)));
  if (uniqueSlugs.length === 0) {
    return [];
  }
  const rows = await database
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        inArray(pages.slug, uniqueSlugs)
      )
    )
    .limit(input.limit ?? uniqueSlugs.length);
  const order = new Map(uniqueSlugs.map((slug, index) => [slug, index]));
  return rows.sort((left, right) => (order.get(left.slug) ?? 0) - (order.get(right.slug) ?? 0));
}

export async function getPageById(pageId: string, database: Database = db) {
  const [page] = await database.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) {
    throw new NotFoundError("Page not found.");
  }
  return page;
}

export async function getPageWithCurrentRevision(pageId: string, database: Database = db) {
  const page = await getPageById(pageId, database);
  if (!page.currentRevisionId) {
    return { page, revision: null };
  }
  const revision = await getRevisionById(page.currentRevisionId, database);
  return { page, revision };
}

export async function getDraftForEditor(
  input: { pageId: string; editorId: string },
  database: Database = db
) {
  const [draft] = await database
    .select()
    .from(pageDrafts)
    .where(and(eq(pageDrafts.pageId, input.pageId), eq(pageDrafts.editorId, input.editorId)))
    .limit(1);
  return draft ?? null;
}

export async function getRevisionById(revisionId: string, database: Database = db) {
  const [revision] = await database
    .select()
    .from(pageRevisions)
    .where(eq(pageRevisions.id, revisionId))
    .limit(1);
  if (!revision) {
    throw new NotFoundError("Revision not found.");
  }
  return revision;
}

export async function getRevisionByNumber(
  pageId: string,
  revisionNumber: number,
  database: RootDatabase = db
) {
  const [revision] = await database
    .select()
    .from(pageRevisions)
    .where(and(eq(pageRevisions.pageId, pageId), eq(pageRevisions.revisionNumber, revisionNumber)))
    .limit(1);
  if (!revision) {
    throw new NotFoundError("Revision not found.");
  }
  return revision;
}

export async function listRevisions(pageId: string, database: Database = db) {
  return database
    .select()
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.revisionNumber));
}

export async function listRevisionsForRead(pageId: string, database: Database = db) {
  const page = await getPageById(pageId, database);
  assertPageVisibleForRead(page);
  return listRevisions(pageId, database);
}

export async function getRevisionForRead(revisionId: string, database: Database = db) {
  const revision = await getRevisionById(revisionId, database);
  const page = await getPageById(revision.pageId, database);
  assertPageVisibleForRead(page);
  return { page, revision };
}

export type PageBacklink = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: Date;
};

export async function listPageBacklinks(
  input: { siteId: string; pageId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<PageBacklink[]> {
  const page = await getPageById(input.pageId, database);
  if (page.siteId !== input.siteId) {
    throw new NotFoundError("Page not found.");
  }
  assertPageVisibleForRead(page);
  const rows = await database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.sourcePageId))
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`${pages.id} <> ${page.id}`,
        or(
          eq(pageLinks.targetPageId, page.id),
          eq(pageLinks.targetNormalizedTitle, page.normalizedTitle)
        )
      )
    )
    .orderBy(desc(pages.updatedAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);

  return uniqueRows(rows, (row) => row.pageId);
}

export type PageOutboundLink = {
  targetTitle: string;
  label: string | null;
  targetPageId: string | null;
  targetSlug: string | null;
  exists: boolean;
};

export type WantedPage = {
  targetTitle: string;
  targetNormalizedTitle: string;
  sourceCount: number;
  updatedAt: Date;
};

export type OrphanedPage = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: Date;
};

export type DeadEndPage = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: Date;
};

export type UncategorizedPage = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: Date;
};

export type ShortPage = {
  pageId: string;
  title: string;
  slug: string;
  plainTextLength: number;
  updatedAt: Date;
};

export type ProtectedPage = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: Date;
};

export type PublishedPageIndexEntry = {
  pageId: string;
  title: string;
  slug: string;
  updatedAt: Date;
};

export type RandomPublishedPage = {
  pageId: string;
  title: string;
  slug: string;
};

export async function listPageOutboundLinks(
  input: { siteId: string; pageId: string },
  database: Database = db
): Promise<PageOutboundLink[]> {
  const rows = await database
    .select()
    .from(pageLinks)
    .where(eq(pageLinks.sourcePageId, input.pageId))
    .orderBy(asc(pageLinks.targetTitle));
  if (rows.length === 0) {
    return [];
  }

  const targetPageIds = rows.flatMap((row) => (row.targetPageId ? [row.targetPageId] : []));
  const targetPages = await database
    .select({
      id: pages.id,
      slug: pages.slug,
      normalizedTitle: pages.normalizedTitle,
      status: pages.status,
      deletedAt: pages.deletedAt
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, input.siteId),
        targetPageIds.length > 0
          ? or(
              inArray(
                pages.normalizedTitle,
                rows.map((row) => row.targetNormalizedTitle)
              ),
              inArray(pages.id, targetPageIds)
            )
          : inArray(
              pages.normalizedTitle,
              rows.map((row) => row.targetNormalizedTitle)
            )
      )
    );
  const targetsByTitle = new Map(targetPages.map((page) => [page.normalizedTitle, page]));
  const targetsById = new Map(targetPages.map((page) => [page.id, page]));

  return rows.map((row) => {
    const target =
      (row.targetPageId ? targetsById.get(row.targetPageId) : undefined) ??
      targetsByTitle.get(row.targetNormalizedTitle);
    const exists = Boolean(target && target.status === "published" && !target.deletedAt);
    return {
      targetTitle: row.targetTitle,
      label: row.label,
      targetPageId: exists ? (target?.id ?? null) : null,
      targetSlug: exists ? (target?.slug ?? null) : null,
      exists
    };
  });
}

export async function listWantedPages(
  input: { siteId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<WantedPage[]> {
  return database
    .select({
      targetTitle: sql<string>`min(${pageLinks.targetTitle})`,
      targetNormalizedTitle: pageLinks.targetNormalizedTitle,
      sourceCount: sql<number>`count(distinct ${pageLinks.sourcePageId})::int`,
      updatedAt: sql<Date>`max(${pages.updatedAt})`
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.sourcePageId))
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`not exists (
          select 1
          from ${pages} as wanted_target
          where wanted_target.site_id = ${input.siteId}
            and (
              wanted_target.id = ${pageLinks.targetPageId}
              or wanted_target.normalized_title = ${pageLinks.targetNormalizedTitle}
            )
            and wanted_target.status = 'published'
            and wanted_target.deleted_at is null
        )`
      )
    )
    .groupBy(pageLinks.targetNormalizedTitle)
    .orderBy(
      desc(sql<number>`count(distinct ${pageLinks.sourcePageId})::int`),
      asc(sql<string>`min(${pageLinks.targetTitle})`)
    )
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listOrphanedPages(
  input: { siteId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<OrphanedPage[]> {
  return database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`not exists (
          select 1
          from ${pageLinks}
          inner join ${pages} as orphan_source_pages
            on orphan_source_pages.id = ${pageLinks.sourcePageId}
          where orphan_source_pages.site_id = ${input.siteId}
            and orphan_source_pages.status = 'published'
            and orphan_source_pages.deleted_at is null
            and orphan_source_pages.id <> ${pages.id}
            and (
              ${pageLinks.targetPageId} = ${pages.id}
              or ${pageLinks.targetNormalizedTitle} = ${pages.normalizedTitle}
            )
        )`
      )
    )
    .orderBy(desc(pages.updatedAt), asc(pages.title))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listDeadEndPages(
  input: { siteId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<DeadEndPage[]> {
  return database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`not exists (
          select 1
          from ${pageLinks}
          inner join ${pages} as dead_target_pages
            on dead_target_pages.site_id = ${input.siteId}
            and dead_target_pages.status = 'published'
            and dead_target_pages.deleted_at is null
            and dead_target_pages.id <> ${pages.id}
            and (
              ${pageLinks.targetPageId} = dead_target_pages.id
              or ${pageLinks.targetNormalizedTitle} = dead_target_pages.normalized_title
            )
          where ${pageLinks.sourcePageId} = ${pages.id}
        )`
      )
    )
    .orderBy(desc(pages.updatedAt), asc(pages.title))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listUncategorizedPages(
  input: { siteId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<UncategorizedPage[]> {
  return database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`not exists (
          select 1
          from ${pageCategories}
          where ${pageCategories.pageId} = ${pages.id}
        )`
      )
    )
    .orderBy(desc(pages.updatedAt), asc(pages.title))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listShortPages(
  input: { siteId: string; maxLength?: number; limit?: number; offset?: number },
  database: Database = db
): Promise<ShortPage[]> {
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;
  const maxLength = Math.max(1, Math.min(input.maxLength ?? 600, 5000));
  const rows = await database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt,
      plainTextLength: sql<number>`char_length(trim(${pageRevisions.plainText}))::int`,
      markdown: pageRevisions.markdown
    })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.id, pages.currentRevisionId))
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`char_length(trim(${pageRevisions.plainText})) <= ${maxLength}`
      )
    )
    .orderBy(
      asc(sql<number>`char_length(trim(${pageRevisions.plainText}))::int`),
      desc(pages.updatedAt),
      asc(pages.title)
    );

  return rows
    .filter((row) => !parseRedirectDirective(row.markdown))
    .slice(offset, offset + limit)
    .map(({ markdown: _markdown, ...row }) => row);
}

export async function listProtectedPages(
  input: { siteId: string; limit?: number; offset?: number },
  database: Database = db
): Promise<ProtectedPage[]> {
  return database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        eq(pages.protectionLevel, "protected")
      )
    )
    .orderBy(desc(pages.updatedAt), asc(pages.title))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listPublishedPageIndex(
  input: { siteId: string; query?: string; prefix?: string; limit?: number; offset?: number },
  database: Database = db
): Promise<{ rows: PublishedPageIndexEntry[]; count: number }> {
  const where = publishedPageIndexWhere(input);
  const [rows, [{ count }]] = await Promise.all([
    database
      .select({
        pageId: pages.id,
        title: pages.title,
        slug: pages.slug,
        updatedAt: pages.updatedAt
      })
      .from(pages)
      .where(where)
      .orderBy(asc(pages.title), asc(pages.slug))
      .limit(input.limit ?? 100)
      .offset(input.offset ?? 0),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(pages)
      .where(where)
  ]);
  return { rows, count };
}

export async function getRandomPublishedPage(
  input: { siteId: string },
  database: Database = db
): Promise<RandomPublishedPage | null> {
  const rows = await database
    .select({
      pageId: pages.id,
      title: pages.title,
      slug: pages.slug,
      markdown: pageRevisions.markdown
    })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.id, pages.currentRevisionId))
    .where(
      and(
        eq(pages.siteId, input.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        sql`${pageRevisions.markdown} !~* ${"^[[:space:]]*#(redirect|重定向)[[:space:]]*\\[\\["}`
      )
    )
    .orderBy(sql`random()`)
    .limit(1);
  const row = rows.find((candidate) => !parseRedirectDirective(candidate.markdown));
  if (!row) {
    return null;
  }
  const { markdown: _markdown, ...page } = row;
  return page;
}

export async function compareRevisions(
  input: { fromRevisionId: string; toRevisionId: string },
  database: RootDatabase = db
) {
  const from = await getRevisionById(input.fromRevisionId, database);
  const to = await getRevisionById(input.toRevisionId, database);
  if (from.pageId !== to.pageId) {
    throw new ConflictError("Revisions belong to different pages.");
  }
  const unified = createUnifiedDiff(
    from.markdown,
    to.markdown,
    `r${from.revisionNumber}`,
    `r${to.revisionNumber}`
  );
  return {
    from,
    to,
    unified,
    lines: parseUnifiedDiff(unified),
    sideBySide: createSideBySideDiff(from.markdown, to.markdown)
  };
}

export async function compareRevisionsForRead(
  input: { fromRevisionId: string; toRevisionId: string },
  database: RootDatabase = db
) {
  const diff = await compareRevisions(input, database);
  const page = await getPageById(diff.to.pageId, database);
  assertPageVisibleForRead(page);
  return { ...diff, page };
}

export async function rollbackPage(
  input: {
    pageId: string;
    targetRevisionId: string;
    actorId: string;
    actorDisplayName: string;
    reason: string;
  },
  database: RootDatabase = db
) {
  assertEditSummaryWithinLimits(input.reason, "reason");
  const targetSnapshot = await getRevisionById(input.targetRevisionId, database);
  if (targetSnapshot.pageId !== input.pageId) {
    throw new ConflictError("Target revision belongs to another page.");
  }
  const preparedRevision = await prepareRevision(targetSnapshot.markdown);
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(input.actorId, page.siteId, ["page.rollback"], tx);
    if (page.deletedAt || page.status === "deleted") {
      throw new ConflictError("Deleted pages must be restored before editing.");
    }
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const target = targetSnapshot;
    await lockSearchIndexWriterForTransaction(page.siteId, tx);
    await lockPageGraphForTransaction(page.siteId, tx);
    const revision = await createRevision(
      {
        page,
        prepared: preparedRevision,
        parentRevisionId: page.currentRevisionId,
        revisionNumber: await getNextRevisionNumber(page.id, tx),
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        editSummary: input.reason || `Rollback r${target.revisionNumber}`,
        state: "published"
      },
      tx
    );
    await assertNoRedirectLoopForRevision(
      {
        siteId: page.siteId,
        pageId: page.id,
        pageSlug: page.slug,
        markdown: preparedRevision.markdown
      },
      tx
    );
    await tx
      .update(pages)
      .set({
        currentRevisionId: revision.id,
        status: "published",
        archivedAt: null,
        updatedAt: new Date()
      })
      .where(eq(pages.id, page.id));
    await updateRelationships(page.id, page.siteId, revision, tx);
    await upsertSearchIndex(
      {
        siteId: page.siteId,
        pageId: page.id,
        title: page.title,
        plainText: revision.plainText,
        categories: revision.categories
      },
      tx
    );
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.rollback",
        targetType: "page",
        targetId: page.id,
        details: {
          title: page.title,
          targetRevisionId: target.id,
          newRevisionId: revision.id,
          reason: input.reason
        }
      },
      tx
    );
    return revision;
  });
}

export async function softDeletePage(
  input: { pageId: string; actorId: string; actorDisplayName: string },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(input.actorId, page.siteId, ["page.delete"], tx);
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    await lockSearchIndexWriterForTransaction(page.siteId, tx);
    const [updated] = await tx
      .update(pages)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        deletedById: input.actorId,
        archivedAt: null,
        updatedAt: new Date()
      })
      .where(eq(pages.id, input.pageId))
      .returning();
    await removeSearchIndex(input.pageId, tx);
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.deleted",
        targetType: "page",
        targetId: page.id,
        details: { title: page.title }
      },
      tx
    );
    return updated;
  });
}

export async function archivePage(
  input: { pageId: string; actorId: string; actorDisplayName: string },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(input.actorId, page.siteId, ["page.delete"], tx);
    if (page.deletedAt || page.status === "deleted") {
      throw new ConflictError("Deleted pages must be restored before archiving.");
    }
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    if (page.status === "archived") {
      return page;
    }
    await lockSearchIndexWriterForTransaction(page.siteId, tx);
    const [updated] = await tx
      .update(pages)
      .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(pages.id, input.pageId))
      .returning();
    await removeSearchIndex(input.pageId, tx);
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.updated",
        targetType: "page",
        targetId: page.id,
        details: { title: page.title, previousStatus: page.status, status: "archived" }
      },
      tx
    );
    return updated;
  });
}

export async function restorePage(
  input: { pageId: string; actorId: string; actorDisplayName: string },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(input.actorId, page.siteId, ["page.restore"], tx);
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const revision = page.currentRevisionId
      ? await getRevisionById(page.currentRevisionId, tx)
      : null;
    if (revision) {
      await lockSearchIndexWriterForTransaction(page.siteId, tx);
      await lockPageGraphForTransaction(page.siteId, tx);
      await assertNoRedirectLoopForRevision(
        {
          siteId: page.siteId,
          pageId: page.id,
          pageSlug: page.slug,
          markdown: revision.markdown
        },
        tx
      );
    }
    const [updated] = await tx
      .update(pages)
      .set({
        status: revision ? "published" : "draft",
        deletedAt: null,
        deletedById: null,
        archivedAt: null,
        updatedAt: new Date()
      })
      .where(eq(pages.id, input.pageId))
      .returning();
    if (revision) {
      await upsertSearchIndex(
        {
          siteId: page.siteId,
          pageId: page.id,
          title: page.title,
          plainText: revision.plainText,
          categories: revision.categories
        },
        tx
      );
    }
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.restored",
        targetType: "page",
        targetId: page.id,
        details: { title: page.title }
      },
      tx
    );
    return updated;
  });
}

export async function renamePage(
  input: {
    pageId: string;
    newTitle: string;
    newSlug?: string;
    createAlias?: boolean;
    actorId: string;
    actorDisplayName: string;
  },
  database: RootDatabase = db
) {
  const identity = derivePageIdentity(input.newTitle, input.newSlug);
  const canonicalTitleSlug = slugifyTitle(identity.title);
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(
      input.actorId,
      page.siteId,
      ["page.edit", "page.rename"],
      tx
    );
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const currentRevision = page.currentRevisionId
      ? await getRevisionById(page.currentRevisionId, tx)
      : null;
    const shouldIndex = Boolean(currentRevision && page.status === "published" && !page.deletedAt);
    if (shouldIndex) {
      await lockSearchIndexWriterForTransaction(page.siteId, tx);
    }
    await lockPageGraphForTransaction(page.siteId, tx);
    const previousCanonicalTitleSlug = slugifyTitle(page.title);
    const duplicate = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.siteId, page.siteId),
          or(
            eq(pages.slug, identity.slug),
            eq(pages.slug, canonicalTitleSlug),
            eq(pages.normalizedTitle, identity.normalizedTitle)
          ),
          sql`${pages.id} <> ${page.id}`
        )
      )
      .limit(1);
    if (duplicate.length > 0) {
      throw new ConflictError("A page with this title or slug already exists.");
    }
    await assertAliasSlugAvailable(
      { siteId: page.siteId, slug: identity.slug, pageId: page.id },
      tx
    );
    if (canonicalTitleSlug !== identity.slug) {
      await assertAliasSlugAvailable(
        { siteId: page.siteId, slug: canonicalTitleSlug, pageId: page.id },
        tx
      );
    }
    if (!input.createAlias) {
      await tx
        .delete(pageAliases)
        .where(
          and(
            eq(pageAliases.siteId, page.siteId),
            eq(pageAliases.pageId, page.id),
            eq(pageAliases.aliasSlug, previousCanonicalTitleSlug)
          )
        );
    }
    if (input.createAlias) {
      await tx
        .insert(pageAliases)
        .values({
          siteId: page.siteId,
          pageId: page.id,
          aliasSlug: page.slug,
          aliasTitle: page.title
        })
        .onConflictDoNothing();
    }
    await tx
      .delete(pageAliases)
      .where(
        and(
          eq(pageAliases.siteId, page.siteId),
          eq(pageAliases.pageId, page.id),
          eq(pageAliases.aliasSlug, identity.slug)
        )
      );
    const [updated] = await tx
      .update(pages)
      .set({
        title: identity.title,
        normalizedTitle: identity.normalizedTitle,
        slug: identity.slug,
        updatedAt: new Date()
      })
      .where(eq(pages.id, page.id))
      .returning();
    if (canonicalTitleSlug !== identity.slug) {
      await tx
        .insert(pageAliases)
        .values({
          siteId: page.siteId,
          pageId: page.id,
          aliasSlug: canonicalTitleSlug,
          aliasTitle: identity.title
        })
        .onConflictDoUpdate({
          target: [pageAliases.siteId, pageAliases.aliasSlug],
          set: { aliasTitle: identity.title }
        });
    }
    await reconcileIncomingPageLinks(page.id, page.siteId, tx);
    await bindUnresolvedPageLinks(updated, tx);
    if (currentRevision) {
      if (updated.status === "published" && !updated.deletedAt) {
        await assertNoRedirectLoopForRevision(
          {
            siteId: page.siteId,
            pageId: page.id,
            pageSlug: updated.slug,
            markdown: currentRevision.markdown
          },
          tx
        );
      }
    }
    if (currentRevision && shouldIndex) {
      await upsertSearchIndex(
        {
          siteId: page.siteId,
          pageId: page.id,
          title: updated.title,
          plainText: currentRevision.plainText,
          categories: currentRevision.categories
        },
        tx
      );
    }
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.renamed",
        targetType: "page",
        targetId: page.id,
        details: { from: page.title, to: updated.title, aliasCreated: Boolean(input.createAlias) }
      },
      tx
    );
    return updated;
  });
}

export async function setPageProtection(
  input: {
    pageId: string;
    protectionLevel: PageProtectionLevel;
    actorId: string;
    actorDisplayName: string;
  },
  database: RootDatabase = db
) {
  const protectionLevel = normalizeProtectionLevel(input.protectionLevel);
  return database.transaction(async (tx) => {
    const page = await getPageForMutation(input.pageId, tx);
    await requirePermissionsForMutation(input.actorId, page.siteId, ["page.protect"], tx);
    if (normalizeProtectionLevel(page.protectionLevel) === protectionLevel) {
      return page;
    }
    const [updated] = await tx
      .update(pages)
      .set({ protectionLevel, updatedAt: new Date() })
      .where(eq(pages.id, page.id))
      .returning();
    await writeAuditLog(
      {
        siteId: page.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "page.updated",
        targetType: "page",
        targetId: page.id,
        details: {
          title: page.title,
          previousProtectionLevel: normalizeProtectionLevel(page.protectionLevel),
          protectionLevel
        }
      },
      tx
    );
    return updated;
  });
}

type PreparedRevision = {
  markdown: string;
  html: string;
  plainText: string;
  contentHash: string;
  headings: RenderedHeading[];
  categories: string[];
  outboundLinks: string[];
};

async function prepareRevision(markdown: string): Promise<PreparedRevision> {
  assertMarkdownWithinLimits(markdown);
  const rendered = await renderMarkdown(markdown);
  if (rendered.categories.length + rendered.links.length > MAX_PAGE_RELATIONSHIPS) {
    throw new ConflictError(
      `A page may contain at most ${MAX_PAGE_RELATIONSHIPS} unique categories and wiki links.`
    );
  }
  return {
    markdown,
    html: rendered.html,
    plainText: rendered.plainText,
    contentHash: contentHash(markdown),
    headings: rendered.headings,
    categories: rendered.categories.map((category) => category.name),
    outboundLinks: rendered.links.map((link) => link.target)
  };
}

async function createRevision(
  input: {
    page: Page;
    prepared: PreparedRevision;
    parentRevisionId: string | null;
    revisionNumber: number;
    actorId: string;
    actorDisplayName: string;
    editSummary: string;
    state: PublicationState;
  },
  database: Database
) {
  const [revision] = await database
    .insert(pageRevisions)
    .values({
      pageId: input.page.id,
      parentRevisionId: input.parentRevisionId,
      revisionNumber: input.revisionNumber,
      markdown: input.prepared.markdown,
      html: input.prepared.html,
      plainText: input.prepared.plainText,
      contentHash: input.prepared.contentHash,
      editorId: input.actorId,
      editorDisplayName: input.actorDisplayName,
      editSummary: input.editSummary,
      state: input.state,
      headings: input.prepared.headings,
      categories: input.prepared.categories,
      outboundLinks: input.prepared.outboundLinks
    })
    .returning();
  return revision;
}

async function getNextRevisionNumber(pageId: string, database: Database) {
  const [row] = await database
    .select({ value: max(pageRevisions.revisionNumber) })
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId));
  return (row.value ?? 0) + 1;
}

function normalizeProtectionLevel(value: string | null | undefined): PageProtectionLevel {
  return value === "protected" ? "protected" : "none";
}

export function assertPageVisibleForRead(page: Pick<Page, "status" | "deletedAt">) {
  if ((page.status !== "published" && page.status !== "archived") || page.deletedAt) {
    throw new NotFoundError("Page not found.");
  }
}

function assertMarkdownWithinLimits(markdown: string) {
  if (markdown.length > MAX_PAGE_MARKDOWN_LENGTH) {
    throw new ConflictError(`Markdown must not exceed ${MAX_PAGE_MARKDOWN_LENGTH} characters.`);
  }
}

function assertEditSummaryWithinLimits(value: string | undefined, field: "editSummary" | "reason") {
  if (value && value.length > MAX_PAGE_EDIT_SUMMARY_LENGTH) {
    throw new ConflictError(
      `${field === "reason" ? "Rollback reason" : "Edit summary"} must not exceed ${MAX_PAGE_EDIT_SUMMARY_LENGTH} characters.`
    );
  }
}

async function getPageByIdForUpdate(pageId: string, database: Database) {
  // Serialize writes to this page without blocking graph updates that only need
  // a foreign-key KEY SHARE lock on a different page in the same site.
  const [page] = await database
    .select()
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1)
    .for("no key update");
  if (!page) {
    throw new NotFoundError("Page not found.");
  }
  return page;
}

async function getPageForMutation(pageId: string, database: Database) {
  return getPageByIdForUpdate(pageId, database);
}

async function assertAliasSlugAvailable(
  input: { siteId: string; slug: string; pageId: string | null },
  database: Database
) {
  const [alias] = await database
    .select({ pageId: pageAliases.pageId })
    .from(pageAliases)
    .where(and(eq(pageAliases.siteId, input.siteId), eq(pageAliases.aliasSlug, input.slug)))
    .limit(1);
  if (alias && alias.pageId !== input.pageId) {
    throw new ConflictError("A page with this title or slug already exists.");
  }
}

async function assertProtectedWriteAllowed(page: Page, actorId: string, database: Database) {
  if (normalizeProtectionLevel(page.protectionLevel) === "none") {
    return;
  }
  if (!(await hasPermission(actorId, page.siteId, "page.protect", database))) {
    throw new ForbiddenError("This page is protected.");
  }
}

async function updateRelationships(
  pageId: string,
  siteId: string,
  revision: PageRevision,
  database: Database
) {
  await database.delete(pageCategories).where(eq(pageCategories.pageId, pageId));
  await database.delete(pageLinks).where(eq(pageLinks.sourcePageId, pageId));

  for (const categoryName of revision.categories) {
    const normalizedName = normalizeTitle(categoryName);
    const [category] = await database
      .insert(categories)
      .values({
        siteId,
        name: categoryName,
        normalizedName,
        slug: slugifyTitle(categoryName)
      })
      .onConflictDoUpdate({
        target: [categories.siteId, categories.slug],
        set: { name: categoryName, normalizedName, updatedAt: new Date() }
      })
      .returning();
    await database
      .insert(pageCategories)
      .values({ pageId, categoryId: category.id })
      .onConflictDoNothing();
  }

  for (const target of revision.outboundLinks) {
    const normalized = normalizeTitle(target);
    const targetPage = await findWikiLinkTarget(siteId, target, database);
    await database
      .insert(pageLinks)
      .values({
        sourcePageId: pageId,
        targetTitle: target,
        targetNormalizedTitle: normalized,
        targetPageId: targetPage?.id ?? null,
        label: target
      })
      .onConflictDoUpdate({
        target: [pageLinks.sourcePageId, pageLinks.targetNormalizedTitle],
        set: { targetPageId: targetPage?.id ?? null, label: target }
      });
  }
}

async function findWikiLinkTarget(siteId: string, target: string, database: Database) {
  const targetSlug = slugifyTitle(target);
  const [slugTarget] = await database
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, targetSlug)))
    .limit(1);
  if (slugTarget) {
    return slugTarget;
  }

  const [aliasTarget] = await database
    .select({ id: pages.id })
    .from(pageAliases)
    .innerJoin(pages, eq(pages.id, pageAliases.pageId))
    .where(and(eq(pageAliases.siteId, siteId), eq(pageAliases.aliasSlug, targetSlug)))
    .limit(1);
  if (aliasTarget) {
    return aliasTarget;
  }

  const [titleTarget] = await database
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.normalizedTitle, normalizeTitle(target))))
    .limit(1);
  return titleTarget;
}

async function reconcileIncomingPageLinks(pageId: string, siteId: string, database: Database) {
  const incoming = await database
    .select({
      targetTitle: pageLinks.targetTitle,
      targetNormalizedTitle: pageLinks.targetNormalizedTitle
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.sourcePageId))
    .where(and(eq(pages.siteId, siteId), eq(pageLinks.targetPageId, pageId)));
  const distinctTargets = new Map(
    incoming.map((link) => [link.targetNormalizedTitle, link.targetTitle])
  );
  for (const [targetNormalizedTitle, targetTitle] of distinctTargets) {
    const resolved = await findWikiLinkTarget(siteId, targetTitle, database);
    if (resolved?.id === pageId) {
      continue;
    }
    await database
      .update(pageLinks)
      .set({ targetPageId: resolved?.id ?? null })
      .where(
        and(
          eq(pageLinks.targetPageId, pageId),
          eq(pageLinks.targetNormalizedTitle, targetNormalizedTitle),
          sql`exists (
            select 1
            from ${pages} as incoming_source
            where incoming_source.id = ${pageLinks.sourcePageId}
              and incoming_source.site_id = ${siteId}
          )`
        )
      );
  }
}

async function bindUnresolvedPageLinks(
  page: Pick<Page, "id" | "siteId" | "slug" | "normalizedTitle">,
  database: Database
) {
  const aliases = await database
    .select({ aliasSlug: pageAliases.aliasSlug })
    .from(pageAliases)
    .where(and(eq(pageAliases.siteId, page.siteId), eq(pageAliases.pageId, page.id)));
  const addressSlugs = new Set([page.slug, ...aliases.map((alias) => alias.aliasSlug)]);
  const unresolved = await database
    .select({
      targetTitle: pageLinks.targetTitle,
      targetNormalizedTitle: pageLinks.targetNormalizedTitle
    })
    .from(pageLinks)
    .innerJoin(pages, eq(pages.id, pageLinks.sourcePageId))
    .where(and(eq(pages.siteId, page.siteId), isNull(pageLinks.targetPageId)));
  const matchedTargets = Array.from(
    new Set(
      unresolved
        .filter(
          (link) =>
            link.targetNormalizedTitle === page.normalizedTitle ||
            addressSlugs.has(slugifyTitle(link.targetTitle))
        )
        .map((link) => link.targetNormalizedTitle)
    )
  );
  if (matchedTargets.length === 0) {
    return;
  }

  await database
    .update(pageLinks)
    .set({ targetPageId: page.id })
    .where(
      and(
        isNull(pageLinks.targetPageId),
        inArray(pageLinks.targetNormalizedTitle, matchedTargets),
        sql`exists (
          select 1
          from ${pages} as unresolved_source
          where unresolved_source.id = ${pageLinks.sourcePageId}
            and unresolved_source.site_id = ${page.siteId}
        )`
      )
    );
}

function publishedPageIndexWhere(input: { siteId: string; query?: string; prefix?: string }) {
  const query = input.query?.trim();
  const prefix = input.prefix?.trim().slice(0, 1);
  return and(
    eq(pages.siteId, input.siteId),
    eq(pages.status, "published"),
    isNull(pages.deletedAt),
    query ? or(ilike(pages.title, `%${query}%`), ilike(pages.slug, `%${query}%`)) : undefined,
    prefix ? ilike(pages.title, `${prefix}%`) : undefined
  );
}

function uniqueRows<T>(rows: T[], keyFn: (row: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }
  return unique;
}
