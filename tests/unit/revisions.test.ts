import { describe, expect, it } from "vitest";
import { contentHash } from "@/lib/crypto";
import {
  createSideBySideDiff,
  createUnifiedDiff,
  parseUnifiedDiff
} from "@/modules/revisions/diff";

describe("revision helpers", () => {
  it("hashes normalized content consistently", () => {
    expect(contentHash("Hello")).toBe(contentHash("Hello"));
    expect(contentHash("Hello")).not.toBe(contentHash("Hello!"));
  });

  it("creates meaningful unified diffs", () => {
    const diff = createUnifiedDiff("one\ntwo\n", "one\nthree\n");
    const lines = parseUnifiedDiff(diff);
    expect(lines.some((line) => line.type === "add" && line.text.includes("three"))).toBe(true);
    expect(lines.some((line) => line.type === "remove" && line.text.includes("two"))).toBe(true);
  });

  it("creates side-by-side rows for changed lines", () => {
    const rows = createSideBySideDiff("one\ntwo\n", "one\nthree\n");

    expect(rows).toContainEqual({
      type: "context",
      oldLineNumber: 1,
      newLineNumber: 1,
      oldText: "one",
      newText: "one"
    });
    expect(rows).toContainEqual({
      type: "change",
      oldLineNumber: 2,
      newLineNumber: 2,
      oldText: "two",
      newText: "three"
    });
  });

  it("creates side-by-side rows for added and removed lines", () => {
    expect(createSideBySideDiff("one\n", "one\nadded\n")).toContainEqual({
      type: "add",
      oldLineNumber: null,
      newLineNumber: 2,
      oldText: "",
      newText: "added"
    });
    expect(createSideBySideDiff("one\nremoved\n", "one\n")).toContainEqual({
      type: "remove",
      oldLineNumber: 2,
      newLineNumber: null,
      oldText: "removed",
      newText: ""
    });
  });
});
