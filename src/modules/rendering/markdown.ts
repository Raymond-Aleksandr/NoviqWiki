import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  parseWikiLinks,
  replaceWikiLinksWithMarkdown,
  type CategoryDeclaration,
  type WikiLink
} from "./wiki-links";

export type RenderedHeading = {
  depth: number;
  id: string;
  text: string;
};

export type RenderedMarkdown = {
  html: string;
  plainText: string;
  headings: RenderedHeading[];
  categories: CategoryDeclaration[];
  links: WikiLink[];
};

const safeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "id",
      "dataLine",
      "ariaHidden",
      "ariaLabel"
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "href",
      "title",
      "rel",
      "target",
      "className",
      "dataWikiTarget"
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "src",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "decoding"
    ],
    span: [...(defaultSchema.attributes?.span ?? []), "className", "style"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "className"],
    input: [...(defaultSchema.attributes?.input ?? []), "type", "checked", "disabled"]
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"]
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "section",
    "article",
    "input",
    "math",
    "semantics",
    "mrow",
    "mi",
    "mn",
    "mo",
    "msup",
    "msub",
    "mfrac",
    "annotation"
  ]
};

export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
  const extensionMetadata = parseWikiLinks(markdown);
  const prepared = replaceWikiLinksWithMarkdown(markdown);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeHighlight)
    .use(rehypeSanitize, safeSchema)
    .use(rehypeStringify)
    .process(prepared);

  const html = String(file);
  return {
    html,
    plainText: htmlToPlainText(html),
    headings: extractHeadingsFromHtml(html),
    categories: extensionMetadata.categories,
    links: extensionMetadata.links
  };
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadingsFromHtml(html: string): RenderedHeading[] {
  const headings: RenderedHeading[] = [];
  const pattern = /<h([1-6]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  for (const match of html.matchAll(pattern)) {
    headings.push({
      depth: Number(match[1]),
      id: match[2] ?? "",
      text: htmlToPlainText(match[3] ?? "")
    });
  }
  return headings;
}
