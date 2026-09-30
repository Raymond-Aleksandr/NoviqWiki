import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { CategoryDirectory } from "@/features/discovery/categories";
import { getRequestI18n } from "@/i18n/server";
import { listCategories } from "@/modules/categories/service";

export default async function CategoriesPage() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  await requirePageReadAccess(site.site.id);
  const [categories, { messages }] = await Promise.all([
    listCategories(site.site.id),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  return <CategoryDirectory categories={categories} messages={messages} />;
}
