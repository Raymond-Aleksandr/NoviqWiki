import { created, ok, apiError } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { createPageApiSchema, listPagesApiQuerySchema } from "@/modules/api/page-schemas";
import { createPage, listPages } from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("page.read");
    const url = new URL(request.url);
    const query = listPagesApiQuerySchema.parse(Object.fromEntries(url.searchParams));
    if (query.status === "draft") {
      await requireApiContext("page.edit");
    } else if (query.status === "archived" || query.status === "deleted") {
      await requireApiContext("page.restore");
    }
    const pages = await listPages({
      siteId: site.site.id,
      query: query.q,
      status: query.status,
      includeDeleted: query.status === "deleted",
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize
    });
    return ok({ pages });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext("page.create", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const body = createPageApiSchema.parse(await request.json());
    if (body.publish) {
      await requireApiContext("page.publish");
    }
    const result = await createPage({
      siteId: site.site.id,
      title: body.title,
      slug: body.slug,
      markdown: body.markdown,
      editSummary: body.editSummary,
      publish: body.publish,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return created(result);
  } catch (error) {
    return apiError(error);
  }
}
