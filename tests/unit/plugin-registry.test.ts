import { afterEach, describe, expect, it } from "vitest";
import {
  clearPluginRegistryForTests,
  collectHomepageContributions,
  listPlugins,
  registerPlugin
} from "@/modules/plugins/registry";

describe("plugin registry", () => {
  afterEach(() => {
    clearPluginRegistryForTests();
  });

  it("registers plugins and rejects duplicate ids", () => {
    registerPlugin({ id: "release-notes", name: "Release Notes", version: "0.1.0" });

    expect(listPlugins()).toHaveLength(1);
    expect(() =>
      registerPlugin({ id: "release-notes", name: "Duplicate", version: "0.1.1" })
    ).toThrow("Plugin already registered: release-notes");
  });

  it("collects homepage contributions with site and locale context", () => {
    registerPlugin({
      id: "quick-links",
      name: "Quick Links",
      version: "0.1.0",
      homepageContributions: (context) => [
        {
          id: `help-${context.locale}`,
          title: `Help for ${context.siteId}`,
          description: context.locale,
          href: "/help"
        }
      ]
    });

    expect(collectHomepageContributions({ siteId: "site_123", locale: "zh-CN" })).toEqual([
      {
        id: "help-zh-CN",
        title: "Help for site_123",
        description: "zh-CN",
        href: "/help"
      }
    ]);
  });
});
