import { describe, expect, it } from "vitest";
import { normalizeAllowedMediaTypes } from "@/modules/settings/service";

describe("site settings helpers", () => {
  it("normalizes allowed media MIME types", () => {
    expect(normalizeAllowedMediaTypes(" image/png,IMAGE/JPEG\napplication/pdf ")).toEqual([
      "image/png",
      "image/jpeg",
      "application/pdf"
    ]);
  });

  it("rejects empty, malformed, and unsafe SVG MIME type allowlists", () => {
    expect(() => normalizeAllowedMediaTypes("")).toThrow("at least one MIME type");
    expect(() => normalizeAllowedMediaTypes("not-a-mime")).toThrow("valid safe MIME");
    expect(() => normalizeAllowedMediaTypes("image/svg+xml")).toThrow("valid safe MIME");
  });
});
