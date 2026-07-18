import path from "node:path";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { nanoid } from "nanoid";
import { lockPageGraphForTransaction } from "@/db/advisory-locks";
import { db, type Database, type RootDatabase } from "@/db/client";
import { mediaAssets, pageDrafts, pageRevisions, pages, siteSettings } from "@/db/schema";
import { contentHash } from "@/lib/crypto";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/modules/audit/service";
import { requirePermissionsForMutation } from "@/modules/authorization/permissions";
import {
  defaultAllowedMediaTypes,
  isSafeAllowedMediaType,
  MAX_MEDIA_UPLOAD_BYTES
} from "@/modules/settings/service";
import { getStableMediaUrl, getStorageAdapter, type StorageAdapter } from "./storage";

const DEFAULT_MEDIA_UPLOAD_BYTES = 5_242_880;
const ABSOLUTE_HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const HTML_AMPERSAND_PATTERN = /&(?:amp|#0*38|#x0*26);/gi;
export const MAX_ORIGINAL_FILENAME_LENGTH = 260;
export const MAX_MEDIA_ALT_TEXT_LENGTH = 2_000;

export type StoredMediaUrlMapping = {
  publicUrl: string;
  storageKey: string;
};

export function extractAbsoluteMediaUrls(contents: readonly string[]) {
  const urls = new Set<string>();
  for (const content of contents) {
    for (const match of content.matchAll(ABSOLUTE_HTTP_URL_PATTERN)) {
      const candidate = trimUrlDelimiters(match[0]).replace(HTML_AMPERSAND_PATTERN, "&");
      if (candidate) {
        urls.add(candidate);
      }
    }
  }
  return [...urls];
}

export function rewriteLegacyMediaUrlsInContent(
  content: string,
  assets: readonly StoredMediaUrlMapping[]
) {
  const replacements = new Map<string, string>();
  for (const asset of assets) {
    const stableUrl = getStableMediaUrl(asset.storageKey);
    if (!asset.publicUrl || asset.publicUrl === stableUrl) {
      continue;
    }
    replacements.set(asset.publicUrl, stableUrl);
  }
  return content.replace(ABSOLUTE_HTTP_URL_PATTERN, (rawMatch) => {
    const rawUrl = trimUrlDelimiters(rawMatch);
    const decodedUrl = rawUrl.replace(HTML_AMPERSAND_PATTERN, "&");
    const stableUrl = replacements.get(decodedUrl);
    return stableUrl ? `${stableUrl}${rawMatch.slice(rawUrl.length)}` : rawMatch;
  });
}

export async function rewriteLegacyMediaUrls(
  input: { siteId: string; contents: readonly string[] },
  database: Database = db
) {
  const candidates = extractAbsoluteMediaUrls(input.contents);
  if (candidates.length === 0) {
    return [...input.contents];
  }
  // Pass the complete candidate set as one JSON value instead of expanding it
  // into one bind parameter (or query) per URL. PostgreSQL turns the value into
  // a relation for an exact semi-join, so arbitrary links in a large document
  // cannot amplify a single view into hundreds of database round trips.
  const candidatesJson = JSON.stringify(candidates);
  const assets = await database
    .select({ publicUrl: mediaAssets.publicUrl, storageKey: mediaAssets.storageKey })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.siteId, input.siteId),
        sql`${mediaAssets.publicUrl} in (
          select candidate.url
          from jsonb_array_elements_text(${candidatesJson}::jsonb) as candidate(url)
        )`
      )
    );
  return input.contents.map((content) => rewriteLegacyMediaUrlsInContent(content, assets));
}

function trimUrlDelimiters(value: string) {
  let result = value.replace(/[.,;!]+$/g, "");
  for (const [opening, closing] of [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"]
  ] as const) {
    while (
      result.endsWith(closing) &&
      countCharacters(result, closing) > countCharacters(result, opening)
    ) {
      result = result.slice(0, -1);
    }
  }
  return result;
}

function countCharacters(value: string, character: string) {
  return [...value].filter((candidate) => candidate === character).length;
}

export async function validateMediaUpload(
  input: {
    siteId: string;
    filename: string;
    bytes: Buffer;
    declaredType?: string;
  },
  database: Database = db
) {
  validateOriginalFilename(input.filename);
  const [settings] = await database
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.siteId, input.siteId))
    .limit(1);
  const maxBytes = normalizeUploadLimit(settings?.uploadMaxBytes);
  const allowed = (settings?.allowedMediaTypes ?? [...defaultAllowedMediaTypes]).map((value) =>
    value.toLowerCase()
  );
  if (input.bytes.length === 0) {
    throw new AppError("File is empty.", "empty_upload", 422);
  }
  if (input.bytes.length > maxBytes) {
    throw new AppError("File is larger than the configured upload limit.", "upload_too_large", 413);
  }
  const detected = await fileTypeFromBuffer(input.bytes).catch(() => undefined);
  const mimeType =
    detected?.mime ?? (isPlainText(input.bytes) ? "text/plain" : "application/octet-stream");
  if (!isSafeAllowedMediaType(mimeType) || !allowed.includes(mimeType)) {
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
  database: RootDatabase = db,
  storage: StorageAdapter = getStorageAdapter()
) {
  const altText = normalizeMediaAltText(input.altText);
  const validation = await validateMediaUpload(input, database);
  const hash = contentHash(input.bytes.toString("base64"));
  const existing = await database.transaction(async (tx) => {
    await requirePermissionsForMutation(input.uploaderId, input.siteId, ["media.upload"], tx);
    const [asset] = await tx
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
    return asset;
  });
  if (existing) {
    return {
      ...existing,
      publicUrl: getStableMediaUrl(existing.storageKey)
    };
  }
  const ext = path.extname(validation.safeFilename);
  const key = `${input.siteId}/${new Date().getUTCFullYear()}/${nanoid(24)}${ext}`;
  const stored = await storage.put(key, input.bytes, validation.mimeType);
  try {
    return await database.transaction(async (tx) => {
      await requirePermissionsForMutation(input.uploaderId, input.siteId, ["media.upload"], tx);
      const [asset] = await tx
        .insert(mediaAssets)
        .values({
          siteId: input.siteId,
          uploaderId: input.uploaderId,
          originalFilename: input.filename,
          safeFilename: validation.safeFilename,
          storageKey: stored.key,
          publicUrl: getStableMediaUrl(stored.key),
          mimeType: validation.mimeType,
          byteSize: input.bytes.length,
          contentHash: hash,
          width: validation.dimensions?.width ?? null,
          height: validation.dimensions?.height ?? null,
          altText
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
        tx
      );
      return asset;
    });
  } catch (error) {
    await storage.delete(stored.key).catch(() => undefined);
    throw error;
  }
}

export function normalizeMediaAltText(value: string | undefined) {
  const altText = value?.trim() ?? "";
  if (altText.length > MAX_MEDIA_ALT_TEXT_LENGTH) {
    throw new AppError(
      `Alternative text must contain at most ${MAX_MEDIA_ALT_TEXT_LENGTH} characters.`,
      "validation_error",
      422
    );
  }
  return altText;
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
  const rows = await database
    .select()
    .from(mediaAssets)
    .where(where)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return rows.map((asset) => ({
    ...asset,
    publicUrl: getStableMediaUrl(asset.storageKey)
  }));
}

export async function getMediaUploadMaxBytes(siteId: string, database: Database = db) {
  const [settings] = await database
    .select({ uploadMaxBytes: siteSettings.uploadMaxBytes })
    .from(siteSettings)
    .where(eq(siteSettings.siteId, siteId))
    .limit(1);
  return normalizeUploadLimit(settings?.uploadMaxBytes);
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
  return findMediaReferences(asset, database, false);
}

async function findMediaReferences(
  asset: typeof mediaAssets.$inferSelect,
  database: Database,
  includeRecoverablePages: boolean
) {
  const revisionRows = await database
    .select({ pageId: pages.id, title: pages.title, slug: pages.slug })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.pageId, pages.id))
    .where(
      and(
        eq(pages.siteId, asset.siteId),
        includeRecoverablePages ? undefined : inArray(pages.status, ["published", "archived"]),
        includeRecoverablePages ? undefined : isNull(pages.deletedAt),
        or(
          ilike(pageRevisions.markdown, `%${asset.publicUrl}%`),
          ilike(pageRevisions.markdown, `%${getStableMediaUrl(asset.storageKey)}%`),
          ilike(pageRevisions.markdown, `%${asset.safeFilename}%`)
        )
      )
    );
  if (!includeRecoverablePages) {
    return uniqueMediaReferenceRows(revisionRows);
  }
  const draftRows = await database
    .select({ pageId: pages.id, title: pages.title, slug: pages.slug })
    .from(pages)
    .innerJoin(pageDrafts, eq(pageDrafts.pageId, pages.id))
    .where(
      and(
        eq(pages.siteId, asset.siteId),
        or(
          ilike(pageDrafts.markdown, `%${asset.publicUrl}%`),
          ilike(pageDrafts.markdown, `%${getStableMediaUrl(asset.storageKey)}%`),
          ilike(pageDrafts.markdown, `%${asset.safeFilename}%`)
        )
      )
    );
  return uniqueMediaReferenceRows([...revisionRows, ...draftRows]);
}

function uniqueMediaReferenceRows(
  rows: readonly { pageId: string; title: string; slug: string }[]
) {
  return [...new Map(rows.map((row) => [row.pageId, row])).values()];
}

export async function deleteMedia(
  input: { assetId: string; actorId: string; actorDisplayName: string; force?: boolean },
  database: RootDatabase = db,
  storage: StorageAdapter = getStorageAdapter()
) {
  const { asset, updated } = await database.transaction(async (tx) => {
    const [lockedAsset] = await tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, input.assetId), isNull(mediaAssets.deletedAt)))
      .limit(1)
      .for("update");
    if (!lockedAsset) {
      throw new NotFoundError("Media asset not found.");
    }
    await requirePermissionsForMutation(input.actorId, lockedAsset.siteId, ["media.delete"], tx);
    await lockPageGraphForTransaction(lockedAsset.siteId, tx);
    const references = await findMediaReferences(lockedAsset, tx, true);
    if (references.length > 0 && !input.force) {
      throw new ConflictError("Media is still referenced by stored page revisions or drafts.");
    }
    const [deleted] = await tx
      .update(mediaAssets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(mediaAssets.id, lockedAsset.id), isNull(mediaAssets.deletedAt)))
      .returning();
    if (!deleted) {
      throw new NotFoundError("Media asset not found.");
    }
    await writeAuditLog(
      {
        siteId: lockedAsset.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "media.deleted",
        targetType: "media",
        targetId: lockedAsset.id,
        details: { filename: lockedAsset.safeFilename, references: references.length }
      },
      tx
    );
    return { asset: lockedAsset, updated: deleted };
  });
  try {
    await storage.delete(asset.storageKey);
  } catch (error) {
    logger.error(
      { err: error, assetId: asset.id, storageKey: asset.storageKey },
      "Media metadata was deleted but object cleanup failed; the retained object can be retried."
    );
  }
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

function validateOriginalFilename(filename: string) {
  if (
    filename.trim().length === 0 ||
    filename.length > MAX_ORIGINAL_FILENAME_LENGTH ||
    filename.includes("\0")
  ) {
    throw new AppError("Filename is invalid or too long.", "invalid_filename", 422);
  }
}

function normalizeUploadLimit(value: number | null | undefined) {
  const configured =
    Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : DEFAULT_MEDIA_UPLOAD_BYTES;
  return Math.min(configured, MAX_MEDIA_UPLOAD_BYTES);
}

function isPlainText(bytes: Buffer) {
  if (bytes.includes(0)) {
    return false;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return Array.from(text).every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        (codePoint >= 32 && codePoint !== 127) ||
        codePoint === 9 ||
        codePoint === 10 ||
        codePoint === 13
      );
    });
  } catch {
    return false;
  }
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
