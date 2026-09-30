import { slugifyTitle } from "@/lib/normalize";

export type CitationInput = {
  pageTitle: string;
  revisionNumber: number;
  revisionCreatedAt: Date;
  siteName: string;
  baseUrl: string;
  pageSlug: string;
  accessedAt: Date;
};

export type PageCitations = {
  canonicalUrl: string;
  apa: string;
  mla: string;
  chicago: string;
  bibtex: string;
};

export function buildPageCitations(input: CitationInput): PageCitations {
  const canonicalUrl = canonicalRevisionUrl(input.baseUrl, input.pageSlug, input.revisionNumber);
  const modified = formatLongDate(input.revisionCreatedAt);
  const accessed = formatLongDate(input.accessedAt);
  const year = input.revisionCreatedAt.getUTCFullYear();

  return {
    canonicalUrl,
    apa: `NoviqWiki contributors. (${formatApaDate(input.revisionCreatedAt)}). ${input.pageTitle}. ${input.siteName}. Retrieved ${accessed}, from ${canonicalUrl}`,
    mla: `"${input.pageTitle}." ${input.siteName}, ${formatMlaDate(input.revisionCreatedAt)}, ${canonicalUrl}. Accessed ${formatMlaDate(input.accessedAt)}.`,
    chicago: `${input.siteName}. "${input.pageTitle}." Last modified ${modified}. ${canonicalUrl}.`,
    bibtex: [
      `@misc{${bibtexKey(input.siteName, input.pageTitle, year)},`,
      `  title = {${escapeBibtex(input.pageTitle)}},`,
      `  author = {{NoviqWiki contributors}},`,
      `  year = {${year}},`,
      `  howpublished = {\\url{${canonicalUrl}}},`,
      `  note = {Revision ${input.revisionNumber}; accessed ${accessed}}`,
      `}`
    ].join("\n")
  };
}

function canonicalRevisionUrl(baseUrl: string, slug: string, revisionNumber: number) {
  const url = new URL(`/page/${slug}`, baseUrl);
  url.searchParams.set("revision", String(revisionNumber));
  return url.toString();
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatApaDate(date: Date) {
  const monthDay = new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "long",
    day: "numeric"
  }).format(date);
  return `${date.getUTCFullYear()}, ${monthDay}`;
}

function formatMlaDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric"
  })
    .format(date)
    .replace(",", "");
}

function bibtexKey(siteName: string, pageTitle: string, year: number) {
  return `${slugifyTitle(siteName)}_${slugifyTitle(pageTitle)}_${year}`.replace(/[^a-z0-9_]/g, "_");
}

function escapeBibtex(value: string) {
  return value.replace(/[{}\\]/g, (match) => `\\${match}`);
}
