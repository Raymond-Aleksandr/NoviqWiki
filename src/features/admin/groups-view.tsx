import { Users } from "lucide-react";
import { createGroupAction, updateGroupAction } from "@/app/actions";
import { EmptyState } from "@/components/ui/empty-state";
import type { Messages } from "@/i18n";
import { AdminCheckboxList } from "./checkbox-list";
import { AdminRecordForm } from "./record-form";
import { AdminCreatePanel, AdminPage, type AdminOption } from "./structures";

type GroupMessages = Pick<Messages,
  | "groups" | "createGroup" | "name" | "description" | "initialRole" | "noRole" | "working"
  | "builtInGroup" | "customGroup" | "protected" | "editable" | "noAssignedRoles"
  | "assignedRoles" | "saveChanges" | "noResults"
>;

export type AdminGroupRow = {
  id: string;
  name: string;
  description: string;
  displayName: string;
  displayDescription: string;
  builtIn: boolean;
  roles: AdminOption[];
};

export function AdminGroupsView({ rows, roles, messages }: {
  rows: AdminGroupRow[];
  roles: AdminOption[];
  messages: GroupMessages;
}) {
  return (
    <AdminPage title={messages.groups}>
      <AdminCreatePanel title={messages.createGroup} id="create-group">
        <AdminRecordForm action={createGroupAction} className="admin-form-grid" nameLabel={messages.name} descriptionLabel={messages.description} submitLabel={messages.createGroup} pendingLabel={messages.working}>
          <label>
            {messages.initialRole}
            <select name="roleId" defaultValue="">
              <option value="">{messages.noRole}</option>
              {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
        </AdminRecordForm>
      </AdminCreatePanel>
      {rows.length === 0 ? <EmptyState title={messages.noResults} /> : (
        <div className="group-card-grid">
          {rows.map((group) => (
            <article className="group-card" key={group.id}>
              <div className="group-card-title">
                <span className="group-card-icon"><Users size={17} aria-hidden="true" /></span>
                <div>
                  <h2 className="group-card-name">{group.displayName}</h2>
                  <div className="muted group-card-kind">{group.builtIn ? messages.builtInGroup : messages.customGroup}</div>
                </div>
              </div>
              <p className="muted group-card-description">{group.displayDescription}</p>
              <div className="group-role-badges">
                <span className={`badge ${group.builtIn ? "warning" : "info"}`}>{group.builtIn ? messages.protected : messages.editable}</span>
                {group.roles.length ? group.roles.map((role) => <span className="badge success" key={role.value}>{role.label}</span>) : <span className="badge">{messages.noAssignedRoles}</span>}
              </div>
              <AdminRecordForm
                action={updateGroupAction}
                className="group-edit-form"
                record={{ field: "groupId", id: group.id, name: group.name, description: group.description, nameReadOnly: group.builtIn }}
                nameLabel={messages.name}
                descriptionLabel={messages.description}
                submitLabel={messages.saveChanges}
                pendingLabel={messages.working}
              >
                <AdminCheckboxList legend={messages.assignedRoles} name="roleId" options={roles} selected={group.roles.map((role) => role.value)} className="group-role-checkboxes" />
              </AdminRecordForm>
            </article>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
