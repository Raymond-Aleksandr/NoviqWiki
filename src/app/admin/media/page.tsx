import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { requireAuthenticatedPermission } from "@/app/access";
import { MediaLibrary, type MediaLibraryItem } from "@/components/media-library";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
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

function serializeMedia(asset: {
  id: string;
  safeFilename: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  altText: string;
  createdAt: Date;
}): MediaLibraryItem {
  return {
    id: asset.id,
    safeFilename: asset.safeFilename,
    publicUrl: asset.publicUrl,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
    createdAt: asset.createdAt.toISOString()
  };
}
