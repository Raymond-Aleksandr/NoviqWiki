import { describe, expect, it } from "vitest";
import { mediaAssets } from "@/db/schema";
import { listRecentChangesPage } from "@/modules/activity/service";
import { writeAuditLog } from "@/modules/audit/service";
import { createPage, softDeletePage } from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("recent changes", () => {
  it("returns paginated public activity counts with action filters", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Recent Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-recent@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    for (let index = 0; index < 3; index += 1) {
      await writeAuditLog(
        {
          siteId: setup.site.id,
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName,
          action: "page.published",
          targetType: "page",
          targetId: `page-${index}`,
          details: { title: `Page ${index}` }
        },
        test.executor
      );
    }
    await writeAuditLog(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        action: "auth.login",
        targetType: "user",
        targetId: setup.owner.id
      },
      test.executor
    );

    const firstPage = await listRecentChangesPage(
      { siteId: setup.site.id, publicOnly: true, limit: 2, offset: 0 },
      test.executor
    );
    const secondPage = await listRecentChangesPage(
      { siteId: setup.site.id, publicOnly: true, limit: 2, offset: 2 },
      test.executor
    );

    expect(firstPage.count).toBe(3);
    expect(firstPage.rows).toHaveLength(2);
    expect(secondPage.rows).toHaveLength(1);
    expect(firstPage.rows.map((row) => row.action)).toEqual(["page.published", "page.published"]);

    const rollbackOnly = await listRecentChangesPage(
      {
        siteId: setup.site.id,
        actions: ["page.rollback"],
        publicOnly: true,
        limit: 2,
        offset: 0
      },
      test.executor
    );
    expect(rollbackOnly.count).toBe(0);
    expect(rollbackOnly.rows).toHaveLength(0);
  });

  it("resolves public page and media targets without linking deleted targets", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Recent Links Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-recent-links@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };
    const created = await createPage(
      {
        siteId: setup.site.id,
        title: "Linked Recent Page",
        markdown: "# Linked Recent Page",
        publish: true,
        ...actor
      },
      test.db
    );
    const [asset] = await test.executor
      .insert(mediaAssets)
      .values({
        siteId: setup.site.id,
        uploaderId: setup.owner.id,
        originalFilename: "recent-image.png",
        safeFilename: "recent-image.png",
        storageKey: `${setup.site.id}/recent-image.png`,
        publicUrl: "/media/recent-image.png",
        mimeType: "image/png",
        byteSize: 128,
        contentHash: "recent-image-hash"
      })
      .returning();
    await writeAuditLog(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        action: "media.uploaded",
        targetType: "media",
        targetId: asset.id,
        details: {}
      },
      test.executor
    );

    let page = await listRecentChangesPage(
      { siteId: setup.site.id, publicOnly: true, limit: 10, offset: 0 },
      test.executor
    );
    const pageCreated = page.rows.find((row) => row.action === "page.created");
    const mediaUploaded = page.rows.find((row) => row.action === "media.uploaded");
    expect(pageCreated).toMatchObject({
      targetHref: "/page/linked-recent-page",
      targetLabel: "Linked Recent Page"
    });
    expect(mediaUploaded).toMatchObject({
      targetHref: "/media/recent-image.png",
      targetLabel: "recent-image.png"
    });

    await softDeletePage({ pageId: created.page.id, ...actor }, test.executor);
    page = await listRecentChangesPage(
      { siteId: setup.site.id, publicOnly: true, limit: 10, offset: 0 },
      test.executor
    );
    const pageDeleted = page.rows.find((row) => row.action === "page.deleted");
    const olderPageCreated = page.rows.find((row) => row.action === "page.created");
    expect(pageDeleted).toMatchObject({
      targetHref: null,
      targetLabel: "Linked Recent Page"
    });
    expect(olderPageCreated?.targetHref).toBeNull();
  });
});
