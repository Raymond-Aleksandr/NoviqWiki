import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText, Tags } from "lucide-react";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCategoryWithPages } from "@/modules/categories/service";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryPage({ params }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const { slug } = await params;
  const result = await getCategoryWithPages({ siteId: site.site.id, slug });
  return (
    <section className="page-frame">
      <header className="page-header stack">
        <h1 className="page-title">Category: {result.category.name}</h1>
        <p className="page-description">
          {result.category.description || "Published pages grouped under this category."}
        </p>
      </header>
      <div className="category-card-grid">
        <div className="category-card">
          <span className="category-card-media" aria-hidden="true" />
          <span className="category-card-body">
            <span>
              <strong>{result.category.name}</strong>
              <span className="muted">{result.pages.length} pages</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </div>
      </div>
      <section className="data-panel page-list-panel">
        <header className="panel-header">
          <span className="badge info">
            <Tags size={13} aria-hidden="true" />
            {result.category.name}
          </span>
          <h2>
            <FileText size={17} aria-hidden="true" />
            Pages in this category
          </h2>
        </header>
        {result.pages.length === 0 ? (
          <div className="empty-state">
            <strong>No published pages in this category.</strong>
          </div>
        ) : (
          result.pages.map((page) => (
            <Link className="page-list-row" key={page.id} href={`/page/${page.slug}`}>
              <FileText size={16} aria-hidden="true" />
              <span>{page.title}</span>
            </Link>
          ))
        )}
      </section>
    </section>
  );
}
