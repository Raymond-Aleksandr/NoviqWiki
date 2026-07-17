import { describe, expect, it } from "vitest";
import { getPrimarySiteWithSettings } from "@/db/site";
import { completeSetup } from "@/modules/setup/service";
import {
  createPage,
  listPageBacklinks,
  listPageOutboundLinks,
  listRevisions,
  publishPage,
  renamePage,
  rollbackPage
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
    const revisions = await listRevisions(page.id, test.executor);
    expect(revisions).toHaveLength(3);
  });
});
