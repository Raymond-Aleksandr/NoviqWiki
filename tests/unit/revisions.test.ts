import { describe, expect, it } from "vitest";
import { contentHash } from "@/lib/crypto";
import { createUnifiedDiff, parseUnifiedDiff } from "@/modules/revisions/diff";

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
});
