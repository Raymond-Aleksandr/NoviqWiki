import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, RouteOff } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listDeadEndPages } from "@/modules/pages/service";

export default async function DeadEndPages() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const [deadEndPages, i18n] = await Promise.all([
    listDeadEndPages({ siteId: site.site.id, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;

  return (
    <section className="page-frame">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.deadEndPages}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.deadEndPages}</h1>
          <p className="page-description">{messages.deadEndPagesDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.read}
          </Link>
        </div>
      </header>
      <section className="data-panel">
        <div className="admin-panel-heading">{messages.deadEndPages}</div>
        {deadEndPages.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noDeadEndPagesYet}</strong>
            <p className="muted">{messages.noDeadEndPagesBody}</p>
          </div>
        ) : (
          <div className="backlink-list">
            {deadEndPages.map((page) => (
              <Link className="backlink-row" href={`/page/${page.slug}`} key={page.pageId}>
                <RouteOff size={16} aria-hidden="true" />
                <span>
                  <strong>{page.title}</strong>
                  <small>
                    {messages.updated} {page.updatedAt.toLocaleString(locale)}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
