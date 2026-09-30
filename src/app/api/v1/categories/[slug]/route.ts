import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { decodeRouteParam } from "@/lib/route-params";
import { getCategoryWithPages } from "@/modules/categories/service";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const { site } = await requireApiContext("page.read");
    const { slug: rawSlug } = await params;
    const slug = decodeRouteParam(rawSlug);
    return ok(await getCategoryWithPages({ siteId: site.site.id, slug }));
  } catch (error) {
    return apiError(error);
  }
}
