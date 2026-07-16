import { updateSettingsAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";

export default async function AdminSettingsPage() {
  const site = await getPrimarySiteWithSettings();
  const settings = site!.settings!;
  return (
    <section className="admin-page compact">
      <h1>Site settings</h1>
      <ActionForm action={updateSettingsAction} className="settings-grid">
        <section className="settings-card">
          <div className="settings-kicker">Identity</div>
          <label>
            Site name
            <input className="field" value={site!.site.name} readOnly />
          </label>
          <label>
            Tagline
            <input className="field" name="tagline" defaultValue={settings.tagline} />
          </label>
          <label>
            Base URL
            <input className="field mono" name="baseUrl" defaultValue={settings.baseUrl} />
          </label>
          <label>
            Homepage title
            <input className="field" name="homepageTitle" defaultValue={settings.homepageTitle} />
          </label>
          <label>
            Homepage intro
            <textarea name="homepageIntro" defaultValue={settings.homepageIntro} />
          </label>
        </section>
        <section className="settings-card">
          <div className="settings-kicker">Access &amp; appearance</div>
          <div className="switch-row">
            <div>
              <div style={{ fontSize: "14px", fontWeight: 500 }}>Allow anonymous reading</div>
              <div className="muted" style={{ fontSize: "12px" }}>
                Visitors can read without an account.
              </div>
            </div>
            <label>
              <input type="checkbox" name="publicMode" defaultChecked={settings.publicMode} />
              Public wiki
            </label>
          </div>
          <label>
            Registration mode
            <select name="registrationMode" defaultValue={settings.registrationMode}>
              <option value="open">Open</option>
              <option value="email_verification">Email verification required</option>
              <option value="invite">Invite or administrator-created</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label>
            Footer
            <textarea name="footerContent" defaultValue={settings.footerContent} />
          </label>
        </section>
        <section className="settings-card">
          <div className="settings-kicker">Upload policy</div>
          <label>
            Upload max bytes
            <input
              className="field"
              name="uploadMaxBytes"
              type="number"
              defaultValue={settings.uploadMaxBytes}
            />
          </label>
        </section>
        <div className="settings-actions">
          <button className="primary">Save changes</button>
        </div>
      </ActionForm>
    </section>
  );
}
