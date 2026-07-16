import type { Metadata } from "next";
import Link from "next/link";
import { Search, Settings, UserRound } from "lucide-react";
import "@/styles/globals.css";
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
  const messages = getMessages(session?.user.locale ?? site?.settings?.defaultLocale);
  const appearance = session?.user.appearance ?? site?.settings?.defaultAppearance ?? "system";
  const siteName = site?.site.name ?? messages.brand;

  return (
    <html
      lang={session?.user.locale ?? site?.settings?.defaultLocale ?? "en"}
      data-theme={appearance === "dark" ? "dark" : undefined}
    >
      <body>
        <a className="skip-link" href="#content">
          {messages.skipToContent}
        </a>
        <div className="shell">
          <aside className="sidebar" aria-label="Site navigation">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                N
              </span>
              <span>{siteName}</span>
            </Link>
            <nav className="nav-list">
              <Link href="/">{messages.read}</Link>
              <Link href="/recent">{messages.recentChanges}</Link>
              <Link href="/categories">{messages.categories}</Link>
              <Link href="/media">{messages.media}</Link>
              {session ? <Link href="/admin">{messages.admin}</Link> : null}
            </nav>
            <p className="muted">{site?.settings?.tagline ?? "A modern self-hosted wiki"}</p>
          </aside>
          <div className="main">
            <header className="topbar">
              <form action="/search" className="global-search" role="search">
                <label className="sr-only" htmlFor="q">
                  {messages.search}
                </label>
                <input id="q" name="q" />
                <button aria-label={messages.search}>
                  <Search size={18} aria-hidden="true" />
                </button>
              </form>
              {session ? (
                <>
                  <span className="muted">
                    <UserRound size={16} aria-hidden="true" /> {session.user.displayName}
                  </span>
                  <form action="/logout" method="post">
                    <button>{messages.logout}</button>
                  </form>
                </>
              ) : (
                <Link className="button" href="/login">
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
      </body>
    </html>
  );
}
