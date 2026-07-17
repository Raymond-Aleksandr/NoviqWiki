import { describe, expect, it } from "vitest";
import { buildPageCitations } from "@/modules/pages/citations";

describe("page citations", () => {
  it("builds stable citation formats for a permanent revision", () => {
    const citations = buildPageCitations({
      pageTitle: "Design Reference",
      revisionNumber: 7,
      revisionCreatedAt: new Date("2026-07-16T18:48:00.000Z"),
      siteName: "NoviqWiki E2E",
      baseUrl: "https://wiki.example.test/base",
      pageSlug: "design-reference",
      accessedAt: new Date("2026-07-17T04:00:00.000Z")
    });

    expect(citations.canonicalUrl).toBe(
      "https://wiki.example.test/page/design-reference?revision=7"
    );
    expect(citations.apa).toContain(
      "NoviqWiki contributors. (2026, July 16). Design Reference. NoviqWiki E2E."
    );
    expect(citations.apa).toContain("Retrieved July 17, 2026, from");
    expect(citations.mla).toContain('"Design Reference." NoviqWiki E2E, Jul 16 2026');
    expect(citations.chicago).toBe(
      'NoviqWiki E2E. "Design Reference." Last modified July 16, 2026. https://wiki.example.test/page/design-reference?revision=7.'
    );
    expect(citations.bibtex).toContain("@misc{noviqwiki_e2e_design_reference_2026,");
    expect(citations.bibtex).toContain("note = {Revision 7; accessed July 17, 2026}");
  });

  it("escapes BibTeX-sensitive title characters", () => {
    const citations = buildPageCitations({
      pageTitle: "Use {braces} and \\slashes",
      revisionNumber: 1,
      revisionCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      siteName: "NoviqWiki",
      baseUrl: "https://wiki.example.test",
      pageSlug: "escaping",
      accessedAt: new Date("2026-01-02T00:00:00.000Z")
    });

    expect(citations.bibtex).toContain("title = {Use \\{braces\\} and \\\\slashes}");
  });
});
