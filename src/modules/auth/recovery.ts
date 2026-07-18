import { and, eq, gt, isNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { getPrimarySiteWithSettings } from "@/db/site";
import { emailVerificationTokens, passwordResetTokens, users } from "@/db/schema";
import { hmac, randomToken } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { writeAuditLog } from "@/modules/audit/service";
import { findUserForLogin, hashPassword } from "@/modules/users/service";
import { invalidateUserSessions } from "./session";
import { sendSystemEmail } from "./email";

const emailVerificationTtlMs = 1000 * 60 * 60 * 24;
const passwordResetTtlMs = 1000 * 60 * 60;

export async function issueEmailVerification(userId: string, database: Database = db) {
  const token = randomToken(40);
  await database.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hmac(token),
    expiresAt: new Date(Date.now() + emailVerificationTtlMs)
  });
  return token;
}

export async function sendEmailVerification(
  input: { userId: string; email: string; displayName: string },
  database: Database = db
) {
  const token = await issueEmailVerification(input.userId, database);
  const site = await getPrimarySiteWithSettings(database);
  const baseUrl = site?.settings?.baseUrl ?? getEnv().NOVIQWIKI_BASE_URL;
  const url = new URL("/verify-email", baseUrl);
  url.searchParams.set("token", token);
  return sendSystemEmail({
    to: input.email,
    subject: `Verify your ${site?.site.name ?? "NoviqWiki"} account`,
    text: `Hello ${input.displayName},\n\nVerify your email address by opening this link:\n${url.toString()}\n\nThis link expires in 24 hours.`
  });
}

export async function verifyEmailToken(token: string, database: Database = db) {
  const [row] = await database
    .update(emailVerificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, hmac(token)),
        isNull(emailVerificationTokens.consumedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    )
    .returning();
  if (!row) {
    throw new AppError("Verification link is invalid or expired.", "invalid_token", 400);
  }
  const [user] = await database
    .update(users)
    .set({ status: "active", emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, row.userId))
    .returning();
  if (!user) {
    throw new AppError("Verification link is invalid or expired.", "invalid_token", 400);
  }
  await writeAuditLog(
    {
      actorId: user.id,
      actorDisplayName: user.displayName,
      action: "user.updated",
      targetType: "user",
      targetId: user.id,
      details: { reason: "email_verified" }
    },
    database
  );
  return user;
}

export async function requestPasswordReset(identifier: string, database: Database = db) {
  const user = await findUserForLogin(identifier, database);
  if (!user || user.status === "suspended") {
    return { issued: false, sent: false };
  }
  const token = await issuePasswordReset(user.id, database);
  const site = await getPrimarySiteWithSettings(database);
  const baseUrl = site?.settings?.baseUrl ?? getEnv().NOVIQWIKI_BASE_URL;
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  const sent = await sendSystemEmail({
    to: user.email,
    subject: `Reset your ${site?.site.name ?? "NoviqWiki"} password`,
    text: `Hello ${user.displayName},\n\nReset your password by opening this link:\n${url.toString()}\n\nThis link expires in 1 hour.`
  });
  await writeAuditLog(
    {
      siteId: site?.site.id,
      actorId: user.id,
      actorDisplayName: user.displayName,
      action: "auth.password_reset_requested",
      targetType: "user",
      targetId: user.id,
      details: { emailSent: sent }
    },
    database
  );
  return { issued: true, sent };
}

export async function issuePasswordReset(userId: string, database: Database = db) {
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
  database: Database = db
) {
  const [row] = await database
    .update(passwordResetTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hmac(input.token)),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .returning();
  if (!row) {
    throw new AppError("Reset link is invalid or expired.", "invalid_token", 400);
  }
  const passwordHash = await hashPassword(input.password);
  const [user] = await database
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, row.userId))
    .returning();
  if (!user) {
    throw new AppError("Reset link is invalid or expired.", "invalid_token", 400);
  }
  await invalidateUserSessions(user.id, database);
  const site = await getPrimarySiteWithSettings(database);
  await writeAuditLog(
    {
      siteId: site?.site.id,
      actorId: user.id,
      actorDisplayName: user.displayName,
      action: "auth.password_reset_completed",
      targetType: "user",
      targetId: user.id
    },
    database
  );
  return user;
}
