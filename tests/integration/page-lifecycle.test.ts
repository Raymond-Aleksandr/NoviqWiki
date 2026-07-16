import { describe, expect, it } from "vitest";
import { getPrimarySiteWithSettings } from "@/db/site";
import { completeSetup } from "@/modules/setup/service";
import {
  createPage,
  listPageBacklinks,
  listPageOutboundLinks,
  listRevisions,
  publishPage,
  rollbackPage
} from "@/modules/pages/service";
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
        markdown: "# Lifecycle\n\nOriginal [[Category:Tests]]",
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
        markdown: "# Lifecycle\n\nUpdated searchable content [[Category:Tests]]",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        editSummary: "Update"
      },
      test.db
    );
    expect(second.revisionNumber).toBe(2);

    const search = await searchPages({ siteId: setup.site.id, query: "searchable" }, test.executor);
    expect(search.rows[0]?.title).toBe("Lifecycle");

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
