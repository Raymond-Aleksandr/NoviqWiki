import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { apiUuidSchema } from "@/modules/api/page-schemas";
import { compareRevisionsForRead } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string; to: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("revision.read");
    const parsed = await params;
    const id = apiUuidSchema.parse(parsed.id);
    const to = apiUuidSchema.parse(parsed.to);
    const { page: _page, ...diff } = await compareRevisionsForRead({
      fromRevisionId: id,
      toRevisionId: to
    });
    return ok(diff);
  } catch (error) {
    return apiError(error);
  }
}
