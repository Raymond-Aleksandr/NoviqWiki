import { Save } from "lucide-react";
import { updateSettingsAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";

export default async function AdminSettingsPage() {
  const site = await getPrimarySiteWithSettings();
  const settings = site!.settings!;
  const homepageSections = {
    search: settings.homepageSections.search ?? true,
    featured: settings.homepageSections.featured ?? true,
    recent: settings.homepageSections.recent ?? true,
    categories: settings.homepageSections.categories ?? true,
    layout: settings.homepageSections.layout ?? "classic",
    showLogo: settings.homepageSections.showLogo ?? Boolean(settings.logoUrl)
  };
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
            {messages.logoUrl}
            <input
              className="field mono"
              name="logoUrl"
              defaultValue={settings.logoUrl ?? ""}
              placeholder="/media/site-logo.png"
            />
          </label>
          <label>
            {messages.faviconUrl}
            <input
              className="field mono"
              name="faviconUrl"
              defaultValue={settings.faviconUrl ?? ""}
              placeholder="/favicon.ico"
            />
          </label>
          <label>
            {messages.defaultLocale}
            <select name="defaultLocale" defaultValue={settings.defaultLocale}>
              <option value="zh-CN">{messages.simplifiedChinese}</option>
              <option value="en">{messages.english}</option>
            </select>
          </label>
        </section>
        <section className="settings-card">
          <div className="settings-kicker">{messages.homepageTitle}</div>
          <label>
            {messages.defaultHomepage}
            <input
              className="field"
              name="defaultHomepage"
              defaultValue={settings.defaultHomepage}
            />
          </label>
          <label>
            {messages.homepageTitle}
            <input className="field" name="homepageTitle" defaultValue={settings.homepageTitle} />
          </label>
          <label>
            {messages.homepageIntro}
            <textarea name="homepageIntro" defaultValue={settings.homepageIntro} />
          </label>
          <label>
            {messages.homepageLayout}
            <select name="homepageLayout" defaultValue={homepageSections.layout}>
              <option value="classic">{messages.homepageClassicLayout}</option>
              <option value="portal">{messages.homepagePortalLayout}</option>
              <option value="compact">{messages.homepageCompactLayout}</option>
            </select>
          </label>
          <div className="homepage-section-toggles" aria-label={messages.homepageVisibleSections}>
            <div className="settings-kicker">{messages.homepageVisibleSections}</div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="homepageShowLogo"
                defaultChecked={homepageSections.showLogo}
              />
              <span>{messages.showHomepageLogo}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="homepageSearch"
                defaultChecked={homepageSections.search}
              />
              <span>{messages.showHomepageSearch}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="homepageFeatured"
                defaultChecked={homepageSections.featured}
              />
              <span>{messages.showHomepageFeatured}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="homepageRecent"
                defaultChecked={homepageSections.recent}
              />
              <span>{messages.showHomepageRecent}</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="homepageCategories"
                defaultChecked={homepageSections.categories}
              />
              <span>{messages.showHomepageCategories}</span>
            </label>
          </div>
          <label>
            {messages.featuredPageSlugs}
            <textarea
              className="mono"
              name="homepageFeaturedPages"
              defaultValue={settings.homepageFeaturedPages.join(", ")}
              placeholder={messages.commaSeparatedSlugs}
            />
          </label>
          <label>
            {messages.featuredCategorySlugs}
            <textarea
              className="mono"
              name="homepageFeaturedCategories"
              defaultValue={settings.homepageFeaturedCategories.join(", ")}
              placeholder={messages.commaSeparatedSlugs}
            />
          </label>
          <label>
            {messages.seoTitle}
            <input className="field" name="seoTitle" defaultValue={settings.seoTitle ?? ""} />
          </label>
          <label>
            {messages.seoDescription}
            <textarea name="seoDescription" defaultValue={settings.seoDescription ?? ""} />
          </label>
        </section>
        <section className="settings-card">
          <div className="settings-kicker">{messages.accessAndAppearance}</div>
          <div className="switch-row">
            <div>
              <div className="settings-switch-title">{messages.allowAnonymousReading}</div>
              <div className="settings-switch-help">{messages.anonymousReadingHelp}</div>
            </div>
            <label className="checkbox-row switch-control">
              <input type="checkbox" name="publicMode" defaultChecked={settings.publicMode} />
              <span>{messages.publicWiki}</span>
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
          <label>
            {messages.allowedMediaTypes}
            <textarea
              className="mono"
              name="allowedMediaTypes"
              defaultValue={settings.allowedMediaTypes.join("\n")}
            />
            <span className="muted">{messages.allowedMediaTypesHelp}</span>
          </label>
        </section>
        <div className="settings-actions">
          <button className="primary">
            <Save size={16} aria-hidden="true" />
            {messages.saveChanges}
          </button>
        </div>
      </ActionForm>
    </section>
  );
}
