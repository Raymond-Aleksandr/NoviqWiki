import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { createPageAction } from "@/app/actions";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission } from "@/modules/authorization/permissions";

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
  return (
    <section className="page-frame editor-page">
      <header className="editor-header">
        <div>
          <h1>Create page</h1>
          <p className="meta">
            Draft first or publish immediately if your role allows publication.
          </p>
        </div>
        <div className="unsaved-badge">Unsaved changes</div>
      </header>
      <ActionForm action={createPageAction} className="editor-form">
        <section className="panel admin-create-panel">
          <div className="editor-title-grid">
            <label>
              Page title
              <input className="field" name="title" required />
            </label>
            <label>
              Slug
              <input className="field" name="slug" />
            </label>
          </div>
        </section>
        <MarkdownEditor
          initialValue={"# New page\n\nStart writing in Markdown.\n"}
          footer={
            <>
              <label>
                <span>Edit summary</span>
                <input className="field" name="editSummary" placeholder="Describe this change" />
              </label>
              <Link className="button" href="/">
                Cancel
              </Link>
              <button name="intent" value="save-draft">
                Save draft
              </button>
              <button className="primary" name="intent" value="publish">
                <Check size={15} aria-hidden="true" />
                Publish
              </button>
            </>
          }
        />
      </ActionForm>
    </section>
  );
}
