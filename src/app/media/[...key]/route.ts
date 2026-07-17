import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { mediaAssets } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { LocalStorageAdapter, getStorageAdapter } from "@/modules/media/storage";

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
  if (getEnv().NEXTWIKI_MEDIA_DRIVER === "s3") {
    const url = await getStorageAdapter().getPublicUrl(storageKey);
    return NextResponse.redirect(url);
  }
  const bytes = await new LocalStorageAdapter().read(storageKey);
  return new NextResponse(bytes, {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    }
  });
}
