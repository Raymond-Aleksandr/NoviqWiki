import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, GitBranch, Plus } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { listRedirectPages, type RedirectTargetStatus } from "@/modules/redirects/service";

export default async function RedirectsPage() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  const [{ rows: redirects, count }, canCreate, i18n] = await Promise.all([
    listRedirectPages({ siteId: site.site.id, limit: 100 }),
    hasPermission(session?.user.id, site.site.id, "page.create"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;

  return (
    <section className="page-frame">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.redirectPages}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.redirectPages}</h1>
          <p className="page-description">{messages.redirectPagesDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.read}
          </Link>
        </div>
      </header>
      <section className="data-panel">
        <div className="admin-panel-heading">
          {count} {messages.redirectsLower}
        </div>
        {redirects.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noRedirectsYet}</strong>
            <p className="muted">{messages.noRedirectsBody}</p>
          </div>
        ) : (
          <div className="backlink-list">
            {redirects.map((entry) => (
              <div className="backlink-row redirect-row" key={entry.pageId}>
                <span className="redirect-flow">
                  <GitBranch size={16} aria-hidden="true" />
                  <span className="redirect-source">
                    <Link href={`/page/${entry.slug}?redirect=no`}>
                      <strong>{entry.title}</strong>
                    </Link>
                    <small>
                      /page/{entry.slug} · {messages.updated}{" "}
                      {entry.updatedAt.toLocaleString(locale)}
                    </small>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                  <span className="redirect-target">
                    {entry.targetPageSlug ? (
                      <Link href={targetHref(entry.targetPageSlug, entry.targetStatus)}>
                        <strong>{entry.targetPageTitle ?? entry.targetTitle}</strong>
                      </Link>
                    ) : (
                      <strong>{entry.targetTitle}</strong>
                    )}
                    <small>/page/{entry.targetPageSlug ?? entry.targetSlug}</small>
                  </span>
                </span>
                <span className="redirect-actions">
                  <span className={`badge ${redirectStatusBadge(entry.targetStatus)}`}>
                    {redirectStatusLabel(entry.targetStatus, messages)}
                  </span>
                  {entry.targetStatus === "missing" && canCreate ? (
                    <Link
                      className="button compact"
                      href={`/edit/new?title=${encodeURIComponent(entry.targetTitle)}`}
                    >
                      <Plus size={14} aria-hidden="true" />
                      {messages.createPage}
                    </Link>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function targetHref(slug: string, status: RedirectTargetStatus) {
  return status === "double" ? `/page/${slug}?redirect=no` : `/page/${slug}`;
}

function redirectStatusBadge(status: RedirectTargetStatus) {
  if (status === "valid") return "success";
  if (status === "double") return "warning";
  if (status === "missing" || status === "deleted") return "danger";
  return "info";
}

function redirectStatusLabel(
  status: RedirectTargetStatus,
  messages: Awaited<ReturnType<typeof getRequestI18n>>["messages"]
) {
  if (status === "valid") return messages.redirectStatusValid;
  if (status === "double") return messages.redirectStatusDouble;
  if (status === "missing") return messages.redirectStatusMissing;
  if (status === "draft") return messages.statusDraft;
  if (status === "archived") return messages.statusArchived;
  return messages.statusDeleted;
}
