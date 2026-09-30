import { notFound, redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { ArticleView } from "@/features/article/article-view";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";
import { slugifyTitle } from "@/lib/normalize";
import { decodeRouteParam } from "@/lib/route-params";
import { hasPermission } from "@/modules/authorization/permissions";
import { rewriteLegacyMediaUrls } from "@/modules/media/service";
import { isPageWatched } from "@/modules/watchlist/service";
import {
  getRevisionById,
  getRevisionByNumber,
  listPageBacklinks,
  listPageOutboundLinks,
  listRevisions
} from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";
import { invalidRevisionNumber, parseRevisionNumberParam } from "@/modules/revisions/params";
import { decorateWikiLinkHtml } from "@/modules/rendering/wiki-link-html";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ revision?: string; redirect?: string }>;
};

export default async function ArticlePage({ params, searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
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
  const [
    canEdit,
    canCreatePage,
    watched,
    outboundLinks,
    backlinks,
    revisions,
    i18n,
    [renderedHtml]
  ] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "page.edit"),
    hasPermission(session?.user.id, site.site.id, "page.create"),
    session
      ? isPageWatched({
          siteId: site.site.id,
          userId: session.user.id,
          pageId: resolved.page.id
        })
      : false,
    listPageOutboundLinks({ siteId: site.site.id, pageId: resolved.page.id }),
    listPageBacklinks({ siteId: site.site.id, pageId: resolved.page.id, limit: 1000 }),
    listRevisions(resolved.page.id),
    getRequestI18n(site.settings?.defaultLocale),
    rewriteLegacyMediaUrls({ siteId: site.site.id, contents: [currentRevision.html] })
  ]);
  return (
    <ArticleView
      page={{
        id: resolved.page.id,
        title: resolved.page.title,
        slug: resolved.page.slug,
        status: resolved.page.status,
        protected: resolved.page.protectionLevel === "protected"
      }}
      revision={{
        revisionNumber: currentRevision.revisionNumber,
        editorDisplayName: currentRevision.editorDisplayName,
        createdAt: currentRevision.createdAt,
        html: decorateWikiLinkHtml(renderedHtml ?? currentRevision.html, outboundLinks, canCreatePage),
        headings: currentRevision.headings,
        characterCount: currentRevision.plainText.length
      }}
      redirectedFrom={resolved.redirectedFrom}
      categories={currentRevision.categories.map((name) => ({ name, slug: slugifyTitle(name) }))}
      statistics={{
        outboundCount: outboundLinks.length,
        backlinkCount: backlinks.length,
        revisionCount: revisions.length
      }}
      permissions={{ canEdit, canWatch: Boolean(session), watched }}
      currentRevisionNumber={
        revisions.find((revision) => revision.id === resolved.page.currentRevisionId)
          ?.revisionNumber ?? currentRevision.revisionNumber
      }
      locale={i18n.locale}
      messages={i18n.messages}
    />
  );
}
