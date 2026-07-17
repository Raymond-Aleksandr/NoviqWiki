import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { getRevisionForRead } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("revision.read");
    const { id } = await params;
    const { revision } = await getRevisionForRead(id);
    return ok({ revision });
  } catch (error) {
    return apiError(error);
  }
}
