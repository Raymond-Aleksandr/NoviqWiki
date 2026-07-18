import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

export type StoredObject = {
  key: string;
  publicUrl: string;
};

export interface StorageAdapter {
  put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): Promise<string>;
  isReady(): Promise<boolean>;
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly root = getEnv().NOVIQWIKI_MEDIA_ROOT,
    private readonly publicPath = getEnv().NOVIQWIKI_STORAGE_PUBLIC_PATH
  ) {}

  async put(key: string, bytes: Buffer) {
    const safePath = this.resolveSafePath(key);
    await mkdir(path.dirname(safePath), { recursive: true });
    await writeFile(safePath, bytes, { flag: "wx" });
    return { key, publicUrl: `${this.publicPath.replace(/\/$/, "")}/${key}` };
  }

  async delete(key: string) {
    await rm(this.resolveSafePath(key), { force: true });
  }

  async getPublicUrl(key: string) {
    return `${this.publicPath.replace(/\/$/, "")}/${key}`;
  }

  async isReady() {
    await mkdir(this.root, { recursive: true });
    return true;
  }

  async read(key: string) {
    return readFile(this.resolveSafePath(key));
  }

  private resolveSafePath(key: string) {
    const resolved = path.resolve(this.root, key);
    const root = path.resolve(this.root);
    if (!resolved.startsWith(root + path.sep)) {
      throw new Error("Unsafe storage key.");
    }
    return resolved;
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
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
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 60 * 60
    });
  }

  async isReady() {
    return Boolean(this.bucket);
  }
}

export function getStorageAdapter(): StorageAdapter {
  return getEnv().NOVIQWIKI_MEDIA_DRIVER === "s3"
    ? new S3StorageAdapter()
    : new LocalStorageAdapter();
}
