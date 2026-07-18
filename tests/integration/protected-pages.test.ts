import { describe, expect, it } from "vitest";
import {
  archivePage,
  createPage,
  listProtectedPages,
  setPageProtection,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("protected pages", () => {
  it("lists only published visible pages with edit protection enabled", async () => {
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
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };

    const protectedPage = await createPage(
      {
        siteId: setup.site.id,
        title: "Protected Topic",
        markdown: "# Protected Topic\n\nStable reference material.",
        publish: true,
        ...actor
      },
      test.db
    );
    await setPageProtection(
      { pageId: protectedPage.page.id, protectionLevel: "protected", ...actor },
      test.db
    );

    await createPage(
      {
        siteId: setup.site.id,
        title: "Ordinary Topic",
        markdown: "# Ordinary Topic",
        publish: true,
        ...actor
      },
      test.db
    );

    const unprotectedPage = await createPage(
      {
        siteId: setup.site.id,
        title: "Unprotected Again",
        markdown: "# Unprotected Again",
        publish: true,
        ...actor
      },
      test.db
    );
    await setPageProtection(
      { pageId: unprotectedPage.page.id, protectionLevel: "protected", ...actor },
      test.db
    );
    await setPageProtection(
      { pageId: unprotectedPage.page.id, protectionLevel: "none", ...actor },
      test.db
    );

    const draft = await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Protected",
        markdown: "# Draft Protected",
        publish: false,
        ...actor
      },
      test.db
    );
    await setPageProtection(
      { pageId: draft.page.id, protectionLevel: "protected", ...actor },
      test.db
    );

    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Protected",
        markdown: "# Archived Protected",
        publish: true,
        ...actor
      },
      test.db
    );
    await setPageProtection(
      { pageId: archived.page.id, protectionLevel: "protected", ...actor },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);

    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Protected",
        markdown: "# Deleted Protected",
        publish: true,
        ...actor
      },
      test.db
    );
    await setPageProtection(
      { pageId: deleted.page.id, protectionLevel: "protected", ...actor },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.db);

    const rows = await listProtectedPages({ siteId: setup.site.id }, test.executor);
    const titles = rows.map((page) => page.title);

    expect(titles).toEqual(["Protected Topic"]);
    expect(rows[0]).toMatchObject({
      pageId: protectedPage.page.id,
      slug: "protected-topic"
    });
    expect(titles).not.toContain("Ordinary Topic");
    expect(titles).not.toContain("Unprotected Again");
    expect(titles).not.toContain("Draft Protected");
    expect(titles).not.toContain("Archived Protected");
    expect(titles).not.toContain("Deleted Protected");
  });
});
