import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";
import { parseRedirectDirective } from "@/modules/redirects/directive";

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

describe("redirect directives", () => {
  it("parses English and Simplified Chinese redirect directives", () => {
    expect(parseRedirectDirective("#REDIRECT [[Target Page]]")).toEqual({
      targetTitle: "Target Page",
      targetSlug: "target-page"
    });
    expect(parseRedirectDirective("\n#重定向 [[目标页面|显示文字]]")).toEqual({
      targetTitle: "目标页面",
      targetSlug: "目标页面"
    });
  });

  it("ignores redirect-like text that is not the first content line", () => {
    expect(parseRedirectDirective("# Heading\n\n#REDIRECT [[Target Page]]")).toBeNull();
    expect(parseRedirectDirective("#REDIRECT Target Page")).toBeNull();
  });
});
