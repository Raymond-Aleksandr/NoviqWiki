import { requireAuthenticatedPermission } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { AdminGroupsView } from "@/features/admin/groups-view";
import { groupDescription, groupDisplayName, roleDisplayName } from "@/i18n/authorization";
import { getRequestI18n } from "@/i18n/server";
import { getGroupSummaries, getRoleSummaries } from "@/modules/authorization/permissions";

export default async function AdminGroupsPage() {
  const site = await getRequestSite();
  await requireAuthenticatedPermission(site!.site.id, "group.read");
  await requireAuthenticatedPermission(site!.site.id, "role.read");
  const [rows, roleRows, { messages }] = await Promise.all([
    getGroupSummaries(site!.site.id),
    getRoleSummaries(site!.site.id),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  return (
    <AdminGroupsView
      messages={messages}
      roles={roleRows.map((role) => ({ value: role.id, label: roleDisplayName(role, messages) }))}
      rows={rows.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        displayName: groupDisplayName(group, messages),
        displayDescription: groupDescription(group, messages),
        builtIn: group.builtIn,
        roles: group.roleIds.map((id, index) => ({ value: id, label: roleDisplayName({ name: group.roleNames[index] ?? id, normalizedName: group.roleNormalizedNames[index] ?? null }, messages) }))
      }))}
    />
  );
}
