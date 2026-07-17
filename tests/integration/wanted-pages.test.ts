import { describe, expect, it } from "vitest";
import { archivePage, createPage, listWantedPages, softDeletePage } from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("wanted pages", () => {
  it("lists missing internal link targets from visible published pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Wanted Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-wanted@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };

    await createPage(
      {
        siteId: setup.site.id,
        title: "Existing Target",
        markdown: "# Existing Target",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Published Source",
        markdown: "[[Wanted Topic]] and [[Existing Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Second Source",
        markdown: "[[Wanted Topic]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Source",
        markdown: "[[Draft Wanted]]",
        publish: false,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Source",
        markdown: "[[Archived Wanted]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Source",
        markdown: "[[Deleted Wanted]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.executor);

    let wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).toHaveLength(1);
    expect(wanted[0]).toMatchObject({
      targetTitle: "Wanted Topic",
      targetNormalizedTitle: "wanted topic",
      sourceCount: 2
    });

    await createPage(
      {
        siteId: setup.site.id,
        title: "Wanted Topic",
        markdown: "# Wanted Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).toHaveLength(0);
  });
});
