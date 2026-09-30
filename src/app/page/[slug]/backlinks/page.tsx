import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Link2 } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getRequestSite } from "@/lib/request-context";
import { ArticleBreadcrumbs, ArticleReturnActions } from "@/features/article/article-navigation";
import { RevisionTime } from "@/features/article/revision-meta";
import { getRequestI18n } from "@/i18n/server";
import { decodeRouteParam } from "@/lib/route-params";
import { listPageBacklinks } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PageBacklinks({ params }: Props) {
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
      <ArticleBreadcrumbs page={resolved.page} currentLabel={messages.whatLinksHere} messages={messages} />
      <PageHeader
        title={messages.whatLinksHere}
        description={
          <p>
            {messages.backlinksDescriptionPrefix} <strong>{resolved.page.title}</strong>.
          </p>
        }
        actions={<ArticleReturnActions slug={resolved.page.slug} messages={messages} />}
      />
      <section className="data-panel">
        <div className="admin-panel-heading">{messages.backlinks}</div>
        {backlinks.length === 0 ? (
          <EmptyState title={messages.noBacklinksYet} description={messages.noBacklinksBody} />
        ) : (
          <div className="backlink-list">
            {backlinks.map((backlink) => (
              <Link className="backlink-row" href={`/page/${backlink.slug}`} key={backlink.pageId}>
                <Link2 size={16} aria-hidden="true" />
                <span>
                  <strong>{backlink.title}</strong>
                  <small>
                    {messages.updated} <RevisionTime date={backlink.updatedAt} locale={locale} />
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
