import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { createPageAction } from "@/app/actions";
import { MarkdownEditor, type EditorMediaItem } from "@/components/editor/markdown-editor";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission } from "@/modules/authorization/permissions";
import { listMedia } from "@/modules/media/service";

export default async function NewPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  await requirePermission(session.user.id, site.site.id, "page.create");
  const [mediaItems, i18n] = await Promise.all([
    listMedia({ siteId: site.site.id, limit: 40 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  return (
    <section className="page-frame editor-page">
      <header className="editor-header">
        <div>
          <h1>{messages.createPage}</h1>
          <p className="meta">{messages.createPageDescription}</p>
        </div>
        <div className="unsaved-badge">{messages.unsavedChanges}</div>
      </header>
      <ActionForm action={createPageAction} className="editor-form" pendingLabel={messages.working}>
        <section className="panel admin-create-panel">
          <div className="editor-title-grid">
            <label>
              {messages.pageTitle}
              <input className="field" name="title" required />
            </label>
            <label>
              {messages.slug}
              <input className="field" name="slug" />
            </label>
          </div>
        </section>
        <MarkdownEditor
          initialValue={messages.newPageTemplate}
          messages={messages}
          mediaItems={serializeEditorMedia(mediaItems)}
          footer={
            <>
              <label>
                <span>{messages.editSummary}</span>
                <input
                  className="field"
                  name="editSummary"
                  placeholder={messages.editSummaryPlaceholder}
                />
              </label>
              <Link className="button" href="/">
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
