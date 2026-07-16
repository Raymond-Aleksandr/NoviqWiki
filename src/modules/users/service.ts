import { and, eq, ilike, or } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { normalizeEmail, normalizeUsername } from "@/lib/normalize";
import { isFinalActiveOwner } from "@/modules/authorization/permissions";

export async function hashPassword(password: string) {
  return hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export async function createUser(
  input: {
    username: string;
    email: string;
    password?: string;
    displayName?: string;
    status?: "active" | "suspended" | "pending";
    locale?: string;
  },
  database: Database = db
) {
  const normalizedUsername = normalizeUsername(input.username);
  const normalizedEmail = normalizeEmail(input.email);
  const existing = await database
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.normalizedUsername, normalizedUsername),
        eq(users.normalizedEmail, normalizedEmail)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    throw new ConflictError("A user with that username or email already exists.");
  }
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const [user] = await database
    .insert(users)
    .values({
      username: input.username.trim(),
      normalizedUsername,
      email: input.email.trim(),
      normalizedEmail,
      displayName: input.displayName?.trim() || input.username.trim(),
      passwordHash,
      status: input.status ?? "active",
      locale: input.locale ?? "en"
    })
    .returning();
  return user;
}

export async function findUserForLogin(identifier: string, database: Database = db) {
  const normalized = identifier.trim().toLowerCase();
  const [user] = await database
    .select()
    .from(users)
    .where(or(eq(users.normalizedUsername, normalized), eq(users.normalizedEmail, normalized)))
    .limit(1);
  return user ?? null;
}

export async function listUsers(
  input: { query?: string; limit?: number; offset?: number },
  database: Database = db
) {
  const conditions = input.query
    ? or(ilike(users.username, `%${input.query}%`), ilike(users.email, `%${input.query}%`))
    : undefined;
  const query = database
    .select()
    .from(users)
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return conditions ? query.where(conditions) : query;
}

export async function setUserStatus(
  input: { siteId: string; userId: string; status: "active" | "suspended" | "pending" },
  database: Database = db
) {
  const [user] = await database.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) {
    throw new NotFoundError("User not found.");
  }
  if (user.status === "active" && input.status !== "active") {
    if (await isFinalActiveOwner(input.userId, input.siteId, database)) {
      throw new ForbiddenError("The final active Owner cannot be suspended or demoted.");
    }
  }
  const [updated] = await database
    .update(users)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(eq(users.id, input.userId)))
    .returning();
  return updated;
}
