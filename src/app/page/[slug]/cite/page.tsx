import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Link2, Quote } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { PageHeader } from "@/components/ui/page-header";
import { getRequestSite } from "@/lib/request-context";
import { ArticleBreadcrumbs, ArticleReturnActions } from "@/features/article/article-navigation";
import { CitationList } from "@/features/article/citation-list";
import { RevisionTime } from "@/features/article/revision-meta";
import { getRequestI18n } from "@/i18n/server";
import { canonicalApplicationBaseUrl } from "@/lib/env";
import { decodeRouteParam } from "@/lib/route-params";
import { buildPageCitations } from "@/modules/pages/citations";
import { getRevisionById } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CitePage({ params }: Props) {
  const site = await getRequestSite();
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
    baseUrl: canonicalApplicationBaseUrl(undefined, site.settings?.baseUrl),
    pageSlug: resolved.page.slug,
    accessedAt: new Date()
  });
  const citationItems = [
    { label: messages.citationApa, value: citations.apa },
    { label: messages.citationMla, value: citations.mla },
    { label: messages.citationChicago, value: citations.chicago },
    { label: messages.citationBibtex, value: citations.bibtex, preformatted: true }
  ].map((item) => ({
    ...item,
    copyLabel: messages.copyMarkdown.replace("Markdown", item.label)
  }));

  return (
    <section className="page-frame cite-page">
      <ArticleBreadcrumbs page={resolved.page} currentLabel={messages.citeThisPage} messages={messages} />
      <PageHeader
        title={messages.citeThisPage}
        description={
          <p>
            {messages.citeThisPageDescriptionPrefix} <strong>{resolved.page.title}</strong>.
          </p>
        }
        actions={<ArticleReturnActions slug={resolved.page.slug} messages={messages} />}
      />
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
              r{revision.revisionNumber} · <RevisionTime date={revision.createdAt} locale={locale} />
            </dd>
          </div>
        </dl>
        <p className="muted citation-note">{messages.citationUsePermanentRevision}</p>
      </section>
      <CitationList
        items={citationItems}
        title={messages.citationFormats}
        messages={{ copiedSuffix: messages.copiedSuffix, clipboardFailed: messages.clipboardFailed }}
      />
    </section>
  );
}
