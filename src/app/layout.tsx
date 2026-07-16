import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen, LogIn, LogOut, Rocket, Settings, UserRound } from "lucide-react";
import "@/styles/globals.css";
import { SiteNav } from "@/components/layout/site-nav";
import { TopbarSearch } from "@/components/layout/topbar-search";
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
              <header className="topbar">
                <TopbarSearch messages={messages} />
                {session ? (
                  <>
                    <span className="topbar-user">
                      <UserRound size={16} aria-hidden="true" /> {session.user.displayName}
                    </span>
                    <form action="/logout" method="post">
                      <button aria-label={messages.logout}>
                        <LogOut size={17} aria-hidden="true" />
                        <span className="topbar-button-label">{messages.logout}</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <Link className="button" href="/login">
                    <LogIn size={17} aria-hidden="true" />
                    {messages.login}
                  </Link>
                )}
                {session ? (
                  <Link
                    className="button"
                    href="/admin/settings"
                    aria-label={messages.siteSettings}
                  >
                    <Settings size={18} aria-hidden="true" />
                  </Link>
                ) : null}
              </header>
              <main id="content" className="content">
                {children}
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
