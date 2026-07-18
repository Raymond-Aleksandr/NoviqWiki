import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { apiUuidSchema } from "@/modules/api/page-schemas";
import { getRevisionForRead } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("revision.read");
    const id = apiUuidSchema.parse((await params).id);
    const { revision } = await getRevisionForRead(id);
    return ok({ revision });
  } catch (error) {
    return apiError(error);
  }
}
