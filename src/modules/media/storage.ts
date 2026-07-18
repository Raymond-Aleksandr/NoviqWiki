import path from "node:path";
import { Readable } from "node:stream";
import { constants, type Stats } from "node:fs";
import { lstat, mkdir, open, realpath, rm, stat, writeFile } from "node:fs/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

export type StoredObject = {
  key: string;
  publicUrl: string;
};

export interface StorageAdapter {
  put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): Promise<string>;
  read(key: string): Promise<Uint8Array | ReadableStream<Uint8Array>>;
  isReady(): Promise<boolean>;
}

const readinessSuccessTtlMs = 5 * 60 * 1000;
const readinessFailureTtlMs = 30 * 1000;
export const MEDIA_ROUTE_PREFIX = "/media";

type S3StorageAdapterOptions = {
  client: S3Client;
  bucket: string;
  now?: () => number;
  successTtlMs?: number;
  failureTtlMs?: number;
};

export function getStableMediaUrl(
  key: string,
  publicPath: string = getEnv().NOVIQWIKI_STORAGE_PUBLIC_PATH
) {
  if (publicPath !== MEDIA_ROUTE_PREFIX) {
    throw new Error(`Media URLs must use the ${MEDIA_ROUTE_PREFIX} route.`);
  }
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${MEDIA_ROUTE_PREFIX}/${encodedKey}`;
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly root = getEnv().NOVIQWIKI_MEDIA_ROOT,
    private readonly publicPath = getEnv().NOVIQWIKI_STORAGE_PUBLIC_PATH
  ) {}

  async put(key: string, bytes: Buffer, _contentType: string) {
    const segments = this.getSafeSegments(key);
    const parent = await this.ensureCanonicalParent(segments.slice(0, -1));
    const target = path.join(parent, segments.at(-1)!);
    await this.validateExistingTarget(target);
    await writeFile(target, bytes, { flag: "wx" });
    return { key, publicUrl: getStableMediaUrl(key, this.publicPath) };
  }

  async delete(key: string) {
    try {
      const target = await this.resolveExistingRegularFile(key);
      await rm(target);
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  async getPublicUrl(key: string) {
    return getStableMediaUrl(key, this.publicPath);
  }

  async isReady() {
    const probeKey = `.noviqwiki-ready-${process.pid}-${crypto.randomUUID()}`;
    try {
      await this.put(probeKey, Buffer.from("ready"), "text/plain");
      await this.delete(probeKey);
      return true;
    } catch {
      await this.delete(probeKey).catch(() => undefined);
      return false;
    }
  }

  async read(key: string) {
    const target = await this.resolveExistingRegularFile(key);
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) {
        throw new Error("Storage object is not a regular file.");
      }
      return Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>;
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  private getSafeSegments(key: string) {
    const resolved = path.resolve(this.root, key);
    const root = path.resolve(this.root);
    if (!resolved.startsWith(root + path.sep)) {
      throw new Error("Unsafe storage key.");
    }
    return path.relative(root, resolved).split(path.sep);
  }

  private async getCanonicalRoot() {
    await mkdir(this.root, { recursive: true });
    const canonicalRoot = await realpath(this.root);
    const metadata = await stat(canonicalRoot);
    if (!metadata.isDirectory()) {
      throw new Error("Media storage root is not a directory.");
    }
    return canonicalRoot;
  }

  private assertCanonicalContainment(canonicalRoot: string, candidate: string) {
    if (candidate !== canonicalRoot && !candidate.startsWith(canonicalRoot + path.sep)) {
      throw new Error("Unsafe storage path.");
    }
  }

  private async ensureCanonicalParent(segments: readonly string[]) {
    const canonicalRoot = await this.getCanonicalRoot();
    let current = canonicalRoot;
    for (const segment of segments) {
      const candidate = path.join(current, segment);
      let metadata;
      try {
        metadata = await lstat(candidate);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
        await mkdir(candidate);
        metadata = await lstat(candidate);
      }
      const canonical = await realpath(candidate);
      this.assertCanonicalContainment(canonicalRoot, canonical);
      const targetMetadata = metadata.isSymbolicLink() ? await stat(canonical) : metadata;
      if (!targetMetadata.isDirectory()) {
        throw new Error("Storage object parent is not a directory.");
      }
      current = canonical;
    }
    return current;
  }

  private async validateExistingTarget(target: string) {
    let metadata: Stats;
    try {
      metadata = await lstat(target);
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      throw new Error("Unsafe storage path.");
    }
    const canonicalRoot = await this.getCanonicalRoot();
    const canonicalTarget = await realpath(target);
    this.assertCanonicalContainment(canonicalRoot, canonicalTarget);
  }

  private async resolveExistingRegularFile(key: string) {
    const segments = this.getSafeSegments(key);
    const canonicalRoot = await this.getCanonicalRoot();
    let current = canonicalRoot;
    for (const [index, segment] of segments.entries()) {
      const candidate = path.join(current, segment);
      const metadata = await lstat(candidate);
      const finalSegment = index === segments.length - 1;
      if (finalSegment && metadata.isSymbolicLink()) {
        throw new Error("Unsafe storage path.");
      }
      const canonical = await realpath(candidate);
      this.assertCanonicalContainment(canonicalRoot, canonical);
      const targetMetadata = metadata.isSymbolicLink() ? await stat(canonical) : metadata;
      if (finalSegment) {
        if (!targetMetadata.isFile()) {
          throw new Error("Storage object is not a regular file.");
        }
        return canonical;
      }
      if (!targetMetadata.isDirectory()) {
        throw new Error("Storage object parent is not a directory.");
      }
      current = canonical;
    }
    throw new Error("Unsafe storage key.");
  }
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly now: () => number;
  private readonly successTtlMs: number;
  private readonly failureTtlMs: number;
  private readinessCache: { value: boolean; expiresAt: number } | null = null;
  private readinessProbe: Promise<boolean> | null = null;

  constructor(options?: S3StorageAdapterOptions) {
    if (options) {
      this.client = options.client;
      this.bucket = options.bucket;
      this.now = options.now ?? Date.now;
      this.successTtlMs = options.successTtlMs ?? readinessSuccessTtlMs;
      this.failureTtlMs = options.failureTtlMs ?? readinessFailureTtlMs;
      return;
    }
    const env = getEnv();
    this.bucket = env.NOVIQWIKI_S3_BUCKET ?? "";
    this.client = new S3Client({
      endpoint: env.NOVIQWIKI_S3_ENDPOINT,
      region: env.NOVIQWIKI_S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.NOVIQWIKI_S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.NOVIQWIKI_S3_SECRET_ACCESS_KEY ?? ""
      }
    });
    this.now = Date.now;
    this.successTtlMs = readinessSuccessTtlMs;
    this.failureTtlMs = readinessFailureTtlMs;
  }

  async put(key: string, bytes: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType
      })
    );
    return { key, publicUrl: await this.getPublicUrl(key) };
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getPublicUrl(key: string) {
    return getStableMediaUrl(key);
  }

  async read(key: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) {
      throw new Error("Storage object has no body.");
    }
    return result.Body.transformToWebStream() as ReadableStream<Uint8Array>;
  }

  async isReady() {
    if (!this.bucket) {
      return false;
    }
    const now = this.now();
    if (this.readinessCache && this.readinessCache.expiresAt > now) {
      return this.readinessCache.value;
    }
    if (this.readinessProbe) {
      return this.readinessProbe;
    }

    const probe = this.runReadinessProbe();
    this.readinessProbe = probe;
    try {
      const value = await probe;
      this.readinessCache = {
        value,
        expiresAt: this.now() + (value ? this.successTtlMs : this.failureTtlMs)
      };
      return value;
    } finally {
      if (this.readinessProbe === probe) {
        this.readinessProbe = null;
      }
    }
  }

  private async runReadinessProbe() {
    const key = `.noviqwiki-readiness/${process.pid}-${crypto.randomUUID()}`;
    const body = Buffer.from("noviqwiki-ready", "utf8");
    let versionId: string | undefined;
    let objectCreated = false;
    let operationsReady: boolean;
    try {
      const stored = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: "text/plain"
        })
      );
      objectCreated = true;
      versionId = stored.VersionId;
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      operationsReady = Boolean(
        result.Body && Buffer.from(await result.Body.transformToByteArray()).equals(body)
      );
    } catch {
      operationsReady = false;
    }

    if (!objectCreated) {
      return false;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(versionId ? { VersionId: versionId } : {})
        })
      );
    } catch {
      return false;
    }
    return operationsReady;
  }
}

let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  storageAdapter ??=
    getEnv().NOVIQWIKI_MEDIA_DRIVER === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter();
  return storageAdapter;
}
