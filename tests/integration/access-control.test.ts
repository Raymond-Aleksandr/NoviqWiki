import { describe, expect, it } from "vitest";
import { hasPermission } from "@/modules/authorization/permissions";
import { updateSiteSettings } from "@/modules/settings/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("site visibility access control", () => {
  it("enforces private wiki mode for anonymous read permissions", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Private Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-private@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await expect(hasPermission(null, setup.site.id, "site.view", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "page.read", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "revision.read", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "media.read", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "page.create", test.executor)).resolves.toBe(
      false
    );

    await updateSiteSettings(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        values: { publicMode: false }
      },
      test.executor
    );

    await expect(hasPermission(null, setup.site.id, "site.view", test.executor)).resolves.toBe(
      false
    );
    await expect(hasPermission(null, setup.site.id, "page.read", test.executor)).resolves.toBe(
      false
    );
    await expect(hasPermission(null, setup.site.id, "revision.read", test.executor)).resolves.toBe(
      false
    );
    await expect(hasPermission(null, setup.site.id, "media.read", test.executor)).resolves.toBe(
      false
    );
    await expect(
      hasPermission(setup.owner.id, setup.site.id, "page.read", test.executor)
    ).resolves.toBe(true);
  });
});
