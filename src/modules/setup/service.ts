import { eq, sql } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { siteSettings, sites, users } from "@/db/schema";
import { slugifyTitle } from "@/lib/normalize";
import { writeAuditLog } from "@/modules/audit/service";
import { assignUserToGroup, ensureDefaultAuthorization } from "@/modules/authorization/permissions";
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
  const [user] = await database.select({ id: users.id }).from(users).limit(1);
  return { mode: user ? "complete" : "owner", site };
}

export async function getSetupMode(database: Database = db): Promise<SetupMode> {
  return (await getSetupState(database)).mode;
}

export async function isSetupRequired(database: Database = db) {
  return (await getSetupMode(database)) !== "complete";
}

export async function completeSetup(
  input: {
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
    ownerUsername: string;
    ownerEmail: string;
    ownerDisplayName?: string;
    ownerPassword: string;
  },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('noviqwiki.initial_setup'))`);
    const [site] = await tx.select().from(sites).limit(1);
    if (!site) {
      throw new Error("Site setup has not been completed.");
    }
    const [existingUser] = await tx.select({ id: users.id }).from(users).limit(1);
    if (existingUser) {
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
