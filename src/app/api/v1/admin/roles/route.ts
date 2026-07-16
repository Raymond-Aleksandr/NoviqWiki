import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { getRoleSummaries } from "@/modules/authorization/permissions";

export async function GET() {
  try {
    const { site } = await requireApiContext("role.read");
    return ok({ roles: await getRoleSummaries(site.site.id) });
  } catch (error) {
    return apiError(error);
  }
}
