import { describe, expect, it } from "vitest";
import { decodeRouteParam } from "@/lib/route-params";

describe("route params", () => {
  it("decodes encoded unicode route params and tolerates malformed input", () => {
    expect(decodeRouteParam("%E4%BA%BA%E7%89%A9")).toBe("人物");
    expect(decodeRouteParam("人物")).toBe("人物");
    expect(decodeRouteParam("%E4%BA")).toBe("%E4%BA");
  });
});
