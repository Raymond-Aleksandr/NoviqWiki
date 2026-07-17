import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, History, Link2, Quote } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { decodeRouteParam } from "@/lib/route-params";
import { buildPageCitations } from "@/modules/pages/citations";
import { getRevisionById } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CitePage({ params }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const resolved = await resolvePageBySlug({
    siteId: site.site.id,
    slug,
    followContentRedirects: true
  }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted" || !resolved.page.currentRevisionId) {
    notFound();
  }
  const [revision, i18n] = await Promise.all([
    getRevisionById(resolved.page.currentRevisionId).catch(() => null),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  if (!revision) {
    notFound();
  }
  const { locale, messages } = i18n;
  const citations = buildPageCitations({
    pageTitle: resolved.page.title,
    revisionNumber: revision.revisionNumber,
    revisionCreatedAt: revision.createdAt,
    siteName: site.site.name,
    baseUrl: site.settings?.baseUrl ?? "http://localhost:3000",
    pageSlug: resolved.page.slug,
    accessedAt: new Date()
  });
  const citationItems = [
    { label: messages.citationApa, value: citations.apa },
    { label: messages.citationMla, value: citations.mla },
    { label: messages.citationChicago, value: citations.chicago },
    { label: messages.citationBibtex, value: citations.bibtex, preformatted: true }
  ];

  return (
    <section className="page-frame cite-page">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href={`/page/${resolved.page.slug}`}>{resolved.page.title}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.citeThisPage}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.citeThisPage}</h1>
          <p className="page-description">
            {messages.citeThisPageDescriptionPrefix} <strong>{resolved.page.title}</strong>.
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
      <section className="data-panel citation-overview">
        <div className="admin-panel-heading">
          <Quote size={16} aria-hidden="true" />
          {messages.citationFormats}
        </div>
        <dl className="citation-meta">
          <div>
            <dt>{messages.citationCanonicalUrl}</dt>
            <dd>
              <Link href={`/page/${resolved.page.slug}?revision=${revision.revisionNumber}`}>
                <Link2 size={14} aria-hidden="true" />
                {citations.canonicalUrl}
              </Link>
            </dd>
          </div>
          <div>
            <dt>{messages.citationLastRevision}</dt>
            <dd>
              r{revision.revisionNumber} · {revision.createdAt.toLocaleString(locale)}
            </dd>
          </div>
        </dl>
        <p className="muted citation-note">{messages.citationUsePermanentRevision}</p>
      </section>
      <section className="citation-list" aria-label={messages.citationFormats}>
        {citationItems.map((item) => (
          <article className="data-panel citation-card" key={item.label}>
            <div className="admin-panel-heading">{item.label}</div>
            {item.preformatted ? (
              <pre className="citation-block">{item.value}</pre>
            ) : (
              <p className="citation-block">{item.value}</p>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}
