import { describe, expect, it } from "vitest";
import { archivePage, createPage, listShortPages, softDeletePage } from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("short pages", () => {
  it("lists published visible non-redirect pages below the selected text length", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Stub Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-short@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };

    const tiny = await createPage(
      {
        siteId: setup.site.id,
        title: "Tiny Topic",
        markdown: "# Tiny Topic\n\nTiny body.",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Medium Topic",
        markdown: `# Medium Topic\n\n${"medium body ".repeat(34)}`,
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Long Topic",
        markdown: `# Long Topic\n\n${"long body ".repeat(150)}`,
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Redirect Stub",
        markdown: "#REDIRECT [[Tiny Topic]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Tiny",
        markdown: "# Draft Tiny",
        publish: false,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Tiny",
        markdown: "# Archived Tiny",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Tiny",
        markdown: "# Deleted Tiny",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.executor);

    const strictRows = await listShortPages(
      { siteId: setup.site.id, maxLength: 200 },
      test.executor
    );
    const strictTitles = strictRows.map((page) => page.title);
    expect(strictTitles).toContain("Tiny Topic");
    expect(strictTitles).not.toContain("Medium Topic");
    expect(strictTitles).not.toContain("Redirect Stub");
    expect(strictTitles).not.toContain("Draft Tiny");
    expect(strictTitles).not.toContain("Archived Tiny");
    expect(strictTitles).not.toContain("Deleted Tiny");
    expect(strictRows.find((page) => page.title === "Tiny Topic")).toMatchObject({
      pageId: tiny.page.id,
      slug: "tiny-topic"
    });

    const broaderRows = await listShortPages(
      { siteId: setup.site.id, maxLength: 600 },
      test.executor
    );
    const broaderTitles = broaderRows.map((page) => page.title);
    expect(broaderTitles).toContain("Tiny Topic");
    expect(broaderTitles).toContain("Medium Topic");
    expect(broaderTitles).not.toContain("Long Topic");
    expect(broaderTitles).not.toContain("Redirect Stub");
  });
});
