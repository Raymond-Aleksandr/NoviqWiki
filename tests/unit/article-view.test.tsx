import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleView } from "@/components/article/article-view";
import type { Page, PageRevision } from "@/db/schema";
import { en } from "@/i18n/en";

describe("ArticleView", () => {
  it("renders redirect origin when a page was resolved through an alias", () => {
    const html = renderToStaticMarkup(
      <ArticleView
        page={page}
        revision={revision}
        redirectedFrom="old-topic"
        locale="en"
        messages={en}
      />
    );

    expect(html).toContain("Redirected from");
    expect(html).toContain("/page/old-topic");
  });

  it("marks historical revisions and links back to the current revision", () => {
    const html = renderToStaticMarkup(
      <ArticleView
        page={page}
        revision={revision}
        currentRevisionNumber={2}
        locale="en"
        messages={en}
      />
    );

    expect(html).toContain("Historical revision");
    expect(html).toContain("You are viewing an old revision of this page.");
    expect(html).toContain("/page/moved-topic");
  });

  it("shows the page protection state in article information", () => {
    const html = renderToStaticMarkup(
      <ArticleView
        page={{ ...page, protectionLevel: "protected" }}
        revision={revision}
        locale="en"
        messages={en}
      />
    );

    expect(html).toContain(en.pageProtected);
  });

  it("renders missing wiki links as page creation links for authorized users", () => {
    const html = renderToStaticMarkup(
      <ArticleView
        page={page}
        revision={{
          ...revision,
          html: '<p><a href="/page/missing-topic" title="wiki-link:Missing Topic">missing</a></p>'
        }}
        canCreatePage
        outboundLinks={[
          {
            targetTitle: "Missing Topic",
            label: "missing",
            targetPageId: null,
            targetSlug: null,
            exists: false
          }
        ]}
        locale="en"
        messages={en}
      />
    );

    expect(html).toContain("/edit/new?title=Missing%20Topic");
    expect(html).toContain("wiki-link-missing");
  });

  it("renders a read-time media URL rewrite without mutating the revision", () => {
    const html = renderToStaticMarkup(
      <ArticleView
        page={page}
        revision={revision}
        renderedHtml={'<p><img src="/media/site/image.png" alt="cover"></p>'}
        locale="en"
        messages={en}
      />
    );

    expect(html).toContain("/media/site/image.png");
    expect(revision.html).toBe("<p>Moved body.</p>");
  });
});

const now = new Date("2026-07-16T12:00:00Z");

const page: Page = {
  id: "11111111-1111-4111-8111-111111111111",
  siteId: "22222222-2222-4222-8222-222222222222",
  title: "Moved Topic",
  normalizedTitle: "moved topic",
  slug: "moved-topic",
  currentRevisionId: "33333333-3333-4333-8333-333333333333",
  status: "published",
  protectionLevel: "none",
  creatorId: "44444444-4444-4444-8444-444444444444",
  deletedAt: null,
  deletedById: null,
  archivedAt: null,
  createdAt: now,
  updatedAt: now
};

const revision: PageRevision = {
  id: "33333333-3333-4333-8333-333333333333",
  pageId: page.id,
  parentRevisionId: null,
  revisionNumber: 1,
  markdown: "# Moved Topic",
  html: "<p>Moved body.</p>",
  plainText: "Moved body.",
  contentHash: "hash",
  editorId: page.creatorId,
  editorDisplayName: "Owner",
  editSummary: "Initial",
  state: "published",
  headings: [],
  categories: [],
  outboundLinks: [],
  createdAt: now
};
