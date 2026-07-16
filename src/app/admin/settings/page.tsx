import { updateSettingsAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";

export default async function AdminSettingsPage() {
  const site = await getPrimarySiteWithSettings();
  const settings = site!.settings!;
  return (
    <section className="panel">
      <h1>Site settings</h1>
      <ActionForm action={updateSettingsAction}>
        <label>
          Tagline
          <input className="field" name="tagline" defaultValue={settings.tagline} />
        </label>
        <label>
          Base URL
          <input className="field" name="baseUrl" defaultValue={settings.baseUrl} />
        </label>
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
          <span>
            <input type="checkbox" name="publicMode" defaultChecked={settings.publicMode} /> Public
            wiki
          </span>
        </label>
        <label>
          Homepage title
          <input className="field" name="homepageTitle" defaultValue={settings.homepageTitle} />
        </label>
        <label>
          Homepage intro
          <textarea name="homepageIntro" defaultValue={settings.homepageIntro} />
        </label>
        <label>
          Footer
          <textarea name="footerContent" defaultValue={settings.footerContent} />
        </label>
        <label>
          Upload max bytes
          <input
            className="field"
            name="uploadMaxBytes"
            type="number"
            defaultValue={settings.uploadMaxBytes}
          />
        </label>
        <button className="primary">Save settings</button>
      </ActionForm>
    </section>
  );
}
