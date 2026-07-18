import { describe, expect, it } from "vitest";
import { ownerSetupSchema, registerSchema } from "@/modules/auth/schemas";

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
});
