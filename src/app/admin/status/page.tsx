import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getStorageAdapter } from "@/modules/media/storage";

export default async function AdminStatusPage() {
  const [{ dbReady }] = await db
    .select({ dbReady: sql<boolean>`true` })
    .from(sql`(select 1) as status`);
  const storageReady = await getStorageAdapter().isReady();
  return (
    <section className="panel">
      <h1>Operational status</h1>
      <p>Database: {dbReady ? "ready" : "unavailable"}</p>
      <p>Storage: {storageReady ? "ready" : "unavailable"}</p>
      <p>Migration status: managed by Drizzle migrations.</p>
    </section>
  );
}
