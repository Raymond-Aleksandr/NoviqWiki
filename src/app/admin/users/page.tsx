import { eq } from "drizzle-orm";
import { createUserAction, resetUserSessionsAction, updateUserStatusAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db/client";
import { groups } from "@/db/schema";
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
  return (
    <section>
      <h1>Users</h1>
      <section className="panel">
        <h2>Create account</h2>
        <ActionForm action={createUserAction}>
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
      <table className="table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Status</th>
            <th>Display name</th>
            <th>Last login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td>{user.status}</td>
              <td>{user.displayName}</td>
              <td>{user.lastLoginAt?.toLocaleString() ?? "Never"}</td>
              <td>
                <ActionForm action={updateUserStatusAction} className="inline-form">
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={user.status === "active" ? "suspended" : "active"}
                  />
                  <button>{user.status === "active" ? "Suspend" : "Activate"}</button>
                </ActionForm>
                <ActionForm action={resetUserSessionsAction} className="inline-form">
                  <input type="hidden" name="userId" value={user.id} />
                  <button>Reset sessions</button>
                </ActionForm>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
