import { Pause, Play, UsersRound } from "lucide-react";
import { createUserAction, resetUserSessionsAction, updateUserGroupsAction, updateUserStatusAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import type { Messages } from "@/i18n";
import { AdminCreatePanel, AdminFilters, AdminPage, AdminTable, type AdminOption } from "./structures";
import { AdminSubmitButton } from "./submit-button";

type UserMessages = Pick<Messages,
  | "users" | "user" | "createAccount" | "username" | "email" | "displayName" | "password"
  | "initialGroup" | "noGroup" | "createUser" | "working" | "filterUsers" | "search"
  | "clearFilters" | "groups" | "role" | "status" | "lastLogin" | "actions" | "noResults"
  | "saveChanges" | "suspend" | "activate" | "resetSessions" | "resetSessionsConfirmBody"
  | "resetSessionsConfirmWarning" | "cancel" | "userStatusActive" | "userStatusSuspended"
  | "userStatusPending" | "never"
>;

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: "active" | "suspended" | "pending";
  groups: AdminOption[];
  roles: string[];
  lastLogin: { dateTime: string; label: string } | null;
};

export function AdminUsersView({ rows, groups, query, messages }: {
  rows: AdminUserRow[];
  groups: AdminOption[];
  query: string;
  messages: UserMessages;
}) {
  return (
    <AdminPage title={messages.users}>
      <AdminCreatePanel title={messages.createAccount}>
        <ActionForm action={createUserAction} className="admin-form-grid" pendingLabel={messages.working}>
          <label>{messages.username}<input className="field" name="username" autoComplete="off" required /></label>
          <label>{messages.email}<input className="field" name="email" type="email" autoComplete="off" required /></label>
          <label>{messages.displayName}<input className="field" name="displayName" autoComplete="off" /></label>
          <label>{messages.password}<input className="field" name="password" type="password" autoComplete="new-password" required /></label>
          <label>
            {messages.initialGroup}
            <select name="groupId" defaultValue="">
              <option value="">{messages.noGroup}</option>
              {groups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
            </select>
          </label>
          <AdminSubmitButton label={messages.createUser} pendingLabel={messages.working} create />
        </ActionForm>
      </AdminCreatePanel>
      <AdminTable
        title={messages.users}
        gridClassName="admin-users-grid admin-grid-users"
        columns={[messages.user, messages.email, messages.groups, messages.role, messages.status, messages.lastLogin, messages.actions]}
        empty={rows.length === 0}
        emptyLabel={messages.noResults}
        filters={<AdminFilters action="/admin/users" query={query} queryLabel={messages.filterUsers} searchLabel={messages.search} clearLabel={messages.clearFilters} />}
      >
        {rows.map((user) => (
          <article className="admin-grid-row admin-users-grid admin-grid-users" key={user.id} role="row">
            <div className="user-cell" data-label={messages.user} role="cell">
              <span className="avatar" aria-hidden="true">{user.displayName.slice(0, 2).toUpperCase()}</span>
              <strong>{user.username}</strong>
            </div>
            <div className="mono muted" data-label={messages.email} role="cell">{user.email}</div>
            <div className="user-group-badges" data-label={messages.groups} role="cell">
              {user.groups.length ? user.groups.map((group) => <span className="badge info" key={group.value}>{group.label}</span>) : <span className="muted">{messages.noGroup}</span>}
            </div>
            <div data-label={messages.role} role="cell"><span className="role-badge">{user.roles.join(", ") || "–"}</span></div>
            <div data-label={messages.status} role="cell">
              <span className={`status-badge ${user.status}`}>{user.status === "active" ? messages.userStatusActive : user.status === "suspended" ? messages.userStatusSuspended : messages.userStatusPending}</span>
            </div>
            <div className="mono muted" data-label={messages.lastLogin} role="cell">
              {user.lastLogin ? <time dateTime={user.lastLogin.dateTime}>{user.lastLogin.label}</time> : messages.never}
            </div>
            <div className="admin-action-list" data-label={messages.actions} role="cell">
              <UserGroupEditor user={user} groups={groups} messages={messages} />
              <ActionForm action={updateUserStatusAction} className="inline-form" pendingLabel={messages.working} statusMode="compact">
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="status" value={user.status === "active" ? "suspended" : "active"} />
                <button className="icon-button" title={user.status === "active" ? messages.suspend : messages.activate}>
                  {user.status === "active" ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                  <span className="sr-only">{user.status === "active" ? messages.suspend : messages.activate} · {user.username}</span>
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
      </AdminTable>
    </AdminPage>
  );
}

function UserGroupEditor({ user, groups, messages }: {
  user: Pick<AdminUserRow, "id" | "username" | "groups">;
  groups: AdminOption[];
  messages: Pick<UserMessages, "groups" | "working" | "saveChanges" | "noGroup">;
}) {
  const selected = new Set(user.groups.map((group) => group.value));
  return (
    <details className="user-group-editor">
      <summary className="button compact">
        <UsersRound size={14} aria-hidden="true" />{messages.groups}
        <span className="sr-only"> · {user.username}</span>
      </summary>
      <ActionForm action={updateUserGroupsAction} className="user-group-form" pendingLabel={messages.working} statusMode="compact">
        <input type="hidden" name="userId" value={user.id} />
        <fieldset>
          <legend>{messages.groups} · {user.username}</legend>
          <div className="user-group-checkboxes">
            {groups.length ? groups.map((group) => (
              <label className="checkbox-row" key={group.value}>
                <input type="checkbox" name="groupId" value={group.value} defaultChecked={selected.has(group.value)} />
                <span>{group.label}</span>
              </label>
            )) : <p className="muted">{messages.noGroup}</p>}
          </div>
        </fieldset>
        <AdminSubmitButton label={messages.saveChanges} pendingLabel={messages.working} compact />
      </ActionForm>
    </details>
  );
}
