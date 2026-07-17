import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen, LogIn, LogOut, Rocket, UserRound } from "lucide-react";
import packageJson from "../../package.json";
import "@/styles/globals.css";
import { SiteNav } from "@/components/layout/site-nav";
import { TopbarSettingsLink } from "@/components/layout/topbar-settings-link";
import { PreferenceControls } from "@/components/layout/theme-controls";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCurrentSession } from "@/modules/auth/session";
import { getMessages } from "@/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPrimarySiteWithSettings().catch(() => null);
  const siteName = site?.site.name ?? "NoviqWiki";
  const title = site?.settings?.seoTitle || siteName;
  const description = site?.settings?.seoDescription || site?.settings?.tagline || siteName;
  return {
    title,
    description,
    icons: site?.settings?.faviconUrl ? { icon: site.settings.faviconUrl } : undefined
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getPrimarySiteWithSettings().catch(() => null);
  const session = await getCurrentSession().catch(() => null);
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("noviqwiki-locale")?.value;
  const cookieAppearance = cookieStore.get("noviqwiki-appearance")?.value;
  const locale =
    cookieLocale === "zh-CN" || cookieLocale === "en"
      ? cookieLocale
      : (session?.user.locale ?? site?.settings?.defaultLocale ?? "en");
  const appearance =
    cookieAppearance === "dark" || cookieAppearance === "light"
      ? cookieAppearance
      : session?.user.appearance === "dark"
        ? "dark"
        : "light";
  const messages = getMessages(locale);
  const siteName = site?.site.name ?? messages.brand;
  const footerContent =
    site?.settings?.footerContent.trim() ||
    site?.settings?.tagline ||
    messages.footerDefaultContent;
  const footerLinks = [
    { href: "/recent", label: messages.recentChanges },
    { href: "/pages", label: messages.pages },
    { href: "/categories", label: messages.categories },
    { href: "/special", label: messages.specialPages }
  ];

  return (
    <html lang={locale} data-theme={appearance}>
      <body>
        <a className="skip-link" href="#content">
          {messages.skipToContent}
        </a>
        <div className="nw-app">
          <div className="design-utility">
            <span>NOVIQWIKI · {messages.classicTheme}</span>
            <PreferenceControls
              initialAppearance={appearance}
              initialLocale={locale === "zh-CN" ? "zh-CN" : "en"}
              messages={messages}
            />
            {!session ? (
              <Link className="utility-login" href="/login">
                <LogIn size={17} aria-hidden="true" />
                {messages.login}
              </Link>
            ) : null}
          </div>
          <div className="shell site-shell">
            <aside className="sidebar" aria-label={messages.siteNavigation}>
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
              <SiteNav messages={messages} showAdmin={Boolean(session)} />
              <div className="sidebar-footer">
                {!site ? (
                  <Link className="button sidebar-setup-link" href="/setup">
                    <Rocket size={16} aria-hidden="true" />
                    {messages.firstRunSetup}
                  </Link>
                ) : null}
                <p className="muted">{site?.settings?.tagline ?? messages.modernSelfHostedWiki}</p>
              </div>
            </aside>
            <div className="main">
              {session ? (
                <header className="topbar topbar-authenticated">
                  <div className="topbar-fill" aria-hidden="true" />
                  <span className="topbar-user">
                    <UserRound size={16} aria-hidden="true" /> {session.user.displayName}
                  </span>
                  <form action="/logout" method="post">
                    <button aria-label={messages.logout}>
                      <LogOut size={17} aria-hidden="true" />
                      <span className="topbar-button-label">{messages.logout}</span>
                    </button>
                  </form>
                  <TopbarSettingsLink label={messages.siteSettings} />
                </header>
              ) : null}
              <main id="content" className="content">
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
                      <Link key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="site-footer-meta">
                    <span>
                      {messages.poweredBy} {messages.brand} {`v${packageJson.version}`}
                    </span>
                    <span>
                      {messages.license} {packageJson.license}
                    </span>
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
