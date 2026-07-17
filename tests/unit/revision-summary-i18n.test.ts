import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { zhCN } from "@/i18n/zh-CN";
import { formatRevisionSummary } from "@/i18n/revisions";

describe("formatRevisionSummary", () => {
  it("localizes system-generated revision summaries", () => {
    expect(formatRevisionSummary("Initial publication", zhCN)).toBe("初始发布");
    expect(formatRevisionSummary("Initial publish", zhCN)).toBe("初始发布");
    expect(formatRevisionSummary("Update body", zhCN)).toBe("更新正文");
    expect(formatRevisionSummary("Rollback to revision 1", zhCN)).toBe("回滚到 r1");
    expect(formatRevisionSummary("Rollback r2", zhCN)).toBe("回滚到 r2");
  });

  it("preserves user-authored summaries", () => {
    expect(formatRevisionSummary("Explain the API contract", zhCN)).toBe(
      "Explain the API contract"
    );
    expect(formatRevisionSummary("更新 API 说明", en)).toBe("更新 API 说明");
  });
});
