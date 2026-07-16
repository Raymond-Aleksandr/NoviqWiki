import { z } from "zod";
import { ok, empty, apiError } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import {
  getPageWithCurrentRevision,
  publishPage,
  renamePage,
  softDeletePage
} from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

const patchSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  markdown: z.string().optional(),
  editSummary: z.string().optional(),
  baseRevisionId: z.string().nullable().optional()
});

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("page.read");
    const { id } = await params;
    return ok(await getPageWithCurrentRevision(id));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext("page.edit");
    if (!session) throw new ForbiddenError("Authentication required.");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    if (body.title) {
      await requireApiContext("page.rename");
      const page = await renamePage({
        pageId: id,
        newTitle: body.title,
        newSlug: body.slug,
        createAlias: true,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
      return ok({ page });
    }
    if (typeof body.markdown === "string") {
      await requireApiContext("page.publish");
      const revision = await publishPage({
        pageId: id,
        markdown: body.markdown,
        baseRevisionId: body.baseRevisionId,
        editSummary: body.editSummary,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
      return ok({ revision, siteId: site.site.id });
    }
    return ok(await getPageWithCurrentRevision(id));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const { session } = await requireApiContext("page.delete");
    if (!session) throw new ForbiddenError("Authentication required.");
    const { id } = await params;
    await softDeletePage({
      pageId: id,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return empty();
  } catch (error) {
    return apiError(error);
  }
}
