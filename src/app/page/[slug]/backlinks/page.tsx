import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, History, Link2 } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listPageBacklinks } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PageBacklinks({ params }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const { slug } = await params;
  const resolved = await resolvePageBySlug({
    siteId: site.site.id,
    slug,
    followContentRedirects: false
  }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const [backlinks, i18n] = await Promise.all([
    listPageBacklinks({
      siteId: site.site.id,
      pageId: resolved.page.id,
      limit: 100
    }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;

  return (
    <section className="page-frame">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href={`/page/${resolved.page.slug}`}>{resolved.page.title}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.whatLinksHere}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.whatLinksHere}</h1>
          <p className="page-description">
            {messages.backlinksDescriptionPrefix} <strong>{resolved.page.title}</strong>.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href={`/page/${resolved.page.slug}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.article}
          </Link>
          <Link className="button" href={`/history/${resolved.page.slug}`}>
            <History size={16} aria-hidden="true" />
            {messages.history}
          </Link>
        </div>
      </header>
      <section className="data-panel">
        <div className="admin-panel-heading">{messages.backlinks}</div>
        {backlinks.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noBacklinksYet}</strong>
            <p className="muted">{messages.noBacklinksBody}</p>
          </div>
        ) : (
          <div className="backlink-list">
            {backlinks.map((backlink) => (
              <Link className="backlink-row" href={`/page/${backlink.slug}`} key={backlink.pageId}>
                <Link2 size={16} aria-hidden="true" />
                <span>
                  <strong>{backlink.title}</strong>
                  <small>
                    {messages.updated} {backlink.updatedAt.toLocaleString(locale)}
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
