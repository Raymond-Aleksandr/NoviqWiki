import { sql } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { siteSettings, sites } from "@/db/schema";
import { slugifyTitle } from "@/lib/normalize";
import { writeAuditLog } from "@/modules/audit/service";
import { assignUserToGroup, ensureDefaultAuthorization } from "@/modules/authorization/permissions";
import { createUser } from "@/modules/users/service";

export async function isSetupRequired(database: Database = db) {
  const [{ count }] = await database.select({ count: sql<number>`count(*)::int` }).from(sites);
  return count === 0;
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
