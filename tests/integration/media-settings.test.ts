import { describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { auditLogs, mediaAssets, pageRevisions } from "@/db/schema";
import { contentHash } from "@/lib/crypto";
import {
  deleteMedia,
  getMediaReferences,
  MAX_MEDIA_ALT_TEXT_LENGTH,
  rewriteLegacyMediaUrls,
  uploadMedia,
  validateMediaUpload
} from "@/modules/media/service";
import type { StorageAdapter } from "@/modules/media/storage";
import {
  archivePage,
  compareRevisionsForRead,
  createPage,
  getPageWithCurrentRevision,
  getRevisionForRead,
  listRevisionsForRead,
  publishPage,
  softDeletePage
} from "@/modules/pages/service";
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
      test.db
    );

    await expect(
      validateMediaUpload(
        {
          siteId: setup.site.id,
          filename: "notes.txt",
          declaredType: "text/html",
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
          declaredType: "text/plain",
          bytes: Buffer.from([0, 255, 0, 254])
        },
        test.executor
      )
    ).rejects.toThrow("This file type is not allowed.");
  });

  it("rejects oversized original filenames before storage", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Filename Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "filename-owner",
        ownerEmail: "filename-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await expect(
      validateMediaUpload(
        {
          siteId: setup.site.id,
          filename: `${"a".repeat(261)}.png`,
          bytes: pngBytes()
        },
        test.executor
      )
    ).rejects.toMatchObject({ code: "invalid_filename", status: 422 });
  });

  it("removes the stored object if the database insert fails and persists a stable URL", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Compensation Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "compensation-owner",
        ownerEmail: "compensation-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const storedKeys: string[] = [];
    const deletedKeys: string[] = [];
    const storage: StorageAdapter = {
      async put(key) {
        storedKeys.push(key);
        return { key, publicUrl: "https://storage.example.test/expiring-signature" };
      },
      async delete(key) {
        deletedKeys.push(key);
      },
      async getPublicUrl() {
        return "https://storage.example.test/expiring-signature";
      },
      async read() {
        return new Uint8Array();
      },
      async isReady() {
        return true;
      }
    };
    const input = {
      siteId: setup.site.id,
      uploaderDisplayName: "Uploader",
      filename: "pixel.png",
      bytes: pngBytes()
    };

    await expect(
      uploadMedia(
        {
          ...input,
          uploaderId: setup.owner.id,
          altText: "x".repeat(MAX_MEDIA_ALT_TEXT_LENGTH + 1)
        },
        test.db,
        storage
      )
    ).rejects.toMatchObject({ code: "validation_error", status: 422 });
    expect(storedKeys).toHaveLength(0);

    await expect(
      uploadMedia({ ...input, uploaderId: crypto.randomUUID() }, test.db, storage)
    ).rejects.toMatchObject({ status: 403 });
    expect(storedKeys).toHaveLength(0);
    expect(deletedKeys).toHaveLength(0);

    await expect(
      uploadMedia(
        {
          ...input,
          uploaderId: setup.owner.id,
          uploaderDisplayName: "x".repeat(161)
        },
        test.db,
        storage
      )
    ).rejects.toThrow();
    expect(storedKeys).toHaveLength(1);
    expect(deletedKeys).toHaveLength(1);

    const asset = await uploadMedia({ ...input, uploaderId: setup.owner.id }, test.db, storage);
    expect(asset.publicUrl).toMatch(/^\/media\//);
    expect(asset.publicUrl).not.toContain("expiring-signature");
  });

  it("does not let setup select a storage driver different from runtime configuration", async () => {
    const test = await createTestDatabase();
    await expect(
      completeSetup(
        {
          siteName: "Mismatched Storage Wiki",
          tagline: "Test",
          baseUrl: "http://localhost:3000",
          registrationMode: "closed",
          mediaDriver: "s3",
          ownerUsername: "owner",
          ownerEmail: "mismatch@example.test",
          ownerPassword: "OwnerPassword123"
        },
        test.db
      )
    ).rejects.toThrow("Media storage is configured as local");
  });

  it("maps persisted signed URLs at read time without mutating immutable content or media rows", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Legacy Media Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "legacy-owner",
        ownerEmail: "legacy-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const legacyUrl =
      "https://s3.example.test/wiki/legacy.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=old";
    await test.executor.insert(mediaAssets).values(
      Array.from({ length: 500 }, (_, index) => ({
        siteId: setup.site.id,
        uploaderId: setup.owner.id,
        originalFilename: `unrelated-${index}.png`,
        safeFilename: `unrelated-${index}.png`,
        storageKey: `${setup.site.id}/unrelated-${index}.png`,
        publicUrl: `https://s3.example.test/wiki/unrelated-${index}.png?X-Amz-Signature=old-${index}`,
        mimeType: "image/png",
        byteSize: 128,
        contentHash: `unrelated-image-hash-${index}`
      }))
    );
    const [asset] = await test.executor
      .insert(mediaAssets)
      .values({
        siteId: setup.site.id,
        uploaderId: setup.owner.id,
        originalFilename: "legacy.png",
        safeFilename: "legacy.png",
        storageKey: `${setup.site.id}/legacy.png`,
        publicUrl: legacyUrl,
        mimeType: "image/png",
        byteSize: 128,
        contentHash: "legacy-image-hash"
      })
      .returning();

    const [rewritten] = await rewriteLegacyMediaUrls(
      { siteId: setup.site.id, contents: [`![legacy](${legacyUrl})`] },
      test.executor
    );
    expect(rewritten).toBe(`![legacy](/media/${setup.site.id}/legacy.png)`);
    const ordinaryExternalLink = "https://www.example.test/not-a-media-asset";
    await expect(
      rewriteLegacyMediaUrls(
        { siteId: setup.site.id, contents: [`[external](${ordinaryExternalLink})`] },
        test.executor
      )
    ).resolves.toEqual([`[external](${ordinaryExternalLink})`]);

    const unrelatedUrls = Array.from(
      { length: 15_000 },
      (_, index) => `https://e.test/${index}?q=%27or--`
    );
    const unrelatedMarkdown = unrelatedUrls.map((url) => `[external](${url})`).join("\n");
    const selectSpy = vi.spyOn(test.executor, "select");
    await expect(
      rewriteLegacyMediaUrls(
        {
          siteId: setup.site.id,
          contents: [
            `![legacy](${legacyUrl})`,
            unrelatedMarkdown,
            `![near match](${legacyUrl}-not-the-persisted-url)`
          ]
        },
        test.executor
      )
    ).resolves.toEqual([
      `![legacy](/media/${setup.site.id}/legacy.png)`,
      unrelatedMarkdown,
      `![near match](${legacyUrl}-not-the-persisted-url)`
    ]);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    selectSpy.mockRestore();

    const [stored] = await test.executor
      .select({ publicUrl: mediaAssets.publicUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, asset.id));
    expect(stored?.publicUrl).toBe(legacyUrl);

    const created = await createPage(
      {
        siteId: setup.site.id,
        title: "Legacy media page",
        markdown: `# Legacy media\n\n![legacy](${legacyUrl})`,
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const initialRevision = "revision" in created ? created.revision : undefined;
    if (!initialRevision) {
      throw new Error("Expected a published revision.");
    }
    const stableUrl = `/media/${setup.site.id}/legacy.png`;
    const revisionRead = await getRevisionForRead(initialRevision.id, test.executor);
    expect(revisionRead.revision.markdown).toContain(legacyUrl);
    expect(revisionRead.revision.html).toContain("X-Amz-Signature");
    expect(revisionRead.revision.contentHash).toBe(contentHash(revisionRead.revision.markdown));

    const pageRead = await getPageWithCurrentRevision(created.page.id, test.executor);
    expect(pageRead.revision?.markdown).toContain(legacyUrl);
    const revisionList = await listRevisionsForRead(created.page.id, test.executor);
    expect(revisionList[0]?.html).toContain("X-Amz-Signature");

    const secondRevision = await publishPage(
      {
        pageId: created.page.id,
        markdown: "# Legacy media removed",
        baseRevisionId: initialRevision.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const diff = await compareRevisionsForRead(
      { fromRevisionId: initialRevision.id, toRevisionId: secondRevision.id },
      test.db
    );
    expect(diff.from.markdown).toContain(legacyUrl);
    expect(diff.from.contentHash).toBe(contentHash(diff.from.markdown));
    expect(diff.unified).toContain("X-Amz-Signature");
    const rewrittenDiffLines = await rewriteLegacyMediaUrls(
      { siteId: setup.site.id, contents: diff.lines.map((line) => line.text) },
      test.executor
    );
    expect(rewrittenDiffLines.join("\n")).toContain(stableUrl);
    expect(rewrittenDiffLines.join("\n")).not.toContain("X-Amz-Signature");

    const [storedRevision] = await test.executor
      .select({ markdown: pageRevisions.markdown, html: pageRevisions.html })
      .from(pageRevisions)
      .where(eq(pageRevisions.id, initialRevision.id));
    expect(storedRevision?.markdown).toContain(legacyUrl);
    expect(storedRevision?.html).toContain("X-Amz-Signature");
  });

  it("protects media referenced by history, drafts, and recoverable deleted pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Historical Media Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "history-media-owner",
        ownerEmail: "history-media-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const storageKey = `${setup.site.id}/history.png`;
    const [asset] = await test.executor
      .insert(mediaAssets)
      .values({
        siteId: setup.site.id,
        uploaderId: setup.owner.id,
        originalFilename: "history.png",
        safeFilename: "history.png",
        storageKey,
        publicUrl: `/media/${storageKey}`,
        mimeType: "image/png",
        byteSize: 128,
        contentHash: "history-image-hash"
      })
      .returning();
    const created = await createPage(
      {
        siteId: setup.site.id,
        title: "Historical media reference",
        markdown: `# First revision\n\n![history](/media/${storageKey})`,
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const firstRevision = "revision" in created ? created.revision : undefined;
    if (!firstRevision) {
      throw new Error("Expected a published revision.");
    }
    await publishPage(
      {
        pageId: created.page.id,
        markdown: "# Current revision without media",
        baseRevisionId: firstRevision.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );

    await expect(getMediaReferences(asset.id, test.executor)).resolves.toEqual([
      expect.objectContaining({ pageId: created.page.id })
    ]);
    await archivePage(
      {
        pageId: created.page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    await expect(getMediaReferences(asset.id, test.executor)).resolves.toEqual([
      expect.objectContaining({ pageId: created.page.id })
    ]);

    await softDeletePage(
      {
        pageId: created.page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    await expect(getMediaReferences(asset.id, test.executor)).resolves.toEqual([]);

    const deleteObject = vi.fn(async () => undefined);
    await expect(
      deleteMedia(
        {
          assetId: asset.id,
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db,
        storageAdapter(deleteObject)
      )
    ).rejects.toThrow("stored page revisions or drafts");

    const draftStorageKey = `${setup.site.id}/draft.png`;
    const [draftAsset] = await test.executor
      .insert(mediaAssets)
      .values({
        siteId: setup.site.id,
        uploaderId: setup.owner.id,
        originalFilename: "draft.png",
        safeFilename: "draft.png",
        storageKey: draftStorageKey,
        publicUrl: `/media/${draftStorageKey}`,
        mimeType: "image/png",
        byteSize: 128,
        contentHash: "draft-image-hash"
      })
      .returning();
    const draftPage = await createPage(
      {
        siteId: setup.site.id,
        title: "Draft media reference",
        markdown: `# Draft only\n\n![draft](/media/${draftStorageKey})`,
        publish: false,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    await expect(getMediaReferences(draftAsset.id, test.executor)).resolves.toEqual([]);
    await expect(
      deleteMedia(
        {
          assetId: draftAsset.id,
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db,
        storageAdapter(deleteObject)
      )
    ).rejects.toThrow("stored page revisions or drafts");
    expect(draftPage.page.status).toBe("draft");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("commits metadata and audit before object cleanup without leaving active broken records", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Media Deletion Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "delete-media-owner",
        ownerEmail: "delete-media-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const [permissionFailureAsset, databaseFailureAsset, storageFailureAsset] = await test.executor
      .insert(mediaAssets)
      .values(
        ["permission-failure", "database-failure", "storage-failure"].map((name) => ({
          siteId: setup.site.id,
          uploaderId: setup.owner.id,
          originalFilename: `${name}.png`,
          safeFilename: `${name}.png`,
          storageKey: `${setup.site.id}/${name}.png`,
          publicUrl: `/media/${setup.site.id}/${name}.png`,
          mimeType: "image/png",
          byteSize: 128,
          contentHash: `${name}-hash`
        }))
      )
      .returning();
    const deleteWithoutPermission = vi.fn(async () => undefined);

    await expect(
      deleteMedia(
        {
          assetId: permissionFailureAsset.id,
          actorId: crypto.randomUUID(),
          actorDisplayName: "Missing actor",
          force: true
        },
        test.db,
        storageAdapter(deleteWithoutPermission)
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(deleteWithoutPermission).not.toHaveBeenCalled();
    const [permissionDeniedActive] = await test.executor
      .select({ deletedAt: mediaAssets.deletedAt })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, permissionFailureAsset.id));
    expect(permissionDeniedActive?.deletedAt).toBeNull();

    const deleteAfterDatabaseFailure = vi.fn(async () => undefined);

    await expect(
      deleteMedia(
        {
          assetId: databaseFailureAsset.id,
          actorId: setup.owner.id,
          actorDisplayName: "x".repeat(161),
          force: true
        },
        test.db,
        storageAdapter(deleteAfterDatabaseFailure)
      )
    ).rejects.toThrow();
    expect(deleteAfterDatabaseFailure).not.toHaveBeenCalled();
    const [stillActive] = await test.executor
      .select({ deletedAt: mediaAssets.deletedAt })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, databaseFailureAsset.id));
    expect(stillActive?.deletedAt).toBeNull();

    const deleteFailure = vi.fn(async () => {
      throw new Error("storage unavailable");
    });
    await expect(
      deleteMedia(
        {
          assetId: storageFailureAsset.id,
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName,
          force: true
        },
        test.db,
        storageAdapter(deleteFailure)
      )
    ).resolves.toMatchObject({ id: storageFailureAsset.id, deletedAt: expect.any(Date) });
    expect(deleteFailure).toHaveBeenCalledWith(storageFailureAsset.storageKey);
    const [softDeleted] = await test.executor
      .select({ deletedAt: mediaAssets.deletedAt })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, storageFailureAsset.id));
    expect(softDeleted?.deletedAt).toBeInstanceOf(Date);
    const deletionAudit = await test.executor
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(eq(auditLogs.action, "media.deleted"), eq(auditLogs.targetId, storageFailureAsset.id))
      );
    expect(deletionAudit).toHaveLength(1);
  });
});

function storageAdapter(deleteObject: StorageAdapter["delete"]): StorageAdapter {
  return {
    async put(key) {
      return { key, publicUrl: `/media/${key}` };
    },
    delete: deleteObject,
    async getPublicUrl(key) {
      return `/media/${key}`;
    },
    async read() {
      return new Uint8Array();
    },
    async isReady() {
      return true;
    }
  };
}

function pngBytes() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
}
