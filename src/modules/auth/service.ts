import { eq, sql } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { siteSettings, users } from "@/db/schema";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getPrimarySiteWithSettings } from "@/db/site";
import { writeAuditLog } from "@/modules/audit/service";
import { createUser, findUserForLogin, verifyPassword } from "@/modules/users/service";
import { createSession } from "./session";
import { assertRateLimit } from "./rate-limit";
import { sendEmailVerification } from "./recovery";

export async function login(
  input: { identifier: string; password: string; request?: Request },
  database: Database = db
) {
  await assertRateLimit(
    {
      scope: "auth.login",
      key: `${input.identifier}:${input.request?.headers.get("x-forwarded-for") ?? "local"}`,
      limit: 8,
      windowSeconds: 60 * 10
    },
    database
  );
  const user = await findUserForLogin(input.identifier, database);
  const genericError = new AppError(
    "Invalid username, email, or password.",
    "invalid_credentials",
    401
  );
  if (!user?.passwordHash) {
    await writeAuditLog(
      {
        action: "auth.login_failed",
        targetType: "user",
        details: { identifier: input.identifier }
      },
      database
    );
    throw genericError;
  }
  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    await writeAuditLog(
      {
        action: "auth.login_failed",
        targetType: "user",
        targetId: user.id,
        details: { identifier: input.identifier }
      },
      database
    );
    throw genericError;
  }
  if (user.status !== "active") {
    throw new ForbiddenError("This account is not active.");
  }
  await database
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  const session = await createSession({ userId: user.id, request: input.request }, database);
  const site = await getPrimarySiteWithSettings(database);
  await writeAuditLog(
    {
      siteId: site?.site.id,
      actorId: user.id,
      actorDisplayName: user.displayName,
      action: "auth.login",
      targetType: "user",
      targetId: user.id
    },
    database
  );
  return { user, ...session };
}

export async function registerUser(
  input: {
    username: string;
    email: string;
    displayName?: string;
    password: string;
  },
  database: RootDatabase = db
) {
  let context = await getRegistrationContext(database);
  if (!context) {
    context = await database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('noviqwiki.initial_setup'))`);
      return getRegistrationContext(tx);
    });
  }
  if (!context) {
    throw new AppError("Site setup is required before registration.", "setup_required", 503);
  }
  const { site, registrationMode } = context;
  if (registrationMode === "closed" || registrationMode === "invite") {
    throw new ForbiddenError("Public registration is closed.");
  }
  const status = registrationMode === "email_verification" ? "pending" : "active";
  const user = await createUser(
    { ...input, status, locale: site.settings.defaultLocale },
    database
  );
  await writeAuditLog(
    {
      siteId: site.site.id,
      actorId: user.id,
      actorDisplayName: user.displayName,
      action: "user.created",
      targetType: "user",
      targetId: user.id,
      details: { registrationMode }
    },
    database
  );
  if (registrationMode === "email_verification") {
    await sendEmailVerification(
      { userId: user.id, email: user.email, displayName: user.displayName },
      database
    );
  }
  return user;
}

async function getRegistrationContext(database: Database) {
  const site = await getPrimarySiteWithSettings(database);
  if (!site?.settings) {
    return null;
  }
  const [existingUser] = await database.select({ id: users.id }).from(users).limit(1);
  if (!existingUser) {
    return null;
  }
  return { site, registrationMode: site.settings.registrationMode };
}

export async function updateRegistrationMode(
  siteId: string,
  mode: "open" | "email_verification" | "invite" | "closed",
  database: Database = db
) {
  await database
    .update(siteSettings)
    .set({ registrationMode: mode, updatedAt: new Date() })
    .where(eq(siteSettings.siteId, siteId));
}
