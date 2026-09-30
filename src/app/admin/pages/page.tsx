import { requireAuthenticatedPermission } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { AdminPagesView } from "@/features/admin/pages-view";
import type { AdminPageStatus } from "@/features/admin/page-types";
import { getRequestI18n } from "@/i18n/server";
import { listPages } from "@/modules/pages/service";

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminPagesPage({ searchParams }: Props) {
  const site = await getRequestSite();
  await requireAuthenticatedPermission(site!.site.id, "page.edit");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = pageStatusFilterValue(params.status);
  const [rows, { locale, messages }] = await Promise.all([
    listPages({ siteId: site!.site.id, includeDeleted: true, query: query || undefined, status, limit: 200 }),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  return (
    <AdminPagesView
      query={query}
      status={status}
      messages={messages}
      rows={rows.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        status: page.status,
        protected: page.protectionLevel === "protected",
        updated: { dateTime: page.updatedAt.toISOString(), label: page.updatedAt.toLocaleString(locale) }
      }))}
    />
  );
}

function pageStatusFilterValue(value: string | undefined): AdminPageStatus | undefined {
  if (value === "published" || value === "draft" || value === "archived" || value === "deleted") return value;
  return undefined;
}
