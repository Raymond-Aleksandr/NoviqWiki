import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { listRevisions } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("revision.read");
    const { id } = await params;
    return ok({ revisions: await listRevisions(id) });
  } catch (error) {
    return apiError(error);
  }
}
