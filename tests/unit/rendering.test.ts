import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/modules/rendering/markdown";

describe("Markdown rendering", () => {
  it("sanitizes raw HTML and extracts headings/categories", async () => {
    const rendered = await renderMarkdown(
      "# Hello\n\n<script>alert(1)</script>\n\n[[Category:Docs]]"
    );
    expect(rendered.html).toContain("<h1");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.plainText).toContain("Hello");
    expect(rendered.categories[0]?.name).toBe("Docs");
    expect(rendered.headings[0]?.text).toBe("Hello");
  });

  it("supports tables, task lists, footnotes, and math", async () => {
    const rendered = await renderMarkdown(
      "- [x] task\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n$E=mc^2$\n\nnote[^1]\n\n[^1]: footnote"
    );
    expect(rendered.html).toContain("<table>");
    expect(rendered.html).toContain("katex");
    expect(rendered.html).toContain("footnote");
  });
});
