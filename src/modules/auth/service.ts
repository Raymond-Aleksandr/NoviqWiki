import { and, eq, sql } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { groups, siteSettings, users } from "@/db/schema";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getPrimarySiteWithSettings } from "@/db/site";
import { writeAuditLog } from "@/modules/audit/service";
import { assignUserToGroup, hasActiveOwner } from "@/modules/authorization/permissions";
import {
  findUserForLogin,
  hashPassword,
  insertPreparedUser,
  normalizeLoginIdentifier,
  prepareUserCredentials,
  verifyPassword
} from "@/modules/users/service";
import { createSession, getRequestMetadata } from "./session";
import { assertRateLimit } from "./rate-limit";
import { sendEmailVerification } from "./recovery";
import { requireSystemEmailConfigured } from "./email";

let dummyPasswordHash: Promise<string> | undefined;

export async function login(
  input: { identifier: string; password: string; request?: Request; clientKey?: string },
  database: RootDatabase = db
) {
  const normalizedIdentifier = normalizeLoginIdentifier(input.identifier);
  const requestMetadata = input.request ? await getRequestMetadata(input.request) : null;
  const clientKey = input.clientKey ?? requestMetadata?.ipHash ?? undefined;
  if (clientKey) {
    await assertRateLimit(
      {
        scope: "auth.login.source",
        key: clientKey,
        limit: 50,
        windowSeconds: 60 * 10
      },
      database
    );
  }
  await assertRateLimit(
    {
      scope: "auth.login.global",
      key: "all",
      limit: 1_000,
      windowSeconds: 60 * 10
    },
    database
  );
  await assertRateLimit(
    {
      scope: "auth.login.account",
      key: normalizedIdentifier,
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
  const fallbackHash = await getDummyPasswordHash();
  const valid = await verifyPassword(user?.passwordHash ?? fallbackHash, input.password);
  if (!user?.passwordHash || !valid) {
    await writeAuditLog(
      {
        action: "auth.login_failed",
        targetType: "user",
        targetId: user?.id,
        details: { identifier: normalizedIdentifier }
      },
      database
    );
    throw genericError;
  }
  if (user.status !== "active") {
    throw new ForbiddenError("This account is not active.");
  }
  const committed = await database.transaction(async (tx) => {
    const [currentUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .for("update");
    if (!currentUser?.passwordHash || currentUser.passwordHash !== user.passwordHash) {
      throw genericError;
    }
    if (currentUser.status !== "active") {
      throw new ForbiddenError("This account is not active.");
    }
    const [updatedUser] = await tx
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, currentUser.id))
      .returning();
    const session = await createSession({ userId: currentUser.id, request: input.request }, tx);
    return { user: updatedUser, ...session };
  });
  const site = await getPrimarySiteWithSettings(database);
  await writeAuditLog(
    {
      siteId: site?.site.id,
      actorId: committed.user.id,
      actorDisplayName: committed.user.displayName,
      action: "auth.login",
      targetType: "user",
      targetId: committed.user.id
    },
    database
  );
  return committed;
}

export async function registerUser(
  input: {
    username: string;
    email: string;
    displayName?: string;
    password: string;
    clientKey?: string;
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
  const { site } = context;
  assertPublicRegistrationAllowed(context.registrationMode);
  if (input.clientKey) {
    await assertRateLimit(
      {
        scope: "auth.register.source",
        key: input.clientKey,
        limit: 5,
        windowSeconds: 60 * 60
      },
      database
    );
  }
  await assertRateLimit(
    {
      scope: "auth.register.global",
      key: "all",
      limit: 100,
      windowSeconds: 60 * 60
    },
    database
  );
  const prepared = await prepareUserCredentials(input);
  const committed = await database.transaction(async (tx) => {
    const [settings] = await tx
      .select({
        registrationMode: siteSettings.registrationMode,
        defaultLocale: siteSettings.defaultLocale
      })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, site.site.id))
      .limit(1)
      .for("share");
    if (!settings) {
      throw new AppError("Site setup is required before registration.", "setup_required", 503);
    }
    assertPublicRegistrationAllowed(settings.registrationMode);
    const [readerGroup] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.siteId, site.site.id), eq(groups.normalizedName, "readers")))
      .limit(1);
    if (!readerGroup) {
      throw new AppError("Default authorization is not configured.", "invalid_state", 500);
    }
    const user = await insertPreparedUser(
      {
        ...prepared,
        status: settings.registrationMode === "email_verification" ? "pending" : "active",
        locale: settings.defaultLocale
      },
      tx
    );
    await assignUserToGroup(user.id, readerGroup.id, tx);
    await writeAuditLog(
      {
        siteId: site.site.id,
        actorId: user.id,
        actorDisplayName: user.displayName,
        action: "user.created",
        targetType: "user",
        targetId: user.id,
        details: { registrationMode: settings.registrationMode }
      },
      tx
    );
    return { user, registrationMode: settings.registrationMode };
  });
  if (committed.registrationMode === "email_verification") {
    await sendEmailVerification({ userId: committed.user.id }, database);
  }
  return committed.user;
}

async function getRegistrationContext(database: Database) {
  const site = await getPrimarySiteWithSettings(database);
  if (!site?.settings) {
    return null;
  }
  if (!(await hasActiveOwner(site.site.id, database))) {
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

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword("NoviqWikiTimingFallback123");
  return dummyPasswordHash;
}

function assertPublicRegistrationAllowed(
  mode: "open" | "email_verification" | "invite" | "closed"
) {
  if (mode === "closed" || mode === "invite") {
    throw new ForbiddenError("Public registration is closed.");
  }
  if (mode === "email_verification") {
    requireSystemEmailConfigured();
  }
}
