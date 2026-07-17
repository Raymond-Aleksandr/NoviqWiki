import { describe, expect, it } from "vitest";
import { listAuditLogs, writeAuditLog } from "@/modules/audit/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("audit log administration", () => {
  it("filters audit logs by action and text query with pagination", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Audit Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-audit@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await writeAuditLog(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: "Editor Alice",
        action: "page.published",
        targetType: "page",
        targetId: "page-1",
        details: { title: "Apollo Guide" }
      },
      test.executor
    );
    await writeAuditLog(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: "Owner",
        action: "media.deleted",
        targetType: "media",
        targetId: "media-1",
        details: { filename: "diagram.png" }
      },
      test.executor
    );

    const published = await listAuditLogs(
      { siteId: setup.site.id, action: "page.published" },
      test.executor
    );
    expect(published.rows).toHaveLength(1);
    expect(published.rows[0]?.targetId).toBe("page-1");

    const titleSearch = await listAuditLogs(
      { siteId: setup.site.id, query: "apollo" },
      test.executor
    );
    expect(titleSearch.rows).toHaveLength(1);
    expect(titleSearch.rows[0]?.action).toBe("page.published");

    const actorSearch = await listAuditLogs(
      { siteId: setup.site.id, query: "alice" },
      test.executor
    );
    expect(actorSearch.rows).toHaveLength(1);
    expect(actorSearch.rows[0]?.actorDisplayName).toBe("Editor Alice");

    const pageOne = await listAuditLogs(
      { siteId: setup.site.id, limit: 1, offset: 0 },
      test.executor
    );
    const pageTwo = await listAuditLogs(
      { siteId: setup.site.id, limit: 1, offset: 1 },
      test.executor
    );
    expect(pageOne.count).toBeGreaterThanOrEqual(3);
    expect(pageOne.rows).toHaveLength(1);
    expect(pageTwo.rows).toHaveLength(1);
    expect(pageOne.rows[0]?.id).not.toBe(pageTwo.rows[0]?.id);
  });
});
