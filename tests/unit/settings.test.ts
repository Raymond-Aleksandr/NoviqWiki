import { describe, expect, it } from "vitest";
import {
  MAX_FEATURED_ITEMS,
  MAX_MEDIA_UPLOAD_BYTES,
  MAX_SEO_DESCRIPTION_LENGTH,
  MAX_SETTINGS_TEXT_LENGTH,
  MAX_SETTINGS_URL_LENGTH,
  normalizeAllowedMediaTypes,
  settingsFormSchema,
  siteSettingsUpdateSchema
} from "@/modules/settings/schemas";
import { updateSiteSettings } from "@/modules/settings/service";

function validSettingsFormInput(overrides: Record<string, unknown> = {}) {
  return {
    tagline: "A wiki",
    baseUrl: "https://wiki.example.test",
    logoUrl: " /media/logo.png ",
    faviconUrl: "",
    defaultLocale: "en",
    publicMode: "on",
    registrationMode: "closed",
    defaultHomepage: "Home",
    homepageTitle: "Welcome",
    homepageIntro: "Introduction",
    homepageFeaturedPages: "start, about, start",
    homepageFeaturedCategories: "guides\nreference",
    homepageSearch: "on",
    homepageRecent: "on",
    homepageCategories: "on",
    homepageLayout: "compact",
    homepageShowLogo: "on",
    footerContent: " Footer ",
    uploadMaxBytes: "1024",
    allowedMediaTypes: "IMAGE/PNG\napplication/pdf",
    seoTitle: "",
    seoDescription: " Description ",
    ...overrides
  };
}

describe("site settings helpers", () => {
  it("normalizes allowed media MIME types", () => {
    expect(normalizeAllowedMediaTypes(" image/png,IMAGE/JPEG\napplication/pdf ")).toEqual([
      "image/png",
      "image/jpeg",
      "application/pdf"
    ]);
  });

  it("rejects empty, malformed, and active-content MIME type allowlists", () => {
    expect(() => normalizeAllowedMediaTypes("")).toThrow("at least one MIME type");
    expect(() => normalizeAllowedMediaTypes("not-a-mime")).toThrow("valid safe MIME");
    expect(() => normalizeAllowedMediaTypes("image/svg+xml")).toThrow("valid safe MIME");
    expect(() => normalizeAllowedMediaTypes("text/html")).toThrow("valid safe MIME");
    expect(() => normalizeAllowedMediaTypes("application/xhtml+xml")).toThrow("valid safe MIME");
    expect(() => normalizeAllowedMediaTypes("application/atom+xml")).toThrow("valid safe MIME");
  });

  it("accepts complete and partial setting updates and normalizes set-like arrays", () => {
    expect(
      siteSettingsUpdateSchema.parse({
        tagline: "A wiki",
        baseUrl: "https://wiki.example.test",
        logoUrl: "/media/logo.png",
        faviconUrl: "https://cdn.example.test/favicon.ico",
        defaultLocale: "zh-CN",
        defaultAppearance: "dark",
        publicMode: false,
        registrationMode: "email_verification",
        defaultHomepage: "Home",
        footerContent: "Footer",
        uploadMaxBytes: MAX_MEDIA_UPLOAD_BYTES,
        allowedMediaTypes: ["IMAGE/PNG", "image/png", "application/pdf"],
        homepageTitle: "Welcome",
        homepageIntro: "Introduction",
        homepageFeaturedPages: ["start", "start", "about"],
        homepageFeaturedCategories: ["guides", "guides"],
        homepageSections: {
          search: true,
          featured: true,
          recent: false,
          categories: true,
          layout: "portal",
          showLogo: true
        },
        seoTitle: "Wiki",
        seoDescription: "A useful wiki"
      })
    ).toMatchObject({
      allowedMediaTypes: ["image/png", "application/pdf"],
      homepageFeaturedPages: ["start", "about"],
      homepageFeaturedCategories: ["guides"]
    });
    expect(siteSettingsUpdateSchema.parse({ publicMode: true })).toEqual({ publicMode: true });
  });

  it.each([
    ["registrationMode", "invalid"],
    ["defaultLocale", "fr"],
    ["defaultAppearance", "sepia"]
  ])("rejects an unsupported %s enum value", (field, value) => {
    expect(() => siteSettingsUpdateSchema.parse({ [field]: value })).toThrow();
  });

  it("rejects unsupported layouts and unknown homepage section properties", () => {
    const requiredSections = {
      search: true,
      featured: true,
      recent: true,
      categories: true
    };
    expect(() =>
      siteSettingsUpdateSchema.parse({
        homepageSections: { ...requiredSections, layout: "wide" }
      })
    ).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({
        homepageSections: { ...requiredSections, unexpected: true }
      })
    ).toThrow();
  });

  it.each([
    ["tagline", 241],
    ["defaultHomepage", 221],
    ["homepageTitle", 221],
    ["seoTitle", 221]
  ])("enforces the database length for %s", (field, length) => {
    expect(() => siteSettingsUpdateSchema.parse({ [field]: "x".repeat(length) })).toThrow();
  });

  it("bounds text fields and featured arrays", () => {
    expect(() =>
      siteSettingsUpdateSchema.parse({ footerContent: "x".repeat(MAX_SETTINGS_TEXT_LENGTH + 1) })
    ).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({ homepageIntro: "x".repeat(MAX_SETTINGS_TEXT_LENGTH + 1) })
    ).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({
        seoDescription: "x".repeat(MAX_SEO_DESCRIPTION_LENGTH + 1)
      })
    ).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({
        homepageFeaturedPages: Array.from(
          { length: MAX_FEATURED_ITEMS + 1 },
          (_, index) => `page-${index}`
        )
      })
    ).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({ homepageFeaturedCategories: ["x".repeat(241)] })
    ).toThrow();
  });

  it("validates absolute and public URLs", () => {
    expect(siteSettingsUpdateSchema.parse({ logoUrl: "/media/logo.png" })).toEqual({
      logoUrl: "/media/logo.png"
    });
    expect(() => siteSettingsUpdateSchema.parse({ baseUrl: "/wiki" })).toThrow();
    expect(() => siteSettingsUpdateSchema.parse({ baseUrl: "ftp://wiki.example.test" })).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({ logoUrl: "//evil.example.test/logo.png" })
    ).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({ logoUrl: "/\\evil.example.test/logo.png" })
    ).toThrow();
    expect(() => siteSettingsUpdateSchema.parse({ faviconUrl: "javascript:alert(1)" })).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({ logoUrl: `/${"x".repeat(MAX_SETTINGS_URL_LENGTH)}` })
    ).toThrow();
  });

  it("enforces the upload limit and safe MIME array contract", () => {
    expect(() => siteSettingsUpdateSchema.parse({ uploadMaxBytes: 0 })).toThrow();
    expect(() => siteSettingsUpdateSchema.parse({ uploadMaxBytes: 1.5 })).toThrow();
    expect(() =>
      siteSettingsUpdateSchema.parse({ uploadMaxBytes: MAX_MEDIA_UPLOAD_BYTES + 1 })
    ).toThrow();
    expect(() => siteSettingsUpdateSchema.parse({ allowedMediaTypes: ["text/html"] })).toThrow();
  });

  it("parses the flat settings form into the shared domain contract", () => {
    expect(settingsFormSchema.parse(validSettingsFormInput())).toEqual({
      tagline: "A wiki",
      baseUrl: "https://wiki.example.test",
      logoUrl: "/media/logo.png",
      faviconUrl: null,
      defaultLocale: "en",
      publicMode: true,
      registrationMode: "closed",
      defaultHomepage: "Home",
      homepageTitle: "Welcome",
      homepageIntro: "Introduction",
      homepageFeaturedPages: ["start", "about"],
      homepageFeaturedCategories: ["guides", "reference"],
      homepageSections: {
        search: true,
        featured: false,
        recent: true,
        categories: true,
        layout: "compact",
        showLogo: true
      },
      footerContent: "Footer",
      uploadMaxBytes: 1024,
      allowedMediaTypes: ["image/png", "application/pdf"],
      seoTitle: null,
      seoDescription: "Description"
    });
  });

  it("rejects invalid form enums and upload limits without normalizing them", () => {
    expect(() =>
      settingsFormSchema.parse(validSettingsFormInput({ registrationMode: "unsupported" }))
    ).toThrow();
    expect(() =>
      settingsFormSchema.parse(
        validSettingsFormInput({ uploadMaxBytes: String(MAX_MEDIA_UPLOAD_BYTES + 1) })
      )
    ).toThrow();
  });

  it("defensively parses service updates before opening a database transaction", async () => {
    let transactionCalled = false;
    const database = {
      transaction: async () => {
        transactionCalled = true;
        throw new Error("transaction should not run");
      }
    };

    await expect(
      updateSiteSettings(
        {
          siteId: "site-id",
          actorId: "actor-id",
          actorDisplayName: "Owner",
          values: { registrationMode: "unsupported" } as never
        },
        database as never
      )
    ).rejects.toThrow();
    expect(transactionCalled).toBe(false);
  });
});
