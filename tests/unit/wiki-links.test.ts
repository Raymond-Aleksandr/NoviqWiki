import { describe, expect, it } from "vitest";
import { parseWikiLinks, replaceWikiLinksWithMarkdown } from "@/modules/rendering/wiki-links";

describe("wiki links", () => {
  it("extracts internal links, aliases, and categories", () => {
    const result = parseWikiLinks("[[Home]] [[Project Plan|plan]] [[Category:Guides]]");
    expect(result.links).toEqual([
      { target: "Home", normalizedTarget: "home", label: "Home" },
      { target: "Project Plan", normalizedTarget: "project plan", label: "plan" }
    ]);
    expect(result.categories).toEqual([
      { name: "Guides", normalizedName: "guides", slug: "guides" }
    ]);
  });

  it("rewrites wiki links to Markdown links and removes category declarations", () => {
    expect(replaceWikiLinksWithMarkdown("[[Home|Start]] [[Category:Guides]]")).toContain(
      "[Start](/page/home"
    );
  });
});
