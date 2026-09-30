import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { Messages } from "@/i18n";
import type { ArticleSummary, CategorySummary } from "./model";

type DirectoryMessages = Pick<Messages,
  "categories" | "categoriesDescription" | "noCategoriesYet" | "categoryDeclarationHint"
  | "pagesLower" | "all" | "pagesInThisCategory" | "selectCategoryHint"
>;

export function CategoryDirectory({
  categories, messages
}: { categories: readonly CategorySummary[]; messages: DirectoryMessages }) {
  return (
    <section className="page-frame">
      <PageHeader title={messages.categories} description={messages.categoriesDescription} />
      <div className="category-card-grid">
        {categories.length === 0 ? (
          <EmptyState title={messages.noCategoriesYet} description={messages.categoryDeclarationHint} />
        ) : categories.map((category) => (
          <Link className="category-card" key={category.id} href={`/categories/${category.slug}`}>
            <span className="category-card-media" aria-hidden="true" />
            <span className="category-card-body"><span>
              <strong>{category.name}</strong>
              <span className="muted">{category.pageCount} {messages.pagesLower}</span>
            </span><ChevronRight size={16} aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
      <section className="data-panel page-list-panel">
        <header className="panel-header"><span className="badge info">{messages.all}</span>
          <h2>{messages.pagesInThisCategory}</h2>
        </header>
        <p className="muted category-selection-hint">{messages.selectCategoryHint}</p>
      </section>
    </section>
  );
}

type CategoryMessages = Pick<Messages,
  "categories" | "categoryPrefix" | "categoryDefaultDescription" | "pagesLower"
  | "pagesInThisCategory" | "noPublishedPagesInCategory"
>;

export function CategoryArticles({ category, pages, messages }: {
  category: { name: string; description: string | null };
  pages: readonly ArticleSummary[];
  messages: CategoryMessages;
}) {
  return (
    <section className="page-frame">
      <PageHeader title={`${messages.categoryPrefix}: ${category.name}`}
        description={category.description || messages.categoryDefaultDescription}
        actions={<Link className="button" href="/categories">{messages.categories}</Link>} />
      <section className="data-panel page-list-panel">
        <header className="panel-header">
          <span className="badge info">{category.name}</span><h2>{messages.pagesInThisCategory}</h2>
          <span className="muted">{pages.length} {messages.pagesLower}</span>
        </header>
        {pages.length === 0 ? <EmptyState title={messages.noPublishedPagesInCategory} /> : pages.map((page) => (
          <Link className="page-list-row" key={page.id} href={`/page/${page.slug}`}>
            <FileText size={16} aria-hidden="true" /><span>{page.title}</span>
          </Link>
        ))}
      </section>
    </section>
  );
}
