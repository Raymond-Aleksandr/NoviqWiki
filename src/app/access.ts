import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/request-context";
import {
  hasPermission,
  requirePermission,
  type PermissionKey
} from "@/modules/authorization/permissions";

export async function requirePageReadAccess(siteId: string) {
  const session = await getRequestSession();
  if (!(await hasPermission(session?.user.id, siteId, "page.read"))) {
    redirect("/login");
  }
  return session;
}

export async function requireMediaReadAccess(siteId: string) {
  const session = await getRequestSession();
  if (!(await hasPermission(session?.user.id, siteId, "media.read"))) {
    redirect("/login");
  }
  return session;
}

export async function requireAuthenticatedPermission(siteId: string, permission: PermissionKey) {
  const session = await getRequestSession();
  if (!session) {
    redirect("/login");
  }
  await requirePermission(session.user.id, siteId, permission);
  return session;
}
