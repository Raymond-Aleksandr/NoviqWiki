import { notFound, redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { ArticleView } from "@/components/article/article-view";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { slugifyTitle } from "@/lib/normalize";
import { hasPermission } from "@/modules/authorization/permissions";
import {
  getRevisionById,
  getRevisionByNumber,
  listPageBacklinks,
  listPageOutboundLinks,
  listRevisions
} from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";
import { invalidRevisionNumber, parseRevisionNumberParam } from "@/modules/revisions/params";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ revision?: string; redirect?: string }>;
};

export default async function ArticlePage({ params, searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  const { slug } = await params;
  const { revision: revisionParam, redirect: redirectMode } = await searchParams;
  const resolved = await resolvePageBySlug({
    siteId: site.site.id,
    slug,
    followContentRedirects: redirectMode !== "no"
  }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const revisionNumber = parseRevisionNumberParam(revisionParam);
  if (revisionNumber === invalidRevisionNumber) {
    notFound();
  }
  const currentRevision = revisionNumber
    ? await getRevisionByNumber(resolved.page.id, revisionNumber).catch(() => null)
    : resolved.page.currentRevisionId
      ? await getRevisionById(resolved.page.currentRevisionId)
      : null;
  if (!currentRevision) {
    notFound();
  }
  const [canEdit, canCreatePage, outboundLinks, backlinks, revisions, i18n] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "page.edit"),
    hasPermission(session?.user.id, site.site.id, "page.create"),
    listPageOutboundLinks({ siteId: site.site.id, pageId: resolved.page.id }),
    listPageBacklinks({ siteId: site.site.id, pageId: resolved.page.id, limit: 1000 }),
    listRevisions(resolved.page.id),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return (
    <ArticleView
      page={resolved.page}
      revision={currentRevision}
      canEdit={canEdit}
      canCreatePage={canCreatePage}
      redirectedFrom={resolved.redirectedFrom}
      categories={currentRevision.categories.map((name) => ({ name, slug: slugifyTitle(name) }))}
      outboundLinks={outboundLinks}
      backlinkCount={backlinks.length}
      revisionCount={revisions.length}
      currentRevisionNumber={
        revisions.find((revision) => revision.id === resolved.page.currentRevisionId)
          ?.revisionNumber
      }
      locale={i18n.locale}
      messages={i18n.messages}
    />
  );
}
