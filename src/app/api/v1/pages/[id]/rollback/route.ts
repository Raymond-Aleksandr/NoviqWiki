import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { apiUuidSchema, rollbackPageApiSchema } from "@/modules/api/page-schemas";
import { rollbackPage } from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { session } = await requireApiContext("page.rollback", request);
    if (!session) throw new ForbiddenError("Authentication required.");
    const id = apiUuidSchema.parse((await params).id);
    const body = rollbackPageApiSchema.parse(await request.json());
    const revision = await rollbackPage({
      pageId: id,
      targetRevisionId: body.targetRevisionId,
      reason: body.reason,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return ok({ revision });
  } catch (error) {
    return apiError(error);
  }
}
