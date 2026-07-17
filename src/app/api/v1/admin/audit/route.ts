import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { auditActionValue, listAuditLogs } from "@/modules/audit/service";

export async function GET(request: Request) {
  try {
    const { site } = await requireApiContext("audit.read");
    const url = new URL(request.url);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50)));
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    return ok(
      await listAuditLogs({
        siteId: site.site.id,
        action: auditActionValue(url.searchParams.get("action")),
        query: url.searchParams.get("q") ?? undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      })
    );
  } catch (error) {
    return apiError(error);
  }
}
