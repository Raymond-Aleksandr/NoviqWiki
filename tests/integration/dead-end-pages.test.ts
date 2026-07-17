import { describe, expect, it } from "vitest";
import { archivePage, createPage, listDeadEndPages, softDeletePage } from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("dead-end pages", () => {
  it("lists published pages without outbound links to other visible published pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Dead End Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-dead-end@example.test",
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
        title: "Linked Target",
        markdown: "[[Linked Source]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Linked Source",
        markdown: "[[Linked Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Lonely Topic",
        markdown: "# Lonely Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Self Link",
        markdown: "[[Self Link]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Missing Link Source",
        markdown: "[[Missing Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Target",
        markdown: "# Draft Target",
        publish: false,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Link Source",
        markdown: "[[Draft Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    const archivedTarget = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Target",
        markdown: "# Archived Target",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archivedTarget.page.id, ...actor }, test.db);
    await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Link Source",
        markdown: "[[Archived Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    const deletedTarget = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Target",
        markdown: "# Deleted Target",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deletedTarget.page.id, ...actor }, test.executor);
    await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Link Source",
        markdown: "[[Deleted Target]]",
        publish: true,
        ...actor
      },
      test.db
    );

    const draftSource = await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Source",
        markdown: "# Draft Source",
        publish: false,
        ...actor
      },
      test.db
    );
    const archivedSource = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Source",
        markdown: "# Archived Source",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archivedSource.page.id, ...actor }, test.db);
    const deletedSource = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Source",
        markdown: "# Deleted Source",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deletedSource.page.id, ...actor }, test.executor);

    const deadEnds = await listDeadEndPages({ siteId: setup.site.id }, test.executor);
    const titles = deadEnds.map((page) => page.title);

    expect(titles).not.toContain("Linked Target");
    expect(titles).not.toContain("Linked Source");
    expect(titles).toContain("Lonely Topic");
    expect(titles).toContain("Self Link");
    expect(titles).toContain("Missing Link Source");
    expect(titles).toContain("Draft Link Source");
    expect(titles).toContain("Archived Link Source");
    expect(titles).toContain("Deleted Link Source");
    expect(titles).not.toContain(draftSource.page.title);
    expect(titles).not.toContain(archivedSource.page.title);
    expect(titles).not.toContain(deletedSource.page.title);
  });
});
