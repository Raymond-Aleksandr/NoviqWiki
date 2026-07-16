import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { listAuditLogs } from "@/modules/audit/service";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("audit.read");
    const url = new URL(request.url);
    return ok(
      await listAuditLogs({
        siteId: site.site.id,
        limit: Number(url.searchParams.get("pageSize") ?? 50),
        offset:
          Math.max(0, Number(url.searchParams.get("page") ?? 1) - 1) *
          Number(url.searchParams.get("pageSize") ?? 50)
      })
    );
  } catch (error) {
    return apiError(error);
  }
}
