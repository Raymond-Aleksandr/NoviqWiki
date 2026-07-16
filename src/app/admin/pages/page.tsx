import Link from "next/link";
import { deletePageAction, restorePageAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listPages } from "@/modules/pages/service";

export default async function AdminPagesPage() {
  const site = await getPrimarySiteWithSettings();
  const rows = await listPages({ siteId: site!.site.id, includeDeleted: true, limit: 200 });
  return (
    <section className="panel">
      <h1>Pages</h1>
      <p>
        <Link className="button primary" href="/edit/new">
          Create page
        </Link>
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((page) => (
            <tr key={page.id}>
              <td>{page.title}</td>
              <td>{page.status}</td>
              <td>{page.updatedAt.toLocaleString()}</td>
              <td>
                <Link href={`/page/${page.slug}`}>View</Link>{" "}
                <Link href={`/edit/${page.slug}`}>Edit</Link>{" "}
                <Link href={`/history/${page.slug}`}>Revisions</Link>
                {page.status === "deleted" ? (
                  <ActionForm action={restorePageAction} className="inline-form">
                    <input type="hidden" name="pageId" value={page.id} />
                    <button>Restore</button>
                  </ActionForm>
                ) : (
                  <ActionForm action={deletePageAction} className="inline-form">
                    <input type="hidden" name="pageId" value={page.id} />
                    <button className="danger">Delete</button>
                  </ActionForm>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
