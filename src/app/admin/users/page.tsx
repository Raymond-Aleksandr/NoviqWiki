import { Pause, Play, Plus, Save, UsersRound } from "lucide-react";
import {
  createUserAction,
  resetUserSessionsAction,
  updateUserGroupsAction,
  updateUserStatusAction
} from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getGroupSummaries, getUserGroupMemberships } from "@/modules/authorization/permissions";
import { listUsers } from "@/modules/users/service";

export default async function AdminUsersPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await listUsers({ limit: 200 });
  const groupRows = await getGroupSummaries(site!.site.id);
  const memberships = await getUserGroupMemberships(
    site!.site.id,
    rows.map((user) => user.id)
  );
  const roleMap = new Map<string, Set<string>>();
  const groupMap = new Map<string, { id: string; name: string }[]>();
  const groupSeenMap = new Map<string, Set<string>>();
  for (const row of memberships) {
    const seenGroups = groupSeenMap.get(row.userId) ?? new Set<string>();
    if (!seenGroups.has(row.groupId)) {
      groupMap.set(row.userId, [
        ...(groupMap.get(row.userId) ?? []),
        { id: row.groupId, name: row.groupName }
      ]);
      seenGroups.add(row.groupId);
      groupSeenMap.set(row.userId, seenGroups);
    }
    if (row.roleName) {
      const roles = roleMap.get(row.userId) ?? new Set<string>();
      roles.add(row.roleName);
      roleMap.set(row.userId, roles);
    }
  }
  const { locale, messages } = await getRequestI18n(site!.settings?.defaultLocale);
  return (
    <section className="admin-page">
      <h1>{messages.users}</h1>
      <section className="panel admin-create-panel">
        <h2>{messages.createAccount}</h2>
        <ActionForm
          action={createUserAction}
          className="admin-form-grid"
          pendingLabel={messages.working}
        >
          <label>
            {messages.username}
            <input className="field" name="username" required />
          </label>
          <label>
            {messages.email}
            <input className="field" name="email" type="email" required />
          </label>
          <label>
            {messages.displayName}
            <input className="field" name="displayName" />
          </label>
          <label>
            {messages.password}
            <input className="field" name="password" type="password" required />
          </label>
          <label>
            {messages.initialGroup}
            <select name="groupId" defaultValue="">
              <option value="">{messages.noGroup}</option>
              {groupRows.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">
            <Plus size={15} aria-hidden="true" />
            {messages.createUser}
          </button>
        </ActionForm>
      </section>
      <div className="data-panel admin-table admin-grid-users">
        <div className="admin-grid-header admin-users-grid admin-grid-users">
          <div>{messages.user}</div>
          <div>{messages.email}</div>
          <div>{messages.groups}</div>
          <div>{messages.role}</div>
          <div>{messages.status}</div>
          <div>{messages.lastLogin}</div>
          <div style={{ textAlign: "right" }}>{messages.actions}</div>
        </div>
        {rows.map((user) => (
          <article className="admin-grid-row admin-users-grid admin-grid-users" key={user.id}>
            <div className="user-cell" data-label={messages.user}>
              <span className="avatar" aria-hidden="true">
                {user.displayName.slice(0, 2).toUpperCase()}
              </span>
              <strong>{user.username}</strong>
            </div>
            <div className="mono muted" data-label={messages.email}>
              {user.email}
            </div>
            <div className="user-group-badges" data-label={messages.groups}>
              {(groupMap.get(user.id) ?? []).length > 0 ? (
                groupMap.get(user.id)?.map((group) => (
                  <span className="badge info" key={group.id}>
                    {group.name}
                  </span>
                ))
              ) : (
                <span className="muted">{messages.noGroup}</span>
              )}
            </div>
            <div data-label={messages.role}>
              <span className="role-badge">
                {[...(roleMap.get(user.id) ?? new Set<string>())].join(", ") || "-"}
              </span>
            </div>
            <div data-label={messages.status}>
              <span className={`status-badge ${user.status}`}>
                {userStatusLabel(user.status, messages)}
              </span>
            </div>
            <div className="mono muted" data-label={messages.lastLogin}>
              {user.lastLoginAt?.toLocaleString(locale) ?? messages.never}
            </div>
            <div className="admin-action-list" data-label={messages.actions}>
              <details className="user-group-editor">
                <summary className="button compact">
                  <UsersRound size={14} aria-hidden="true" />
                  {messages.groups}
                </summary>
                <ActionForm
                  action={updateUserGroupsAction}
                  className="user-group-form"
                  pendingLabel={messages.working}
                  statusMode="compact"
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <fieldset>
                    <legend>{messages.groups}</legend>
                    <div className="user-group-checkboxes">
                      {groupRows.map((group) => {
                        const userGroupIds = new Set(
                          (groupMap.get(user.id) ?? []).map((membership) => membership.id)
                        );
                        return (
                          <label className="checkbox-row" key={`${user.id}-${group.id}`}>
                            <input
                              type="checkbox"
                              name="groupId"
                              value={group.id}
                              defaultChecked={userGroupIds.has(group.id)}
                            />
                            <span>{group.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <button className="button compact primary">
                    <Save size={14} aria-hidden="true" />
                    {messages.saveChanges}
                  </button>
                </ActionForm>
              </details>
              <ActionForm
                action={updateUserStatusAction}
                className="inline-form"
                pendingLabel={messages.working}
                statusMode="compact"
              >
                <input type="hidden" name="userId" value={user.id} />
                <input
                  type="hidden"
                  name="status"
                  value={user.status === "active" ? "suspended" : "active"}
                />
                <button
                  className="icon-button"
                  title={user.status === "active" ? messages.suspend : messages.activate}
                >
                  {user.status === "active" ? (
                    <Pause size={15} aria-hidden="true" />
                  ) : (
                    <Play size={15} aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {user.status === "active" ? messages.suspend : messages.activate} ·{" "}
                    {user.username}
                  </span>
                </button>
              </ActionForm>
              <ConfirmActionForm
                action={resetUserSessionsAction}
                hiddenFields={[{ name: "userId", value: user.id }]}
                triggerLabel={`${messages.resetSessions} · ${user.username}`}
                triggerTitle={messages.resetSessions}
                triggerIconOnly
                triggerClassName="icon-button"
                icon="reset"
                title={`${messages.resetSessions} · ${user.username}`}
                body={messages.resetSessionsConfirmBody}
                warning={messages.resetSessionsConfirmWarning}
                confirmLabel={messages.resetSessions}
                cancelLabel={messages.cancel}
                pendingLabel={messages.working}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function userStatusLabel(
  status: string,
  messages: Awaited<ReturnType<typeof getRequestI18n>>["messages"]
) {
  if (status === "active") return messages.userStatusActive;
  if (status === "suspended") return messages.userStatusSuspended;
  if (status === "pending") return messages.userStatusPending;
  return status;
}
