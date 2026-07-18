import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("repository branding", () => {
  it("does not contain the provisional legacy identifier", () => {
    const legacyIdentifier = ["next", "wiki"].join("");
    const result = spawnSync("git", ["grep", "-n", "-i", legacyIdentifier], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(result.error).toBeUndefined();
    expect(result.stdout).toBe("");
    expect(result.status).toBe(1);
  });
});
