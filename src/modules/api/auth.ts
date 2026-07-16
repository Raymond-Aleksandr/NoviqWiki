import { getPrimarySiteWithSettings } from "@/db/site";
import { ForbiddenError } from "@/lib/errors";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission, type PermissionKey } from "@/modules/authorization/permissions";

export async function requireApiContext(permission?: PermissionKey) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    throw new ForbiddenError("Setup is required.");
  }
  const session = await getCurrentSession();
  if (permission) {
    await requirePermission(session?.user.id, site.site.id, permission);
  }
  return { site, session };
}
