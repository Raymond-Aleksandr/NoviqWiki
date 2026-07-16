import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { rollbackAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCurrentSession } from "@/modules/auth/session";
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
  const { slug } = await params;
  const resolved = await resolvePageBySlug({ siteId: site.site.id, slug }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const revisions = await listRevisions(resolved.page.id);
  const session = await getCurrentSession();
  const canRollback = await hasPermission(session?.user.id, site.site.id, "page.rollback");
  return (
    <section className="page-frame">
      <h1 className="page-title admin-title">History · {resolved.page.title}</h1>
      <div className="history-panel">
        <div className="history-row header">
          <div>Rev</div>
          <div>Summary</div>
          <div>Editor</div>
          <div>Actions</div>
        </div>
        {revisions.map((revision, index) => (
          <article className="history-row" key={revision.id}>
            <div className="mono" style={{ fontWeight: 600 }}>
              r{revision.revisionNumber}
              {resolved.page.currentRevisionId === revision.id ? (
                <span
                  className="badge success"
                  style={{ display: "block", width: "fit-content", marginTop: 4 }}
                >
                  current
                </span>
              ) : null}
            </div>
            <div>
              <div>{revision.editSummary || "No edit summary"}</div>
              <div className="mono muted" style={{ fontSize: "11px" }}>
                {revision.createdAt.toLocaleString()}
              </div>
            </div>
            <div className="muted">{revision.editorDisplayName}</div>
            <div className="history-actions">
              <Link href={`/page/${resolved.page.slug}?revision=${revision.revisionNumber}`}>
                View
              </Link>
              {revisions[index + 1] ? (
                <Link href={`/diff/${revisions[index + 1].id}/${revision.id}`}>Compare</Link>
              ) : null}
              {canRollback && resolved.page.currentRevisionId !== revision.id ? (
                <ActionForm action={rollbackAction} className="inline-form">
                  <input type="hidden" name="pageId" value={resolved.page.id} />
                  <input type="hidden" name="slug" value={resolved.page.slug} />
                  <input type="hidden" name="targetRevisionId" value={revision.id} />
                  <input
                    type="hidden"
                    name="reason"
                    value={`Rollback to revision ${revision.revisionNumber}`}
                  />
                  <button>
                    <RotateCcw size={13} aria-hidden="true" />
                    Rollback
                  </button>
                </ActionForm>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
