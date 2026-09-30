import type { ArticleHeading } from "./types";

// The route supplies HTML already sanitized by the Markdown renderer. Only escaped
// permalink attributes and a static link marker are added to that trusted markup.
export function addHeadingPermalinks(
  html: string,
  headings: ArticleHeading[],
  permanentLinkLabel: string
) {
  const headingsById = new Map(headings.map((heading) => [heading.id, heading]));
  return html.replace(
    /(<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>)([\s\S]*?)(<\/h\2>)/g,
    (match, opening: string, _depth: string, id: string, content: string, closing: string) => {
      const heading = headingsById.get(id);
      if (!heading) return match;
      const href = escapeHtmlAttribute(`#${encodeURIComponent(decodeHtmlAttribute(id))}`);
      const label = escapeHtmlAttribute(`${permanentLinkLabel}: ${heading.text}`);
      return `${opening}${content} <a class="article-heading-link" href="${href}" aria-label="${label}"><span aria-hidden="true">#</span></a>${closing}`;
    }
  );
}

export function headingHref(id: string) {
  return `#${encodeURIComponent(decodeHtmlAttribute(id))}`;
}

export function extractArticleCover(html: string) {
  const tag = /<img\s+[^>]*>/i.exec(html)?.[0];
  if (!tag) return null;
  const src = readAttribute(tag, "src");
  return src ? { src, alt: readAttribute(tag, "alt") ?? "" } : null;
}

function readAttribute(tag: string, name: string) {
  const value = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
  return value === undefined ? null : decodeHtmlAttribute(value);
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
