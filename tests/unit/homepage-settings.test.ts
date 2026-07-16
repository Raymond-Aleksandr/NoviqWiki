import { describe, expect, it } from "vitest";
import { normalizeHomepageSections, prioritizeCategories } from "@/modules/settings/homepage";

describe("homepage settings", () => {
  it("uses the release defaults when homepage sections are not configured", () => {
    expect(normalizeHomepageSections()).toEqual({
      search: true,
      featured: true,
      recent: true,
      categories: true,
      layout: "classic",
      showLogo: true
    });
  });

  it("preserves explicit section visibility and layout choices", () => {
    expect(
      normalizeHomepageSections({
        search: false,
        featured: false,
        recent: true,
        categories: false,
        layout: "compact",
        showLogo: false
      })
    ).toEqual({
      search: false,
      featured: false,
      recent: true,
      categories: false,
      layout: "compact",
      showLogo: false
    });
  });

  it("falls back to the classic layout for invalid stored layout values", () => {
    expect(normalizeHomepageSections({ layout: "wide" }).layout).toBe("classic");
  });

  it("prioritizes configured categories without duplicating repeated slugs", () => {
    const categories = [
      { slug: "alpha", name: "Alpha" },
      { slug: "beta", name: "Beta" },
      { slug: "gamma", name: "Gamma" }
    ];

    expect(
      prioritizeCategories(categories, [" beta ", "missing", "alpha", "beta"]).map(
        (category) => category.slug
      )
    ).toEqual(["beta", "alpha", "gamma"]);
  });
});
