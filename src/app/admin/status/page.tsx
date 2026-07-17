import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { getStorageAdapter } from "@/modules/media/storage";

export default async function AdminStatusPage() {
  const site = await getPrimarySiteWithSettings();
  const [{ dbReady }] = await db
    .select({ dbReady: sql<boolean>`true` })
    .from(sql`(select 1) as status`);
  const storageReady = await getStorageAdapter().isReady();
  const { messages } = await getRequestI18n(site?.settings?.defaultLocale);
  return (
    <section className="admin-page">
      <h1>{messages.operationalStatus}</h1>
      <div className="status-card-grid">
        <StatusCard
          name={messages.database}
          value={dbReady ? messages.ready : messages.unavailable}
          ok={dbReady}
          messages={messages}
        />
        <StatusCard
          name={messages.storage}
          value={storageReady ? messages.ready : messages.unavailable}
          ok={storageReady}
          messages={messages}
        />
        <StatusCard
          name={messages.migrations}
          value={messages.managedByDrizzle}
          ok
          messages={messages}
        />
        <StatusCard
          name={messages.runtime}
          value={messages.nextJsProductionBuild}
          ok
          messages={messages}
        />
      </div>
      <section className="data-panel">
        <div className="admin-panel-heading">{messages.system}</div>
        <div className="system-grid">
          <div>
            <div className="mono muted system-label">{messages.version}</div>
            <strong>v0.1.0</strong>
          </div>
          <div>
            <div className="mono muted system-label">{messages.database}</div>
            <strong>{dbReady ? messages.online : messages.offline}</strong>
          </div>
          <div>
            <div className="mono muted system-label">{messages.storage}</div>
            <strong>{storageReady ? messages.online : messages.offline}</strong>
          </div>
          <div>
            <div className="mono muted system-label">{messages.migrations}</div>
            <strong>Drizzle</strong>
          </div>
        </div>
      </section>
    </section>
  );
}

function StatusCard({
  name,
  value,
  ok,
  messages
}: {
  name: string;
  value: string;
  ok: boolean;
  messages: Awaited<ReturnType<typeof getRequestI18n>>["messages"];
}) {
  return (
    <article className="status-card">
      <div>
        <strong>{name}</strong>
        <div className="muted">{value}</div>
      </div>
      <span className={ok ? "status-ok" : "status-error"}>
        <span className="admin-dot" /> {ok ? messages.ok : messages.error}
      </span>
    </article>
  );
}
