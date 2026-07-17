# NoviqWiki Content Format

Markdown is the canonical source format for NoviqWiki pages. Every saved edit creates an immutable revision containing the original Markdown, sanitized rendered HTML, and searchable plain text.

NoviqWiki v0.1.0 does not implement MediaWiki syntax, MediaWiki extensions, MediaWiki templates, migration behavior, or MediaWiki API compatibility.

## Page Source

Authors edit Markdown. Store the source exactly enough to preserve author intent, then derive display and search fields through the renderer.

Each revision should include:

- Page ID.
- Revision ID.
- Author ID.
- Markdown source.
- Sanitized rendered HTML.
- Searchable plain text.
- Edit summary.
- Created timestamp.

Do not mutate historical revisions. To change a page, create a new revision.

## Supported Markdown

v0.1.0 supports the Markdown features provided by the project renderer:

- CommonMark paragraphs, headings, lists, blockquotes, links, and images.
- GitHub Flavored Markdown tables, strikethrough, autolinks, and task lists.
- Fenced code blocks with syntax highlighting.
- Inline code.
- Math blocks and inline math rendered with KaTeX.
- Heading anchors generated from rendered heading text.

## Links and Categories

Use standard Markdown links:

```markdown
[Display text](/page/getting-started)
[External site](https://example.com)
```

Use wiki links for internal page references:

```markdown
[[Getting Started]]
[[Getting Started|start here]]
```

Wiki links resolve to `/page/{slug}` when the target page exists. Missing internal links render with a distinct missing-link state, and users with page creation permission can open a pre-filled new-page form from the missing link. The `/special` index groups browsing, content-maintenance, and authorized administration entry points. The `/wanted` maintenance page lists missing targets that are linked from published visible pages and removes them automatically once the target page is published. The `/orphaned` maintenance page lists published pages that currently have no inbound links from other published pages. The `/dead-end` maintenance page lists published pages that currently do not link to another published page. The `/short-pages` maintenance page lists published non-redirect pages below a selected readable-text length threshold. The `/protected-pages` maintenance page lists published pages with edit protection enabled. The `/uncategorized` maintenance page lists published pages without any category membership.

Categories are declared with wiki-link category declarations:

```markdown
[[Category:Operations]]
```

Published revisions update category membership, backlinks, outbound links, and search metadata transactionally.

## Redirect Pages

Create a redirect page by making the first non-empty source line a redirect directive:

```markdown
#REDIRECT [[Target Page]]
#重定向 [[目标页面]]
```

Redirect pages keep their own immutable revision history. Public article browsing resolves redirect pages server-side to the target page and displays the redirect origin. Editing, history, and backlinks routes can still address the redirect source page directly so maintainers can inspect or change it. The `/redirects` maintenance page lists published redirect pages and flags valid targets, double redirects, and missing or non-public targets.

The publish pipeline rejects redirect loops that can be detected from the current page graph, and runtime page resolution also enforces loop and depth limits.

## Media and Attachments

Use Markdown image syntax for embedded images:

```markdown
![Architecture diagram](/media/architecture.png)
```

Uploaded media must be validated by size, detected MIME type, filename, storage key, and the configured allowlist. Prefer descriptive alt text for accessibility.

## Code Blocks

Use fenced code blocks with a language identifier:

````markdown
```ts
export function title(value: string) {
  return value.trim();
}
```
````

The renderer may highlight recognized languages. Unknown languages should render as plain code.

## Math

Use inline math for short expressions and fenced or block math for larger formulas:

```markdown
Inline: $a^2 + b^2 = c^2$

$$
E = mc^2
$$
```

Rendered math must still pass through the sanitization pipeline.

## Sanitization

Rendered HTML is stored only after sanitization. The sanitizer must remove unsafe tags, event handlers, JavaScript URLs, and attributes that can execute script or break page isolation.

Raw HTML is disabled by default. Do not render unsanitized Markdown directly into React with `dangerouslySetInnerHTML`.

## Search Text

Searchable plain text is derived from the rendered content. It should exclude markup and unsafe HTML while preserving the visible words users expect to search for.

Search indexes should point at page and revision records, not replace the canonical Markdown source.

## Slugs and Headings

Page slugs should be URL-safe and stable. Heading IDs should be generated from heading text and deduplicated inside the document.

Changing a heading may change its anchor. For important links, prefer stable page-level routes over deep heading links.

## Authoring Guidelines

- Use one top-level heading per page when possible.
- Prefer descriptive link text over raw URLs.
- Add alt text for images.
- Keep edit summaries concise and specific.
- Use tables only where tabular comparison is useful.
- Do not paste arbitrary HTML from untrusted sources.
