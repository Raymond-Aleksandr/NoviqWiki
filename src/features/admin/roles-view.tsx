import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { createRoleAction, updateRoleAction } from "@/app/actions";
import { EmptyState } from "@/components/ui/empty-state";
import type { Messages } from "@/i18n";
import { AdminCheckboxList } from "./checkbox-list";
import { AdminRecordForm } from "./record-form";
import { AdminCreatePanel, AdminPage, AdminPanel, type AdminOption } from "./structures";

type RoleMessages = Pick<Messages,
  | "rolesAndPermissions" | "rolesDescription" | "createRole" | "working" | "name"
  | "description" | "permissions" | "protected" | "editable" | "saveChanges"
  | "capability" | "allowed" | "noResults"
>;

export type AdminRoleRow = {
  id: string;
  name: string;
  description: string;
  displayName: string;
  displayDescription: string;
  builtIn: boolean;
  permissions: string[];
};

export function AdminRolesView({ rows, permissions, messages }: {
  rows: AdminRoleRow[];
  permissions: AdminOption[];
  messages: RoleMessages;
}) {
  return (
    <AdminPage title={messages.rolesAndPermissions} description={messages.rolesDescription}>
      <AdminCreatePanel title={messages.createRole} id="create-role">
        <AdminRecordForm action={createRoleAction} className="form" nameLabel={messages.name} descriptionLabel={messages.description} submitLabel={messages.createRole} pendingLabel={messages.working}>
          <AdminCheckboxList legend={messages.permissions} name="permission" options={permissions} className="role-permission-checkboxes" code />
        </AdminRecordForm>
      </AdminCreatePanel>
      {rows.length === 0 ? <EmptyState title={messages.noResults} /> : (
        <>
          <div className="role-card-grid">
            {rows.map((role) => (
              <article className="role-card" key={role.id}>
                <div className="role-card-header">
                  <div><h2>{role.displayName}</h2><p className="muted">{role.displayDescription}</p></div>
                  <span className={`badge ${role.builtIn ? "warning" : "info"}`}>{role.builtIn ? messages.protected : messages.editable}</span>
                </div>
                {role.builtIn ? (
                  <div className="role-permission-summary">
                    {role.permissions.map((permission) => <span className="badge success mono" key={permission}>{permission}</span>)}
                  </div>
                ) : (
                  <AdminRecordForm
                    action={updateRoleAction}
                    className="role-edit-form"
                    record={{ field: "roleId", id: role.id, name: role.name, description: role.description }}
                    nameLabel={messages.name}
                    descriptionLabel={messages.description}
                    submitLabel={messages.saveChanges}
                    pendingLabel={messages.working}
                  >
                    <AdminCheckboxList legend={messages.permissions} name="permission" options={permissions} selected={role.permissions} className="role-permission-checkboxes" code />
                  </AdminRecordForm>
                )}
              </article>
            ))}
          </div>
          <PermissionMatrix rows={rows} permissions={permissions} messages={messages} />
        </>
      )}
    </AdminPage>
  );
}

function PermissionMatrix({ rows, permissions, messages }: {
  rows: Pick<AdminRoleRow, "id" | "displayName" | "permissions">[];
  permissions: AdminOption[];
  messages: Pick<RoleMessages, "permissions" | "capability" | "allowed">;
}) {
  return (
    <AdminPanel title={messages.permissions} className="permission-panel">
      <div className="permission-matrix-scroll" role="region" aria-label={messages.permissions} tabIndex={0}>
        <div className="permission-matrix" role="table" aria-label={messages.permissions} style={{ "--role-count": rows.length } as CSSProperties}>
          <div className="permission-row header" role="row">
            <div role="columnheader">{messages.capability}</div>
            {rows.map((role) => <div className="permission-cell-center" key={role.id} role="columnheader">{role.displayName}</div>)}
          </div>
          {permissions.map((permission) => (
            <div className="permission-row" key={permission.value} role="row">
              <div className="mono" role="rowheader">{permission.label}</div>
              {rows.map((role) => {
                const allowed = role.permissions.includes(permission.value);
                return (
                  <div className={`permission-cell-center ${allowed ? "allowed" : ""}`} key={role.id} role="cell" aria-label={allowed ? messages.allowed : undefined}>
                    {allowed ? <Check size={16} aria-hidden="true" /> : "–"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </AdminPanel>
  );
}
