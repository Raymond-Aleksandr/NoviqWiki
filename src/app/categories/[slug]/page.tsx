import { notFound, redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { CategoryArticles } from "@/features/discovery/categories";
import { getRequestI18n } from "@/i18n/server";
import { decodeRouteParam } from "@/lib/route-params";
import { NotFoundError } from "@/lib/errors";
import { getCategoryWithPages } from "@/modules/categories/service";

type Props = { params: Promise<{ slug: string }> };

export default async function CategoryPage({ params }: Props) {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const [result, { messages }] = await Promise.all([
    getCategoryWithPages({ siteId: site.site.id, slug }).catch((error: unknown) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <CategoryArticles category={{ name: result.category.name, description: result.category.description }}
    pages={result.pages.map(({ id, title, slug }) => ({ id, title, slug }))} messages={messages} />;
}
