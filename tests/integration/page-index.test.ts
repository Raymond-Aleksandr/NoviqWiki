import { describe, expect, it } from "vitest";
import {
  archivePage,
  createPage,
  listPublishedPageIndex,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("public page index", () => {
  it("lists only visible published pages with search, prefix, and pagination", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Index Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-index@example.test",
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
        title: "Beta Page",
        markdown: "# Beta Page",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Alpha Page",
        markdown: "# Alpha Page",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Custom Mars",
        slug: "custom-mars",
        markdown: "# Custom Mars",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Page",
        markdown: "# Draft Page",
        publish: false,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Page",
        markdown: "# Archived Page",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Page",
        markdown: "# Deleted Page",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.db);

    const all = await listPublishedPageIndex({ siteId: setup.site.id }, test.executor);
    expect(all.count).toBe(3);
    expect(all.rows.map((page) => page.title)).toEqual(["Alpha Page", "Beta Page", "Custom Mars"]);

    const prefix = await listPublishedPageIndex(
      { siteId: setup.site.id, prefix: "B" },
      test.executor
    );
    expect(prefix.rows.map((page) => page.title)).toEqual(["Beta Page"]);

    const slugQuery = await listPublishedPageIndex(
      { siteId: setup.site.id, query: "mars" },
      test.executor
    );
    expect(slugQuery.rows.map((page) => page.slug)).toEqual(["custom-mars"]);

    const secondPage = await listPublishedPageIndex(
      { siteId: setup.site.id, limit: 2, offset: 2 },
      test.executor
    );
    expect(secondPage.count).toBe(3);
    expect(secondPage.rows.map((page) => page.title)).toEqual(["Custom Mars"]);
  });
});
