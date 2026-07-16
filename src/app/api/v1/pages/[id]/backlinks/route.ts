import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { listPageBacklinks } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const { site } = await requireApiContext("page.read");
    const { id } = await params;
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
