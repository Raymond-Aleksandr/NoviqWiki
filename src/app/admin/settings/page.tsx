import { updateSettingsAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";

export default async function AdminSettingsPage() {
  const site = await getPrimarySiteWithSettings();
  const settings = site!.settings!;
  const { messages } = await getRequestI18n(settings.defaultLocale);
  return (
    <section className="admin-page compact">
      <h1>{messages.siteSettings}</h1>
      <ActionForm
        action={updateSettingsAction}
        className="settings-grid"
        pendingLabel={messages.working}
      >
        <section className="settings-card">
          <div className="settings-kicker">{messages.identity}</div>
          <label>
            {messages.siteName}
            <input className="field" value={site!.site.name} readOnly />
          </label>
          <label>
            {messages.tagline}
            <input className="field" name="tagline" defaultValue={settings.tagline} />
          </label>
          <label>
            {messages.baseUrl}
            <input className="field mono" name="baseUrl" defaultValue={settings.baseUrl} />
          </label>
          <label>
            {messages.defaultLocale}
            <select name="defaultLocale" defaultValue={settings.defaultLocale}>
              <option value="zh-CN">{messages.simplifiedChinese}</option>
              <option value="en">{messages.english}</option>
            </select>
          </label>
          <label>
            {messages.homepageTitle}
            <input className="field" name="homepageTitle" defaultValue={settings.homepageTitle} />
          </label>
          <label>
            {messages.homepageIntro}
            <textarea name="homepageIntro" defaultValue={settings.homepageIntro} />
          </label>
        </section>
        <section className="settings-card">
          <div className="settings-kicker">{messages.accessAndAppearance}</div>
          <div className="switch-row">
            <div>
              <div style={{ fontSize: "14px", fontWeight: 500 }}>
                {messages.allowAnonymousReading}
              </div>
              <div className="muted" style={{ fontSize: "12px" }}>
                {messages.anonymousReadingHelp}
              </div>
            </div>
            <label>
              <input type="checkbox" name="publicMode" defaultChecked={settings.publicMode} />
              {messages.publicWiki}
            </label>
          </div>
          <label>
            {messages.registrationMode}
            <select name="registrationMode" defaultValue={settings.registrationMode}>
              <option value="open">{messages.registrationOpen}</option>
              <option value="email_verification">{messages.registrationEmailVerification}</option>
              <option value="invite">{messages.registrationInvite}</option>
              <option value="closed">{messages.registrationClosed}</option>
            </select>
          </label>
          <label>
            {messages.footer}
            <textarea name="footerContent" defaultValue={settings.footerContent} />
          </label>
        </section>
        <section className="settings-card">
          <div className="settings-kicker">{messages.uploadPolicy}</div>
          <label>
            {messages.uploadMaxBytes}
            <input
              className="field"
              name="uploadMaxBytes"
              type="number"
              defaultValue={settings.uploadMaxBytes}
            />
          </label>
        </section>
        <div className="settings-actions">
          <button className="primary">{messages.saveChanges}</button>
        </div>
      </ActionForm>
    </section>
  );
}
