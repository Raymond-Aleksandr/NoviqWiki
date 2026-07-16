import { redirect } from "next/navigation";
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
    <section>
      <h1>Create page</h1>
      <ActionForm action={createPageAction}>
        <label>
          Page title
          <input className="field" name="title" required />
        </label>
        <label>
          Slug
          <input className="field" name="slug" />
        </label>
        <MarkdownEditor initialValue={"# New page\n\nStart writing in Markdown.\n"} />
        <label>
          Edit summary
          <input className="field" name="editSummary" />
        </label>
        <div className="article-tabs">
          <button name="intent" value="save-draft">
            Save draft
          </button>
          <button className="primary" name="intent" value="publish">
            Publish
          </button>
        </div>
      </ActionForm>
    </section>
  );
}
