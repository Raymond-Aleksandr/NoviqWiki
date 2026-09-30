import { requirePageReadAccess } from "@/app/access";
import { PageHeader } from "@/components/ui/page-header";
import { ArticleBreadcrumbs } from "@/features/article/article-navigation";
import { RevisionDiff } from "@/features/article/revision-diff";
import { RevisionMeta } from "@/features/article/revision-meta";
import { RevisionRollbackAction } from "@/features/article/revision-rollback-action";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { rewriteLegacyMediaUrls } from "@/modules/media/service";
import { compareRevisionsForRead } from "@/modules/pages/service";
import { getSiteSettings } from "@/modules/settings/service";

type Props = {
  params: Promise<{ from: string; to: string }>;
};

export default async function DiffPage({ params }: Props) {
  const { from, to } = await params;
  const { page, ...diff } = await compareRevisionsForRead({
    fromRevisionId: from,
    toRevisionId: to
  });
  const session = await requirePageReadAccess(page.siteId);
  const lineCount = diff.lines.length;
  const displayContents = [
    ...diff.lines.map((line) => line.text),
    ...diff.sideBySide.flatMap((row) => [row.oldText, row.newText])
  ];
  const [canRollback, settings, rewrittenContents] = await Promise.all([
    hasPermission(session?.user.id, page.siteId, "page.rollback"),
    getSiteSettings(page.siteId),
    rewriteLegacyMediaUrls({ siteId: page.siteId, contents: displayContents })
  ]);
  const displayLines = diff.lines.map((line, index) => ({
    ...line,
    text: rewrittenContents[index] ?? line.text
  }));
  const displaySideBySide = diff.sideBySide.map((row, index) => ({
    ...row,
    oldText: rewrittenContents[lineCount + index * 2] ?? row.oldText,
    newText: rewrittenContents[lineCount + index * 2 + 1] ?? row.newText
  }));
  const i18n = await getRequestI18n(settings?.defaultLocale);
  const { locale, messages } = i18n;
  return (
    <section className="page-frame">
      <ArticleBreadcrumbs page={page} currentLabel={messages.compare} messages={messages} />
      <PageHeader
        eyebrow={page.title}
        title={`${messages.compareRevision} ${diff.from.revisionNumber} ${messages.to} ${diff.to.revisionNumber}`}
        description={
          <div className="diff-revision-meta">
            <RevisionMeta revision={diff.from} locale={locale} messages={messages} />
            <RevisionMeta revision={diff.to} locale={locale} messages={messages} />
          </div>
        }
        actions={canRollback && page.currentRevisionId !== diff.from.id ? (
          <RevisionRollbackAction
            pageId={page.id}
            slug={page.slug}
            revision={diff.from}
            reason={messages.rollbackFromDiffSummary.replace("{revision}", String(diff.from.revisionNumber))}
            label={`${messages.rollBackToRevision} r${diff.from.revisionNumber}`}
            messages={messages}
            danger
          />
        ) : undefined}
      />
      <RevisionDiff
        slug={page.slug}
        fromRevisionNumber={diff.from.revisionNumber}
        toRevisionNumber={diff.to.revisionNumber}
        lines={displayLines}
        rows={displaySideBySide}
        messages={messages}
      />
    </section>
  );
}
