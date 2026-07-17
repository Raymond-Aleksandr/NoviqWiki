import { z } from "zod";
import { ok, empty, apiError } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import {
  assertPageVisibleForRead,
  getPageWithCurrentRevision,
  publishPage,
  renamePage,
  restorePage,
  setPageProtection,
  softDeletePage
} from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

const patchSchema = z.object({
  action: z.enum(["restore"]).optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
  markdown: z.string().optional(),
  editSummary: z.string().optional(),
  baseRevisionId: z.string().nullable().optional(),
  protectionLevel: z.enum(["none", "protected"]).optional()
});

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("page.read");
    const { id } = await params;
    const page = await getPageWithCurrentRevision(id);
    assertPageVisibleForRead(page.page);
    return ok(page);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext();
    if (!session) throw new ForbiddenError("Authentication required.");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    if (body.action === "restore") {
      await requireApiContext("page.restore");
      const page = await restorePage({
        pageId: id,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
      return ok({ page });
    }
    if (body.protectionLevel) {
      await requireApiContext("page.protect");
      const page = await setPageProtection({
        pageId: id,
        protectionLevel: body.protectionLevel,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
      return ok({ page });
    }
    if (body.title) {
      await requireApiContext("page.edit");
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
      await requireApiContext("page.edit");
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
