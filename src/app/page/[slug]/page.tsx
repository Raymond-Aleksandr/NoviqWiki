import { notFound, redirect } from "next/navigation";
import { ArticleView } from "@/components/article/article-view";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getRevisionById, getRevisionByNumber } from "@/modules/pages/service";
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
  const canEdit = await hasPermission(session?.user.id, site.site.id, "page.edit");
  return <ArticleView page={resolved.page} revision={currentRevision} canEdit={canEdit} />;
}
