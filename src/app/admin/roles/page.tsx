import type { CSSProperties } from "react";
import { Check, Plus, Save } from "lucide-react";
import { createRoleAction, updateRoleAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getRoleSummaries, permissionKeys } from "@/modules/authorization/permissions";

export default async function AdminRolesPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await getRoleSummaries(site!.site.id);
  const matrixStyle = { "--role-count": rows.length } as CSSProperties;
  const { messages } = await getRequestI18n(site!.settings?.defaultLocale);
  return (
    <section className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title admin-title">{messages.rolesAndPermissions}</h1>
          <p className="page-description">{messages.rolesDescription}</p>
        </div>
      </div>
      <section className="panel admin-create-panel" id="create-role">
        <h2>{messages.createRole}</h2>
        <ActionForm action={createRoleAction} pendingLabel={messages.working}>
          <label>
            {messages.name}
            <input className="field" name="name" required />
          </label>
          <label>
            {messages.description}
            <input className="field" name="description" />
          </label>
          <fieldset>
            <legend>{messages.permissions}</legend>
            <div className="grid">
              {permissionKeys.map((permission) => (
                <label className="checkbox-row permission-checkbox" key={permission}>
                  <input type="checkbox" name="permission" value={permission} />
                  <span className="mono">{permission}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="primary">
            <Plus size={15} aria-hidden="true" />
            {messages.createRole}
          </button>
        </ActionForm>
      </section>
      <div className="role-card-grid">
        {rows.map((role) => (
          <article className="role-card" key={role.id}>
            <div className="role-card-header">
              <div>
                <h2>{role.name}</h2>
                <p className="muted">{role.description || messages.noDescriptionProvided}</p>
              </div>
              <span className={`badge ${role.builtIn ? "warning" : "info"}`}>
                {role.builtIn ? messages.protected : messages.editable}
              </span>
            </div>
            {role.builtIn ? (
              <div className="role-permission-summary">
                {role.permissions.map((permission) => (
                  <span className="badge success mono" key={`${role.id}-${permission}`}>
                    {permission}
                  </span>
                ))}
              </div>
            ) : (
              <ActionForm
                action={updateRoleAction}
                className="role-edit-form"
                pendingLabel={messages.working}
              >
                <input type="hidden" name="roleId" value={role.id} />
                <label>
                  {messages.name}
                  <input className="field" name="name" defaultValue={role.name} required />
                </label>
                <label>
                  {messages.description}
                  <input className="field" name="description" defaultValue={role.description} />
                </label>
                <fieldset>
                  <legend>{messages.permissions}</legend>
                  <div className="role-permission-checkboxes">
                    {permissionKeys.map((permission) => (
                      <label className="checkbox-row permission-checkbox" key={permission}>
                        <input
                          type="checkbox"
                          name="permission"
                          value={permission}
                          defaultChecked={role.permissions.includes(permission)}
                        />
                        <span className="mono">{permission}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="primary">
                  <Save size={15} aria-hidden="true" />
                  {messages.saveChanges}
                </button>
              </ActionForm>
            )}
          </article>
        ))}
      </div>
      <div className="data-panel permission-panel">
        <div className="permission-matrix" style={matrixStyle}>
          <div className="permission-row header">
            <div>{messages.capability}</div>
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
                    {allowed ? <Check size={16} aria-label={messages.allowed} /> : "–"}
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
