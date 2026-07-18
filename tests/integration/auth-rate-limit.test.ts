import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { rateLimitBuckets } from "@/db/schema";
import { hmac } from "@/lib/crypto";
import { assertRateLimit } from "@/modules/auth/rate-limit";
import { login, registerUser } from "@/modules/auth/service";
import { createSession } from "@/modules/auth/session";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("authentication rate limits", () => {
  it("atomically allows only the configured number of concurrent attempts", async () => {
    const test = await createTestDatabase();
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        assertRateLimit(
          { scope: "test.concurrent", key: "same-client", limit: 5, windowSeconds: 60 },
          test.executor
        )
      )
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(5);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(15);
    const [bucket] = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "test.concurrent"));
    expect(bucket.attempts).toBe(6);
  });

  it("uses one account bucket for case and whitespace variants", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Login Limits Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "open",
        mediaDriver: "local",
        ownerUsername: "Owner",
        ownerEmail: "login-limits-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await login({ identifier: "OWNER", password: "OwnerPassword123" }, test.db);
    await login({ identifier: " owner ", password: "OwnerPassword123" }, test.db);
    const accountBuckets = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.login.account"));
    expect(accountBuckets).toEqual([{ attempts: 2 }]);
    const [globalBucket] = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.login.global"));
    expect(globalBucket.attempts).toBe(2);
  });

  it("limits public registration before repeated password hashing", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Registration Limits Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "open",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "registration-limits-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const registration = {
      username: "duplicate",
      email: "duplicate@example.test",
      password: "DuplicatePassword123",
      clientKey: "registration-source"
    };

    await registerUser(registration, test.db);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(registerUser(registration, test.db)).rejects.toMatchObject({
        code: "conflict"
      });
    }
    await expect(registerUser(registration, test.db)).rejects.toMatchObject({
      code: "rate_limited",
      status: 429
    });
    const [globalBucket] = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.register.global"));
    expect(globalBucket.attempts).toBe(5);
    const [sourceBucket] = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.register.source"));
    expect(sourceBucket.attempts).toBe(6);
  });

  it("creates the initial Owner session without consulting a saturated login bucket", async () => {
    const test = await createTestDatabase();
    const now = new Date();
    await test.executor.insert(rateLimitBuckets).values({
      scope: "auth.login.global",
      keyHash: hmac("all"),
      windowStartedAt: now,
      attempts: 1_001,
      updatedAt: now
    });
    const setup = await completeSetup(
      {
        siteName: "Setup Session Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "setup-owner",
        ownerEmail: "setup-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await expect(
      login({ identifier: setup.owner.username, password: "OwnerPassword123" }, test.db)
    ).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    const accountBuckets = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.login.account"));
    expect(accountBuckets).toHaveLength(0);
    const session = await createSession({ userId: setup.owner.id }, test.executor);
    expect(session.session.userId).toBe(setup.owner.id);
  });
});
