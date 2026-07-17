import { normalizeTitle } from "@/lib/normalize";
import type { PageOutboundLink } from "@/modules/pages/service";

const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
const wikiTitlePattern = /\stitle="wiki-link:([^"]*)"/;

export function decorateWikiLinkHtml(
  html: string,
  outboundLinks: PageOutboundLink[],
  canCreatePage: boolean
) {
  if (!html.includes("wiki-link:")) {
    return html;
  }
  const linksByTarget = new Map(
    outboundLinks.map((link) => [normalizeTitle(link.targetTitle), link])
  );

  return html.replace(anchorPattern, (fullMatch, attributes: string, body: string) => {
    const wikiTitle = attributes.match(wikiTitlePattern)?.[1];
    if (!wikiTitle) {
      return fullMatch;
    }

    const targetTitle = decodeHtmlAttribute(wikiTitle);
    const target = linksByTarget.get(normalizeTitle(targetTitle));
    const exists = Boolean(target?.exists && target.targetSlug);
    const href = exists
      ? `/page/${target?.targetSlug}`
      : canCreatePage
        ? `/edit/new?title=${encodeURIComponent(targetTitle)}`
        : getAttribute(attributes, "href") || `/page/${encodeURIComponent(targetTitle)}`;

    let nextAttributes = attributes;
    nextAttributes = setAttribute(nextAttributes, "href", href);
    nextAttributes = setAttribute(nextAttributes, "title", targetTitle);
    nextAttributes = setAttribute(nextAttributes, "data-wiki-state", exists ? "exists" : "missing");
    nextAttributes = setClassNames(nextAttributes, [
      "wiki-link",
      exists ? "wiki-link-exists" : "wiki-link-missing"
    ]);
    return `<a${nextAttributes}>${body}</a>`;
  });
}

function setClassNames(attributes: string, classNames: string[]) {
  const existing = getAttribute(attributes, "class")?.split(/\s+/).filter(Boolean) ?? [];
  const merged = [...new Set([...existing, ...classNames])];
  return setAttribute(attributes, "class", merged.join(" "));
}

function setAttribute(attributes: string, name: string, value: string) {
  const escaped = escapeHtmlAttribute(value);
  const pattern = new RegExp(`\\s${escapeRegExp(name)}="[^"]*"`);
  if (pattern.test(attributes)) {
    return attributes.replace(pattern, ` ${name}="${escaped}"`);
  }
  return `${attributes} ${name}="${escaped}"`;
}

function getAttribute(attributes: string, name: string) {
  const pattern = new RegExp(`\\s${escapeRegExp(name)}="([^"]*)"`);
  const value = attributes.match(pattern)?.[1];
  return value ? decodeHtmlAttribute(value) : null;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
