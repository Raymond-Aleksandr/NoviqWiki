import { apiError, created, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { listMedia, uploadMedia } from "@/modules/media/service";
import { AppError, ForbiddenError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("media.read");
    const url = new URL(request.url);
    return ok({
      media: await listMedia({
        siteId: site.site.id,
        query: url.searchParams.get("q") ?? undefined,
        limit: Number(url.searchParams.get("pageSize") ?? 50),
        offset:
          Math.max(0, Number(url.searchParams.get("page") ?? 1) - 1) *
          Number(url.searchParams.get("pageSize") ?? 50)
      })
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext("media.upload");
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("File is required.", "missing_file", 422);
    }
    const asset = await uploadMedia({
      siteId: site.site.id,
      uploaderId: session.user.id,
      uploaderDisplayName: session.user.displayName,
      filename: file.name,
      declaredType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      altText:
        typeof formData.get("altText") === "string" ? String(formData.get("altText")) : undefined
    });
    return created({ asset });
  } catch (error) {
    return apiError(error);
  }
}
