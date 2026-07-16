import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { getCategoryWithPages } from "@/modules/categories/service";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const { site } = await requireApiContext("page.read");
    const { slug } = await params;
    return ok(await getCategoryWithPages({ siteId: site.site.id, slug }));
  } catch (error) {
    return apiError(error);
  }
}
