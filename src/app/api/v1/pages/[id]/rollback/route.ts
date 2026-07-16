import { z } from "zod";
import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { rollbackPage } from "@/modules/pages/service";
import { ForbiddenError } from "@/lib/errors";

const rollbackSchema = z.object({
  targetRevisionId: z.string(),
  reason: z.string().default("Rollback")
});

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { session } = await requireApiContext("page.rollback");
    if (!session) throw new ForbiddenError("Authentication required.");
    const { id } = await params;
    const body = rollbackSchema.parse(await request.json());
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
