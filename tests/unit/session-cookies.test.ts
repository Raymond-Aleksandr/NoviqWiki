import { describe, expect, it } from "vitest";
import { shouldUseSecureCookies } from "@/modules/auth/session";

describe("session cookie transport", () => {
  it("uses Secure cookies only for an HTTPS canonical URL", () => {
    expect(shouldUseSecureCookies("http://localhost:3000")).toBe(false);
    expect(shouldUseSecureCookies("http://192.0.2.10:3000")).toBe(false);
    expect(shouldUseSecureCookies("https://wiki.example.com")).toBe(true);
  });
});
