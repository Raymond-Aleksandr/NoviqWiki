import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { getPrimarySiteWithSettings } from "@/db/site";
import { emailVerificationTokens, passwordResetTokens, users } from "@/db/schema";
import { hmac, randomToken } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { canonicalApplicationBaseUrl, getEnv } from "@/lib/env";
import { writeAuditLog } from "@/modules/audit/service";
import { findUserForLogin, hashPassword, normalizeLoginIdentifier } from "@/modules/users/service";
import { invalidateUserSessions } from "./session";
import { sendSystemEmail } from "./email";
import { assertRateLimit } from "./rate-limit";

const emailVerificationTtlMs = 1000 * 60 * 60 * 24;
const passwordResetTtlMs = 1000 * 60 * 60;

export async function issueEmailVerification(userId: string, database: RootDatabase = db) {
  return database.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for("update");
    if (!user || user.status !== "pending") {
      throw new AppError(
        "Email verification is only available for pending accounts.",
        "invalid_state",
        409
      );
    }
    return insertEmailVerificationToken(user.id, tx);
  });
}

async function insertEmailVerificationToken(userId: string, database: Database) {
  const token = randomToken(40);
  await database.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hmac(token),
    expiresAt: new Date(Date.now() + emailVerificationTtlMs)
  });
  return token;
}

export async function sendEmailVerification(
  input: { userId: string },
  database: RootDatabase = db,
  sendEmail: typeof sendSystemEmail = sendSystemEmail
) {
  const staged = await database.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for("update");
    if (!user || user.status !== "pending") {
      return null;
    }
    const token = await insertEmailVerificationToken(user.id, tx);
    return { token, user };
  });
  if (!staged) {
    return false;
  }
  let sent = false;
  try {
    const site = await getPrimarySiteWithSettings(database);
    const baseUrl = canonicalApplicationBaseUrl(getEnv(), site?.settings?.baseUrl);
    const url = new URL("/verify-email", baseUrl);
    url.searchParams.set("token", staged.token);
    sent = await sendEmail({
      to: staged.user.email,
      subject: `Verify your ${site?.site.name ?? "NoviqWiki"} account`,
      text: `Hello ${staged.user.displayName},\n\nVerify your email address by opening this link:\n${url.toString()}\n\nThis link expires in 24 hours.`
    });
  } catch {
    sent = false;
  }
  const tokenHash = hmac(staged.token);
  return database.transaction(async (tx) => {
    const now = new Date();
    const [currentUser] = await tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, staged.user.id))
      .limit(1)
      .for("update");
    if (!sent || currentUser?.status !== "pending") {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, tokenHash),
            isNull(emailVerificationTokens.consumedAt)
          )
        );
      return false;
    }
    const [currentToken] = await tx
      .select({ id: emailVerificationTokens.id })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .limit(1)
      .for("update");
    if (!currentToken) {
      return false;
    }
    await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.userId, currentUser.id),
          ne(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt)
        )
      );
    return true;
  });
}

export async function verifyEmailToken(token: string, database: RootDatabase = db) {
  return database.transaction(async (tx) => {
    const now = new Date();
    const [candidate] = await tx
      .select({ id: emailVerificationTokens.id, userId: emailVerificationTokens.userId })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, hmac(token)),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .limit(1);
    if (!candidate) {
      throw invalidVerificationToken();
    }
    const [currentUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, candidate.userId))
      .limit(1)
      .for("update");
    if (!currentUser || currentUser.status !== "pending") {
      throw invalidVerificationToken();
    }
    const [claimed] = await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.id, candidate.id),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .returning({ id: emailVerificationTokens.id });
    if (!claimed) {
      throw invalidVerificationToken();
    }
    const [user] = await tx
      .update(users)
      .set({ status: "active", emailVerifiedAt: now, updatedAt: now })
      .where(and(eq(users.id, currentUser.id), eq(users.status, "pending")))
      .returning();
    if (!user) {
      throw invalidVerificationToken();
    }
    await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(
        and(eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.consumedAt))
      );
    await writeAuditLog(
      {
        actorId: user.id,
        actorDisplayName: user.displayName,
        action: "user.updated",
        targetType: "user",
        targetId: user.id,
        details: { reason: "email_verified" }
      },
      tx
    );
    return user;
  });
}

export async function requestEmailVerification(
  input: { identifier: string; clientKey?: string },
  database: RootDatabase = db,
  sendEmail: typeof sendSystemEmail = sendSystemEmail
) {
  const normalizedIdentifier = normalizeLoginIdentifier(input.identifier);
  if (input.clientKey) {
    await assertRateLimit(
      {
        scope: "auth.email_verification.source",
        key: input.clientKey,
        limit: 10,
        windowSeconds: 60 * 60
      },
      database
    );
  }
  await assertRateLimit(
    {
      scope: "auth.email_verification.global",
      key: "all",
      limit: 200,
      windowSeconds: 60 * 60
    },
    database
  );
  await assertRateLimit(
    {
      scope: "auth.email_verification.account",
      key: normalizedIdentifier,
      limit: 3,
      windowSeconds: 60 * 60
    },
    database
  );
  const user = await findUserForLogin(normalizedIdentifier, database);
  if (user?.status === "pending") {
    await sendEmailVerification({ userId: user.id }, database, sendEmail);
  }
  return { accepted: true } as const;
}

function invalidVerificationToken() {
  return new AppError("Verification link is invalid or expired.", "invalid_token", 400);
}

export async function requestPasswordReset(
  input: { identifier: string; clientKey?: string },
  database: RootDatabase = db
) {
  const normalizedIdentifier = normalizeLoginIdentifier(input.identifier);
  if (input.clientKey) {
    await assertRateLimit(
      {
        scope: "auth.password_reset.source",
        key: input.clientKey,
        limit: 10,
        windowSeconds: 60 * 60
      },
      database
    );
  }
  await assertRateLimit(
    {
      scope: "auth.password_reset.global",
      key: "all",
      limit: 200,
      windowSeconds: 60 * 60
    },
    database
  );
  await assertRateLimit(
    {
      scope: "auth.password_reset.account",
      key: normalizedIdentifier,
      limit: 3,
      windowSeconds: 60 * 60
    },
    database
  );
  const user = await findUserForLogin(normalizedIdentifier, database);
  if (!user || user.status === "suspended") {
    return { issued: false, sent: false };
  }
  const issued = await database.transaction(async (tx) => {
    const [currentUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .for("update");
    if (!currentUser || currentUser.status === "suspended") {
      return null;
    }
    const token = await insertPasswordResetToken(currentUser.id, tx);
    return { token, user: currentUser };
  });
  if (!issued) {
    return { issued: false, sent: false };
  }
  const site = await getPrimarySiteWithSettings(database);
  const baseUrl = canonicalApplicationBaseUrl(getEnv(), site?.settings?.baseUrl);
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", issued.token);
  const sent = await sendSystemEmail({
    to: issued.user.email,
    subject: `Reset your ${site?.site.name ?? "NoviqWiki"} password`,
    text: `Hello ${issued.user.displayName},\n\nReset your password by opening this link:\n${url.toString()}\n\nThis link expires in 1 hour.`
  }).catch(() => false);
  await writeAuditLog(
    {
      siteId: site?.site.id,
      actorId: issued.user.id,
      actorDisplayName: issued.user.displayName,
      action: "auth.password_reset_requested",
      targetType: "user",
      targetId: issued.user.id,
      details: { emailSent: sent }
    },
    database
  );
  return { issued: true, sent };
}

export async function issuePasswordReset(userId: string, database: RootDatabase = db) {
  return database.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for("update");
    if (!user || user.status === "suspended") {
      throw new AppError("Password reset is not available for this account.", "invalid_state", 409);
    }
    return insertPasswordResetToken(user.id, tx);
  });
}

async function insertPasswordResetToken(userId: string, database: Database) {
  const token = randomToken(40);
  await database.insert(passwordResetTokens).values({
    userId,
    tokenHash: hmac(token),
    expiresAt: new Date(Date.now() + passwordResetTtlMs)
  });
  return token;
}

export async function resetPasswordWithToken(
  input: { token: string; password: string },
  database: RootDatabase = db
) {
  const [candidate] = await database
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hmac(input.token)),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!candidate) {
    throw new AppError("Reset link is invalid or expired.", "invalid_token", 400);
  }
  return database.transaction(async (tx) => {
    const [currentUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, candidate.userId))
      .limit(1)
      .for("update");
    if (!currentUser || currentUser.status === "suspended") {
      throw new AppError("Reset link is invalid or expired.", "invalid_token", 400);
    }
    const consumedAt = new Date();
    const [claimed] = await tx
      .update(passwordResetTokens)
      .set({ consumedAt })
      .where(
        and(
          eq(passwordResetTokens.id, candidate.id),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .returning({ id: passwordResetTokens.id });
    if (!claimed) {
      throw new AppError("Reset link is invalid or expired.", "invalid_token", 400);
    }
    const passwordHash = await hashPassword(input.password);
    const [user] = await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, currentUser.id), ne(users.status, "suspended")))
      .returning();
    if (!user) {
      throw new AppError("Reset link is invalid or expired.", "invalid_token", 400);
    }
    await tx
      .update(passwordResetTokens)
      .set({ consumedAt })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.consumedAt)));
    await invalidateUserSessions(user.id, tx);
    const site = await getPrimarySiteWithSettings(tx);
    await writeAuditLog(
      {
        siteId: site?.site.id,
        actorId: user.id,
        actorDisplayName: user.displayName,
        action: "auth.password_reset_completed",
        targetType: "user",
        targetId: user.id
      },
      tx
    );
    return user;
  });
}
