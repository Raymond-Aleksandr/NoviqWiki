import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { sites, siteSettings } from "@/db/schema";

export async function getPrimarySite(database: Database = db) {
  const [site] = await database.select().from(sites).limit(1);
  return site ?? null;
}

export async function getPrimarySiteWithSettings(database: Database = db) {
  const [site] = await database.select().from(sites).limit(1);
  if (!site) {
    return null;
  }
  const [settings] = await database
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.siteId, site.id))
    .limit(1);
  return { site, settings: settings ?? null };
}
