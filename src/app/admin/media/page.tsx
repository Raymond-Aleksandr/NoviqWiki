import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { requireAuthenticatedPermission } from "@/app/access";
import { MediaLibrary } from "@/components/media-library";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { serializeMedia } from "@/modules/media/dto";
import { listMedia } from "@/modules/media/service";

export default async function AdminMediaPage() {
  const site = await getPrimarySiteWithSettings();
  const session = await requireAuthenticatedPermission(site!.site.id, "media.read");
  const [canUpload, canDelete, rows, i18n] = await Promise.all([
    hasPermission(session?.user.id, site!.site.id, "media.upload"),
    hasPermission(session?.user.id, site!.site.id, "media.delete"),
    listMedia({ siteId: site!.site.id, limit: 200 }),
    getRequestI18n(site!.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <h1 className="page-title admin-title">{messages.media}</h1>
          <p className="page-description">{messages.mediaAdminDescription}</p>
        </div>
      </header>
      <MediaLibrary
        assets={rows.map(serializeMedia)}
        canUpload={canUpload}
        canDelete={canDelete}
        uploadAction={uploadMediaAction}
        deleteAction={deleteMediaAction}
        messages={messages}
        emptyMessage={messages.mediaEmptyAdminLibrary}
      />
    </section>
  );
}
