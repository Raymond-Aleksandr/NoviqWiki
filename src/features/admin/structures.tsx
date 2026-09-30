import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export type AdminOption = { value: string; label: string };

export function AdminPage({
  title,
  description,
  actions,
  compact = false,
  children
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`admin-page${compact ? " compact" : ""}`}>
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </section>
  );
}

export function AdminPanel({
  title,
  className = "",
  children
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`data-panel ${className}`}>
      <h2 className="admin-panel-heading">{title}</h2>
      {children}
    </section>
  );
}

export function AdminCreatePanel({
  title,
  id,
  children
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel admin-create-panel" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function AdminFilters({
  action,
  query,
  queryLabel,
  searchLabel,
  clearLabel,
  filter,
  children
}: {
  action: string;
  query: string;
  queryLabel: string;
  searchLabel: string;
  clearLabel: string;
  filter?: { name: string; label: string; value: string; options: AdminOption[] };
  children?: ReactNode;
}) {
  return (
    <form className="admin-filter-bar" action={action} role="search" aria-label={queryLabel}>
      <label className="admin-filter-control admin-filter-search">
        <span className="sr-only">{queryLabel}</span>
        <Search size={15} aria-hidden="true" />
        <input type="search" name="q" defaultValue={query} placeholder={queryLabel} />
      </label>
      {filter ? (
        <label className="admin-filter-control admin-filter-select">
          <span className="sr-only">{filter.label}</span>
          <select name={filter.name} defaultValue={filter.value}>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      ) : null}
      <button className="button compact" type="submit">
        <Search size={14} aria-hidden="true" />
        {searchLabel}
      </button>
      {query || filter?.value ? (
        <Link className="button compact" href={action}>
          <X size={14} aria-hidden="true" />
          {clearLabel}
        </Link>
      ) : null}
      <div className="admin-filter-spacer" />
      {children}
    </form>
  );
}

export function AdminTable({
  title,
  gridClassName,
  columns,
  empty,
  emptyLabel,
  filters,
  footer,
  children
}: {
  title: string;
  gridClassName: string;
  columns: string[];
  empty: boolean;
  emptyLabel: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="data-panel admin-table">
      {filters}
      {empty ? <EmptyState title={emptyLabel} /> : (
        <div role="table" aria-label={title}>
          <div className={`admin-grid-header ${gridClassName}`} role="row">
            {columns.map((column) => <div role="columnheader" key={column}>{column}</div>)}
          </div>
          {children}
        </div>
      )}
      {footer}
    </div>
  );
}
