import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { MediaLibrary, type MediaLibraryItem } from "@/components/media-library";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { listMedia } from "@/modules/media/service";

export default async function MediaPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  const [canUpload, canDelete, assets, i18n] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "media.upload"),
    hasPermission(session?.user.id, site.site.id, "media.delete"),
    listMedia({ siteId: site.site.id, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  return (
    <section className="page-frame wide">
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.mediaLibrary}</h1>
          <p className="page-description">{messages.mediaLibraryDescription}</p>
        </div>
        {canUpload ? (
          <a className="button primary" href="#media-upload">
            <Upload size={16} aria-hidden="true" />
            {messages.upload}
          </a>
        ) : null}
      </header>
      <MediaLibrary
        assets={assets.map(serializeMedia)}
        canUpload={canUpload}
        canDelete={canDelete}
        uploadAction={uploadMediaAction}
        deleteAction={deleteMediaAction}
        messages={messages}
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
