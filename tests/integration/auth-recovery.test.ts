import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import type { RootDatabase } from "@/db/client";
import {
  auditLogs,
  emailVerificationTokens,
  groups,
  passwordResetTokens,
  rateLimitBuckets,
  sessions,
  siteSettings,
  userGroups,
  users
} from "@/db/schema";
import { hmac } from "@/lib/crypto";
import { completeSetup } from "@/modules/setup/service";
import { updateSiteSettings } from "@/modules/settings/service";
import { login, registerUser } from "@/modules/auth/service";
import { createSession } from "@/modules/auth/session";
import {
  issueEmailVerification,
  issuePasswordReset,
  requestEmailVerification,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyEmailToken
} from "@/modules/auth/recovery";
import { createUser, setUserStatus } from "@/modules/users/service";
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
    const assignments = await test.executor
      .select({ group: groups.normalizedName })
      .from(userGroups)
      .innerJoin(groups, eq(groups.id, userGroups.groupId))
      .where(eq(userGroups.userId, user.id));
    expect(assignments).toEqual([{ group: "readers" }]);
    const createdLogs = await test.executor
      .select({ details: auditLogs.details })
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, user.id), eq(auditLogs.action, "user.created")));
    expect(createdLogs).toEqual([{ details: { registrationMode: "open" } }]);
  });

  it("rejects email-verification configuration and legacy registration when SMTP is absent", async () => {
    const test = await createTestDatabase();
    const setupInput = {
      siteName: "No SMTP Wiki",
      tagline: "Test",
      baseUrl: "http://localhost:3000",
      registrationMode: "email_verification" as const,
      mediaDriver: "local" as const,
      ownerUsername: "no-smtp-owner",
      ownerEmail: "no-smtp-owner@example.test",
      ownerPassword: "OwnerPassword123"
    };
    await expect(completeSetup(setupInput, test.db)).rejects.toMatchObject({
      code: "email_unavailable",
      status: 503
    });
    const setup = await completeSetup({ ...setupInput, registrationMode: "closed" }, test.db);
    await expect(
      updateSiteSettings(
        {
          siteId: setup.site.id,
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName,
          values: { registrationMode: "email_verification" }
        },
        test.db
      )
    ).rejects.toMatchObject({ code: "email_unavailable", status: 503 });
    await test.executor
      .update(siteSettings)
      .set({ registrationMode: "email_verification" })
      .where(eq(siteSettings.siteId, setup.site.id));

    await expect(
      registerUser(
        {
          username: "no-smtp-pending",
          email: "no-smtp-pending@example.test",
          password: "NoSmtpPendingPassword123"
        },
        test.db
      )
    ).rejects.toMatchObject({ code: "email_unavailable", status: 503 });
    const created = await test.executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "no-smtp-pending"));
    expect(created).toHaveLength(0);
  });

  it("verifies pending users and resets passwords with single-use tokens", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Recovery Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
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

    const staleVerificationToken = await issueEmailVerification(user.id, test.db);
    const verificationToken = await issueEmailVerification(user.id, test.db);
    const verified = await verifyEmailToken(verificationToken, test.db);
    expect(verified.status).toBe("active");
    await expect(verifyEmailToken(staleVerificationToken, test.db)).rejects.toThrow(/invalid/i);
    await expect(verifyEmailToken(verificationToken, test.db)).rejects.toThrow(/invalid/i);

    const staleResetToken = await issuePasswordReset(user.id, test.db);
    const resetToken = await issuePasswordReset(user.id, test.db);
    await resetPasswordWithToken({ token: resetToken, password: "NewPendingPassword123" }, test.db);
    await expect(
      resetPasswordWithToken({ token: staleResetToken, password: "StaleTokenPassword123" }, test.db)
    ).rejects.toThrow(/invalid/i);
    await expect(
      resetPasswordWithToken({ token: resetToken, password: "ReusedTokenPassword123" }, test.db)
    ).rejects.toThrow(/invalid/i);
    await expect(
      login({ identifier: "pending", password: "PendingPassword123" }, test.db)
    ).rejects.toThrow(/Invalid/);
    const loggedIn = await login(
      { identifier: "pending", password: "NewPendingPassword123" },
      test.db
    );
    expect(loggedIn.user.username).toBe("pending");

    const [updated] = await test.executor
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(updated.emailVerifiedAt).toBeTruthy();
  });

  it("cannot reactivate a suspended user with an old verification or reset token", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Suspension Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "suspension-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "suspended-pending",
        email: "suspended-pending@example.test",
        password: "PendingPassword123",
        status: "pending"
      },
      test.executor
    );
    const verificationToken = await issueEmailVerification(user.id, test.db);
    const resetToken = await issuePasswordReset(user.id, test.db);

    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: user.id,
        status: "suspended",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );

    await expect(verifyEmailToken(verificationToken, test.db)).rejects.toThrow(/invalid/i);
    await expect(
      resetPasswordWithToken({ token: resetToken, password: "ChangedPassword123" }, test.db)
    ).rejects.toThrow(/invalid/i);
    await expect(issueEmailVerification(user.id, test.db)).rejects.toMatchObject({
      code: "invalid_state",
      status: 409
    });
    await expect(issuePasswordReset(user.id, test.db)).rejects.toMatchObject({
      code: "invalid_state",
      status: 409
    });
    const [updated] = await test.executor
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, user.id));
    expect(updated.status).toBe("suspended");
    await expect(
      test.executor
        .select()
        .from(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            isNull(emailVerificationTokens.consumedAt)
          )
        )
    ).resolves.toHaveLength(0);
    await expect(
      test.executor
        .select()
        .from(passwordResetTokens)
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.consumedAt)))
    ).resolves.toHaveLength(0);
  });

  it("rolls back token consumption and account activation when verification auditing fails", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Atomic Verification Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "atomic-verification-owner",
        ownerEmail: "atomic-verification-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "atomic-pending",
        email: "atomic-pending@example.test",
        password: "AtomicPendingPassword123",
        status: "pending"
      },
      test.executor
    );
    const token = await issueEmailVerification(user.id, test.db);

    await expect(verifyEmailToken(token, failAuditWrites(test.db))).rejects.toThrow(
      /forced audit failure/i
    );
    const [unchangedUser] = await test.executor
      .select({ status: users.status, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, user.id));
    expect(unchangedUser).toMatchObject({ status: "pending", emailVerifiedAt: null });
    const [unchangedToken] = await test.executor
      .select({ consumedAt: emailVerificationTokens.consumedAt })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hmac(token)));
    expect(unchangedToken.consumedAt).toBeNull();
    await expect(verifyEmailToken(token, test.db)).resolves.toMatchObject({ status: "active" });
  });

  it("resends verification generically, replaces old links only after delivery, and hides SMTP failure", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Verification Resend Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "resend-owner",
        ownerEmail: "resend-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const pending = await createUser(
      {
        username: "resend-pending",
        email: "resend-pending@example.test",
        password: "ResendPendingPassword123",
        status: "pending"
      },
      test.executor
    );
    const oldToken = await issueEmailVerification(pending.id, test.db);
    let deliveredText = "";
    await expect(
      requestEmailVerification({ identifier: " RESEND-PENDING " }, test.db, async (message) => {
        deliveredText = message.text;
        return true;
      })
    ).resolves.toEqual({ accepted: true });
    const deliveredUrl = deliveredText.match(/https?:\/\/\S+/)?.[0];
    const replacementToken = deliveredUrl ? new URL(deliveredUrl).searchParams.get("token") : null;
    expect(replacementToken).toBeTruthy();
    await expect(verifyEmailToken(oldToken, test.db)).rejects.toThrow(/invalid/i);
    await expect(verifyEmailToken(replacementToken ?? "", test.db)).resolves.toMatchObject({
      status: "active"
    });

    let attemptedDeliveries = 0;
    const genericSender = async () => {
      attemptedDeliveries += 1;
      return true;
    };
    await expect(
      requestEmailVerification({ identifier: "missing@example.test" }, test.db, genericSender)
    ).resolves.toEqual({ accepted: true });
    await expect(
      requestEmailVerification({ identifier: pending.email }, test.db, genericSender)
    ).resolves.toEqual({ accepted: true });
    const suspended = await createUser(
      {
        username: "resend-suspended",
        email: "resend-suspended@example.test",
        password: "ResendSuspendedPassword123",
        status: "suspended"
      },
      test.executor
    );
    await expect(
      requestEmailVerification({ identifier: suspended.email }, test.db, genericSender)
    ).resolves.toEqual({ accepted: true });
    expect(attemptedDeliveries).toBe(0);

    const retryPending = await createUser(
      {
        username: "retry-pending",
        email: "retry-pending@example.test",
        password: "RetryPendingPassword123",
        status: "pending"
      },
      test.executor
    );
    const preservedToken = await issueEmailVerification(retryPending.id, test.db);
    await expect(
      requestEmailVerification({ identifier: retryPending.email }, test.db, async () => {
        throw new Error("SMTP unavailable");
      })
    ).resolves.toEqual({ accepted: true });
    const retryTokens = await test.executor
      .select({ tokenHash: emailVerificationTokens.tokenHash })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, retryPending.id),
          isNull(emailVerificationTokens.consumedAt)
        )
      );
    expect(retryTokens).toEqual([{ tokenHash: hmac(preservedToken) }]);
    await expect(verifyEmailToken(preservedToken, test.db)).resolves.toMatchObject({
      status: "active"
    });
  });

  it("keeps exactly one delivered token valid across concurrent verification resends", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Concurrent Verification Resend Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "concurrent-resend-owner",
        ownerEmail: "concurrent-resend-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const pending = await createUser(
      {
        username: "concurrent-resend-pending",
        email: "concurrent-resend-pending@example.test",
        password: "ConcurrentResendPassword123",
        status: "pending"
      },
      test.executor
    );
    const deliveredMessages: string[] = [];
    let releaseDeliveries!: () => void;
    const bothDeliveriesStarted = new Promise<void>((resolve) => {
      releaseDeliveries = resolve;
    });
    const sender = async (message: { text: string }) => {
      deliveredMessages.push(message.text);
      if (deliveredMessages.length === 2) {
        releaseDeliveries();
      }
      await bothDeliveriesStarted;
      return true;
    };

    await Promise.all([
      requestEmailVerification({ identifier: pending.username }, test.db, sender),
      requestEmailVerification({ identifier: pending.username }, test.db, sender)
    ]);
    const deliveredTokens = deliveredMessages.map((message) => {
      const deliveredUrl = message.match(/https?:\/\/\S+/)?.[0];
      return deliveredUrl ? new URL(deliveredUrl).searchParams.get("token") : null;
    });
    expect(deliveredTokens.every(Boolean)).toBe(true);
    const activeTokens = await test.executor
      .select({ tokenHash: emailVerificationTokens.tokenHash })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, pending.id),
          isNull(emailVerificationTokens.consumedAt)
        )
      );
    expect(activeTokens).toHaveLength(1);
    expect(deliveredTokens.map((token) => hmac(token ?? ""))).toContain(activeTokens[0].tokenHash);
    const outcomes = await Promise.allSettled(
      deliveredTokens.map((token) => verifyEmailToken(token ?? "", test.db))
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  it("rate limits verification resends atomically without distinguishing missing accounts", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Verification Resend Limits Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "resend-limits-owner",
        ownerEmail: "resend-limits-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const request = (identifier: string) =>
      requestEmailVerification(
        { identifier, clientKey: "same-verification-source" },
        test.db,
        async () => false
      );
    await expect(request(" MISSING@example.test ")).resolves.toEqual({ accepted: true });
    await expect(request("missing@example.test")).resolves.toEqual({ accepted: true });
    await expect(request("Missing@Example.Test")).resolves.toEqual({ accepted: true });
    await expect(request("missing@example.test")).rejects.toMatchObject({
      code: "rate_limited",
      status: 429
    });
    const buckets = await test.executor
      .select({ scope: rateLimitBuckets.scope, attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets);
    expect(buckets).toEqual(
      expect.arrayContaining([
        { scope: "auth.email_verification.source", attempts: 4 },
        { scope: "auth.email_verification.global", attempts: 4 },
        { scope: "auth.email_verification.account", attempts: 4 }
      ])
    );
  });

  it("allows only one of two competing password reset links to change the password", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Competing Reset Links Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "competing-reset-owner",
        ownerEmail: "competing-reset-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "competing-reset-user",
        email: "competing-reset-user@example.test",
        password: "OriginalPassword123"
      },
      test.executor
    );
    const tokens = await Promise.all([
      issuePasswordReset(user.id, test.db),
      issuePasswordReset(user.id, test.db)
    ]);
    const passwords = ["FirstReplacement123", "SecondReplacement123"] as const;
    const outcomes = await Promise.allSettled(
      tokens.map((token, index) =>
        resetPasswordWithToken({ token, password: passwords[index] }, test.db)
      )
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    const successfulIndex = outcomes.findIndex((outcome) => outcome.status === "fulfilled");
    await expect(
      login(
        { identifier: user.username, password: passwords[successfulIndex] ?? "unreachable" },
        test.db
      )
    ).resolves.toMatchObject({ user: { id: user.id } });
    const rejectedIndex = outcomes.findIndex((outcome) => outcome.status === "rejected");
    await expect(
      login(
        { identifier: user.username, password: passwords[rejectedIndex] ?? "unreachable" },
        test.db
      )
    ).rejects.toMatchObject({ code: "invalid_credentials", status: 401 });
    const activeTokens = await test.executor
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.consumedAt)));
    expect(activeTokens).toHaveLength(0);
  });

  it("normalizes reset identifiers and rate limits requests without revealing account existence", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Reset Limits Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "reset-limits-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await expect(
      requestPasswordReset({ identifier: "missing@example.test" }, test.db)
    ).resolves.toEqual({ issued: false, sent: false });
    await expect(
      requestPasswordReset({ identifier: " MISSING@example.test " }, test.db)
    ).resolves.toEqual({ issued: false, sent: false });
    await expect(
      requestPasswordReset({ identifier: "Missing@Example.Test" }, test.db)
    ).resolves.toEqual({ issued: false, sent: false });
    await expect(
      requestPasswordReset({ identifier: "missing@example.test" }, test.db)
    ).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    const [globalBucket] = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.password_reset.global"));
    expect(globalBucket.attempts).toBe(4);
    const [accountBucket] = await test.executor
      .select({ attempts: rateLimitBuckets.attempts })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "auth.password_reset.account"));
    expect(accountBucket.attempts).toBe(4);
  });

  it("does not issue a password reset token after concurrent suspension", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Reset Suspension Race Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "reset-suspension-owner",
        ownerEmail: "reset-suspension-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "reset-suspension-user",
        email: "reset-suspension-user@example.test",
        password: "ResetSuspensionPassword123"
      },
      test.executor
    );
    const paused = pauseNextTransaction(test.db);
    const pendingRequest = requestPasswordReset({ identifier: user.username }, paused.database);

    await paused.entered;
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: user.id,
        status: "suspended",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    paused.release();
    await expect(pendingRequest).resolves.toEqual({ issued: false, sent: false });
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: user.id,
        status: "active",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const activeTokens = await test.executor
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.consumedAt)));
    expect(activeTokens).toHaveLength(0);
  });

  it("rejects a login when its verified password is reset before the locked commit", async () => {
    const test = await createTestDatabase();
    await completeSetup(
      {
        siteName: "Password Race Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "password-race-owner",
        ownerEmail: "password-race-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "password-race-user",
        email: "password-race-user@example.test",
        password: "OriginalPassword123"
      },
      test.executor
    );
    await createSession({ userId: user.id }, test.executor);
    const resetToken = await issuePasswordReset(user.id, test.db);
    const paused = pauseNextTransaction(test.db);
    const pendingLogin = login(
      { identifier: user.username, password: "OriginalPassword123" },
      paused.database
    );
    const loginAssertion = expect(pendingLogin).rejects.toMatchObject({
      code: "invalid_credentials",
      status: 401
    });

    await paused.entered;
    await resetPasswordWithToken(
      { token: resetToken, password: "ReplacementPassword123" },
      test.db
    );
    paused.release();
    await loginAssertion;
    const activeSessions = await test.executor
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    expect(activeSessions).toHaveLength(0);
  });

  it("does not leave a login session that revives after concurrent suspension", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Suspension Race Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "suspension-race-owner",
        ownerEmail: "suspension-race-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const user = await createUser(
      {
        username: "suspension-race-user",
        email: "suspension-race-user@example.test",
        password: "SuspensionPassword123"
      },
      test.executor
    );
    const paused = pauseNextTransaction(test.db);
    const pendingLogin = login(
      { identifier: user.username, password: "SuspensionPassword123" },
      paused.database
    );
    const loginAssertion = expect(pendingLogin).rejects.toMatchObject({
      code: "forbidden",
      status: 403
    });

    await paused.entered;
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: user.id,
        status: "suspended",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    paused.release();
    await loginAssertion;
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: user.id,
        status: "active",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const activeSessions = await test.executor
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    expect(activeSessions).toHaveLength(0);
  });
});

function pauseNextTransaction(database: RootDatabase) {
  let markEntered!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  type TransactionCallback = Parameters<RootDatabase["transaction"]>[0];
  const paused = new Proxy(database, {
    get(target, property) {
      if (property === "transaction") {
        return async (callback: TransactionCallback) => {
          markEntered();
          await gate;
          return database.transaction(callback);
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as RootDatabase;
  return { database: paused, entered, release };
}

function failAuditWrites(database: RootDatabase) {
  return {
    transaction: async <T>(callback: (transaction: unknown) => Promise<T>) =>
      database.transaction(async (transaction) => {
        const failingTransaction = new Proxy(transaction, {
          get(target, property) {
            if (property === "insert") {
              return (table: unknown) => {
                if (table === auditLogs) {
                  throw new Error("Forced audit failure");
                }
                const insert = Reflect.get(target, property) as (value: unknown) => unknown;
                return insert.call(target, table);
              };
            }
            const value = Reflect.get(target, property);
            return typeof value === "function" ? value.bind(target) : value;
          }
        });
        return callback(failingTransaction);
      })
  } as unknown as RootDatabase;
}
