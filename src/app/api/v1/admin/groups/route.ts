import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { apiError, created, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { createGroupWithRoles, getGroupSummaries } from "@/modules/authorization/permissions";

const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).optional(),
    roleIds: z.array(z.string().uuid()).max(100).default([])
  })
  .strict();

export async function GET() {
  try {
    const { site } = await requireApiContext("group.read");
    return ok({ groups: await getGroupSummaries(site.site.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { site, session } = await requireApiContext("group.manage", request);
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const body = createGroupSchema.parse(await request.json());
    const group = await createGroupWithRoles({
      siteId: site.site.id,
      name: body.name,
      description: body.description,
      roleIds: body.roleIds,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName
    });
    return created({ group });
  } catch (error) {
    return apiError(error);
  }
}
