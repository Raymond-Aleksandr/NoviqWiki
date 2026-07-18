import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBoundedMediaFormData } from "@/modules/media/request";
import { getMediaCacheControl, getMediaContentDisposition } from "@/modules/media/response";
import { extractAbsoluteMediaUrls, rewriteLegacyMediaUrlsInContent } from "@/modules/media/service";
import { getStableMediaUrl, LocalStorageAdapter, S3StorageAdapter } from "@/modules/media/storage";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("media request boundaries", () => {
  it("parses a multipart request within the configured hard limit", async () => {
    const data = new FormData();
    data.set("file", new File(["hello"], "hello.txt", { type: "text/plain" }));

    const parsed = await parseBoundedMediaFormData(
      new Request("http://localhost/api/v1/media", { method: "POST", body: data }),
      1024
    );

    expect(parsed.get("file")).toBeInstanceOf(File);
  });

  it("rejects oversized bodies while reading even without trusting Content-Length", async () => {
    const data = new FormData();
    data.set("file", new File([new Uint8Array(300_000)], "large.bin"));

    await expect(
      parseBoundedMediaFormData(
        new Request("http://localhost/api/v1/media", { method: "POST", body: data }),
        1
      )
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe("media response policy", () => {
  it("never marks private media as publicly cacheable", () => {
    expect(getMediaCacheControl(false)).toBe("private, no-store, max-age=0");
    expect(getMediaCacheControl(true)).toBe("public, max-age=0, must-revalidate");
    expect(getMediaCacheControl(true)).not.toContain("immutable");
  });

  it("forces active and unrecognized content to download", () => {
    expect(getMediaContentDisposition("text/html", "page.html")).toMatch(/^attachment;/);
    expect(getMediaContentDisposition("application/pdf", "guide.pdf")).toMatch(/^attachment;/);
    expect(getMediaContentDisposition("image/png", "image.png")).toMatch(/^inline;/);
  });
});

describe("media storage URLs", () => {
  it("uses an encoded stable same-origin media URL", () => {
    expect(getStableMediaUrl("site/year/a b.png", "/media")).toBe("/media/site/year/a%20b.png");
    expect(() => getStableMediaUrl("site/year/image.png", "/uploads")).toThrow(
      "Media URLs must use the /media route."
    );
  });

  it("rewrites persisted signed URLs in Markdown and encoded HTML without changing storage", () => {
    const publicUrl =
      "https://s3.example.test/wiki/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=old";
    const mapping = [{ publicUrl, storageKey: "site/year/image.png" }];

    expect(rewriteLegacyMediaUrlsInContent(`![cover](${publicUrl})`, mapping)).toBe(
      "![cover](/media/site/year/image.png)"
    );
    expect(
      rewriteLegacyMediaUrlsInContent(
        '<img src="https://s3.example.test/wiki/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&#x26;X-Amz-Signature=old">',
        mapping
      )
    ).toBe('<img src="/media/site/year/image.png">');
  });

  it("extracts only exact absolute URL candidates and decodes HTML ampersands", () => {
    const signedUrl =
      "https://s3.example.test/wiki/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=old";
    const unrelated = Array.from(
      { length: 1_000 },
      (_, index) => `https://external.example.test/article-${index}`
    );
    const candidates = extractAbsoluteMediaUrls([
      `![cover](${signedUrl.replaceAll("&", "&amp;")})`,
      ...unrelated.map((url) => `[external](${url})`)
    ]);

    expect(candidates).toHaveLength(unrelated.length + 1);
    expect(candidates).toContain(signedUrl);
    expect(candidates).toContain(unrelated.at(-1));
    expect(candidates).not.toContain(`${signedUrl})`);
  });

  it("probes local storage by writing and removing a file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "noviqwiki-media-"));
    temporaryDirectories.push(root);
    const adapter = new LocalStorageAdapter(root, "/media");

    await expect(adapter.isReady()).resolves.toBe(true);
    await expect(adapter.put("site/file.txt", Buffer.from("hello"), "text/plain")).resolves.toEqual(
      {
        key: "site/file.txt",
        publicUrl: "/media/site/file.txt"
      }
    );
    const body = await adapter.read("site/file.txt");
    expect(body).toBeInstanceOf(ReadableStream);
    const bytes = await new Response(body).arrayBuffer();
    expect(Buffer.from(bytes).toString("utf8")).toBe("hello");
  });

  it("rejects final symlinks for local reads, writes, and deletes", async () => {
    const sandbox = await mkdtemp(path.join(tmpdir(), "noviqwiki-media-links-"));
    temporaryDirectories.push(sandbox);
    const root = path.join(sandbox, "media");
    const outside = path.join(sandbox, "outside.txt");
    await mkdir(root);
    await writeFile(outside, "outside");
    await symlink(outside, path.join(root, "linked.txt"));
    const adapter = new LocalStorageAdapter(root, "/media");

    await expect(adapter.read("linked.txt")).rejects.toThrow("Unsafe storage path");
    await expect(adapter.put("linked.txt", Buffer.from("overwrite"), "text/plain")).rejects.toThrow(
      "Unsafe storage path"
    );
    await expect(adapter.delete("linked.txt")).rejects.toThrow("Unsafe storage path");
    await expect(readFile(outside, "utf8")).resolves.toBe("outside");
  });

  it("rejects intermediate symlinks that leave the canonical media root", async () => {
    const sandbox = await mkdtemp(path.join(tmpdir(), "noviqwiki-media-links-"));
    temporaryDirectories.push(sandbox);
    const root = path.join(sandbox, "media");
    const outside = path.join(sandbox, "outside");
    await Promise.all([mkdir(root), mkdir(outside)]);
    await writeFile(path.join(outside, "secret.txt"), "outside");
    await symlink(outside, path.join(root, "linked"));
    const adapter = new LocalStorageAdapter(root, "/media");

    await expect(adapter.read("linked/secret.txt")).rejects.toThrow("Unsafe storage path");
    await expect(
      adapter.put("linked/new.txt", Buffer.from("escaped"), "text/plain")
    ).rejects.toThrow("Unsafe storage path");
    await expect(adapter.delete("linked/secret.txt")).rejects.toThrow("Unsafe storage path");
    await expect(readFile(path.join(outside, "secret.txt"), "utf8")).resolves.toBe("outside");
    await expect(readFile(path.join(outside, "new.txt"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("probes S3 capabilities once, cleans the exact version, and caches success", async () => {
    let now = 1_000;
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        return { VersionId: "probe-version" };
      }
      if (command instanceof GetObjectCommand) {
        return {
          Body: {
            transformToByteArray: async () => new TextEncoder().encode("noviqwiki-ready")
          }
        };
      }
      if (command instanceof DeleteObjectCommand) {
        return {};
      }
      throw new Error("Unexpected S3 command");
    });
    const adapter = new S3StorageAdapter({
      client: { send } as unknown as S3Client,
      bucket: "media",
      now: () => now,
      successTtlMs: 300_000,
      failureTtlMs: 30_000
    });

    await expect(Promise.all([adapter.isReady(), adapter.isReady()])).resolves.toEqual([
      true,
      true
    ]);
    expect(send).toHaveBeenCalledTimes(3);
    const deleteCommand = send.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof DeleteObjectCommand);
    expect(deleteCommand).toBeInstanceOf(DeleteObjectCommand);
    expect((deleteCommand as DeleteObjectCommand).input.VersionId).toBe("probe-version");

    await expect(adapter.isReady()).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(3);

    now += 300_001;
    await expect(adapter.isReady()).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(6);
  });

  it("cleans up and briefly caches a failed S3 capability probe", async () => {
    let now = 1_000;
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        return { VersionId: "failed-probe-version" };
      }
      if (command instanceof GetObjectCommand) {
        throw new Error("get denied");
      }
      if (command instanceof DeleteObjectCommand) {
        return {};
      }
      throw new Error("Unexpected S3 command");
    });
    const adapter = new S3StorageAdapter({
      client: { send } as unknown as S3Client,
      bucket: "media",
      now: () => now,
      successTtlMs: 300_000,
      failureTtlMs: 30_000
    });

    await expect(adapter.isReady()).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[2]?.[0] as DeleteObjectCommand).input.VersionId).toBe(
      "failed-probe-version"
    );

    await expect(adapter.isReady()).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(3);

    now += 30_001;
    await expect(adapter.isReady()).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(6);
  });
});
