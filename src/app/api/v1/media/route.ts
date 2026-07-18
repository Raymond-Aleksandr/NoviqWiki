import { apiError, created, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { getMediaUploadMaxBytes, listMedia, uploadMedia } from "@/modules/media/service";
import { parseBoundedMediaFormData } from "@/modules/media/request";
import { AppError, ForbiddenError } from "@/lib/errors";
import { paginationSchema } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("media.read");
    const url = new URL(request.url);
    const pagination = paginationSchema.parse({
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "50"
    });
    return ok({
      media: await listMedia({
        siteId: site.site.id,
        query: url.searchParams.get("q") ?? undefined,
        limit: pagination.pageSize,
        offset: (pagination.page - 1) * pagination.pageSize
      })
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext("media.upload", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const maxFileBytes = await getMediaUploadMaxBytes(site.site.id);
    const formData = await parseBoundedMediaFormData(request, maxFileBytes);
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
