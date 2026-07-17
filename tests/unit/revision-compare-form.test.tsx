import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RevisionCompareForm } from "@/components/article/revision-compare-form";
import { en } from "@/i18n/en";

describe("RevisionCompareForm", () => {
  it("renders arbitrary revision comparison controls", () => {
    const html = renderToStaticMarkup(
      <RevisionCompareForm
        pageSlug="topic"
        revisions={[
          revision("new", 3, "Latest"),
          revision("middle", 2, "Middle"),
          revision("old", 1, "Initial")
        ]}
        locale="en"
        messages={en}
      />
    );

    expect(html).toContain('action="/history/topic/compare"');
    expect(html).toContain('name="from"');
    expect(html).toContain('name="to"');
    expect(html).toContain("Compare selected revisions");
    expect(html).toContain("r3");
    expect(html).toContain("r1");
  });

  it("does not render when a page has fewer than two revisions", () => {
    const html = renderToStaticMarkup(
      <RevisionCompareForm
        pageSlug="topic"
        revisions={[revision("only", 1, "Initial")]}
        locale="en"
        messages={en}
      />
    );

    expect(html).toBe("");
  });
});

function revision(id: string, revisionNumber: number, editSummary: string) {
  return {
    id,
    revisionNumber,
    editSummary,
    editorDisplayName: "Owner",
    createdAt: new Date("2026-07-16T12:00:00Z")
  };
}
