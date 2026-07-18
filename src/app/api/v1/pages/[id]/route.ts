import { ok, empty, apiError } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { apiUuidSchema, patchPageApiSchema } from "@/modules/api/page-schemas";
import {
  archivePage,
  assertPageVisibleForRead,
  getPageWithCurrentRevision,
  publishPage,
  renamePage,
  restorePage,
  setPageProtection,
  softDeletePage
} from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("page.read");
    const id = apiUuidSchema.parse((await params).id);
    const page = await getPageWithCurrentRevision(id);
    assertPageVisibleForRead(page.page);
    return ok(page);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext(undefined, request);
    if (!session) throw new ForbiddenError("Authentication required.");
    const id = apiUuidSchema.parse((await params).id);
    const body = patchPageApiSchema.parse(await request.json());
    if ("action" in body) {
      if (body.action === "archive") {
        await requireApiContext("page.delete");
        const page = await archivePage({
          pageId: id,
          actorId: session.user.id,
          actorDisplayName: session.user.displayName
        });
        return ok({ page });
      }
      await requireApiContext("page.restore");
      const page = await restorePage({
        pageId: id,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
      return ok({ page });
    }
    if ("protectionLevel" in body) {
      await requireApiContext("page.protect");
      const page = await setPageProtection({
        pageId: id,
        protectionLevel: body.protectionLevel,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
      return ok({ page });
    }
    if ("title" in body) {
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
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { session } = await requireApiContext("page.delete", request);
    if (!session) throw new ForbiddenError("Authentication required.");
    const id = apiUuidSchema.parse((await params).id);
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
