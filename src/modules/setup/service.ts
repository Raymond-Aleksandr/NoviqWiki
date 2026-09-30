import { eq, sql } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { siteSettings, sites } from "@/db/schema";
import { sha256, safeEqual } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { AppError, ForbiddenError } from "@/lib/errors";
import { slugifyTitle } from "@/lib/normalize";
import { writeAuditLog } from "@/modules/audit/service";
import { requireSystemEmailConfigured } from "@/modules/auth/email";
import {
  assignUserToGroup,
  ensureDefaultAuthorization,
  hasActiveOwner
} from "@/modules/authorization/permissions";
import { createUser } from "@/modules/users/service";

export type SetupMode = "initial" | "owner" | "complete";

export type SetupState = {
  mode: SetupMode;
  site: { id: string; name: string } | null;
};

export async function getSetupState(database: Database = db): Promise<SetupState> {
  const [site] = await database.select({ id: sites.id, name: sites.name }).from(sites).limit(1);
  if (!site) {
    return { mode: "initial", site: null };
  }
  return { mode: (await hasActiveOwner(site.id, database)) ? "complete" : "owner", site };
}

export async function getSetupMode(database: Database = db): Promise<SetupMode> {
  return (await getSetupState(database)).mode;
}

export function assertSetupAuthorized(providedToken?: string) {
  const env = getEnv();
  const configuredToken = env.NOVIQWIKI_SETUP_TOKEN?.trim();
  if (env.NODE_ENV !== "production" && !configuredToken) {
    return;
  }
  if (!configuredToken || configuredToken.length < 32) {
    throw new AppError(
      "Initial setup is disabled until NOVIQWIKI_SETUP_TOKEN is configured with at least 32 characters.",
      "setup_token_required",
      503
    );
  }
  if (!providedToken || !safeEqual(sha256(providedToken), sha256(configuredToken))) {
    throw new ForbiddenError("The setup token is invalid.");
  }
}

export async function isSetupRequired(database: Database = db) {
  return (await getSetupMode(database)) !== "complete";
}

export async function completeSetup(
  input: {
    setupToken?: string;
    siteName: string;
    tagline: string;
    baseUrl: string;
    defaultLocale?: "en" | "zh-CN";
    registrationMode: "open" | "email_verification" | "invite" | "closed";
    mediaDriver: "local" | "s3";
    ownerUsername: string;
    ownerEmail: string;
    ownerDisplayName?: string;
    ownerPassword: string;
  },
  database: RootDatabase = db
) {
  assertSetupAuthorized(input.setupToken);
  const configuredMediaDriver = getEnv().NOVIQWIKI_MEDIA_DRIVER;
  if (input.mediaDriver !== configuredMediaDriver) {
    throw new AppError(
      `Media storage is configured as ${configuredMediaDriver}; setup cannot select ${input.mediaDriver}.`,
      "validation_error",
      422
    );
  }
  if (input.registrationMode === "email_verification") {
    requireSystemEmailConfigured();
  }
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('noviqwiki.initial_setup'))`);
    const existing = await tx.select({ id: sites.id }).from(sites).limit(1);
    if (existing.length > 0) {
      throw new Error("Setup has already been completed.");
    }
    const [site] = await tx
      .insert(sites)
      .values({
        name: input.siteName,
        slug: slugifyTitle(input.siteName),
        setupComplete: true
      })
      .returning();
    await tx.insert(siteSettings).values({
      siteId: site.id,
      tagline: input.tagline,
      baseUrl: input.baseUrl,
      defaultLocale: input.defaultLocale ?? "en",
      registrationMode: input.registrationMode,
      mediaDriver: input.mediaDriver,
      homepageTitle: input.siteName,
      homepageIntro: input.tagline
    });
    const { ownerGroupId } = await ensureDefaultAuthorization(site.id, tx);
    const owner = await createUser(
      {
        username: input.ownerUsername,
        email: input.ownerEmail,
        displayName: input.ownerDisplayName,
        password: input.ownerPassword,
        status: "active",
        locale: input.defaultLocale ?? "en"
      },
      tx
    );
    await assignUserToGroup(owner.id, ownerGroupId, tx);
    await writeAuditLog(
      {
        siteId: site.id,
        actorId: owner.id,
        actorDisplayName: owner.displayName,
        action: "setup.complete",
        targetType: "site",
        targetId: site.id,
        details: { siteName: site.name }
      },
      tx
    );
    return { site, owner };
  });
}

export async function bootstrapOwner(
  input: {
    setupToken?: string;
    ownerUsername: string;
    ownerEmail: string;
    ownerDisplayName?: string;
    ownerPassword: string;
  },
  database: RootDatabase = db
) {
  assertSetupAuthorized(input.setupToken);
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('noviqwiki.initial_setup'))`);
    const [site] = await tx.select().from(sites).limit(1);
    if (!site) {
      throw new Error("Site setup has not been completed.");
    }
    if (await hasActiveOwner(site.id, tx)) {
      throw new Error("Setup has already been completed.");
    }
    const [settings] = await tx
      .select({ defaultLocale: siteSettings.defaultLocale })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, site.id))
      .limit(1);
    const { ownerGroupId } = await ensureDefaultAuthorization(site.id, tx);
    const owner = await createUser(
      {
        username: input.ownerUsername,
        email: input.ownerEmail,
        displayName: input.ownerDisplayName,
        password: input.ownerPassword,
        status: "active",
        locale: settings?.defaultLocale ?? "en"
      },
      tx
    );
    await assignUserToGroup(owner.id, ownerGroupId, tx);
    await writeAuditLog(
      {
        siteId: site.id,
        actorId: owner.id,
        actorDisplayName: owner.displayName,
        action: "setup.complete",
        targetType: "site",
        targetId: site.id,
        details: { siteName: site.name, ownerBootstrap: true }
      },
      tx
    );
    return { site, owner };
  });
}
