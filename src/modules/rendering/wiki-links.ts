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

  mapMarkdownProse(markdown, (prose) => {
    for (const match of prose.matchAll(wikiLinkPattern)) {
      const parsed = parseWikiLinkInner(match[1] ?? "");
      if (!parsed) {
        continue;
      }
      if (parsed.category) {
        categories.push({
          name: parsed.target,
          normalizedName: normalizeTitle(parsed.target),
          slug: slugifyTitle(parsed.target)
        });
        continue;
      }
      links.push({
        target: parsed.target,
        normalizedTarget: normalizeTitle(parsed.target),
        label: parsed.label
      });
    }
    return prose;
  });

  return {
    links: uniqueBy(links, (link) => link.normalizedTarget),
    categories: uniqueBy(categories, (category) => category.normalizedName)
  };
}

export function replaceWikiLinksWithMarkdown(markdown: string) {
  return mapMarkdownProse(markdown, (prose) =>
    prose.replace(wikiLinkPattern, (full, inner: string) => {
      const parsed = parseWikiLinkInner(inner);
      if (!parsed) {
        return full;
      }
      if (parsed.category) {
        return "";
      }
      return `[${escapeMarkdownLabel(parsed.label)}](/page/${slugifyTitle(parsed.target)} "wiki-link:${parsed.target}")`;
    })
  );
}

function parseWikiLinkInner(inner: string) {
  const raw = inner.trim();
  if (!raw) {
    return null;
  }
  const [targetPart = "", labelPart] = raw.split("|", 2).map((part) => part.trim());
  if (/^category:/i.test(targetPart)) {
    const target = targetPart.replace(/^category:/i, "").trim();
    return target ? { target, label: target, category: true } : null;
  }
  return targetPart
    ? { target: targetPart, label: labelPart || targetPart, category: false }
    : null;
}

/** Transform Markdown prose while preserving code examples byte-for-byte. */
function mapMarkdownProse(markdown: string, transform: (prose: string) => string) {
  const lines = markdown.match(/.*(?:\r?\n|$)/g) ?? [];
  let fence: { marker: "`" | "~"; length: number } | null = null;
  let result = "";

  for (const line of lines) {
    if (!line) {
      continue;
    }
    const fenceMatch = /^(?: {0,3})(`{3,}|~{3,})/.exec(line);
    if (fence) {
      result += line;
      const closingFenceMatch = /^(?: {0,3})(`{3,}|~{3,})[ \t]*(?:\r?\n)?$/.exec(line);
      if (
        closingFenceMatch &&
        closingFenceMatch[1]?.startsWith(fence.marker) &&
        closingFenceMatch[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0];
      if (marker === "`" || marker === "~") {
        fence = { marker, length: fenceMatch[1]?.length ?? 3 };
      }
      result += line;
      continue;
    }
    if (/^(?: {4}|\t)/.test(line)) {
      result += line;
      continue;
    }
    result += mapInlineProse(line, transform);
  }

  return result;
}

function mapInlineProse(line: string, transform: (prose: string) => string) {
  let cursor = 0;
  let proseStart = 0;
  let result = "";
  while (cursor < line.length) {
    if (line[cursor] !== "`" || (cursor > 0 && line[cursor - 1] === "\\")) {
      cursor += 1;
      continue;
    }
    let runLength = 1;
    while (line[cursor + runLength] === "`") {
      runLength += 1;
    }
    const closing = findClosingBacktickRun(line, cursor + runLength, runLength);
    if (closing < 0) {
      cursor += runLength;
      continue;
    }
    result += transform(line.slice(proseStart, cursor));
    result += line.slice(cursor, closing + runLength);
    cursor = closing + runLength;
    proseStart = cursor;
  }
  result += transform(line.slice(proseStart));
  return result;
}

function findClosingBacktickRun(line: string, start: number, expectedLength: number) {
  let cursor = start;
  while (cursor < line.length) {
    const runStart = line.indexOf("`", cursor);
    if (runStart < 0) {
      return -1;
    }
    let runLength = 1;
    while (line[runStart + runLength] === "`") {
      runLength += 1;
    }
    if (runLength === expectedLength) {
      return runStart;
    }
    cursor = runStart + runLength;
  }
  return -1;
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
