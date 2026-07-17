import { describe, expect, it } from "vitest";
import { writeAuditLog } from "@/modules/audit/service";
import { listRecentChangesPage } from "@/modules/activity/service";
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
});
