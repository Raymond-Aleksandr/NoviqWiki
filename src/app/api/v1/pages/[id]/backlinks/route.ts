import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { apiUuidSchema } from "@/modules/api/page-schemas";
import { listPageBacklinks } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const { site } = await requireApiContext("page.read");
    const id = apiUuidSchema.parse((await params).id);
    return ok({
      backlinks: await listPageBacklinks({
        siteId: site.site.id,
        pageId: id,
        limit: 100
      })
    });
  } catch (error) {
    return apiError(error);
  }
}
