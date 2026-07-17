import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";

export async function requirePageReadAccess(siteId: string) {
  const session = await getCurrentSession();
  if (!(await hasPermission(session?.user.id, siteId, "page.read"))) {
    redirect("/login");
  }
  return session;
}

export async function requireMediaReadAccess(siteId: string) {
  const session = await getCurrentSession();
  if (!(await hasPermission(session?.user.id, siteId, "media.read"))) {
    redirect("/login");
  }
  return session;
}
