import { describe, expect, it } from "vitest";
import { normalizeTitle, slugifyTitle } from "@/lib/normalize";
import { derivePageIdentity } from "@/modules/pages/title";

describe("title normalization", () => {
  it("normalizes title whitespace and case", () => {
    expect(normalizeTitle("  Hello   Wiki  ")).toBe("hello wiki");
  });

  it("creates stable slugs", () => {
    expect(slugifyTitle("Hello, Next Wiki!")).toBe("hello-next-wiki");
    expect(slugifyTitle("次世代 Wiki")).toBe("次世代-wiki");
  });

  it("validates page identity", () => {
    expect(derivePageIdentity("Project Home")).toMatchObject({
      title: "Project Home",
      normalizedTitle: "project home",
      slug: "project-home"
    });
    expect(() => derivePageIdentity("Project Home", "s".repeat(241))).toThrow(
      "Slug must be 240 characters or less."
    );
  });
});
