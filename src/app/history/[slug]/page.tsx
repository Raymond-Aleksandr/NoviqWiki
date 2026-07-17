import Link from "next/link";
import { Eye, GitCompare } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { rollbackAction } from "@/app/actions";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { listRevisions } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function HistoryPage({ params }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  const { slug } = await params;
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
      <h1 className="page-title history-title">
        {messages.history} · {resolved.page.title}
      </h1>
      <div className="history-panel">
        <div className="history-row header">
          <div>{messages.revisionShort}</div>
          <div>{messages.summary}</div>
          <div>{messages.editor}</div>
          <div>{messages.actions}</div>
        </div>
        {revisions.map((revision, index) => (
          <article className="history-row" key={revision.id}>
            <div className="history-revision-cell mono" data-label={messages.revisionShort}>
              r{revision.revisionNumber}
              {resolved.page.currentRevisionId === revision.id ? (
                <span className="badge success history-current-badge">{messages.current}</span>
              ) : null}
            </div>
            <div className="history-summary-cell" data-label={messages.summary}>
              <div className="history-summary-text">
                {revision.editSummary || messages.noEditSummary}
              </div>
              <div className="history-summary-date mono muted">
                {revision.createdAt.toLocaleString(locale)}
              </div>
            </div>
            <div className="muted" data-label={messages.editor}>
              {revision.editorDisplayName}
            </div>
            <div className="history-actions" data-label={messages.actions}>
              <Link
                className="button compact"
                href={`/page/${resolved.page.slug}?revision=${revision.revisionNumber}&redirect=no`}
              >
                <Eye size={14} aria-hidden="true" />
                {messages.view}
              </Link>
              {revisions[index + 1] ? (
                <Link
                  className="button compact"
                  href={`/diff/${revisions[index + 1].id}/${revision.id}`}
                >
                  <GitCompare size={14} aria-hidden="true" />
                  {messages.compare}
                </Link>
              ) : null}
              {canRollback && resolved.page.currentRevisionId !== revision.id ? (
                <ConfirmActionForm
                  action={rollbackAction}
                  hiddenFields={[
                    { name: "pageId", value: resolved.page.id },
                    { name: "slug", value: resolved.page.slug },
                    { name: "targetRevisionId", value: revision.id },
                    { name: "reason", value: `Rollback to revision ${revision.revisionNumber}` }
                  ]}
                  triggerLabel={messages.rollback}
                  triggerClassName="button compact"
                  icon="rollback"
                  title={`${messages.rollback} · r${revision.revisionNumber}`}
                  body={messages.rollbackConfirmBody}
                  warning={messages.destructiveActionWarning}
                  confirmLabel={messages.rollback}
                  cancelLabel={messages.cancel}
                  pendingLabel={messages.working}
                />
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
