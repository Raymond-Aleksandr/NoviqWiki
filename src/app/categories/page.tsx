import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listCategories } from "@/modules/categories/service";

export default async function CategoriesPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const [categories, i18n] = await Promise.all([
    listCategories(site.site.id),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  return (
    <section className="page-frame">
      <header className="page-header stack">
        <h1 className="page-title">{messages.categories}</h1>
        <p className="page-description">{messages.categoriesDescription}</p>
      </header>
      <div className="category-card-grid">
        {categories.length === 0 ? (
          <section className="empty-state">
            <h2>{messages.noCategoriesYet}</h2>
            <p className="muted">{messages.categoryDeclarationHint}</p>
          </section>
        ) : (
          categories.map((category) => (
            <Link className="category-card" key={category.id} href={`/categories/${category.slug}`}>
              <span className="category-card-media" aria-hidden="true" />
              <span className="category-card-body">
                <span>
                  <strong>{category.name}</strong>
                  <span className="muted">
                    {category.pageCount} {messages.pagesLower}
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))
        )}
      </div>
      <section className="data-panel page-list-panel">
        <header className="panel-header">
          <span className="badge info">{messages.all}</span>
          <h2>{messages.pagesInThisCategory}</h2>
        </header>
        <p className="muted" style={{ padding: "14px 18px", margin: 0 }}>
          {messages.selectCategoryHint}
        </p>
      </section>
    </section>
  );
}
