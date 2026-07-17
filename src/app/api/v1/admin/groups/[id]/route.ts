import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { requireApiContext } from "@/modules/api/auth";
import { apiError, ok } from "@/modules/api/responses";
import { updateGroup } from "@/modules/authorization/permissions";

const updateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  roleIds: z.array(z.string().uuid()).default([])
});

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext("group.manage");
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const { id } = await params;
    const body = updateGroupSchema.parse(await request.json());
    const group = await updateGroup({
      siteId: site.site.id,
      groupId: id,
      name: body.name,
      description: body.description,
      roleIds: body.roleIds,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return ok({ group });
  } catch (error) {
    return apiError(error);
  }
}
