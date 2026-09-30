import { z } from "zod";
import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { searchPages } from "@/modules/search/service";
import { paginationSchema } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const searchQuerySchema = paginationSchema.extend({
  q: z.string().max(500).default(""),
  category: z.string().max(240).optional()
});

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("page.read");
    const url = new URL(request.url);
    const query = searchQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await searchPages({
      siteId: site.site.id,
      query: query.q,
      category: query.category,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize
    });
    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
