import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAppearance, resolveLocale } from "../../src/lib/preferences";

test("valid locale cookies override account, browser and site preferences", () => {
  assert.equal(resolveLocale({ cookieLocale: "en", userLocale: "zh-CN", acceptLanguage: "zh-CN", defaultLocale: "zh-CN" }), "en");
  assert.equal(resolveLocale({ cookieLocale: "zh-CN", userLocale: "en", acceptLanguage: "en", defaultLocale: "en" }), "zh-CN");
});

test("account locale overrides browser and site when the cookie is absent or invalid", () => {
  for (const cookieLocale of [undefined, null, "", "invalid", "EN", "zh"]) {
    assert.equal(resolveLocale({ cookieLocale, userLocale: "zh-CN", acceptLanguage: "en", defaultLocale: "en" }), "zh-CN");
  }
});

test("Accept-Language chooses the highest weighted supported browser language", () => {
  assert.equal(resolveLocale({ acceptLanguage: "fr-FR, en-US;q=0.6, zh-CN;q=0.9", defaultLocale: "en" }), "zh-CN");
  assert.equal(resolveLocale({ acceptLanguage: "zh-CN;q=0.4, en-CA;q=0.9", defaultLocale: "zh-CN" }), "en");
  assert.equal(resolveLocale({ cookieLocale: "fr", userLocale: "de", acceptLanguage: "EN-CA;q=0.8, ZH-CN;q=0.6" }), "en");
});

test("unweighted browser languages have quality 1 and equal weights preserve header order", () => {
  assert.equal(resolveLocale({ acceptLanguage: "zh;q=0.9, en-GB", defaultLocale: "zh-CN" }), "en");
  assert.equal(resolveLocale({ acceptLanguage: "zh-CN;q=0.8, en;q=0.8" }), "zh-CN");
  assert.equal(resolveLocale({ acceptLanguage: "en;q=0.8, zh-CN;q=0.8" }), "en");
});

test("explicitly rejected browser languages are ignored", () => {
  assert.equal(resolveLocale({ acceptLanguage: "en;q=0, zh-CN;q=0.5", defaultLocale: "en" }), "zh-CN");
  assert.equal(resolveLocale({ acceptLanguage: "zh-CN;q=0, en;q=0", defaultLocale: "zh-CN" }), "zh-CN");
});

test("malformed quality values cannot override the site default", () => {
  for (const acceptLanguage of ["en;q=NaN", "en;q=-1", "en;q=1.5", "en;q=Infinity", "en;q=invalid", "en;q="]) {
    assert.equal(resolveLocale({ acceptLanguage, defaultLocale: "zh-CN" }), "zh-CN", acceptLanguage);
  }
  assert.equal(resolveLocale({ acceptLanguage: "en;q=invalid, zh-CN;q=0.7", defaultLocale: "en" }), "zh-CN");
});

test("missing and unsupported browser preferences fall back to the validated site default", () => {
  for (const acceptLanguage of [undefined, null, "", "fr-FR,de;q=0.8", "*", "not-a-language"]) {
    assert.equal(resolveLocale({ acceptLanguage, defaultLocale: "zh-CN" }), "zh-CN");
  }
  for (const defaultLocale of [undefined, null, "", "invalid", "EN", "zh"]) {
    assert.equal(resolveLocale({ acceptLanguage: "fr", defaultLocale }), "en");
  }
});

test("explicit appearance cookies override account appearance", () => {
  assert.equal(resolveAppearance("light", "dark"), "light");
  assert.equal(resolveAppearance("dark", "light"), "dark");
});

test("missing or invalid appearance cookies fall back to account preference", () => {
  for (const cookieAppearance of [undefined, null, "", "system", "invalid", "DARK"]) {
    assert.equal(resolveAppearance(cookieAppearance, "dark"), "dark");
    assert.equal(resolveAppearance(cookieAppearance, "light"), "light");
  }
});

test("appearance defaults to light when neither preference is supported", () => {
  for (const userAppearance of [undefined, null, "", "system", "invalid", "DARK"]) {
    assert.equal(resolveAppearance("invalid", userAppearance), "light");
  }
});
