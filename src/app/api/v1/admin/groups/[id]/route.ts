import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { requireApiContext } from "@/modules/api/auth";
import { apiError, ok } from "@/modules/api/responses";
import { updateGroup } from "@/modules/authorization/permissions";

const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).optional(),
    roleIds: z.array(z.string().uuid()).max(100).default([])
  })
  .strict();
const groupIdSchema = z.string().uuid();

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext("group.manage", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const id = groupIdSchema.parse((await params).id);
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
