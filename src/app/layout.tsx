import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  BookOpen,
  Clock3,
  ImageIcon,
  LogIn,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  UserRound
} from "lucide-react";
import "@/styles/globals.css";
import { PreferenceControls } from "@/components/layout/theme-controls";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCurrentSession } from "@/modules/auth/session";
import { getMessages } from "@/i18n";

export const metadata: Metadata = {
  title: "NoviqWiki",
  description: "A modern self-hosted wiki platform"
};

export const dynamic = "force-dynamic";

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
            <span>NOVIQWIKI · CLASSIC THEME</span>
            <PreferenceControls
              initialAppearance={appearance}
              initialLocale={locale === "zh-CN" ? "zh-CN" : "en"}
            />
          </div>
          <div className="shell">
            <aside className="sidebar" aria-label="Site navigation">
              <Link href="/" className="brand">
                <span className="brand-mark" aria-hidden="true">
                  <BookOpen size={25} aria-hidden="true" />
                </span>
                <span>{siteName}</span>
              </Link>
              <nav className="nav-list">
                <Link href="/">
                  <BookOpen size={18} aria-hidden="true" />
                  {messages.read}
                </Link>
                <Link href="/recent">
                  <Clock3 size={18} aria-hidden="true" />
                  {messages.recentChanges}
                </Link>
                <Link href="/categories">
                  <Tags size={18} aria-hidden="true" />
                  {messages.categories}
                </Link>
                <Link href="/media">
                  <ImageIcon size={18} aria-hidden="true" />
                  {messages.media}
                </Link>
                {session ? (
                  <Link href="/admin">
                    <ShieldCheck size={18} aria-hidden="true" />
                    {messages.admin}
                  </Link>
                ) : null}
              </nav>
              <div className="sidebar-footer">
                {!site ? (
                  <Link className="button sidebar-setup-link" href="/setup">
                    First-run setup
                  </Link>
                ) : null}
                <p className="muted">{site?.settings?.tagline ?? "A modern self-hosted wiki"}</p>
              </div>
            </aside>
            <div className="main">
              <header className="topbar">
                <form action="/search" className="global-search" role="search">
                  <label className="sr-only" htmlFor="q">
                    {messages.search}
                  </label>
                  <input id="q" name="q" placeholder={`${messages.search} this wiki...`} />
                  <button aria-label={messages.search}>
                    <Search size={18} aria-hidden="true" />
                  </button>
                </form>
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
                  <Link className="button" href="/admin/settings" aria-label={messages.settings}>
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
