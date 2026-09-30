import type { ReactNode } from "react";
import { updateSettingsAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import type { SiteSetting } from "@/db/schema";
import type { Messages } from "@/i18n";
import { SettingsField } from "./settings-field";
import { AdminPage } from "./structures";
import { AdminSubmitButton } from "./submit-button";

type SettingsMessages = Pick<Messages,
  | "siteSettings" | "working" | "identity" | "siteName" | "tagline" | "baseUrl"
  | "logoUrl" | "faviconUrl" | "defaultLocale" | "simplifiedChinese" | "english"
  | "defaultHomepage" | "homepageTitle" | "homepageIntro" | "homepageLayout"
  | "homepageClassicLayout" | "homepagePortalLayout" | "homepageCompactLayout"
  | "homepageVisibleSections" | "showHomepageLogo" | "showHomepageSearch"
  | "showHomepageFeatured" | "showHomepageRecent" | "showHomepageCategories"
  | "featuredPageSlugs" | "featuredCategorySlugs" | "commaSeparatedSlugs"
  | "seoTitle" | "seoDescription" | "accessAndAppearance" | "allowAnonymousReading"
  | "anonymousReadingHelp" | "publicWiki" | "registrationMode" | "registrationOpen"
  | "registrationEmailVerification" | "registrationInvite" | "registrationClosed"
  | "footer" | "uploadPolicy" | "uploadMaxBytes" | "allowedMediaTypes"
  | "allowedMediaTypesHelp" | "saveChanges"
>;

export type AdminSettingsValues = Pick<SiteSetting,
  | "tagline" | "baseUrl" | "logoUrl" | "faviconUrl" | "defaultLocale"
  | "defaultHomepage" | "homepageTitle" | "homepageIntro" | "homepageSections"
  | "homepageFeaturedPages" | "homepageFeaturedCategories" | "seoTitle" | "seoDescription"
  | "publicMode" | "registrationMode" | "footerContent" | "uploadMaxBytes" | "allowedMediaTypes"
>;

export function AdminSettingsView({ siteName, settings, maxUploadBytes, messages }: {
  siteName: string;
  settings: AdminSettingsValues;
  maxUploadBytes: number;
  messages: SettingsMessages;
}) {
  const homepage = {
    layout: settings.homepageSections.layout ?? "classic",
    showLogo: settings.homepageSections.showLogo ?? Boolean(settings.logoUrl),
    search: settings.homepageSections.search ?? true,
    featured: settings.homepageSections.featured ?? true,
    recent: settings.homepageSections.recent ?? true,
    categories: settings.homepageSections.categories ?? true
  };
  const toggles = [
    { name: "homepageShowLogo", label: messages.showHomepageLogo, checked: homepage.showLogo },
    { name: "homepageSearch", label: messages.showHomepageSearch, checked: homepage.search },
    { name: "homepageFeatured", label: messages.showHomepageFeatured, checked: homepage.featured },
    { name: "homepageRecent", label: messages.showHomepageRecent, checked: homepage.recent },
    { name: "homepageCategories", label: messages.showHomepageCategories, checked: homepage.categories }
  ];
  return (
    <AdminPage title={messages.siteSettings} compact>
      <ActionForm action={updateSettingsAction} className="settings-grid" pendingLabel={messages.working}>
        <SettingsSection title={messages.identity}>
          <SettingsField label={messages.siteName} name="siteName" value={siteName} readOnly />
          <SettingsField label={messages.tagline} name="tagline" value={settings.tagline} />
          <SettingsField label={messages.baseUrl} name="baseUrl" value={settings.baseUrl} type="url" />
          <SettingsField label={messages.logoUrl} name="logoUrl" value={settings.logoUrl ?? ""} placeholder="/media/site-logo.png" />
          <SettingsField label={messages.faviconUrl} name="faviconUrl" value={settings.faviconUrl ?? ""} placeholder="/favicon.ico" />
          <SettingsField label={messages.defaultLocale} name="defaultLocale" kind="select" value={settings.defaultLocale} options={[{ value: "zh-CN", label: messages.simplifiedChinese }, { value: "en", label: messages.english }]} />
        </SettingsSection>
        <SettingsSection title={messages.homepageTitle}>
          <SettingsField label={messages.defaultHomepage} name="defaultHomepage" value={settings.defaultHomepage} />
          <SettingsField label={messages.homepageTitle} name="homepageTitle" value={settings.homepageTitle} />
          <SettingsField label={messages.homepageIntro} name="homepageIntro" kind="textarea" value={settings.homepageIntro} />
          <SettingsField label={messages.homepageLayout} name="homepageLayout" kind="select" value={homepage.layout} options={[{ value: "classic", label: messages.homepageClassicLayout }, { value: "portal", label: messages.homepagePortalLayout }, { value: "compact", label: messages.homepageCompactLayout }]} />
          <SettingsField label={messages.seoTitle} name="seoTitle" value={settings.seoTitle ?? ""} />
          <SettingsField label={messages.seoDescription} name="seoDescription" kind="textarea" value={settings.seoDescription ?? ""} />
        </SettingsSection>
        <SettingsSection title={messages.homepageVisibleSections}>
          <fieldset className="homepage-section-toggles">
            <legend className="sr-only">{messages.homepageVisibleSections}</legend>
            {toggles.map((toggle) => (
              <label className="checkbox-row" key={toggle.name}>
                <input type="checkbox" name={toggle.name} defaultChecked={toggle.checked} />
                <span>{toggle.label}</span>
              </label>
            ))}
          </fieldset>
          <SettingsField label={messages.featuredPageSlugs} name="homepageFeaturedPages" kind="textarea" value={settings.homepageFeaturedPages.join(", ")} placeholder={messages.commaSeparatedSlugs} />
          <SettingsField label={messages.featuredCategorySlugs} name="homepageFeaturedCategories" kind="textarea" value={settings.homepageFeaturedCategories.join(", ")} placeholder={messages.commaSeparatedSlugs} />
        </SettingsSection>
        <SettingsSection title={messages.accessAndAppearance}>
          <div className="switch-row">
            <div>
              <div className="settings-switch-title">{messages.allowAnonymousReading}</div>
              <div className="settings-switch-help" id="public-mode-help">{messages.anonymousReadingHelp}</div>
            </div>
            <label className="checkbox-row switch-control">
              <input type="checkbox" name="publicMode" defaultChecked={settings.publicMode} aria-describedby="public-mode-help" />
              <span>{messages.publicWiki}</span>
            </label>
          </div>
          <SettingsField label={messages.registrationMode} name="registrationMode" kind="select" value={settings.registrationMode} options={[{ value: "open", label: messages.registrationOpen }, { value: "email_verification", label: messages.registrationEmailVerification }, { value: "invite", label: messages.registrationInvite }, { value: "closed", label: messages.registrationClosed }]} />
          <SettingsField label={messages.footer} name="footerContent" kind="textarea" value={settings.footerContent} />
        </SettingsSection>
        <SettingsSection title={messages.uploadPolicy}>
          <SettingsField label={messages.uploadMaxBytes} name="uploadMaxBytes" type="number" min={1} max={maxUploadBytes} value={settings.uploadMaxBytes} />
          <SettingsField label={messages.allowedMediaTypes} name="allowedMediaTypes" kind="textarea" value={settings.allowedMediaTypes.join("\n")} help={messages.allowedMediaTypesHelp} />
        </SettingsSection>
        <div className="settings-actions"><AdminSubmitButton label={messages.saveChanges} pendingLabel={messages.working} /></div>
      </ActionForm>
    </AdminPage>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-card"><h2 className="settings-kicker">{title}</h2>{children}</section>;
}
