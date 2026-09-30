import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/layout/admin-nav";
import { getAdminNavigation } from "@/features/admin/navigation";
import { getRequestI18n } from "@/i18n/server";
import { getRequestSession, getRequestSite } from "@/lib/request-context";
import { requirePermission } from "@/modules/authorization/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const site = await getRequestSite();
  if (!site) {
    redirect("/setup");
  }
  const session = await getRequestSession();
  if (!session) {
    redirect("/login");
  }
  await requirePermission(session.user.id, site.site.id, "site.configure");
  const { messages } = await getRequestI18n(site.settings?.defaultLocale);
  return (
    <section>
      <AdminNav items={getAdminNavigation(messages)} label={messages.adminNavigation} />
      {children}
    </section>
  );
}
