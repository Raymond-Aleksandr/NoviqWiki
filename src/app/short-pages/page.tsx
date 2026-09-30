import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Ruler } from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { listShortPages } from "@/modules/pages/service";

type Props = {
  searchParams: Promise<{ max?: string }>;
};

const thresholds = [200, 600, 1200] as const;

export default async function ShortPages({ searchParams }: Props) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const params = await searchParams;
  const maxLength = shortPageThreshold(params.max);
  const [shortPages, i18n] = await Promise.all([
    listShortPages({ siteId: site.site.id, maxLength, limit: 100 }),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { locale, messages } = i18n;

  return (
    <section className="page-frame">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.shortPages}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.shortPages}</h1>
          <p className="page-description">{messages.shortPagesDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.read}
          </Link>
        </div>
      </header>
      <nav className="filter-pills" aria-label={messages.shortPagesThresholds}>
        {thresholds.map((threshold) => (
          <Link
            aria-current={maxLength === threshold ? "page" : undefined}
            className={`filter-pill ${maxLength === threshold ? "active" : ""}`}
            href={`/short-pages?max=${threshold}`}
            key={threshold}
          >
            ≤ {threshold} {messages.chars}
          </Link>
        ))}
      </nav>
      <section className="data-panel page-index-panel">
        <div className="admin-panel-heading">
          {shortPages.length} {messages.shortPagesLower}
        </div>
        {shortPages.length === 0 ? (
          <div className="empty-state backlinks-empty">
            <strong>{messages.noShortPagesYet}</strong>
            <p className="muted">{messages.noShortPagesBody}</p>
          </div>
        ) : (
          <div className="backlink-list">
            {shortPages.map((page) => (
              <Link className="backlink-row" href={`/page/${page.slug}`} key={page.pageId}>
                <Ruler size={16} aria-hidden="true" />
                <span>
                  <strong>{page.title}</strong>
                  <small>
                    {page.plainTextLength} {messages.chars} · {messages.updated}{" "}
                    {page.updatedAt.toLocaleString(locale)}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function shortPageThreshold(value: string | undefined) {
  const parsed = Number(value);
  return thresholds.includes(parsed as (typeof thresholds)[number])
    ? (parsed as (typeof thresholds)[number])
    : 600;
}
