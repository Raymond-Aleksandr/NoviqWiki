import { describe, expect, it } from "vitest";
import {
  archivePage,
  createPage,
  listUncategorizedPages,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("uncategorized pages", () => {
  it("lists published visible pages without category membership", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Category Hygiene Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-uncategorized@example.test",
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
        title: "Categorized Topic",
        markdown: "# Categorized Topic\n\n[[Category:Testing]]",
        publish: true,
        ...actor
      },
      test.db
    );
    const uncategorized = await createPage(
      {
        siteId: setup.site.id,
        title: "Uncategorized Topic",
        markdown: "# Uncategorized Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Categorized",
        markdown: "# Draft Categorized\n\n[[Category:Drafts]]",
        publish: false,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Uncategorized",
        markdown: "# Archived Uncategorized",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Uncategorized",
        markdown: "# Deleted Uncategorized",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.db);

    const rows = await listUncategorizedPages({ siteId: setup.site.id }, test.executor);
    const titles = rows.map((page) => page.title);

    expect(titles).toContain("Uncategorized Topic");
    expect(rows.find((page) => page.title === "Uncategorized Topic")).toMatchObject({
      pageId: uncategorized.page.id,
      slug: "uncategorized-topic"
    });
    expect(titles).not.toContain("Categorized Topic");
    expect(titles).not.toContain("Draft Categorized");
    expect(titles).not.toContain("Archived Uncategorized");
    expect(titles).not.toContain("Deleted Uncategorized");
  });
});
