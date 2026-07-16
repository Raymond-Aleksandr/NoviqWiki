import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";

function detectLoop(chain: Record<string, string>, start: string, maxDepth = 8) {
  const seen = new Set<string>();
  let current = start;
  for (let index = 0; index <= maxDepth; index += 1) {
    if (seen.has(current)) {
      throw new ConflictError("Redirect loop detected.");
    }
    seen.add(current);
    const next = chain[current];
    if (!next) {
      return current;
    }
    current = next;
  }
  throw new ConflictError("Redirect depth exceeded.");
}

describe("redirect loop detection", () => {
  it("detects loops and allows acyclic redirects", () => {
    expect(detectLoop({ a: "b", b: "c" }, "a")).toBe("c");
    expect(() => detectLoop({ a: "b", b: "a" }, "a")).toThrow(ConflictError);
  });
});
