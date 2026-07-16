import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listCategories } from "@/modules/categories/service";

export default async function CategoriesPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const categories = await listCategories(site.site.id);
  return (
    <section className="page-frame">
      <header className="page-header stack">
        <h1 className="page-title">Categories</h1>
        <p className="page-description">
          Browse topic groups maintained from article category declarations.
        </p>
      </header>
      <div className="category-card-grid">
        {categories.length === 0 ? (
          <section className="empty-state">
            <h2>No categories yet.</h2>
            <p className="muted">
              Add declarations such as [[Category:Guides]] to published pages.
            </p>
          </section>
        ) : (
          categories.map((category) => (
            <Link className="category-card" key={category.id} href={`/categories/${category.slug}`}>
              <span className="category-card-media" aria-hidden="true" />
              <span className="category-card-body">
                <span>
                  <strong>{category.name}</strong>
                  <span className="muted">{category.pageCount} pages</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))
        )}
      </div>
      <section className="data-panel page-list-panel">
        <header className="panel-header">
          <span className="badge info">All</span>
          <h2>Pages in this category</h2>
        </header>
        <p className="muted" style={{ padding: "14px 18px", margin: 0 }}>
          Select a category card to see its published pages.
        </p>
      </section>
    </section>
  );
}
