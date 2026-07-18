import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { mediaAssets } from "@/db/schema";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getMediaCacheControl, getMediaContentDisposition } from "@/modules/media/response";
import { getStorageAdapter } from "@/modules/media/storage";

type Props = {
  params: Promise<unknown>;
};

export async function GET(_request: Request, { params }: Props) {
  const parsedParams = await params;
  const key =
    typeof parsedParams === "object" &&
    parsedParams !== null &&
    "key" in parsedParams &&
    Array.isArray(parsedParams.key)
      ? parsedParams.key
      : [];
  const storageKey = key.filter((part): part is string => typeof part === "string").join("/");
  if (!storageKey) {
    return new NextResponse("Not found", { status: 404 });
  }
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.storageKey, storageKey))
    .limit(1);
  if (!asset || asset.deletedAt) {
    return new NextResponse("Not found", { status: 404 });
  }
  const session = await getCurrentSession();
  if (!(await hasPermission(session?.user.id, asset.siteId, "media.read"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const publiclyReadable = await hasPermission(null, asset.siteId, "media.read");
  const body = await getStorageAdapter().read(storageKey);
  const responseBody = body instanceof ReadableStream ? body : Uint8Array.from(body).buffer;
  return new NextResponse(responseBody, {
    headers: {
      "content-type": asset.mimeType,
      "content-disposition": getMediaContentDisposition(asset.mimeType, asset.safeFilename),
      "cache-control": getMediaCacheControl(publiclyReadable),
      "x-content-type-options": "nosniff"
    }
  });
}
