import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { listUsers } from "@/modules/users/service";

export async function GET(request: Request) {
  try {
    await requireApiContext("user.read");
    const url = new URL(request.url);
    return ok({
      users: await listUsers({ query: url.searchParams.get("q") ?? undefined, limit: 100 })
    });
  } catch (error) {
    return apiError(error);
  }
}
