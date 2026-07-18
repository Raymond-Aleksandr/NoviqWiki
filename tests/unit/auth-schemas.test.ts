import { describe, expect, it } from "vitest";
import {
  emailVerificationRequestSchema,
  ownerSetupSchema,
  registerSchema,
  setupSchema
} from "@/modules/auth/schemas";

describe("authentication schemas", () => {
  it("treats a blank optional registration display name as absent", () => {
    const parsed = registerSchema.parse({
      username: "new-user",
      email: "new-user@example.test",
      displayName: "   ",
      password: "RegistrationPassword123"
    });

    expect(parsed.displayName).toBeUndefined();
  });

  it("accepts owner bootstrap without a display name", () => {
    const parsed = ownerSetupSchema.parse({
      ownerUsername: "owner",
      ownerEmail: "owner@example.test",
      ownerDisplayName: "",
      ownerPassword: "OwnerPassword123"
    });

    expect(parsed.ownerDisplayName).toBeUndefined();
  });

  it("strictly bounds verification resend identifiers", () => {
    expect(emailVerificationRequestSchema.parse({ identifier: "  reader@example.test  " })).toEqual(
      { identifier: "reader@example.test" }
    );
    expect(emailVerificationRequestSchema.safeParse({ identifier: "a".repeat(321) }).success).toBe(
      false
    );
    expect(
      emailVerificationRequestSchema.safeParse({
        identifier: "reader@example.test",
        unexpected: "value"
      }).success
    ).toBe(false);
  });

  it("accepts only HTTP(S) setup base URLs", () => {
    const input = {
      siteName: "Wiki",
      tagline: "Test",
      baseUrl: "https://wiki.example.test",
      registrationMode: "closed",
      mediaDriver: "local",
      ownerUsername: "owner",
      ownerEmail: "owner@example.test",
      ownerPassword: "OwnerPassword123"
    };
    expect(setupSchema.safeParse(input).success).toBe(true);
    expect(setupSchema.safeParse({ ...input, baseUrl: "ftp://wiki.example.test" }).success).toBe(
      false
    );
  });
});
