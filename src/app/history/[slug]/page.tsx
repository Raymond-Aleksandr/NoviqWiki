import { notFound, redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { PageHeader } from "@/components/ui/page-header";
import { getRequestSite } from "@/lib/request-context";
import { ArticleBreadcrumbs, ArticleReturnActions } from "@/features/article/article-navigation";
import { RevisionCompare } from "@/features/article/revision-compare";
import { RevisionHistory } from "@/features/article/revision-history";
import { getRequestI18n } from "@/i18n/server";
import { decodeRouteParam } from "@/lib/route-params";
import { hasPermission } from "@/modules/authorization/permissions";
import { listRevisions } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function HistoryPage({ params }: Props) {
  const site = await getRequestSite();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
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
  const revisions = await listRevisions(resolved.page.id);
  const [canRollback, i18n] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "page.rollback"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;
  return (
    <section className="page-frame">
      <ArticleBreadcrumbs page={resolved.page} currentLabel={messages.history} messages={messages} />
      <PageHeader
        title={`${messages.history} · ${resolved.page.title}`}
        actions={<ArticleReturnActions slug={resolved.page.slug} includeHistory={false} messages={messages} />}
      />
      <RevisionCompare
        pageSlug={resolved.page.slug}
        revisions={revisions}
        locale={locale}
        messages={messages}
      />
      <RevisionHistory
        page={{
          id: resolved.page.id,
          slug: resolved.page.slug,
          currentRevisionId: resolved.page.currentRevisionId
        }}
        revisions={revisions}
        canRollback={canRollback}
        locale={locale}
        messages={messages}
      />
    </section>
  );
}
