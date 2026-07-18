import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { requireApiContext } from "@/modules/api/auth";
import { apiError, ok } from "@/modules/api/responses";
import { updateUserGroups } from "@/modules/authorization/permissions";

const updateUserSchema = z
  .object({
    groupIds: z.array(z.string().uuid()).max(100).default([])
  })
  .strict();
const userIdSchema = z.string().uuid();

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext("user.manage", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const id = userIdSchema.parse((await params).id);
    const body = updateUserSchema.parse(await request.json());
    const groups = await updateUserGroups({
      siteId: site.site.id,
      userId: id,
      groupIds: body.groupIds,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return ok({ groups });
  } catch (error) {
    return apiError(error);
  }
}
