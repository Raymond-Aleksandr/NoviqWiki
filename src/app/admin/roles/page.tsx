import type { CSSProperties } from "react";
import { Check, Plus } from "lucide-react";
import { createRoleAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRoleSummaries, permissionKeys } from "@/modules/authorization/permissions";

export default async function AdminRolesPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await getRoleSummaries(site!.site.id);
  const matrixStyle = { "--role-count": rows.length } as CSSProperties;
  return (
    <section className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title admin-title">Roles &amp; permissions</h1>
          <p className="page-description">
            Each role grants a set of capabilities across the wiki.
          </p>
        </div>
        <a className="button primary" href="#create-role">
          <Plus size={15} aria-hidden="true" />
          New role
        </a>
      </div>
      <section className="panel admin-create-panel" id="create-role">
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
          <button className="primary">
            <Plus size={15} aria-hidden="true" />
            Create role
          </button>
        </ActionForm>
      </section>
      <div className="data-panel permission-panel">
        <div className="permission-matrix" style={matrixStyle}>
          <div className="permission-row header">
            <div>Capability</div>
            {rows.map((role) => (
              <div className="permission-cell-center" key={role.id}>
                {role.name}
              </div>
            ))}
          </div>
          {permissionKeys.map((permission) => (
            <div className="permission-row" key={permission}>
              <div className="mono">{permission}</div>
              {rows.map((role) => {
                const allowed = role.permissions.includes(permission);
                return (
                  <div
                    className={`permission-cell-center ${allowed ? "allowed" : ""}`}
                    key={`${role.id}-${permission}`}
                  >
                    {allowed ? <Check size={16} aria-label="Allowed" /> : "–"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
