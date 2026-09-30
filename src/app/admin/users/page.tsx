import { requireAuthenticatedPermission } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { AdminUsersView } from "@/features/admin/users-view";
import { groupDisplayName, roleDisplayName } from "@/i18n/authorization";
import { getRequestI18n } from "@/i18n/server";
import { getGroupSummaries, getUserGroupMemberships } from "@/modules/authorization/permissions";
import { listUsers } from "@/modules/users/service";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const site = await getRequestSite();
  await requireAuthenticatedPermission(site!.site.id, "user.read");
  await requireAuthenticatedPermission(site!.site.id, "group.read");
  await requireAuthenticatedPermission(site!.site.id, "role.read");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const [rows, groupRows, { locale, messages }] = await Promise.all([
    listUsers({ query: query || undefined, limit: 200 }),
    getGroupSummaries(site!.site.id),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  const memberships = await getUserGroupMemberships(site!.site.id, rows.map((user) => user.id));
  const groupsByUser = new Map<string, Map<string, { value: string; label: string }>>();
  const rolesByUser = new Map<string, Map<string, string>>();
  for (const membership of memberships) {
    const groups = groupsByUser.get(membership.userId) ?? new Map();
    groups.set(membership.groupId, {
      value: membership.groupId,
      label: groupDisplayName({ name: membership.groupName, normalizedName: membership.groupNormalizedName }, messages)
    });
    groupsByUser.set(membership.userId, groups);
    if (membership.roleName) {
      const roles = rolesByUser.get(membership.userId) ?? new Map();
      roles.set(membership.roleNormalizedName ?? membership.roleName, roleDisplayName({ name: membership.roleName, normalizedName: membership.roleNormalizedName }, messages));
      rolesByUser.set(membership.userId, roles);
    }
  }
  return (
    <AdminUsersView
      query={query}
      messages={messages}
      groups={groupRows.map((group) => ({ value: group.id, label: groupDisplayName(group, messages) }))}
      rows={rows.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        groups: [...(groupsByUser.get(user.id)?.values() ?? [])],
        roles: [...(rolesByUser.get(user.id)?.values() ?? [])],
        lastLogin: user.lastLoginAt ? { dateTime: user.lastLoginAt.toISOString(), label: user.lastLoginAt.toLocaleString(locale) } : null
      }))}
    />
  );
}
