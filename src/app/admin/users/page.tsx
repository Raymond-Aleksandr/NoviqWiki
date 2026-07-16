import { eq, inArray } from "drizzle-orm";
import { Pause, Play, RotateCcw } from "lucide-react";
import { createUserAction, resetUserSessionsAction, updateUserStatusAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db/client";
import { groupRoles, groups, roles, userGroups } from "@/db/schema";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listUsers } from "@/modules/users/service";

export default async function AdminUsersPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await listUsers({ limit: 200 });
  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.siteId, site!.site.id))
    .orderBy(groups.name);
  const roleRows =
    rows.length > 0
      ? await db
          .select({
            userId: userGroups.userId,
            roleName: roles.name
          })
          .from(userGroups)
          .innerJoin(groupRoles, eq(groupRoles.groupId, userGroups.groupId))
          .innerJoin(roles, eq(roles.id, groupRoles.roleId))
          .where(
            inArray(
              userGroups.userId,
              rows.map((user) => user.id)
            )
          )
      : [];
  const roleMap = new Map<string, string[]>();
  for (const row of roleRows) {
    roleMap.set(row.userId, [...(roleMap.get(row.userId) ?? []), row.roleName]);
  }
  return (
    <section className="admin-page">
      <h1>Users</h1>
      <section className="panel admin-create-panel">
        <h2>Create account</h2>
        <ActionForm action={createUserAction} className="admin-form-grid">
          <label>
            Username
            <input className="field" name="username" required />
          </label>
          <label>
            Email
            <input className="field" name="email" type="email" required />
          </label>
          <label>
            Display name
            <input className="field" name="displayName" />
          </label>
          <label>
            Password
            <input className="field" name="password" type="password" required />
          </label>
          <label>
            Initial group
            <select name="groupId" defaultValue="">
              <option value="">No group</option>
              {groupRows.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">Create user</button>
        </ActionForm>
      </section>
      <div className="data-panel admin-table admin-grid-users">
        <div className="admin-grid-header admin-users-grid admin-grid-users">
          <div>User</div>
          <div>Email</div>
          <div>Role</div>
          <div>Status</div>
          <div>Last login</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>
        {rows.map((user) => (
          <article className="admin-grid-row admin-users-grid admin-grid-users" key={user.id}>
            <div className="user-cell" data-label="User">
              <span className="avatar" aria-hidden="true">
                {user.displayName.slice(0, 2).toUpperCase()}
              </span>
              <strong>{user.username}</strong>
            </div>
            <div className="mono muted" data-label="Email">
              {user.email}
            </div>
            <div data-label="Role">
              <span className="role-badge">{roleMap.get(user.id)?.join(", ") ?? "-"}</span>
            </div>
            <div data-label="Status">
              <span className={`status-badge ${user.status}`}>{user.status}</span>
            </div>
            <div className="mono muted" data-label="Last login">
              {user.lastLoginAt?.toLocaleString() ?? "Never"}
            </div>
            <div className="admin-action-list" data-label="Actions">
              <ActionForm action={updateUserStatusAction} className="inline-form">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  type="hidden"
                  name="status"
                  value={user.status === "active" ? "suspended" : "active"}
                />
                <button
                  className="icon-button"
                  title={user.status === "active" ? "Suspend" : "Activate"}
                >
                  {user.status === "active" ? (
                    <Pause size={15} aria-hidden="true" />
                  ) : (
                    <Play size={15} aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {user.status === "active" ? "Suspend" : "Activate"}
                  </span>
                </button>
              </ActionForm>
              <ActionForm action={resetUserSessionsAction} className="inline-form">
                <input type="hidden" name="userId" value={user.id} />
                <button className="icon-button" title="Reset sessions">
                  <RotateCcw size={15} aria-hidden="true" />
                  <span className="sr-only">Reset sessions</span>
                </button>
              </ActionForm>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
