import { Plus, Save, Users } from "lucide-react";
import { requireAuthenticatedPermission } from "@/app/access";
import { createGroupAction, updateGroupAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { groupDescription, groupDisplayName, roleDisplayName } from "@/i18n/authorization";
import { getRequestI18n } from "@/i18n/server";
import { getGroupSummaries, getRoleSummaries } from "@/modules/authorization/permissions";

export default async function AdminGroupsPage() {
  const site = await getPrimarySiteWithSettings();
  await requireAuthenticatedPermission(site!.site.id, "group.read");
  await requireAuthenticatedPermission(site!.site.id, "role.read");
  const rows = await getGroupSummaries(site!.site.id);
  const roleRows = await getRoleSummaries(site!.site.id);
  const { messages } = await getRequestI18n(site!.settings?.defaultLocale);
  return (
    <section className="admin-page">
      <div className="page-header">
        <h1 className="page-title admin-title">{messages.groups}</h1>
      </div>
      <section className="panel admin-create-panel" id="create-group">
        <h2>{messages.createGroup}</h2>
        <ActionForm
          action={createGroupAction}
          className="admin-form-grid"
          pendingLabel={messages.working}
        >
          <label>
            {messages.name}
            <input className="field" name="name" required />
          </label>
          <label>
            {messages.description}
            <input className="field" name="description" />
          </label>
          <label>
            {messages.initialRole}
            <select name="roleId" defaultValue="">
              <option value="">{messages.noRole}</option>
              {roleRows.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleDisplayName(role, messages)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">
            <Plus size={15} aria-hidden="true" />
            {messages.createGroup}
          </button>
        </ActionForm>
      </section>
      <div className="group-card-grid">
        {rows.map((group) => (
          <article className="group-card" key={group.id}>
            <div className="group-card-title">
              <span className="group-card-icon">
                <Users size={17} aria-hidden="true" />
              </span>
              <div>
                <div className="group-card-name">{groupDisplayName(group, messages)}</div>
                <div className="muted group-card-kind">
                  {group.builtIn ? messages.builtInGroup : messages.customGroup}
                </div>
              </div>
            </div>
            <p className="muted group-card-description">{groupDescription(group, messages)}</p>
            <div className="group-role-badges">
              <span className={`badge ${group.builtIn ? "warning" : "info"}`}>
                {group.builtIn ? messages.protected : messages.editable}
              </span>
              {group.roleIds.length > 0 ? (
                group.roleIds.map((roleId, index) => (
                  <span className="badge success" key={`${group.id}-${roleId}`}>
                    {roleDisplayName(
                      {
                        name: group.roleNames[index] ?? roleId,
                        normalizedName: group.roleNormalizedNames[index] ?? null
                      },
                      messages
                    )}
                  </span>
                ))
              ) : (
                <span className="badge">{messages.noAssignedRoles}</span>
              )}
            </div>
            <ActionForm
              action={updateGroupAction}
              className="group-edit-form"
              pendingLabel={messages.working}
            >
              <input type="hidden" name="groupId" value={group.id} />
              <label>
                {messages.name}
                <input
                  className="field"
                  name="name"
                  defaultValue={group.name}
                  readOnly={group.builtIn}
                  required
                />
              </label>
              <label>
                {messages.description}
                <input className="field" name="description" defaultValue={group.description} />
              </label>
              <fieldset>
                <legend>{messages.assignedRoles}</legend>
                <div className="group-role-checkboxes">
                  {roleRows.map((role) => (
                    <label className="checkbox-row permission-checkbox" key={role.id}>
                      <input
                        type="checkbox"
                        name="roleId"
                        value={role.id}
                        defaultChecked={group.roleIds.includes(role.id)}
                      />
                      <span>{roleDisplayName(role, messages)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="primary">
                <Save size={15} aria-hidden="true" />
                {messages.saveChanges}
              </button>
            </ActionForm>
          </article>
        ))}
      </div>
    </section>
  );
}
