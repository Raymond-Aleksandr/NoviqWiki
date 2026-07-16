import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrimarySiteWithSettings } from "@/db/site";
import { listCategories } from "@/modules/categories/service";

export default async function CategoriesPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const categories = await listCategories(site.site.id);
  return (
    <section className="panel">
      <h1>Categories</h1>
      {categories.map((category) => (
        <p key={category.id}>
          <Link href={`/categories/${category.slug}`}>{category.name}</Link>{" "}
          <span className="muted">({category.pageCount})</span>
        </p>
      ))}
    </section>
  );
}
