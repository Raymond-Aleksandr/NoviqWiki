import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { db, type Database, type RootDatabase } from "@/db/client";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  sites,
  users,
  type User
} from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { normalizeEmail, normalizeUsername } from "@/lib/normalize";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
  usernameSchema
} from "@/modules/auth/schemas";
import {
  isFinalActiveOwner,
  requirePermission,
  requireOwnerForOwnerAccount,
  updateUserGroups
} from "@/modules/authorization/permissions";
import { writeAuditLog } from "@/modules/audit/service";
import { managedUserSchema } from "@/modules/users/schemas";

export type SafeUser = Pick<
  User,
  | "id"
  | "username"
  | "email"
  | "displayName"
  | "status"
  | "locale"
  | "appearance"
  | "emailVerifiedAt"
  | "lastLoginAt"
  | "createdAt"
  | "updatedAt"
>;

const safeUserColumns = {
  id: users.id,
  username: users.username,
  email: users.email,
  displayName: users.displayName,
  status: users.status,
  locale: users.locale,
  appearance: users.appearance,
  emailVerifiedAt: users.emailVerifiedAt,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
};

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    locale: user.locale,
    appearance: user.appearance,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

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

export type CreateUserInput = {
  username: string;
  email: string;
  password?: string;
  displayName?: string;
  status?: "active" | "suspended" | "pending";
  locale?: string;
};

export type PreparedUserCredentials = {
  username: string;
  normalizedUsername: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  passwordHash: string | null;
};

export async function prepareUserCredentials(
  input: Pick<CreateUserInput, "username" | "email" | "password" | "displayName">
): Promise<PreparedUserCredentials> {
  const username = usernameSchema.parse(input.username);
  const email = emailSchema.parse(input.email);
  const displayName = input.displayName ? displayNameSchema.parse(input.displayName) : username;
  const password = input.password === undefined ? undefined : passwordSchema.parse(input.password);
  return {
    username,
    normalizedUsername: normalizeUsername(username),
    email,
    normalizedEmail: normalizeEmail(email),
    displayName,
    passwordHash: password ? await hashPassword(password) : null
  };
}

export async function insertPreparedUser(
  input: PreparedUserCredentials & Pick<CreateUserInput, "status" | "locale">,
  database: Database = db
) {
  const existing = await database
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.normalizedUsername, input.normalizedUsername),
        eq(users.normalizedEmail, input.normalizedEmail)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    throw new ConflictError("A user with that username or email already exists.");
  }
  const [user] = await database
    .insert(users)
    .values({
      username: input.username,
      normalizedUsername: input.normalizedUsername,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      status: input.status ?? "active",
      locale: input.locale ?? "en"
    })
    .returning();
  return user;
}

export async function createUser(input: CreateUserInput, database: Database = db) {
  const prepared = await prepareUserCredentials(input);
  return insertPreparedUser({ ...prepared, status: input.status, locale: input.locale }, database);
}

export async function createManagedUser(
  input: {
    siteId: string;
    username: string;
    email: string;
    password: string;
    displayName?: string;
    locale?: string;
    groupId?: string;
    actorId: string;
    actorDisplayName: string;
  },
  database: RootDatabase = db
) {
  const values = managedUserSchema.parse({
    username: input.username,
    email: input.email,
    displayName: input.displayName,
    password: input.password,
    locale: input.locale ?? "en",
    groupId: input.groupId
  });
  return database.transaction(async (tx) => {
    await lockUserManagementSite(input.siteId, tx);
    await requirePermission(input.actorId, input.siteId, "user.manage", tx);
    const user = await createUser(
      {
        username: values.username,
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        status: "active",
        locale: values.locale
      },
      tx
    );
    if (values.groupId) {
      await updateUserGroups(
        {
          siteId: input.siteId,
          userId: user.id,
          groupIds: [values.groupId],
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName
        },
        tx as unknown as RootDatabase
      );
    }
    await writeAuditLog(
      {
        siteId: input.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "user.created",
        targetType: "user",
        targetId: user.id,
        details: { username: user.username, groupId: input.groupId ?? null }
      },
      tx
    );
    return user;
  });
}

export async function findUserForLogin(identifier: string, database: Database = db) {
  const normalized = normalizeLoginIdentifier(identifier);
  const [user] = await database
    .select()
    .from(users)
    .where(or(eq(users.normalizedUsername, normalized), eq(users.normalizedEmail, normalized)))
    .limit(1);
  return user ?? null;
}

export function normalizeLoginIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export async function listUsers(
  input: { query?: string; limit?: number; offset?: number },
  database: Database = db
) {
  const conditions = input.query
    ? or(ilike(users.username, `%${input.query}%`), ilike(users.email, `%${input.query}%`))
    : undefined;
  const query = database
    .select(safeUserColumns)
    .from(users)
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return conditions ? query.where(conditions) : query;
}

export async function setUserStatus(
  input: {
    siteId: string;
    userId: string;
    status: "active" | "suspended" | "pending";
    actorId?: string;
    actorDisplayName?: string;
  },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    await lockUserManagementSite(input.siteId, tx);
    if (input.actorId) {
      await requirePermission(input.actorId, input.siteId, "user.manage", tx);
    }
    const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) {
      throw new NotFoundError("User not found.");
    }
    await requireOwnerForOwnerAccount(
      {
        siteId: input.siteId,
        targetUserId: user.id,
        actorId: input.actorId
      },
      tx
    );
    if (user.status === "active" && input.status !== "active") {
      if (await isFinalActiveOwner(input.userId, input.siteId, tx)) {
        throw new ForbiddenError("The final active Owner cannot be suspended or demoted.");
      }
    }

    const now = new Date();
    const [updated] = await tx
      .update(users)
      .set({ status: input.status, updatedAt: now })
      .where(eq(users.id, input.userId))
      .returning();

    if (input.status === "suspended") {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailVerificationTokens.userId, input.userId),
            isNull(emailVerificationTokens.consumedAt)
          )
        );
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(
          and(eq(passwordResetTokens.userId, input.userId), isNull(passwordResetTokens.consumedAt))
        );
      await tx
        .update(sessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(and(eq(sessions.userId, input.userId), isNull(sessions.revokedAt)));
    }

    if (input.actorId && user.status !== input.status) {
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: input.status === "active" ? "user.activated" : "user.suspended",
          targetType: "user",
          targetId: user.id,
          details: { previousStatus: user.status, status: input.status }
        },
        tx
      );
    }
    return updated;
  });
}

export async function resetManagedUserSessions(
  input: { siteId: string; userId: string; actorId: string; actorDisplayName?: string },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    await lockUserManagementSite(input.siteId, tx);
    await requirePermission(input.actorId, input.siteId, "user.manage", tx);
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!user) {
      throw new NotFoundError("User not found.");
    }
    await requireOwnerForOwnerAccount(
      {
        siteId: input.siteId,
        targetUserId: user.id,
        actorId: input.actorId
      },
      tx
    );
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    await writeAuditLog(
      {
        siteId: input.siteId,
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        action: "user.updated",
        targetType: "user",
        targetId: user.id,
        details: { reason: "sessions_reset" }
      },
      tx
    );
  });
}

async function lockUserManagementSite(siteId: string, database: Database) {
  // Match authorization's NO KEY UPDATE mode so all Owner invariants serialize
  // without competing with unrelated FK checks on the site row.
  await database.execute(
    sql`select ${sites.id} from ${sites} where ${sites.id} = ${siteId} for no key update`
  );
}
