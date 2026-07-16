import { eq } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { createGroupAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db/client";
import { groups, roles } from "@/db/schema";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";

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
  const { messages } = await getRequestI18n(site!.settings?.defaultLocale);
  return (
    <section className="admin-page">
      <div className="page-header">
        <h1 className="page-title admin-title">{messages.groups}</h1>
        <a className="button primary" href="#create-group">
          <Plus size={15} aria-hidden="true" />
          {messages.newGroup}
        </a>
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
                  {role.name}
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
                <div style={{ fontSize: "15px", fontWeight: 600 }}>{group.name}</div>
                <div className="muted" style={{ fontSize: "12px" }}>
                  {group.builtIn ? messages.builtInGroup : messages.customGroup}
                </div>
              </div>
            </div>
            <p className="muted" style={{ margin: "0 0 14px" }}>
              {group.description || messages.noDescriptionProvided}
            </p>
            <span className={`badge ${group.builtIn ? "warning" : "info"}`}>
              {group.builtIn ? messages.protected : messages.editable}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
