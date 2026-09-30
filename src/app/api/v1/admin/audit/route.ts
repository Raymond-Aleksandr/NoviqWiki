import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { auditActionValue, listAuditLogs } from "@/modules/audit/service";
import { getPagination } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("audit.read");
    const url = new URL(request.url);
    const { limit, offset } = getPagination(url.searchParams);
    return ok(
      await listAuditLogs({
        siteId: site.site.id,
        action: auditActionValue(url.searchParams.get("action")),
        query: url.searchParams.get("q") ?? undefined,
        limit,
        offset
      })
    );
  } catch (error) {
    return apiError(error);
  }
}
