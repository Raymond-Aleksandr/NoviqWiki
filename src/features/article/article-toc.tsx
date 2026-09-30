import type { Messages } from "@/i18n";
import { headingHref } from "./article-html";
import type { ArticleHeading } from "./types";

type TocEntry = ArticleHeading & { children: TocEntry[] };

export function ArticleToc({
  headings,
  messages
}: {
  headings: ArticleHeading[];
  messages: Pick<Messages, "tableOfContents" | "contents">;
}) {
  if (headings.length === 0) return null;
  return (
    <nav className="toc toc-card" aria-label={messages.tableOfContents}>
      <strong>{messages.contents}</strong>
      <TocList entries={createToc(headings)} />
    </nav>
  );
}

function TocList({ entries }: { entries: TocEntry[] }) {
  return (
    <ol className="article-toc-list" role="list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a href={headingHref(entry.id)}>{entry.text}</a>
          {entry.children.length > 0 ? <TocList entries={entry.children} /> : null}
        </li>
      ))}
    </ol>
  );
}

function createToc(headings: ArticleHeading[]) {
  const entries: TocEntry[] = [];
  const ancestors: TocEntry[] = [];
  for (const heading of headings) {
    const entry: TocEntry = { ...heading, children: [] };
    while (ancestors.length > 0 && ancestors[ancestors.length - 1]!.depth >= heading.depth) {
      ancestors.pop();
    }
    const parent = ancestors[ancestors.length - 1];
    (parent ? parent.children : entries).push(entry);
    ancestors.push(entry);
  }
  return entries;
}
