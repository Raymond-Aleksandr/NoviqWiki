import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { createRole, getRoleSummaries, permissionKeys } from "@/modules/authorization/permissions";

const createRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).optional(),
    permissionKeys: z.array(z.enum(permissionKeys)).max(permissionKeys.length).default([])
  })
  .strict();

export async function GET() {
  try {
    const { site } = await requireApiContext("role.read");
    return ok({ roles: await getRoleSummaries(site.site.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext("role.manage", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const body = createRoleSchema.parse(await request.json());
    const role = await createRole({
      siteId: site.site.id,
      name: body.name,
      description: body.description,
      permissionKeys: body.permissionKeys,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return ok({ role }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
