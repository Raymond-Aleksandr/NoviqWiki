import path from "node:path";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { nanoid } from "nanoid";
import { db, type Database } from "@/db/client";
import { mediaAssets, pageRevisions, pages, siteSettings } from "@/db/schema";
import { contentHash } from "@/lib/crypto";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { writeAuditLog } from "@/modules/audit/service";
import { getStorageAdapter } from "./storage";

const unsafeSvgMime = "image/svg+xml";

export async function validateMediaUpload(
  input: {
    siteId: string;
    filename: string;
    bytes: Buffer;
    declaredType?: string;
  },
  database: Database = db
) {
  const [settings] = await database
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.siteId, input.siteId))
    .limit(1);
  const maxBytes = settings?.uploadMaxBytes ?? 5_242_880;
  const allowed = settings?.allowedMediaTypes ?? [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf"
  ];
  if (input.bytes.length === 0) {
    throw new AppError("File is empty.", "empty_upload", 422);
  }
  if (input.bytes.length > maxBytes) {
    throw new AppError("File is larger than the configured upload limit.", "upload_too_large", 413);
  }
  const detected = await fileTypeFromBuffer(input.bytes);
  const mimeType = detected?.mime ?? input.declaredType ?? "application/octet-stream";
  if (mimeType === unsafeSvgMime || !allowed.includes(mimeType)) {
    throw new AppError("This file type is not allowed.", "unsupported_media_type", 415, {
      mimeType
    });
  }
  const safeFilename = sanitizeFilename(input.filename, detected?.ext);
  const dimensions = getImageDimensions(input.bytes, mimeType);
  return {
    mimeType,
    safeFilename,
    dimensions
  };
}

export async function uploadMedia(
  input: {
    siteId: string;
    uploaderId: string;
    uploaderDisplayName: string;
    filename: string;
    bytes: Buffer;
    declaredType?: string;
    altText?: string;
  },
  database: Database = db
) {
  const validation = await validateMediaUpload(input, database);
  const hash = contentHash(input.bytes.toString("base64"));
  const existing = await database
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.siteId, input.siteId),
        eq(mediaAssets.contentHash, hash),
        isNull(mediaAssets.deletedAt)
      )
    )
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }
  const ext = path.extname(validation.safeFilename);
  const key = `${input.siteId}/${new Date().getUTCFullYear()}/${nanoid(24)}${ext}`;
  const stored = await getStorageAdapter().put(key, input.bytes, validation.mimeType);
  const [asset] = await database
    .insert(mediaAssets)
    .values({
      siteId: input.siteId,
      uploaderId: input.uploaderId,
      originalFilename: input.filename,
      safeFilename: validation.safeFilename,
      storageKey: stored.key,
      publicUrl: stored.publicUrl,
      mimeType: validation.mimeType,
      byteSize: input.bytes.length,
      contentHash: hash,
      width: validation.dimensions?.width ?? null,
      height: validation.dimensions?.height ?? null,
      altText: input.altText ?? ""
    })
    .returning();
  await writeAuditLog(
    {
      siteId: input.siteId,
      actorId: input.uploaderId,
      actorDisplayName: input.uploaderDisplayName,
      action: "media.uploaded",
      targetType: "media",
      targetId: asset.id,
      details: { filename: asset.safeFilename, mimeType: asset.mimeType, bytes: asset.byteSize }
    },
    database
  );
  return asset;
}

export async function listMedia(
  input: { siteId: string; query?: string; limit?: number; offset?: number },
  database: Database = db
) {
  const where = input.query
    ? and(
        eq(mediaAssets.siteId, input.siteId),
        isNull(mediaAssets.deletedAt),
        ilike(mediaAssets.safeFilename, `%${input.query}%`)
      )
    : and(eq(mediaAssets.siteId, input.siteId), isNull(mediaAssets.deletedAt));
  return database
    .select()
    .from(mediaAssets)
    .where(where)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
}

export async function getMediaReferences(assetId: string, database: Database = db) {
  const [asset] = await database
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!asset) {
    throw new NotFoundError("Media asset not found.");
  }
  const rows = await database
    .select({ pageId: pages.id, title: pages.title, slug: pages.slug })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.id, pages.currentRevisionId))
    .where(
      and(
        eq(pages.siteId, asset.siteId),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        or(
          ilike(pageRevisions.markdown, `%${asset.publicUrl}%`),
          ilike(pageRevisions.markdown, `%${asset.safeFilename}%`)
        )
      )
    );
  return rows;
}

export async function deleteMedia(
  input: { assetId: string; actorId: string; actorDisplayName: string; force?: boolean },
  database: Database = db
) {
  const [asset] = await database
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, input.assetId))
    .limit(1);
  if (!asset) {
    throw new NotFoundError("Media asset not found.");
  }
  const references = await getMediaReferences(input.assetId, database);
  if (references.length > 0 && !input.force) {
    throw new ConflictError("Media is still referenced by published pages.");
  }
  await getStorageAdapter().delete(asset.storageKey);
  const [updated] = await database
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaAssets.id, asset.id))
    .returning();
  await writeAuditLog(
    {
      siteId: asset.siteId,
      actorId: input.actorId,
      actorDisplayName: input.actorDisplayName,
      action: "media.deleted",
      targetType: "media",
      targetId: asset.id,
      details: { filename: asset.safeFilename, references: references.length }
    },
    database
  );
  return updated;
}

function sanitizeFilename(filename: string, detectedExt?: string) {
  const parsed = path.parse(filename);
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const ext = (detectedExt ? `.${detectedExt}` : parsed.ext)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "");
  const safe = `${base || "upload"}${ext}`;
  if (safe.includes("..") || safe.includes("/") || safe.includes("\\")) {
    throw new AppError("Unsafe filename.", "unsafe_filename", 422);
  }
  return safe;
}

function getImageDimensions(bytes: Buffer, mimeType: string) {
  if (!mimeType.startsWith("image/")) {
    return null;
  }
  try {
    const result = imageSize(bytes);
    return {
      width: result.width ?? null,
      height: result.height ?? null
    };
  } catch {
    return null;
  }
}
