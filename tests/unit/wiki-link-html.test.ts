import { describe, expect, it } from "vitest";
import { decorateWikiLinkHtml } from "@/modules/rendering/wiki-link-html";
import type { PageOutboundLink } from "@/modules/pages/service";

describe("wiki link HTML decoration", () => {
  it("marks existing wiki links and refreshes the href to the resolved page slug", () => {
    const html = decorateWikiLinkHtml(
      '<p><a href="/page/old-title" title="wiki-link:Old Title">old page</a></p>',
      [
        {
          targetTitle: "Old Title",
          label: "old page",
          targetPageId: "page-id",
          targetSlug: "new-title",
          exists: true
        }
      ],
      true
    );

    expect(html).toContain('href="/page/new-title"');
    expect(html).toContain('class="wiki-link wiki-link-exists"');
    expect(html).toContain('data-wiki-state="exists"');
  });

  it("marks missing wiki links and offers page creation to authorized users", () => {
    const html = decorateWikiLinkHtml(
      '<p><a href="/page/missing-topic" title="wiki-link:Missing Topic">missing</a></p>',
      [missingLink()],
      true
    );

    expect(html).toContain('href="/edit/new?title=Missing%20Topic"');
    expect(html).toContain('class="wiki-link wiki-link-missing"');
    expect(html).toContain('data-wiki-state="missing"');
  });

  it("keeps missing wiki links read-only when page creation is not allowed", () => {
    const html = decorateWikiLinkHtml(
      '<p><a href="/page/missing-topic" title="wiki-link:Missing Topic">missing</a></p>',
      [missingLink()],
      false
    );

    expect(html).toContain('href="/page/missing-topic"');
    expect(html).not.toContain("/edit/new");
    expect(html).toContain('class="wiki-link wiki-link-missing"');
  });
});

function missingLink(): PageOutboundLink {
  return {
    targetTitle: "Missing Topic",
    label: "missing",
    targetPageId: null,
    targetSlug: null,
    exists: false
  };
}
