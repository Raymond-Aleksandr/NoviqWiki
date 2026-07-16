import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getStorageAdapter } from "@/modules/media/storage";

export default async function AdminStatusPage() {
  const [{ dbReady }] = await db
    .select({ dbReady: sql<boolean>`true` })
    .from(sql`(select 1) as status`);
  const storageReady = await getStorageAdapter().isReady();
  return (
    <section className="admin-page">
      <h1>Operational status</h1>
      <div className="status-card-grid">
        <StatusCard name="Database" value={dbReady ? "ready" : "unavailable"} ok={dbReady} />
        <StatusCard
          name="Storage"
          value={storageReady ? "ready" : "unavailable"}
          ok={storageReady}
        />
        <StatusCard name="Migrations" value="managed by Drizzle" ok />
        <StatusCard name="Runtime" value="Next.js production build" ok />
      </div>
      <section className="data-panel">
        <div className="admin-panel-heading">System</div>
        <div className="system-grid">
          <div>
            <div className="mono muted" style={{ fontSize: "11px" }}>
              version
            </div>
            <strong>v0.1.0</strong>
          </div>
          <div>
            <div className="mono muted" style={{ fontSize: "11px" }}>
              database
            </div>
            <strong>{dbReady ? "online" : "offline"}</strong>
          </div>
          <div>
            <div className="mono muted" style={{ fontSize: "11px" }}>
              storage
            </div>
            <strong>{storageReady ? "online" : "offline"}</strong>
          </div>
          <div>
            <div className="mono muted" style={{ fontSize: "11px" }}>
              migrations
            </div>
            <strong>Drizzle</strong>
          </div>
        </div>
      </section>
    </section>
  );
}

function StatusCard({ name, value, ok }: { name: string; value: string; ok: boolean }) {
  return (
    <article className="status-card">
      <div>
        <strong>{name}</strong>
        <div className="muted">{value}</div>
      </div>
      <span className={ok ? "status-ok" : "status-error"}>
        <span className="admin-dot" /> {ok ? "OK" : "Error"}
      </span>
    </article>
  );
}
