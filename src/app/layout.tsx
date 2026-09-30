import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, LogIn, LogOut, Rocket, Search, UserRound } from "lucide-react";
import packageJson from "../../package.json";
import "@/styles/globals.css";
import { ResponsiveSiteNav } from "@/components/layout/responsive-site-nav";
import { TopbarSettingsLink } from "@/components/layout/topbar-settings-link";
import { PreferenceControls } from "@/components/layout/theme-controls";
import { getRequestSite, getShellContext } from "@/lib/request-context";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getRequestSite().catch(() => null);
  const siteName = site?.site.name ?? "NoviqWiki";
  return {
    title: site?.settings?.seoTitle || siteName,
    description: site?.settings?.seoDescription || site?.settings?.tagline || siteName,
    icons: site?.settings?.faviconUrl ? { icon: site.settings.faviconUrl } : undefined
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { site, session, setupRequired, locale, appearance, messages, canAdmin } = await getShellContext();
  const siteName = site?.site.name ?? messages.brand;
  const footerContent =
    site?.settings?.footerContent.trim() || site?.settings?.tagline || messages.footerDefaultContent;
  const navigationMessages = {
    read: messages.read,
    recentChanges: messages.recentChanges,
    pages: messages.pages,
    categories: messages.categories,
    media: messages.media,
    specialPages: messages.specialPages,
    admin: messages.admin,
    siteNavigation: messages.siteNavigation
  };
  const preferenceMessages = {
    language: messages.language,
    appearance: messages.appearance,
    light: messages.light,
    dark: messages.dark,
    simplifiedChinese: messages.simplifiedChinese,
    english: messages.english
  };
  const footerLinks = [
    { href: "/pages", label: messages.pages },
    { href: "/categories", label: messages.categories },
    { href: "/recent", label: messages.recentChanges },
    { href: "/special", label: messages.specialPages }
  ];

  return (
    <html lang={locale} data-theme={appearance}>
      <body>
        <a className="skip-link" href="#content">
          {messages.skipToContent}
        </a>
        <div className="nw-app">
          <header className="app-header">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                {site?.settings?.logoUrl ? (
                  <img className="brand-logo" src={site.settings.logoUrl} alt="" />
                ) : (
                  <BookOpen size={25} aria-hidden="true" />
                )}
              </span>
              <span>{siteName}</span>
            </Link>
            <form className="shell-search" action="/search" method="get" role="search" aria-label={messages.searchThisWiki}>
              <Search size={18} aria-hidden="true" />
              <input name="q" type="search" aria-label={messages.searchQuery} placeholder={messages.searchThisWikiPlaceholder} />
              <button type="submit" className="icon-button" aria-label={messages.search} title={messages.search}>
                <Search size={16} aria-hidden="true" />
              </button>
            </form>
            <div className="app-header-actions">
              <PreferenceControls
                initialAppearance={appearance}
                initialLocale={locale}
                messages={preferenceMessages}
              />
              {setupRequired ? (
                <Link className="utility-login" href="/setup">
                  <Rocket size={17} aria-hidden="true" />
                  {messages.firstRunSetup}
                </Link>
              ) : session ? (
                <>
                  <span className="topbar-user" title={session.user.displayName}>
                    <UserRound size={16} aria-hidden="true" />
                    <span>{session.user.displayName}</span>
                  </span>
                  {canAdmin ? <TopbarSettingsLink label={messages.siteSettings} /> : null}
                  <form action="/logout" method="post">
                    <button type="submit" className="icon-button" aria-label={messages.logout} title={messages.logout}>
                      <LogOut size={17} aria-hidden="true" />
                    </button>
                  </form>
                </>
              ) : (
                <Link className="utility-login" href="/login">
                  <LogIn size={17} aria-hidden="true" />
                  {messages.login}
                </Link>
              )}
            </div>
          </header>
          <div className="shell site-shell">
            <aside className="sidebar" aria-label={messages.siteNavigation}>
              <ResponsiveSiteNav messages={navigationMessages} canAdmin={canAdmin} />
              <div className="sidebar-footer">
                <p className="muted">{site?.settings?.tagline || messages.modernSelfHostedWiki}</p>
              </div>
            </aside>
            <div className="main">
              <main id="content" className="content" tabIndex={-1}>
                {children}
              </main>
              <footer className="site-footer" aria-label={messages.siteFooter}>
                <div className="site-footer-inner">
                  <div className="site-footer-copy">
                    <strong>{siteName}</strong>
                    <p>{footerContent}</p>
                  </div>
                  <nav className="site-footer-links" aria-label={messages.footerNavigation}>
                    {footerLinks.map((link) => (
                      <Link key={link.href} href={link.href}>{link.label}</Link>
                    ))}
                  </nav>
                  <div className="site-footer-meta">
                    <span>{messages.poweredBy} {messages.brand} {`v${packageJson.version}`}</span>
                    <span>{messages.license} {packageJson.license}</span>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
