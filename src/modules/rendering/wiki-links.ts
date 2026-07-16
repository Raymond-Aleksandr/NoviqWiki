import { normalizeTitle, slugifyTitle } from "@/lib/normalize";

export type WikiLink = {
  target: string;
  normalizedTarget: string;
  label: string;
};

export type CategoryDeclaration = {
  name: string;
  normalizedName: string;
  slug: string;
};

const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;

export function parseWikiLinks(markdown: string) {
  const links: WikiLink[] = [];
  const categories: CategoryDeclaration[] = [];

  for (const match of markdown.matchAll(wikiLinkPattern)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    const [targetPart, labelPart] = raw.split("|", 2).map((part) => part.trim());
    if (/^category:/i.test(targetPart)) {
      const name = targetPart.replace(/^category:/i, "").trim();
      if (name) {
        categories.push({
          name,
          normalizedName: normalizeTitle(name),
          slug: slugifyTitle(name)
        });
      }
      continue;
    }
    links.push({
      target: targetPart,
      normalizedTarget: normalizeTitle(targetPart),
      label: labelPart || targetPart
    });
  }

  return {
    links: uniqueBy(links, (link) => link.normalizedTarget),
    categories: uniqueBy(categories, (category) => category.normalizedName)
  };
}

export function replaceWikiLinksWithMarkdown(markdown: string) {
  return markdown.replace(wikiLinkPattern, (_full, inner: string) => {
    const [targetPart, labelPart] = inner.split("|", 2).map((part) => part.trim());
    if (/^category:/i.test(targetPart)) {
      return "";
    }
    const label = labelPart || targetPart;
    return `[${escapeMarkdownLabel(label)}](/page/${slugifyTitle(targetPart)} "wiki-link:${targetPart}")`;
  });
}

function escapeMarkdownLabel(label: string) {
  return label.replace(/\[/g, "\\[").replace(/]/g, "\\]");
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
