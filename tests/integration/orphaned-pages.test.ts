import { describe, expect, it } from "vitest";
import {
  archivePage,
  createPage,
  listOrphanedPages,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("orphaned pages", () => {
  it("lists published pages with no inbound links from visible published pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Orphan Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-orphan@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };

    const linkedTarget = await createPage(
      {
        siteId: setup.site.id,
        title: "Linked Target",
        markdown: "# Linked Target",
        publish: true,
        ...actor
      },
      test.db
    );
    const source = await createPage(
      {
        siteId: setup.site.id,
        title: "Visible Source",
        markdown: "[[Linked Target]] and [[Late Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    const orphan = await createPage(
      {
        siteId: setup.site.id,
        title: "Lonely Topic",
        markdown: "# Lonely Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Topic",
        markdown: "# Archived Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Topic",
        markdown: "# Deleted Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.db);

    let orphaned = await listOrphanedPages({ siteId: setup.site.id }, test.executor);
    expect(orphaned.map((page) => page.title)).toContain("Lonely Topic");
    expect(orphaned.map((page) => page.title)).toContain("Visible Source");
    expect(orphaned.map((page) => page.title)).not.toContain("Linked Target");
    expect(orphaned.map((page) => page.title)).not.toContain("Archived Topic");
    expect(orphaned.map((page) => page.title)).not.toContain("Deleted Topic");
    expect(orphaned.find((page) => page.title === "Lonely Topic")).toMatchObject({
      pageId: orphan.page.id,
      slug: "lonely-topic"
    });

    await createPage(
      {
        siteId: setup.site.id,
        title: "Late Target",
        markdown: "# Late Target",
        publish: true,
        ...actor
      },
      test.db
    );
    orphaned = await listOrphanedPages({ siteId: setup.site.id }, test.executor);
    expect(orphaned.map((page) => page.title)).not.toContain("Late Target");
    expect(orphaned.map((page) => page.title)).toContain("Visible Source");
    expect(orphaned.map((page) => page.title)).not.toContain(linkedTarget.page.title);
    expect(orphaned.map((page) => page.title)).toContain(source.page.title);
  });
});
