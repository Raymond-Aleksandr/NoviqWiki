import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { editPageAction } from "@/app/actions";
import { MarkdownEditor, type EditorMediaItem } from "@/components/editor/markdown-editor";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission } from "@/modules/authorization/permissions";
import { listMedia } from "@/modules/media/service";
import { getDraftForEditor, getRevisionById } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function EditPage({ params }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  await requirePermission(session.user.id, site.site.id, "page.edit");
  const { slug } = await params;
  const resolved = await resolvePageBySlug({
    siteId: site.site.id,
    slug,
    followContentRedirects: false
  }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const revision = resolved.page.currentRevisionId
    ? await getRevisionById(resolved.page.currentRevisionId)
    : null;
  const [draft, mediaItems, i18n] = await Promise.all([
    getDraftForEditor({ pageId: resolved.page.id, editorId: session.user.id }),
    listMedia({ siteId: site.site.id, limit: 40 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  const editorMarkdown = draft?.markdown ?? revision?.markdown ?? "";
  const baseRevisionId = draft?.baseRevisionId ?? resolved.page.currentRevisionId ?? "";
  return (
    <section className="page-frame editor-page">
      <header className="editor-header">
        <div>
          <h1>
            {messages.editPageTitlePrefix} · {resolved.page.title}
          </h1>
          <p className="meta">
            {messages.baseRevision} {revision?.revisionNumber ?? messages.none}.{" "}
            {messages.outdatedBaseRejected}
          </p>
          {draft ? (
            <div className="draft-resume-notice">
              <span className="badge warning">{messages.draftLoaded}</span>
              <span>
                {messages.draftLoadedDescription} {draft.updatedAt.toLocaleString(i18n.locale)}
              </span>
            </div>
          ) : null}
        </div>
        <div className="unsaved-badge">{messages.unsavedChanges}</div>
      </header>
      <ActionForm action={editPageAction} className="editor-form" pendingLabel={messages.working}>
        <input type="hidden" name="pageId" value={resolved.page.id} />
        <input type="hidden" name="slug" value={resolved.page.slug} />
        <input type="hidden" name="baseRevisionId" value={baseRevisionId} />
        <MarkdownEditor
          initialValue={editorMarkdown}
          messages={messages}
          mediaItems={serializeEditorMedia(mediaItems)}
          footer={
            <>
              <label>
                <span>{messages.editSummary}</span>
                <input
                  className="field"
                  name="editSummary"
                  defaultValue={draft?.editSummary ?? ""}
                  placeholder={messages.editSummaryPlaceholder}
                />
              </label>
              <Link className="button" href={`/page/${resolved.page.slug}`}>
                <X size={15} aria-hidden="true" />
                {messages.cancel}
              </Link>
              <button name="intent" value="save-draft">
                <Save size={15} aria-hidden="true" />
                {messages.saveDraft}
              </button>
              <button className="primary" name="intent" value="publish">
                <Check size={15} aria-hidden="true" />
                {messages.publish}
              </button>
            </>
          }
        />
      </ActionForm>
    </section>
  );
}

function serializeEditorMedia(
  rows: Array<{
    id: string;
    safeFilename: string;
    publicUrl: string;
    mimeType: string;
    altText: string;
  }>
): EditorMediaItem[] {
  return rows.map((item) => ({
    id: item.id,
    safeFilename: item.safeFilename,
    publicUrl: item.publicUrl,
    mimeType: item.mimeType,
    altText: item.altText
  }));
}
