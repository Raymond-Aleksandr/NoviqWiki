import { requireAuthenticatedPermission } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { AdminRolesView } from "@/features/admin/roles-view";
import { roleDescription, roleDisplayName } from "@/i18n/authorization";
import { getRequestI18n } from "@/i18n/server";
import { getRoleSummaries, permissionKeys } from "@/modules/authorization/permissions";

export default async function AdminRolesPage() {
  const site = await getRequestSite();
  await requireAuthenticatedPermission(site!.site.id, "role.read");
  const [rows, { messages }] = await Promise.all([
    getRoleSummaries(site!.site.id),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  return (
    <AdminRolesView
      messages={messages}
      permissions={permissionKeys.map((permission) => ({ value: permission, label: permission }))}
      rows={rows.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        displayName: roleDisplayName(role, messages),
        displayDescription: roleDescription(role, messages),
        builtIn: role.builtIn,
        permissions: role.permissions
      }))}
    />
  );
}
