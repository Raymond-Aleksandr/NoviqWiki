import { z } from "zod";
import { created, ok, apiError } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { createPage, listPages } from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

const createPageSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  markdown: z.string().default(""),
  editSummary: z.string().optional(),
  publish: z.boolean().default(false)
});

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("page.read");
    const url = new URL(request.url);
    const pages = await listPages({
      siteId: site.site.id,
      query: url.searchParams.get("q") ?? undefined,
      status:
        (url.searchParams.get("status") as "draft" | "published" | "archived" | "deleted" | null) ??
        undefined,
      limit: Number(url.searchParams.get("pageSize") ?? 50),
      offset:
        Math.max(0, Number(url.searchParams.get("page") ?? 1) - 1) *
        Number(url.searchParams.get("pageSize") ?? 50)
    });
    return ok({ pages });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext("page.create");
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const body = createPageSchema.parse(await request.json());
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
