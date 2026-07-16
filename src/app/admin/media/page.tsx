import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { MediaLibrary, type MediaLibraryItem } from "@/components/media-library";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { listMedia } from "@/modules/media/service";

export default async function AdminMediaPage() {
  const site = await getPrimarySiteWithSettings();
  const session = await getCurrentSession();
  const [canUpload, canDelete, rows] = await Promise.all([
    hasPermission(session?.user.id, site!.site.id, "media.upload"),
    hasPermission(session?.user.id, site!.site.id, "media.delete"),
    listMedia({ siteId: site!.site.id, limit: 200 })
  ]);
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <h1 className="page-title admin-title">Media</h1>
          <p className="page-description">
            Browse uploads, inspect metadata, and copy insertion syntax.
          </p>
        </div>
      </header>
      <MediaLibrary
        assets={rows.map(serializeMedia)}
        canUpload={canUpload}
        canDelete={canDelete}
        uploadAction={uploadMediaAction}
        deleteAction={deleteMediaAction}
        emptyMessage="Uploaded files will appear in the administrative media library."
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
