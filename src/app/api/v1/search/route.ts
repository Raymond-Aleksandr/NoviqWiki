import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { searchPages } from "@/modules/search/service";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("page.read");
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const result = await searchPages({
      siteId: site.site.id,
      query,
      category: url.searchParams.get("category") ?? undefined,
      limit: Number(url.searchParams.get("pageSize") ?? 20),
      offset:
        Math.max(0, Number(url.searchParams.get("page") ?? 1) - 1) *
        Number(url.searchParams.get("pageSize") ?? 20)
    });
    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
