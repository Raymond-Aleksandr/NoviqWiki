import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { roles } from "@/db/schema";
import {
  assignRoleToGroup,
  assignUserToGroup,
  createGroup
} from "@/modules/authorization/permissions";
import { getPrimarySiteWithSettings } from "@/db/site";
import { completeSetup } from "@/modules/setup/service";
import { createUser } from "@/modules/users/service";
import {
  actionsForRecentChangeFilter,
  listRecentChanges,
  listRecentChangesWithTargets
} from "@/modules/activity/service";
import {
  archivePage,
  createPage,
  compareRevisionsForRead,
  getRevisionForRead,
  getDraftForEditor,
  listPages,
  listPageBacklinks,
  listPageOutboundLinks,
  listRevisions,
  listRevisionsForRead,
  publishPage,
  renamePage,
  restorePage,
  rollbackPage,
  saveDraft,
  softDeletePage,
  setPageProtection
} from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";
import { searchPages } from "@/modules/search/service";
import { createTestDatabase } from "../helpers/test-db";

describe("page lifecycle integration", () => {
  it("sets up a site, publishes revisions, indexes search, and rolls back immutably", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Test Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const site = await getPrimarySiteWithSettings(test.executor);
    expect(site?.site.id).toBe(setup.site.id);

    const first = await createPage(
      {
        siteId: setup.site.id,
        title: "Lifecycle",
        markdown: "# Lifecycle\n\nOriginal [[Category:Testing]]",
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Initial"
      },
      test.db
    );
    const firstRevision = "revision" in first ? first.revision : null;
    if (!firstRevision) {
      throw new Error("Expected published page creation to return a revision.");
    }
    expect(firstRevision.revisionNumber).toBe(1);

    const page = first.page;
    const draftOnly = await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Only",
        markdown: "# Draft Only\n\nWork in progress.",
        publish: false,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Start draft"
      },
      test.db
    );
    expect(draftOnly.page.status).toBe("draft");
    const createdChanges = await listRecentChanges(
      {
        siteId: setup.site.id,
        actions: actionsForRecentChangeFilter("created"),
        publicOnly: true
      },
      test.executor
    );
    expect(createdChanges.map((change) => change.targetId)).toContain(page.id);
    expect(createdChanges.map((change) => change.targetId)).not.toContain(draftOnly.page.id);
    const publishedChanges = await listRecentChanges(
      {
        siteId: setup.site.id,
        actions: actionsForRecentChangeFilter("published"),
        publicOnly: true
      },
      test.executor
    );
    expect(publishedChanges.map((change) => change.targetId)).toContain(page.id);
    expect(publishedChanges).toContainEqual(
      expect.objectContaining({
        targetId: page.id,
        details: expect.objectContaining({ title: "Lifecycle" })
      })
    );
    const publishedChangesWithTargets = await listRecentChangesWithTargets(
      {
        siteId: setup.site.id,
        actions: actionsForRecentChangeFilter("published"),
        publicOnly: true
      },
      test.executor
    );
    expect(publishedChangesWithTargets).toContainEqual(
      expect.objectContaining({ targetId: page.id, targetLabel: "Lifecycle" })
    );
    const storedNewPageDraft = await getDraftForEditor(
      { pageId: draftOnly.page.id, editorId: setup.owner.id },
      test.executor
    );
    expect(storedNewPageDraft?.markdown).toContain("Work in progress.");
    expect(storedNewPageDraft?.baseRevisionId).toBeNull();
    const draftRows = await listPages(
      { siteId: setup.site.id, status: "draft", includeDeleted: true },
      test.db
    );
    expect(draftRows.map((row) => row.id)).toContain(draftOnly.page.id);
    expect(draftRows.map((row) => row.id)).not.toContain(page.id);
    const titleFilterRows = await listPages(
      { siteId: setup.site.id, query: "life", includeDeleted: true },
      test.db
    );
    expect(titleFilterRows.map((row) => row.id)).toContain(page.id);
    const slugFilterRows = await listPages(
      { siteId: setup.site.id, query: "draft-only", includeDeleted: true },
      test.db
    );
    expect(slugFilterRows.map((row) => row.id)).toContain(draftOnly.page.id);

    const savedDraft = await saveDraft(
      {
        pageId: page.id,
        baseRevisionId: firstRevision.id,
        markdown: "# Lifecycle\n\nDraft body [[Category:Testing]]",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Saved draft"
      },
      test.db
    );
    const restoredDraft = await getDraftForEditor(
      { pageId: page.id, editorId: setup.owner.id },
      test.executor
    );
    expect(restoredDraft?.id).toBe(savedDraft.id);
    expect(restoredDraft?.baseRevisionId).toBe(firstRevision.id);
    expect(restoredDraft?.editSummary).toBe("Saved draft");

    const source = await createPage(
      {
        siteId: setup.site.id,
        title: "Link Source",
        markdown: "# Link Source\n\nSee [[Lifecycle]].",
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Link to lifecycle"
      },
      test.db
    );
    const sourcePage = source.page;
    const backlinks = await listPageBacklinks(
      { siteId: setup.site.id, pageId: page.id },
      test.executor
    );
    expect(backlinks.map((backlink) => backlink.title)).toContain("Link Source");
    const outboundLinks = await listPageOutboundLinks(
      { siteId: setup.site.id, pageId: sourcePage.id },
      test.executor
    );
    expect(outboundLinks).toContainEqual(
      expect.objectContaining({ targetTitle: "Lifecycle", exists: true })
    );

    const second = await publishPage(
      {
        pageId: page.id,
        baseRevisionId: page.currentRevisionId,
        markdown: "# Lifecycle\n\nUpdated searchable content [[Category:Testing]]",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Update"
      },
      test.db
    );
    expect(second.revisionNumber).toBe(2);
    const draftAfterPublish = await getDraftForEditor(
      { pageId: page.id, editorId: setup.owner.id },
      test.executor
    );
    expect(draftAfterPublish).toBeNull();

    const search = await searchPages({ siteId: setup.site.id, query: "searchable" }, test.executor);
    expect(search.rows[0]?.title).toBe("Lifecycle");
    const prefixSearch = await searchPages({ siteId: setup.site.id, query: "test" }, test.executor);
    expect(prefixSearch.rows).toContainEqual(expect.objectContaining({ title: "Lifecycle" }));

    const renamed = await renamePage(
      {
        pageId: page.id,
        newTitle: "Moved Topic",
        newSlug: "moved-topic",
        createAlias: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(renamed.slug).toBe("moved-topic");

    const resolvedOldSlug = await resolvePageBySlug(
      { siteId: setup.site.id, slug: "lifecycle" },
      test.executor
    );
    expect(resolvedOldSlug.page.id).toBe(page.id);
    expect(resolvedOldSlug.redirectedFrom).toBe("lifecycle");

    const aliasSearch = await searchPages(
      { siteId: setup.site.id, query: "Lifecycle" },
      test.executor
    );
    expect(aliasSearch.rows).toContainEqual(
      expect.objectContaining({ title: "Moved Topic", slug: "moved-topic" })
    );
    await expect(
      createPage(
        {
          siteId: setup.site.id,
          title: "Alias Collision",
          slug: "lifecycle",
          markdown: "# Alias Collision",
          publish: true,
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("A page with this title or slug already exists.");
    await expect(
      renamePage(
        {
          pageId: sourcePage.id,
          newTitle: "Alias Collision",
          newSlug: "lifecycle",
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("A page with this title or slug already exists.");

    const revisionsAfterRename = await listRevisions(page.id, test.executor);
    expect(revisionsAfterRename).toHaveLength(2);

    const revisionsBeforeRollback = await listRevisions(page.id, test.executor);
    const rollback = await rollbackPage(
      {
        pageId: page.id,
        targetRevisionId: revisionsBeforeRollback.at(-1)!.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        reason: "Integration rollback"
      },
      test.db
    );
    expect(rollback.revisionNumber).toBe(3);
    const rollbackChanges = await listRecentChanges(
      {
        siteId: setup.site.id,
        actions: actionsForRecentChangeFilter("rollback"),
        publicOnly: true
      },
      test.executor
    );
    expect(rollbackChanges.map((change) => change.targetId)).toContain(page.id);
    expect(rollbackChanges).toContainEqual(
      expect.objectContaining({
        targetId: page.id,
        details: expect.objectContaining({ title: "Moved Topic" })
      })
    );
    const rollbackChangesWithTargets = await listRecentChangesWithTargets(
      {
        siteId: setup.site.id,
        actions: actionsForRecentChangeFilter("rollback"),
        publicOnly: true
      },
      test.executor
    );
    expect(rollbackChangesWithTargets).toContainEqual(
      expect.objectContaining({ targetId: page.id, targetLabel: "Moved Topic" })
    );
    const revisions = await listRevisions(page.id, test.executor);
    expect(revisions).toHaveLength(3);

    const archived = await archivePage(
      {
        pageId: page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBeInstanceOf(Date);
    const archivedRows = await listPages(
      { siteId: setup.site.id, status: "archived", includeDeleted: true },
      test.db
    );
    expect(archivedRows.map((row) => row.id)).toContain(page.id);
    const archivedSearch = await searchPages(
      { siteId: setup.site.id, query: "test" },
      test.executor
    );
    expect(archivedSearch.rows).not.toContainEqual(expect.objectContaining({ pageId: page.id }));
    const archivedRevisions = await listRevisions(page.id, test.executor);
    expect(archivedRevisions).toHaveLength(3);

    const restoredFromArchive = await restorePage(
      {
        pageId: page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(restoredFromArchive.status).toBe("published");
    expect(restoredFromArchive.archivedAt).toBeNull();
    const restoredFromArchiveSearch = await searchPages(
      { siteId: setup.site.id, query: "test" },
      test.executor
    );
    expect(restoredFromArchiveSearch.rows).toContainEqual(
      expect.objectContaining({ title: "Moved Topic", slug: "moved-topic" })
    );

    await softDeletePage(
      {
        pageId: page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const deletedSearch = await searchPages(
      { siteId: setup.site.id, query: "test" },
      test.executor
    );
    expect(deletedSearch.rows).not.toContainEqual(expect.objectContaining({ pageId: page.id }));
    await expect(getRevisionForRead(firstRevision.id, test.executor)).rejects.toThrow(
      "Page not found."
    );
    await expect(listRevisionsForRead(page.id, test.executor)).rejects.toThrow("Page not found.");
    await expect(
      compareRevisionsForRead(
        { fromRevisionId: firstRevision.id, toRevisionId: rollback.id },
        test.db
      )
    ).rejects.toThrow("Page not found.");

    const restored = await restorePage(
      {
        pageId: page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(restored.status).toBe("published");
    const restoredSearch = await searchPages(
      { siteId: setup.site.id, query: "test" },
      test.executor
    );
    expect(restoredSearch.rows).toContainEqual(
      expect.objectContaining({ title: "Moved Topic", slug: "moved-topic" })
    );

    const movedBack = await renamePage(
      {
        pageId: page.id,
        newTitle: "Lifecycle",
        newSlug: "lifecycle",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(movedBack.slug).toBe("lifecycle");
    const resolvedAfterMoveBack = await resolvePageBySlug(
      { siteId: setup.site.id, slug: "lifecycle" },
      test.executor
    );
    expect(resolvedAfterMoveBack.page.id).toBe(page.id);
    expect(resolvedAfterMoveBack.redirectedFrom).toBeNull();
  });

  it("enforces page protection on server-side write operations", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Protected Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-protected@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    const editor = await createUser(
      {
        username: "editor",
        email: "editor@example.test",
        password: "EditorPassword123",
        displayName: "Editor",
        status: "active"
      },
      test.executor
    );
    const [editorRole] = await test.executor
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.siteId, setup.site.id), eq(roles.normalizedName, "editor")))
      .limit(1);
    const editorGroup = await createGroup(
      { siteId: setup.site.id, name: "Editors", description: "Can edit and publish." },
      test.executor
    );
    await assignRoleToGroup(editorGroup.id, editorRole.id, test.executor);
    await assignUserToGroup(editor.id, editorGroup.id, test.executor);

    const created = await createPage(
      {
        siteId: setup.site.id,
        title: "Protected Topic",
        markdown: "# Protected Topic\n\nInitial.",
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Initial"
      },
      test.db
    );
    const page = created.page;
    const firstRevision = "revision" in created ? created.revision : null;
    if (!firstRevision) {
      throw new Error("Expected published page creation to return a revision.");
    }

    const editorRevision = await publishPage(
      {
        pageId: page.id,
        baseRevisionId: firstRevision.id,
        markdown: "# Protected Topic\n\nEditor can publish before protection.",
        actorId: editor.id,
        actorDisplayName: editor.displayName,
        editSummary: "Editor update"
      },
      test.db
    );
    expect(editorRevision.revisionNumber).toBe(2);

    const protectedPage = await setPageProtection(
      {
        pageId: page.id,
        protectionLevel: "protected",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.executor
    );
    expect(protectedPage.protectionLevel).toBe("protected");

    await expect(
      setPageProtection(
        {
          pageId: page.id,
          protectionLevel: "none",
          actorId: editor.id,
          actorDisplayName: editor.displayName
        },
        test.executor
      )
    ).rejects.toThrow("You do not have permission to perform this action.");

    await expect(
      saveDraft(
        {
          pageId: page.id,
          baseRevisionId: editorRevision.id,
          markdown: "# Protected Topic\n\nBlocked draft.",
          actorId: editor.id,
          actorDisplayName: editor.displayName,
          editSummary: "Blocked draft"
        },
        test.db
      )
    ).rejects.toThrow("This page is protected.");

    await expect(
      publishPage(
        {
          pageId: page.id,
          baseRevisionId: editorRevision.id,
          markdown: "# Protected Topic\n\nBlocked publish.",
          actorId: editor.id,
          actorDisplayName: editor.displayName,
          editSummary: "Blocked publish"
        },
        test.db
      )
    ).rejects.toThrow("This page is protected.");

    await expect(
      renamePage(
        {
          pageId: page.id,
          newTitle: "Blocked Protected Move",
          actorId: editor.id,
          actorDisplayName: editor.displayName
        },
        test.db
      )
    ).rejects.toThrow("This page is protected.");

    await expect(
      rollbackPage(
        {
          pageId: page.id,
          targetRevisionId: firstRevision.id,
          actorId: editor.id,
          actorDisplayName: editor.displayName,
          reason: "Blocked rollback"
        },
        test.db
      )
    ).rejects.toThrow("This page is protected.");

    await expect(
      softDeletePage(
        {
          pageId: page.id,
          actorId: editor.id,
          actorDisplayName: editor.displayName
        },
        test.executor
      )
    ).rejects.toThrow("This page is protected.");

    await expect(
      archivePage(
        {
          pageId: page.id,
          actorId: editor.id,
          actorDisplayName: editor.displayName
        },
        test.db
      )
    ).rejects.toThrow("This page is protected.");

    const ownerRevision = await publishPage(
      {
        pageId: page.id,
        baseRevisionId: editorRevision.id,
        markdown: "# Protected Topic\n\nOwner can edit protected pages.",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Owner update"
      },
      test.db
    );
    expect(ownerRevision.revisionNumber).toBe(3);

    const unprotectedPage = await setPageProtection(
      {
        pageId: page.id,
        protectionLevel: "none",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.executor
    );
    expect(unprotectedPage.protectionLevel).toBe("none");

    const finalEditorRevision = await publishPage(
      {
        pageId: page.id,
        baseRevisionId: ownerRevision.id,
        markdown: "# Protected Topic\n\nEditor can publish after protection is removed.",
        actorId: editor.id,
        actorDisplayName: editor.displayName,
        editSummary: "Editor update after unprotect"
      },
      test.db
    );
    expect(finalEditorRevision.revisionNumber).toBe(4);
  });
});
