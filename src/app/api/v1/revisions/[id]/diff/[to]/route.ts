import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { compareRevisions } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string; to: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("revision.read");
    const { id, to } = await params;
    return ok(await compareRevisions({ fromRevisionId: id, toRevisionId: to }));
  } catch (error) {
    return apiError(error);
  }
}
