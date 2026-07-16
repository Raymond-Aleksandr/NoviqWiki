import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { editPageAction } from "@/app/actions";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission } from "@/modules/authorization/permissions";
import { getRevisionById } from "@/modules/pages/service";
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
  const resolved = await resolvePageBySlug({ siteId: site.site.id, slug }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const revision = resolved.page.currentRevisionId
    ? await getRevisionById(resolved.page.currentRevisionId)
    : null;
  const { messages } = await getRequestI18n(site.settings?.defaultLocale);
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
        </div>
        <div className="unsaved-badge">{messages.unsavedChanges}</div>
      </header>
      <ActionForm action={editPageAction} className="editor-form" pendingLabel={messages.working}>
        <input type="hidden" name="pageId" value={resolved.page.id} />
        <input type="hidden" name="slug" value={resolved.page.slug} />
        <input type="hidden" name="baseRevisionId" value={resolved.page.currentRevisionId ?? ""} />
        <MarkdownEditor
          initialValue={revision?.markdown ?? ""}
          messages={messages}
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
