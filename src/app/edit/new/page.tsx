import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { createPageAction } from "@/app/actions";
import { MarkdownEditor } from "@/features/editor/markdown-editor";
import { getEditorMessages } from "@/features/editor/messages";
import type { EditorMediaItem } from "@/features/editor/types";
import { ActionForm } from "@/components/ui/action-form";
import { getRequestSite } from "@/lib/request-context";
import { getRequestI18n } from "@/i18n/server";
import { getRequestSession } from "@/lib/request-context";
import { hasPermission, requirePermission } from "@/modules/authorization/permissions";
import { listMedia } from "@/modules/media/service";
import { renderEditorPreview } from "@/modules/rendering/preview";

type Props = {
  searchParams: Promise<{ title?: string }>;
};

export default async function NewPage({ searchParams }: Props) {
  const site = await getRequestSite();
  if (!site) {
    redirect("/setup");
  }
  const session = await getRequestSession();
  if (!session) {
    redirect("/login");
  }
  await requirePermission(session.user.id, site.site.id, "page.create");
  const canReadMedia = await hasPermission(session.user.id, site.site.id, "media.read");
  const [mediaItems, i18n] = await Promise.all([
    canReadMedia ? listMedia({ siteId: site.site.id, limit: 40 }) : Promise.resolve([]),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  const { title } = await searchParams;
  const requestedTitle = normalizeRequestedTitle(title);
  const initialMarkdown = requestedTitle ? `# ${requestedTitle}\n\n` : messages.newPageTemplate;
  const initialPreview = await renderEditorPreview({
    siteId: site.site.id,
    markdown: initialMarkdown,
    canCreatePage: true
  });
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
              <input className="field" name="title" defaultValue={requestedTitle} required />
            </label>
            <label>
              {messages.slug}
              <input className="field" name="slug" />
            </label>
          </div>
        </section>
        <MarkdownEditor
          initialValue={initialMarkdown}
          initialPreviewHtml={initialPreview.html}
          previewMode="create"
          messages={getEditorMessages(messages)}
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

function normalizeRequestedTitle(value: string | undefined) {
  const title = value?.trim();
  return title ? title.slice(0, 220) : "";
}
