import { redirect } from "next/navigation";
import { requireMediaReadAccess } from "@/app/access";
import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { MediaLibrary } from "@/components/media-library";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { serializeMedia } from "@/modules/media/dto";
import { listMedia } from "@/modules/media/service";

export default async function MediaPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requireMediaReadAccess(site.site.id);
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
