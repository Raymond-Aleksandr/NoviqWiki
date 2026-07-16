import { createRoleAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRoleSummaries, permissionKeys } from "@/modules/authorization/permissions";

export default async function AdminRolesPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await getRoleSummaries(site!.site.id);
  return (
    <section>
      <h1>Roles</h1>
      <section className="panel">
        <h2>Create role</h2>
        <ActionForm action={createRoleAction}>
          <label>
            Name
            <input className="field" name="name" required />
          </label>
          <label>
            Description
            <input className="field" name="description" />
          </label>
          <fieldset>
            <legend>Permissions</legend>
            <div className="grid">
              {permissionKeys.map((permission) => (
                <label key={permission}>
                  <span>
                    <input type="checkbox" name="permission" value={permission} /> {permission}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="primary">Create role</button>
        </ActionForm>
      </section>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Built in</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((role) => (
            <tr key={role.id}>
              <td>{role.name}</td>
              <td>{role.builtIn ? "Yes" : "No"}</td>
              <td>{role.permissions.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
