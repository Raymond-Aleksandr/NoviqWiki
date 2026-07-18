import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { requireApiContext } from "@/modules/api/auth";
import { apiError, ok } from "@/modules/api/responses";
import { permissionKeys, updateRole } from "@/modules/authorization/permissions";

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).optional(),
    permissionKeys: z.array(z.enum(permissionKeys)).max(permissionKeys.length).default([])
  })
  .strict();
const roleIdSchema = z.string().uuid();

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { site, session } = await requireApiContext("role.manage", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const id = roleIdSchema.parse((await params).id);
    const body = updateRoleSchema.parse(await request.json());
    const role = await updateRole({
      siteId: site.site.id,
      roleId: id,
      name: body.name,
      description: body.description,
      permissionKeys: body.permissionKeys,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return ok({ role });
  } catch (error) {
    return apiError(error);
  }
}
