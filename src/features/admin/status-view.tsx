import type { Messages } from "@/i18n";
import { AdminPage, AdminPanel } from "./structures";

type StatusMessages = Pick<Messages,
  | "operationalStatus" | "database" | "storage" | "ready" | "unavailable"
  | "ok" | "error" | "system" | "version" | "migrations" | "managedByDrizzle" | "runtime"
>;

export function AdminStatusView({ databaseReady, storageReady, version, runtime, messages }: {
  databaseReady: boolean;
  storageReady: boolean;
  version: string;
  runtime: string;
  messages: StatusMessages;
}) {
  const checks = [
    { key: "database", name: messages.database, ok: databaseReady },
    { key: "storage", name: messages.storage, ok: storageReady }
  ];
  return (
    <AdminPage title={messages.operationalStatus}>
      <div className="status-card-grid">
        {checks.map((check) => (
          <article className="status-card" key={check.key}>
            <div><strong>{check.name}</strong><div className="muted">{check.ok ? messages.ready : messages.unavailable}</div></div>
            <span className={check.ok ? "status-ok" : "status-error"}>
              <span className="admin-dot" aria-hidden="true" />{check.ok ? messages.ok : messages.error}
            </span>
          </article>
        ))}
      </div>
      <AdminPanel title={messages.system}>
        <div className="system-grid">
          {[
            { key: "version", label: messages.version, value: version },
            { key: "migrations", label: messages.migrations, value: messages.managedByDrizzle },
            { key: "runtime", label: messages.runtime, value: runtime }
          ].map((item) => <div key={item.key}><div className="muted system-label">{item.label}</div><strong>{item.value}</strong></div>)}
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
