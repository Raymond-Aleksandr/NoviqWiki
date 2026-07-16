import Link from "next/link";
import { redirect } from "next/navigation";
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
    <section className="panel">
      <h1>Category: {result.category.name}</h1>
      {result.pages.map((page) => (
        <p key={page.id}>
          <Link href={`/page/${page.slug}`}>{page.title}</Link>
        </p>
      ))}
    </section>
  );
}
