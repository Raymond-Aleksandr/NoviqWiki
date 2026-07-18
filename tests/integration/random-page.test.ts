import { describe, expect, it } from "vitest";
import {
  archivePage,
  createPage,
  getRandomPublishedPage,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("random published page", () => {
  it("returns a readable published non-redirect page", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Random Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-random@example.test",
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
        title: "Readable Article",
        markdown: "# Readable Article\n\nThis page can be selected.",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Article",
        markdown: "# Draft Article",
        publish: false,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Article",
        markdown: "# Archived Article",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Article",
        markdown: "# Deleted Article",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.db);
    await createPage(
      {
        siteId: setup.site.id,
        title: "Redirect Article",
        markdown: "#REDIRECT [[Readable Article]]",
        publish: true,
        ...actor
      },
      test.db
    );

    await expect(
      getRandomPublishedPage({ siteId: setup.site.id }, test.executor)
    ).resolves.toMatchObject({
      title: "Readable Article",
      slug: "readable-article"
    });
  });

  it("returns null when the wiki has no readable published non-redirect pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Empty Random Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-random-empty@example.test",
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
        title: "Only Draft",
        markdown: "# Only Draft",
        publish: false,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Only Redirect",
        markdown: "#REDIRECT [[Missing Target]]",
        publish: true,
        ...actor
      },
      test.db
    );

    await expect(
      getRandomPublishedPage({ siteId: setup.site.id }, test.executor)
    ).resolves.toBeNull();
  });
});
