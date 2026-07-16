import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
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
  const resolved = await resolvePageBySlug({ siteId: site.site.id, slug }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    notFound();
  }
  const revision = resolved.page.currentRevisionId
    ? await getRevisionById(resolved.page.currentRevisionId)
    : null;
  return (
    <section className="page-frame editor-page">
      <header className="editor-header">
        <div>
          <h1>Edit · {resolved.page.title}</h1>
          <p className="meta">
            Base revision {revision?.revisionNumber ?? "none"}. Publishing from an outdated base
            revision is rejected.
          </p>
        </div>
        <div className="unsaved-badge">Unsaved changes</div>
      </header>
      <ActionForm action={editPageAction} className="editor-form">
        <input type="hidden" name="pageId" value={resolved.page.id} />
        <input type="hidden" name="slug" value={resolved.page.slug} />
        <input type="hidden" name="baseRevisionId" value={resolved.page.currentRevisionId ?? ""} />
        <MarkdownEditor
          initialValue={revision?.markdown ?? ""}
          footer={
            <>
              <label>
                <span>Edit summary</span>
                <input className="field" name="editSummary" placeholder="Describe this change" />
              </label>
              <Link className="button" href={`/page/${resolved.page.slug}`}>
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
