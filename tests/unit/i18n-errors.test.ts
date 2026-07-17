import { describe, expect, it } from "vitest";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { localizeErrorMessage } from "@/i18n/errors";
import { en } from "@/i18n/en";
import { zhCN } from "@/i18n/zh-CN";

describe("localized errors", () => {
  it("localizes common service errors", () => {
    expect(localizeErrorMessage(new ForbiddenError("Authentication required."), zhCN)).toBe(
      "请先登录。"
    );
    expect(
      localizeErrorMessage(
        new ConflictError("A page with this title or slug already exists."),
        zhCN
      )
    ).toBe("已有页面使用该标题或路径名。");
    expect(localizeErrorMessage(new NotFoundError("Media asset not found."), zhCN)).toBe(
      "未找到媒体文件。"
    );
  });

  it("preserves English messages for English requests", () => {
    expect(
      localizeErrorMessage(
        new AppError("Too many attempts. Try again later.", "rate_limited", 429),
        en
      )
    ).toBe("Too many attempts. Try again later.");
  });
});
