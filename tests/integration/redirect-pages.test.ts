import { describe, expect, it } from "vitest";
import { archivePage, createPage, softDeletePage } from "@/modules/pages/service";
import { listRedirectPages } from "@/modules/redirects/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("redirect maintenance", () => {
  it("lists published redirect pages with target health", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Redirect Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-redirects@example.test",
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
        title: "Valid Target",
        markdown: "# Valid Target",
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

    await createRedirect("Intermediate Redirect", "Valid Target");
    await createRedirect("Valid Redirect", "Valid Target");
    await createRedirect("Double Redirect", "Intermediate Redirect");
    await createRedirect("Missing Redirect", "Missing Target");
    await createRedirect("Draft Redirect", "Draft Target");
    await createRedirect("Archived Redirect", "Archived Target");
    await createRedirect("Deleted Redirect", "Deleted Target");

    const redirects = await listRedirectPages({ siteId: setup.site.id }, test.executor);
    expect(redirects.count).toBe(7);

    const byTitle = new Map(redirects.rows.map((row) => [row.title, row]));
    expect(byTitle.get("Valid Redirect")).toMatchObject({
      targetTitle: "Valid Target",
      targetStatus: "valid",
      targetPageSlug: "valid-target"
    });
    expect(byTitle.get("Intermediate Redirect")).toMatchObject({
      targetTitle: "Valid Target",
      targetStatus: "valid"
    });
    expect(byTitle.get("Double Redirect")).toMatchObject({
      targetTitle: "Intermediate Redirect",
      targetStatus: "double",
      targetPageSlug: "intermediate-redirect"
    });
    expect(byTitle.get("Missing Redirect")).toMatchObject({
      targetTitle: "Missing Target",
      targetStatus: "missing",
      targetPageId: null
    });
    expect(byTitle.get("Draft Redirect")).toMatchObject({ targetStatus: "draft" });
    expect(byTitle.get("Archived Redirect")).toMatchObject({ targetStatus: "archived" });
    expect(byTitle.get("Deleted Redirect")).toMatchObject({ targetStatus: "deleted" });

    const pageTwo = await listRedirectPages(
      { siteId: setup.site.id, limit: 2, offset: 2 },
      test.executor
    );
    expect(pageTwo.count).toBe(7);
    expect(pageTwo.rows).toHaveLength(2);

    async function createRedirect(title: string, targetTitle: string) {
      return createPage(
        {
          siteId: setup.site.id,
          title,
          markdown: `#REDIRECT [[${targetTitle}]]`,
          publish: true,
          ...actor
        },
        test.db
      );
    }
  });
});
