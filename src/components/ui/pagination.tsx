import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Messages } from "@/i18n";

type Props = {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
  messages: Pick<Messages, "page" | "previousPage" | "nextPage">;
};

export function Pagination({ page, totalPages, previousHref, nextHref, messages }: Props) {
  const pages = Math.max(1, totalPages);
  const previous = (
    <>
      <ChevronLeft size={15} aria-hidden="true" />
      {messages.previousPage}
    </>
  );
  const next = (
    <>
      {messages.nextPage}
      <ChevronRight size={15} aria-hidden="true" />
    </>
  );

  return (
    <nav className="pagination" aria-label={messages.page}>
      {page > 1 ? (
        <Link className="button compact pagination-link" href={previousHref} rel="prev">
          {previous}
        </Link>
      ) : (
        <span className="button compact pagination-disabled" aria-disabled="true">
          {previous}
        </span>
      )}
      <span className="pagination-status" aria-current="page">
        {messages.page} {page} / {pages}
      </span>
      {page < pages ? (
        <Link className="button compact pagination-link" href={nextHref} rel="next">
          {next}
        </Link>
      ) : (
        <span className="button compact pagination-disabled" aria-disabled="true">
          {next}
        </span>
      )}
    </nav>
  );
}
