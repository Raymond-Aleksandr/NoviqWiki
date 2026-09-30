import assert from "node:assert/strict";
import { test } from "node:test";
import {
  discoveryHref,
  discoveryPagination,
  pagePrefix,
  paginationNavigation,
  queryValue,
  shortPageThreshold,
  totalPageCount
} from "../../src/features/discovery/query";

test("query normalization trims the first value of repeated parameters", () => {
  assert.equal(queryValue(undefined), "");
  assert.equal(queryValue([]), "");
  assert.equal(queryValue("  knowledge  "), "knowledge");
  assert.equal(queryValue(["  first  ", "second"]), "first");
  assert.equal(queryValue([" ", "second"]), "");
  assert.equal(discoveryPagination([" 3 ", "7"], 50).page, 3);
});

test("invalid, noninteger and nonfinite page requests start at the first page", () => {
  for (const request of [undefined, "", "0", "-1", "1.5", "2.0", "NaN", "Infinity", "-Infinity", "1e3", "0x10", "1 page", "9007199254740992", "9999999999999999999999999999999999999"]) {
    assert.deepEqual(discoveryPagination(request, 50), { page: 1, limit: 50, offset: 0 }, String(request));
  }
});

test("valid page requests use the supplied limit and preserve a safe integer offset", () => {
  assert.deepEqual(discoveryPagination(" 4 ", 25), { page: 4, limit: 25, offset: 75 });
  assert.deepEqual(discoveryPagination("0002", 50), { page: 2, limit: 50, offset: 50 });
  for (const pageSize of [1, 25, 50, 100, 1000]) {
    const maxPage = Math.floor(2_147_483_647 / pageSize) + 1;
    const boundary = discoveryPagination(String(maxPage), pageSize);
    assert.equal(boundary.page, maxPage);
    assert.ok(Number.isSafeInteger(boundary.offset));
    assert.ok(boundary.offset <= 2_147_483_647);
    assert.equal(discoveryPagination(String(maxPage + 1), pageSize).page, 1);
  }
});

test("query links omit unset filters and canonicalize the first page", () => {
  assert.equal(discoveryHref("/pages"), "/pages");
  assert.equal(discoveryHref("/pages", { q: "", prefix: undefined, page: 1 }), "/pages");
  assert.equal(discoveryHref("/pages", { q: "wiki", prefix: "W", page: 1 }), "/pages?q=wiki&prefix=W");
  assert.equal(discoveryHref("/pages", { page: 2 }), "/pages?page=2");
});

test("filters are escaped as query data without becoming extra parameters or fragments", () => {
  const query = "中文 & page=100 /? # +";
  const category = "A/B & q=other";
  const href = discoveryHref("/search", { q: query, category, page: 3 });
  const url = new URL(href, "https://wiki.example");
  assert.equal(url.pathname, "/search");
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.get("q"), query);
  assert.equal(url.searchParams.get("category"), category);
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(url.searchParams.size, 3);
});

test("page counts include a first page for empty collections and round up partial pages", () => {
  assert.equal(totalPageCount(0, 50), 1);
  assert.equal(totalPageCount(1, 50), 1);
  assert.equal(totalPageCount(50, 50), 1);
  assert.equal(totalPageCount(51, 50), 2);
  assert.equal(totalPageCount(150, 50), 3);
});

test("pagination retains filters and stays on the collection bounds", () => {
  assert.deepEqual(paginationNavigation("/pages", 1, 3, { q: "wiki", prefix: "W" }), {
    page: 1,
    totalPages: 3,
    previousHref: "/pages?q=wiki&prefix=W",
    nextHref: "/pages?q=wiki&prefix=W&page=2"
  });
  assert.deepEqual(paginationNavigation("/recent", 3, 3, { filter: "edited" }), {
    page: 3,
    totalPages: 3,
    previousHref: "/recent?filter=edited&page=2",
    nextHref: "/recent?filter=edited&page=3"
  });
  assert.deepEqual(paginationNavigation("/pages", 1, 1), {
    page: 1,
    totalPages: 1,
    previousHref: "/pages",
    nextHref: "/pages"
  });
});

test("page prefixes and short-page thresholds normalize repeated and invalid filters", () => {
  assert.equal(pagePrefix([" apple ", "zebra"]), "A");
  assert.equal(pagePrefix("z"), "Z");
  for (const value of [undefined, "", "1", "中", "é", "!"]) assert.equal(pagePrefix(value), undefined);
  assert.equal(shortPageThreshold([" 200 ", "1200"]), 200);
  assert.equal(shortPageThreshold("1200"), 1200);
  for (const value of [undefined, "", "-200", "200.5", "Infinity", "2e2", "500", "999999999999999999999"]) {
    assert.equal(shortPageThreshold(value), 600);
  }
});
