import { notFound, redirect } from "next/navigation";
import { ArticleView } from "@/components/article/article-view";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { slugifyTitle } from "@/lib/normalize";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import {
  getRevisionById,
  getRevisionByNumber,
  listPageBacklinks,
  listPageOutboundLinks,
  listRevisions
} from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ revision?: string }>;
};

export default async function ArticlePage({ params, searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const { slug } = await params;
  const { revision: revisionParam } = await searchParams;
  const resolved = await resolvePageBySlug({ siteId: site.site.id, slug }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const revisionNumber = revisionParam ? Number(revisionParam) : null;
  const currentRevision = revisionNumber
    ? await getRevisionByNumber(resolved.page.id, revisionNumber).catch(() => null)
    : resolved.page.currentRevisionId
      ? await getRevisionById(resolved.page.currentRevisionId)
      : null;
  if (!currentRevision) {
    notFound();
  }
  const session = await getCurrentSession();
  const [canEdit, outboundLinks, backlinks, revisions, i18n] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "page.edit"),
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
      categories={currentRevision.categories.map((name) => ({ name, slug: slugifyTitle(name) }))}
      outboundLinks={outboundLinks}
      backlinkCount={backlinks.length}
      revisionCount={revisions.length}
      locale={i18n.locale}
      messages={i18n.messages}
    />
  );
}
