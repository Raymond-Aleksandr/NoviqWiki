import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { getSpecialPageSections } from "@/modules/pages/special-pages";

describe("special pages", () => {
  it("groups public browsing and maintenance pages without admin links by default", () => {
    const sections = getSpecialPageSections(en);

    expect(sections.map((section) => section.id)).toEqual(["browse", "maintenance"]);
    expect(sections.flatMap((section) => section.links.map((link) => link.href))).toEqual([
      "/search",
      "/pages",
      "/recent",
      "/categories",
      "/media",
      "/wanted",
      "/orphaned",
      "/dead-end",
      "/short-pages",
      "/protected-pages",
      "/uncategorized",
      "/redirects"
    ]);
  });

  it("adds the administration section only for site administrators", () => {
    const sections = getSpecialPageSections(en, { includeAdmin: true });
    const administration = sections.find((section) => section.id === "administration");

    expect(administration?.links.map((link) => link.href)).toEqual([
      "/admin",
      "/admin/pages",
      "/admin/users",
      "/admin/groups",
      "/admin/roles",
      "/admin/settings",
      "/admin/audit",
      "/admin/status"
    ]);
  });
});
