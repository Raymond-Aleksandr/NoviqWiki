import { redirect } from "next/navigation";
import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { requireAuthenticatedPermission } from "@/app/access";
import { PageHeader } from "@/components/ui/page-header";
import { getRequestSite } from "@/lib/request-context";
import { MediaLibraryView } from "@/features/media/media-library-view";
import { getMediaLibraryMessages } from "@/features/media/messages";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { serializeMedia } from "@/modules/media/dto";
import { listMedia } from "@/modules/media/service";

export default async function AdminMediaPage() {
  const site = await getRequestSite();
  if (!site) redirect("/setup");
  const session = await requireAuthenticatedPermission(site.site.id, "media.read");
  const [canUpload, canDelete, rows, i18n] = await Promise.all([
    hasPermission(session.user.id, site.site.id, "media.upload"),
    hasPermission(session.user.id, site.site.id, "media.delete"),
    listMedia({ siteId: site.site.id, limit: 200 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  return (
    <section className="admin-page">
      <PageHeader title={messages.media} description={messages.mediaAdminDescription} />
      <MediaLibraryView
        assets={rows.map(serializeMedia)}
        uploadAction={canUpload ? uploadMediaAction : undefined}
        deleteAction={canDelete ? deleteMediaAction : undefined}
        messages={getMediaLibraryMessages(messages)}
        emptyMessage={messages.mediaEmptyAdminLibrary}
      />
    </section>
  );
}
