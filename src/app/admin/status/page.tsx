import { sql } from "drizzle-orm";
import { version } from "../../../../package.json";
import { db } from "@/db/client";
import { getRequestSite } from "@/lib/request-context";
import { AdminStatusView } from "@/features/admin/status-view";
import { getRequestI18n } from "@/i18n/server";
import { getStorageAdapter } from "@/modules/media/storage";

export default async function AdminStatusPage() {
  const site = await getRequestSite();
  const [database, storage, i18n] = await Promise.allSettled([
    db.select({ dbReady: sql<boolean>`true` }).from(sql`(select 1) as status`),
    Promise.resolve().then(() => getStorageAdapter().isReady()),
    getRequestI18n(site?.settings?.defaultLocale)
  ]);
  if (i18n.status === "rejected") throw i18n.reason;
  return (
    <AdminStatusView
      databaseReady={database.status === "fulfilled" && database.value[0]?.dbReady === true}
      storageReady={storage.status === "fulfilled" && storage.value === true}
      version={`v${version}`}
      runtime={`Node.js ${process.version}`}
      messages={i18n.value.messages}
    />
  );
}
