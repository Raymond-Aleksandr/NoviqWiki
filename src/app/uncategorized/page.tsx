import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listUncategorizedPages } from "@/modules/pages/service";

export default async function UncategorizedPages() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const [uncategorizedPages, i18n] = await Promise.all([
    listUncategorizedPages({ siteId: site.site.id, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;

  return (
    <section className="page-frame">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.uncategorizedPages}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.uncategorizedPages}</h1>
          <p className="page-description">{messages.uncategorizedPagesDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.read}
          </Link>
        </div>
      </header>
      <section className="data-panel">
        <div className="admin-panel-heading">{messages.uncategorizedPages}</div>
        {uncategorizedPages.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noUncategorizedPagesYet}</strong>
            <p className="muted">{messages.noUncategorizedPagesBody}</p>
          </div>
        ) : (
          <div className="backlink-list">
            {uncategorizedPages.map((page) => (
              <Link className="backlink-row" href={`/page/${page.slug}`} key={page.pageId}>
                <Tags size={16} aria-hidden="true" />
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
