import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { apiError, created, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { createGroup, getGroupSummaries, updateGroup } from "@/modules/authorization/permissions";

const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  roleIds: z.array(z.string().uuid()).default([])
});

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
    const { site, session } = await requireApiContext("group.manage");
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    const body = createGroupSchema.parse(await request.json());
    const group = await createGroup({
      siteId: site.site.id,
      name: body.name,
      description: body.description
    });
    if (body.roleIds.length > 0) {
      await updateGroup({
        siteId: site.site.id,
        groupId: group.id,
        name: group.name,
        description: group.description,
        roleIds: body.roleIds,
        actorId: session.user.id,
        actorDisplayName: session.user.displayName
      });
    }
    return created({ group });
  } catch (error) {
    return apiError(error);
  }
}
