import { describe, expect, it } from "vitest";
import { validateMediaUpload } from "@/modules/media/service";
import { updateSiteSettings } from "@/modules/settings/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("media upload settings", () => {
  it("uses the configured MIME allowlist during upload validation", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Media Settings Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-media-settings@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await updateSiteSettings(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        values: { allowedMediaTypes: ["text/plain"], uploadMaxBytes: 1024 }
      },
      test.executor
    );

    await expect(
      validateMediaUpload(
        {
          siteId: setup.site.id,
          filename: "notes.txt",
          declaredType: "text/plain",
          bytes: Buffer.from("hello")
        },
        test.executor
      )
    ).resolves.toMatchObject({ mimeType: "text/plain", safeFilename: "notes.txt" });

    await expect(
      validateMediaUpload(
        {
          siteId: setup.site.id,
          filename: "notes.bin",
          declaredType: "application/octet-stream",
          bytes: Buffer.from("hello")
        },
        test.executor
      )
    ).rejects.toThrow("This file type is not allowed.");
  });
});
