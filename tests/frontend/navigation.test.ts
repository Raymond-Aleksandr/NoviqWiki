import assert from "node:assert/strict";
import { test } from "node:test";
import { getSiteNavigation, type SiteNavigationMessages } from "../../src/components/layout/navigation";

const messages: SiteNavigationMessages = {
  read: "Read",
  recentChanges: "Recent changes",
  pages: "Pages",
  categories: "Categories",
  media: "Media",
  specialPages: "Special pages",
  admin: "Admin",
  siteNavigation: "Site navigation"
};

function activeLinks(pathname: string, canAdmin = true) {
  return getSiteNavigation(pathname, messages, canAdmin)
    .filter((link) => link.active)
    .map((link) => link.href);
}

test("article reading and revision workflows share the Read navigation item", () => {
  for (const pathname of ["/", "/page", "/page/article", "/page/article/backlinks", "/edit/new", "/edit/article", "/history/article", "/diff/from/to"]) {
    assert.deepEqual(activeLinks(pathname), ["/"], pathname);
    assert.deepEqual(activeLinks(pathname, false), ["/"], `${pathname} without admin permission`);
  }
});

test("matching distinguishes /page from /pages and highlights each collection", () => {
  for (const [pathname, href] of [
    ["/pages", "/pages"],
    ["/pages/nested", "/pages"],
    ["/categories/topic", "/categories"],
    ["/recent", "/recent"],
    ["/media/folder/image.png", "/media"],
    ["/admin", "/admin"],
    ["/admin/settings", "/admin"]
  ]) {
    assert.deepEqual(activeLinks(pathname), [href], pathname);
  }
});

test("similar prefixes never highlight unrelated routes", () => {
  for (const pathname of ["/page-extra", "/pages-extra", "/admin-extra", "/editor", "/history-extra", "/difference", "/categories-extra", "/recent-extra", "/media-extra", "/special-extra", "/watchlist-extra"]) {
    assert.deepEqual(activeLinks(pathname), [], pathname);
  }
});

test("every report and its descendants belong to Special pages", () => {
  for (const pathname of ["/special", "/wanted", "/orphaned", "/dead-end", "/short-pages", "/protected-pages", "/uncategorized", "/redirects", "/watchlist"]) {
    assert.deepEqual(activeLinks(pathname), ["/special"], pathname);
    assert.deepEqual(activeLinks(`${pathname}/nested`), ["/special"], `${pathname}/nested`);
  }
});

test("admin visibility requires the site configuration permission", () => {
  assert.equal(getSiteNavigation("/admin", messages, true).filter((link) => link.href === "/admin").length, 1);
  assert.equal(getSiteNavigation("/admin", messages, false).some((link) => link.href === "/admin"), false);
  assert.deepEqual(activeLinks("/admin/settings", false), []);
  assert.deepEqual(
    getSiteNavigation("/", messages, true).filter((link) => link.href !== "/admin").map((link) => link.href),
    getSiteNavigation("/", messages, false).map((link) => link.href)
  );
});

test("navigation labels use the supplied dictionary", () => {
  const translated = { ...messages, read: "阅读", admin: "管理" };
  const navigation = getSiteNavigation("/", translated, true);
  assert.equal(navigation.find((link) => link.href === "/")?.label, "阅读");
  assert.equal(navigation.find((link) => link.href === "/admin")?.label, "管理");
});
