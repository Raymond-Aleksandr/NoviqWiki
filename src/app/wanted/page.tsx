import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileQuestion, Plus } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { listWantedPages } from "@/modules/pages/service";

export default async function WantedPages() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  const [wantedPages, canCreate, i18n] = await Promise.all([
    listWantedPages({ siteId: site.site.id, limit: 100 }),
    hasPermission(session?.user.id, site.site.id, "page.create"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;

  return (
    <section className="page-frame">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.wantedPages}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.wantedPages}</h1>
          <p className="page-description">{messages.wantedPagesDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.read}
          </Link>
        </div>
      </header>
      <section className="data-panel">
        <div className="admin-panel-heading">{messages.wantedPages}</div>
        {wantedPages.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noWantedPagesYet}</strong>
            <p className="muted">{messages.noWantedPagesBody}</p>
          </div>
        ) : (
          <div className="backlink-list">
            {wantedPages.map((wanted) => (
              <div className="backlink-row wanted-row" key={wanted.targetNormalizedTitle}>
                <span className="wanted-main">
                  <FileQuestion size={16} aria-hidden="true" />
                  <span>
                    <strong>{wanted.targetTitle}</strong>
                    <small>
                      {wanted.sourceCount} {messages.sourcePages} · {messages.updated}{" "}
                      {wanted.updatedAt.toLocaleString(locale)}
                    </small>
                  </span>
                </span>
                {canCreate ? (
                  <Link
                    className="button compact"
                    href={`/edit/new?title=${encodeURIComponent(wanted.targetTitle)}`}
                  >
                    <Plus size={14} aria-hidden="true" />
                    {messages.createPage}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
