import { describe, expect, it } from "vitest";
import {
  groupDescription,
  groupDisplayName,
  roleDescription,
  roleDisplayName
} from "@/i18n/authorization";
import { en } from "@/i18n/en";
import { zhCN } from "@/i18n/zh-CN";

describe("authorization display labels", () => {
  it("localizes built-in roles and groups", () => {
    expect(roleDisplayName({ name: "Owner", normalizedName: "owner" }, zhCN)).toBe("所有者");
    expect(roleDisplayName({ name: "Editor", normalizedName: "editor" }, zhCN)).toBe("编辑者");
    expect(groupDisplayName({ name: "owners", normalizedName: "owners" }, zhCN)).toBe("所有者");
    expect(groupDisplayName({ name: "readers", normalizedName: "readers" }, zhCN)).toBe("读者");
    expect(roleDescription({ name: "Owner", normalizedName: "owner" }, zhCN)).toBe(
      "拥有完整站点权限。"
    );
    expect(groupDescription({ name: "readers", normalizedName: "readers" }, zhCN)).toBe(
      "默认注册读者。"
    );
  });

  it("preserves custom role and group names", () => {
    const customRole = {
      name: "Owner support",
      normalizedName: "owner support",
      description: "Handles escalations",
      builtIn: false
    };
    const customGroup = {
      name: "readers circle",
      normalizedName: "readers circle",
      description: "Book club",
      builtIn: false
    };

    expect(roleDisplayName(customRole, zhCN)).toBe("Owner support");
    expect(roleDescription(customRole, zhCN)).toBe("Handles escalations");
    expect(groupDisplayName(customGroup, en)).toBe("readers circle");
    expect(groupDescription(customGroup, en)).toBe("Book club");
  });
});
