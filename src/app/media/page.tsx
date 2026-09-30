import { redirect } from "next/navigation";
import { requireMediaReadAccess } from "@/app/access";
import { deleteMediaAction, uploadMediaAction } from "@/app/actions";
import { PageHeader } from "@/components/ui/page-header";
import { getRequestSite } from "@/lib/request-context";
import { MediaLibraryView } from "@/features/media/media-library-view";
import { getMediaLibraryMessages } from "@/features/media/messages";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { serializeMedia } from "@/modules/media/dto";
import { listMedia } from "@/modules/media/service";

export default async function MediaPage() {
  const site = await getRequestSite();
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
      <PageHeader title={messages.mediaLibrary} description={messages.mediaLibraryDescription} />
      <MediaLibraryView
        assets={assets.map(serializeMedia)}
        uploadAction={canUpload ? uploadMediaAction : undefined}
        deleteAction={canDelete ? deleteMediaAction : undefined}
        messages={getMediaLibraryMessages(messages)}
      />
    </section>
  );
}
