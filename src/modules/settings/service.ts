import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { writeAuditLog } from "@/modules/audit/service";

export type SiteSettingsUpdate = Partial<{
  tagline: string;
  baseUrl: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  defaultLocale: string;
  defaultAppearance: "system" | "light" | "dark";
  publicMode: boolean;
  registrationMode: "open" | "email_verification" | "invite" | "closed";
  defaultHomepage: string;
  footerContent: string;
  uploadMaxBytes: number;
  allowedMediaTypes: string[];
  homepageTitle: string;
  homepageIntro: string;
  homepageFeaturedPages: string[];
  homepageFeaturedCategories: string[];
  seoTitle: string | null;
  seoDescription: string | null;
}>;

export async function getSiteSettings(siteId: string, database: Database = db) {
  const [settings] = await database
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.siteId, siteId))
    .limit(1);
  return settings ?? null;
}

export async function updateSiteSettings(
  input: {
    siteId: string;
    actorId: string;
    actorDisplayName: string;
    values: SiteSettingsUpdate;
  },
  database: Database = db
) {
  const [updated] = await database
    .update(siteSettings)
    .set({ ...input.values, updatedAt: new Date() })
    .where(eq(siteSettings.siteId, input.siteId))
    .returning();
  await writeAuditLog(
    {
      siteId: input.siteId,
      actorId: input.actorId,
      actorDisplayName: input.actorDisplayName,
      action: "settings.updated",
      targetType: "site",
      targetId: input.siteId,
      details: { fields: Object.keys(input.values) }
    },
    database
  );
  return updated;
}
