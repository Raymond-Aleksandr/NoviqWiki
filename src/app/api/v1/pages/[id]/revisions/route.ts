import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { apiUuidSchema } from "@/modules/api/page-schemas";
import { listRevisionsForRead } from "@/modules/pages/service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("revision.read");
    const id = apiUuidSchema.parse((await params).id);
    return ok({ revisions: await listRevisionsForRead(id) });
  } catch (error) {
    return apiError(error);
  }
}
