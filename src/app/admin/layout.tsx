import { redirect } from "next/navigation";
import { AdminNav } from "@/components/layout/admin-nav";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission } from "@/modules/authorization/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  await requirePermission(session.user.id, site.site.id, "site.configure");
  const { messages } = await getRequestI18n(site.settings?.defaultLocale);
  return (
    <section>
      <AdminNav messages={messages} />
      {children}
    </section>
  );
}
