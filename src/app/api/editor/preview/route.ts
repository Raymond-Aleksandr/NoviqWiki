import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { requireApiContext } from "@/modules/api/auth";
import { apiError, ok } from "@/modules/api/responses";
import { hasPermission, requirePermission } from "@/modules/authorization/permissions";
import { renderEditorPreview } from "@/modules/rendering/preview";

const previewSchema = z.object({
  markdown: z.string().max(2_000_000),
  mode: z.enum(["create", "edit"])
});

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext();
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const body = previewSchema.parse(await request.json());
    await requirePermission(
      session.user.id,
      site.site.id,
      body.mode === "create" ? "page.create" : "page.edit"
    );
    const canCreatePage = await hasPermission(session.user.id, site.site.id, "page.create");
    const preview = await renderEditorPreview({
      siteId: site.site.id,
      markdown: body.markdown,
      canCreatePage
    });
    return ok({ html: preview.html });
  } catch (error) {
    return apiError(error);
  }
}
