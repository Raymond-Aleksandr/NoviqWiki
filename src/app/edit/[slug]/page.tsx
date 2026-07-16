import { redirect } from "next/navigation";
import { editPageAction } from "@/app/actions";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
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
  const resolved = await resolvePageBySlug({ siteId: site.site.id, slug });
  const revision = resolved.page.currentRevisionId
    ? await getRevisionById(resolved.page.currentRevisionId)
    : null;
  return (
    <section>
      <h1>Edit {resolved.page.title}</h1>
      <p className="meta">
        Base revision {revision?.revisionNumber ?? "none"}. Publishing from an outdated base
        revision is rejected.
      </p>
      <ActionForm action={editPageAction}>
        <input type="hidden" name="pageId" value={resolved.page.id} />
        <input type="hidden" name="slug" value={resolved.page.slug} />
        <input type="hidden" name="baseRevisionId" value={resolved.page.currentRevisionId ?? ""} />
        <MarkdownEditor initialValue={revision?.markdown ?? ""} />
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
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>Current preview</h2>
        {revision ? (
          <div className="article-body" dangerouslySetInnerHTML={{ __html: revision.html }} />
        ) : null}
      </section>
    </section>
  );
}
