import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { completeSetup } from "@/modules/setup/service";
import { login, registerUser } from "@/modules/auth/service";
import {
  issueEmailVerification,
  issuePasswordReset,
  resetPasswordWithToken,
  verifyEmailToken
} from "@/modules/auth/recovery";
import { createUser } from "@/modules/users/service";
import { createTestDatabase } from "../helpers/test-db";

describe("auth recovery integration", () => {
  it("registers users with the site default locale", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Locale Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        defaultLocale: "zh-CN",
        registrationMode: "open",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    const user = await registerUser(
      {
        username: "reader",
        email: "reader@example.test",
        password: "ReaderPassword123"
      },
      test.db
    );

    expect(user.locale).toBe("zh-CN");
  });

  it("verifies pending users and resets passwords with single-use tokens", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Recovery Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "email_verification",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "pending",
        email: "pending@example.test",
        password: "PendingPassword123",
        status: "pending"
      },
      test.executor
    );

    const verificationToken = await issueEmailVerification(user.id, test.executor);
    const verified = await verifyEmailToken(verificationToken, test.executor);
    expect(verified.status).toBe("active");
    await expect(verifyEmailToken(verificationToken, test.executor)).rejects.toThrow(/invalid/i);

    const resetToken = await issuePasswordReset(user.id, test.executor);
    await resetPasswordWithToken(
      { token: resetToken, password: "NewPendingPassword123" },
      test.executor
    );
    await expect(
      login({ identifier: "pending", password: "PendingPassword123" }, test.executor)
    ).rejects.toThrow(/Invalid/);
    const loggedIn = await login(
      { identifier: "pending", password: "NewPendingPassword123" },
      test.executor
    );
    expect(loggedIn.user.username).toBe("pending");

    const [updated] = await test.executor
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(updated.emailVerifiedAt).toBeTruthy();
  });
});
