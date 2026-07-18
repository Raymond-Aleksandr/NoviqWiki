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

  it("does not extract or rewrite wiki syntax inside code", () => {
    const markdown = [
      "`[[Inline Example]]` [[Real Page]]",
      "",
      "```md",
      "[[Category:Example]]",
      "[[Fenced Example]]",
      "```"
    ].join("\n");
    const parsed = parseWikiLinks(markdown);
    expect(parsed.links.map((link) => link.target)).toEqual(["Real Page"]);
    expect(parsed.categories).toEqual([]);

    const replaced = replaceWikiLinksWithMarkdown(markdown);
    expect(replaced).toContain("`[[Inline Example]]`");
    expect(replaced).toContain("[[Category:Example]]\n[[Fenced Example]]");
    expect(replaced).toContain("[Real Page](/page/real-page");
  });

  it("does not close fenced code when a fence marker has trailing content", () => {
    const markdown = [
      "```md",
      "```not-a-closing-fence",
      "[[Category:Secret]] [[Still Code]]",
      "```   ",
      "[[Visible Page]]"
    ].join("\n");

    const parsed = parseWikiLinks(markdown);
    expect(parsed.links.map((link) => link.target)).toEqual(["Visible Page"]);
    expect(parsed.categories).toEqual([]);
    expect(replaceWikiLinksWithMarkdown(markdown)).toContain("[[Category:Secret]] [[Still Code]]");
  });

  it("requires an exact backtick run length to close an inline code span", () => {
    const markdown = "``[[Hidden Before]]```[[Hidden After Longer Run]]`` [[Visible Page]]";

    const parsed = parseWikiLinks(markdown);
    expect(parsed.links.map((link) => link.target)).toEqual(["Visible Page"]);
    expect(replaceWikiLinksWithMarkdown(markdown)).toContain(
      "``[[Hidden Before]]```[[Hidden After Longer Run]]``"
    );
  });
});
