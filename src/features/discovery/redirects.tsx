import Link from "next/link";
import { ArrowRight, GitBranch, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Messages } from "@/i18n";
import type { RedirectPageEntry } from "@/modules/redirects/service";
import { ReportFrame } from "./reports";

type RedirectMessages = Pick<Messages,
  "breadcrumb" | "read" | "redirectPages" | "redirectPagesDescription" | "redirectsLower"
  | "noRedirectsYet" | "noRedirectsBody" | "updated" | "createPage" | "redirectStatusValid"
  | "redirectStatusDouble" | "redirectStatusMissing" | "statusDraft" | "statusArchived" | "statusDeleted"
>;

type RedirectSummary = Omit<RedirectPageEntry, "targetPageId" | "updatedAt"> & { updated: string };

export function RedirectsView({ redirects, count, canCreate, messages }: {
  redirects: readonly RedirectSummary[];
  count: number;
  canCreate: boolean;
  messages: RedirectMessages;
}) {
  return (
    <ReportFrame title={messages.redirectPages} description={messages.redirectPagesDescription} messages={messages}>
      <section className="data-panel">
        <div className="admin-panel-heading">{count} {messages.redirectsLower}</div>
        {redirects.length === 0 ? <EmptyState title={messages.noRedirectsYet} description={messages.noRedirectsBody} /> : (
          <div className="backlink-list">{redirects.map((entry) => {
            const status = redirectStatus(entry.targetStatus, messages);
            return <div className="backlink-row redirect-row" key={entry.pageId}>
              <span className="redirect-flow">
                <GitBranch size={16} aria-hidden="true" />
                <span className="redirect-source">
                  <Link href={`/page/${entry.slug}?redirect=no`}><strong>{entry.title}</strong></Link>
                  <small>/page/{entry.slug} · {messages.updated} {entry.updated}</small>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
                <span className="redirect-target">
                  {entry.targetPageSlug ? (
                    <Link href={`/page/${entry.targetPageSlug}${entry.targetStatus === "double" ? "?redirect=no" : ""}`}>
                      <strong>{entry.targetPageTitle ?? entry.targetTitle}</strong>
                    </Link>
                  ) : <strong>{entry.targetTitle}</strong>}
                  <small>/page/{entry.targetPageSlug ?? entry.targetSlug}</small>
                </span>
              </span>
              <span className="redirect-actions">
                <span className={`badge ${status.tone}`}>{status.label}</span>
                {entry.targetStatus === "missing" && canCreate ? (
                  <Link className="button compact" href={`/edit/new?title=${encodeURIComponent(entry.targetTitle)}`}>
                    <Plus size={14} aria-hidden="true" />{messages.createPage}
                  </Link>
                ) : null}
              </span>
            </div>;
          })}</div>
        )}
      </section>
    </ReportFrame>
  );
}

function redirectStatus(status: RedirectPageEntry["targetStatus"], messages: RedirectMessages) {
  switch (status) {
    case "valid": return { tone: "success", label: messages.redirectStatusValid };
    case "double": return { tone: "warning", label: messages.redirectStatusDouble };
    case "missing": return { tone: "danger", label: messages.redirectStatusMissing };
    case "deleted": return { tone: "danger", label: messages.statusDeleted };
    case "draft": return { tone: "info", label: messages.statusDraft };
    case "archived": return { tone: "info", label: messages.statusArchived };
  }
}
