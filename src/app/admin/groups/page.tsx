import { eq } from "drizzle-orm";
import { createGroupAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db/client";
import { groups, roles } from "@/db/schema";
import { getPrimarySiteWithSettings } from "@/db/site";

export default async function AdminGroupsPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.siteId, site!.site.id))
    .orderBy(groups.name);
  const roleRows = await db
    .select()
    .from(roles)
    .where(eq(roles.siteId, site!.site.id))
    .orderBy(roles.name);
  return (
    <section>
      <h1>Groups</h1>
      <section className="panel">
        <h2>Create group</h2>
        <ActionForm action={createGroupAction}>
          <label>
            Name
            <input className="field" name="name" required />
          </label>
          <label>
            Description
            <input className="field" name="description" />
          </label>
          <label>
            Initial role
            <select name="roleId" defaultValue="">
              <option value="">No role</option>
              {roleRows.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">Create group</button>
        </ActionForm>
      </section>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Built in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((group) => (
            <tr key={group.id}>
              <td>{group.name}</td>
              <td>{group.description}</td>
              <td>{group.builtIn ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
