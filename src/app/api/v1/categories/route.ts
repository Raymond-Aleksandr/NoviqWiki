import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { listCategories } from "@/modules/categories/service";

export async function GET() {
  try {
    const { site } = await requireApiContext("page.read");
    return ok({ categories: await listCategories(site.site.id) });
  } catch (error) {
    return apiError(error);
  }
}
