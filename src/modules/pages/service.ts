import { and, asc, desc, eq, ilike, inArray, isNull, max, or, sql } from "drizzle-orm";
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
import { hasPermission } from "@/modules/authorization/permissions";
import { renderMarkdown } from "@/modules/rendering/markdown";
import { createUnifiedDiff, parseUnifiedDiff } from "@/modules/revisions/diff";
import { removeSearchIndex, upsertSearchIndex } from "@/modules/search/service";
import { derivePageIdentity } from "./title";

export type PublicationState = "draft" | "published";
export type PageProtectionLevel = "none" | "protected";

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
  return database.transaction(async (tx) => {
    const identity = derivePageIdentity(input.title, input.slug);
    const duplicate = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.siteId, input.siteId),
          or(eq(pages.slug, identity.slug), eq(pages.normalizedTitle, identity.normalizedTitle))
        )
      )
      .limit(1);
    if (duplicate.length > 0) {
      throw new ConflictError("A page with this title or slug already exists.");
    }
    await assertAliasSlugAvailable({ siteId: input.siteId, slug: identity.slug, pageId: null }, tx);

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

    if (input.publish) {
      const revision = await createRevision(
        {
          siteId: input.siteId,
          page,
          markdown: input.markdown,
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
  const page = await getPageById(input.pageId, database);
  if (page.deletedAt || page.status === "deleted") {
    throw new ConflictError("Deleted pages must be restored before editing.");
  }
  await assertProtectedWriteAllowed(page, input.actorId, database);
  const [draft] = await database
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
    database
  );
  return draft;
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
  return database.transaction(async (tx) => {
    const page = await getPageById(input.pageId, tx);
    if (page.deletedAt || page.status === "deleted") {
      throw new ConflictError("Deleted pages must be restored before editing.");
    }
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const expectedBase = input.baseRevisionId ?? null;
    if ((page.currentRevisionId ?? null) !== expectedBase) {
      throw new ConflictError("The page changed after this editor loaded it.");
    }
    const revisionNumber = await getNextRevisionNumber(page.id, tx);
    const revision = await createRevision(
      {
        siteId: page.siteId,
        page,
        markdown: input.markdown,
        parentRevisionId: page.currentRevisionId,
        revisionNumber,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        editSummary: input.editSummary ?? "",
        state: "published"
      },
      tx
    );
    await tx
      .update(pages)
      .set({ currentRevisionId: revision.id, status: "published", updatedAt: new Date() })
      .where(eq(pages.id, page.id));
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
        details: { revisionId: revision.id }
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
        inArray(
          pages.normalizedTitle,
          rows.map((row) => row.targetNormalizedTitle)
        )
      )
    );
  const targets = new Map(targetPages.map((page) => [page.normalizedTitle, page]));

  return rows.map((row) => {
    const target = targets.get(row.targetNormalizedTitle);
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
    lines: parseUnifiedDiff(unified)
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
  return database.transaction(async (tx) => {
    const page = await getPageById(input.pageId, tx);
    if (page.deletedAt || page.status === "deleted") {
      throw new ConflictError("Deleted pages must be restored before editing.");
    }
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const target = await getRevisionById(input.targetRevisionId, tx);
    if (target.pageId !== page.id) {
      throw new ConflictError("Target revision belongs to another page.");
    }
    const revision = await createRevision(
      {
        siteId: page.siteId,
        page,
        markdown: target.markdown,
        parentRevisionId: page.currentRevisionId,
        revisionNumber: await getNextRevisionNumber(page.id, tx),
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        editSummary: input.reason || `Rollback to revision ${target.revisionNumber}`,
        state: "published"
      },
      tx
    );
    await tx
      .update(pages)
      .set({ currentRevisionId: revision.id, status: "published", updatedAt: new Date() })
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
        details: { targetRevisionId: target.id, newRevisionId: revision.id, reason: input.reason }
      },
      tx
    );
    return revision;
  });
}

export async function softDeletePage(
  input: { pageId: string; actorId: string; actorDisplayName: string },
  database: Database = db
) {
  const page = await getPageById(input.pageId, database);
  await assertProtectedWriteAllowed(page, input.actorId, database);
  const [updated] = await database
    .update(pages)
    .set({
      status: "deleted",
      deletedAt: new Date(),
      deletedById: input.actorId,
      updatedAt: new Date()
    })
    .where(eq(pages.id, input.pageId))
    .returning();
  await removeSearchIndex(input.pageId, database);
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
    database
  );
  return updated;
}

export async function restorePage(
  input: { pageId: string; actorId: string; actorDisplayName: string },
  database: Database = db
) {
  const { page, revision } = await getPageWithCurrentRevision(input.pageId, database);
  await assertProtectedWriteAllowed(page, input.actorId, database);
  const [updated] = await database
    .update(pages)
    .set({
      status: revision ? "published" : "draft",
      deletedAt: null,
      deletedById: null,
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
      database
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
    database
  );
  return updated;
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
  return database.transaction(async (tx) => {
    const page = await getPageById(input.pageId, tx);
    await assertProtectedWriteAllowed(page, input.actorId, tx);
    const identity = derivePageIdentity(input.newTitle, input.newSlug);
    const duplicate = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.siteId, page.siteId),
          or(eq(pages.slug, identity.slug), eq(pages.normalizedTitle, identity.normalizedTitle)),
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
    if (page.currentRevisionId) {
      const revision = await getRevisionById(page.currentRevisionId, tx);
      await upsertSearchIndex(
        {
          siteId: page.siteId,
          pageId: page.id,
          title: updated.title,
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
  database: Database = db
) {
  const page = await getPageById(input.pageId, database);
  if (!(await hasPermission(input.actorId, page.siteId, "page.protect", database))) {
    throw new ForbiddenError();
  }
  const protectionLevel = normalizeProtectionLevel(input.protectionLevel);
  if (normalizeProtectionLevel(page.protectionLevel) === protectionLevel) {
    return page;
  }
  const [updated] = await database
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
    database
  );
  return updated;
}

async function createRevision(
  input: {
    siteId: string;
    page: Page;
    markdown: string;
    parentRevisionId: string | null;
    revisionNumber: number;
    actorId: string;
    actorDisplayName: string;
    editSummary: string;
    state: PublicationState;
  },
  database: Database
) {
  const rendered = await renderMarkdown(input.markdown);
  const [revision] = await database
    .insert(pageRevisions)
    .values({
      pageId: input.page.id,
      parentRevisionId: input.parentRevisionId,
      revisionNumber: input.revisionNumber,
      markdown: input.markdown,
      html: rendered.html,
      plainText: rendered.plainText,
      contentHash: contentHash(input.markdown),
      editorId: input.actorId,
      editorDisplayName: input.actorDisplayName,
      editSummary: input.editSummary,
      state: input.state,
      headings: rendered.headings,
      categories: rendered.categories.map((category) => category.name),
      outboundLinks: rendered.links.map((link) => link.target)
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
  if (page.status === "deleted" || page.deletedAt) {
    throw new NotFoundError("Page not found.");
  }
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
    const [targetPage] = await database
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.normalizedTitle, normalized)))
      .limit(1);
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
