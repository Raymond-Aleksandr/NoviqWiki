import Link from "next/link";
import { ArrowLeft, FileQuestion, Plus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { Messages } from "@/i18n";

type ReportFrameProps = {
  title: string;
  description: string;
  messages: Pick<Messages, "breadcrumb" | "read">;
  children: ReactNode;
  className?: string;
};

export function ReportFrame({ title, description, messages, children, className }: ReportFrameProps) {
  return (
    <section className={`page-frame ${className ?? ""}`}>
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <PageHeader
        title={title}
        description={description}
        actions={<Link className="button" href="/">
          <ArrowLeft size={16} aria-hidden="true" />{messages.read}
        </Link>}
      />
      {children}
    </section>
  );
}

type WantedMessages = Pick<Messages,
  "breadcrumb" | "read" | "wantedPages" | "wantedPagesDescription" | "noWantedPagesYet"
  | "noWantedPagesBody" | "sourcePages" | "updated" | "createPage"
>;

export function WantedReport({ pages, canCreate, messages }: {
  pages: readonly { id: string; title: string; sourceCount: number; updated: string }[];
  canCreate: boolean;
  messages: WantedMessages;
}) {
  return <PageReport title={messages.wantedPages} description={messages.wantedPagesDescription}
    messages={messages} icon={FileQuestion} emptyTitle={messages.noWantedPagesYet}
    emptyDescription={messages.noWantedPagesBody} items={pages.map((page) => ({
      id: page.id,
      title: page.title,
      description: `${page.sourceCount} ${messages.sourcePages} · ${messages.updated} ${page.updated}`,
      action: canCreate ? <Link className="button compact" href={`/edit/new?title=${encodeURIComponent(page.title)}`}>
        <Plus size={14} aria-hidden="true" />{messages.createPage}
      </Link> : undefined
    }))} />;
}

export type ReportItem = {
  id: string;
  title: string;
  href?: string;
  description: string;
  action?: ReactNode;
};

type PageReportProps = Omit<ReportFrameProps, "children"> & {
  items: readonly ReportItem[];
  icon: LucideIcon;
  panelTitle?: string;
  emptyTitle: string;
  emptyDescription: string;
  filters?: ReactNode;
};

export function PageReport({
  items, icon: Icon, panelTitle, emptyTitle, emptyDescription, filters, ...frame
}: PageReportProps) {
  return (
    <ReportFrame {...frame}>
      {filters}
      <section className="data-panel">
        <div className="admin-panel-heading">{panelTitle ?? frame.title}</div>
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="backlink-list">
            {items.map((item) => {
              const copy = <><Icon size={16} aria-hidden="true" /><span>
                <strong>{item.title}</strong><small>{item.description}</small>
              </span></>;
              return item.href ? (
                <Link className="backlink-row" href={item.href} key={item.id}>{copy}</Link>
              ) : (
                <div className="backlink-row wanted-row" key={item.id}>
                  <span className="wanted-main">{copy}</span>{item.action}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </ReportFrame>
  );
}
