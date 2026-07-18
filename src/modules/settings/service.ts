import { eq } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { requirePermissionsForMutation } from "@/modules/authorization/permissions";
import { writeAuditLog } from "@/modules/audit/service";
import { requireSystemEmailConfigured } from "@/modules/auth/email";
import { siteSettingsUpdateSchema, type SiteSettingsUpdate } from "@/modules/settings/schemas";

export {
  defaultAllowedMediaTypes,
  isInlineSafeMediaType,
  isSafeAllowedMediaType,
  MAX_MEDIA_UPLOAD_BYTES,
  normalizeAllowedMediaTypes,
  type SiteSettingsUpdate
} from "@/modules/settings/schemas";

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
  database: RootDatabase = db
) {
  const values = siteSettingsUpdateSchema.parse(input.values);
  return database.transaction(async (tx) => {
    await requirePermissionsForMutation(input.actorId, input.siteId, ["site.configure"], tx);
    if (values.registrationMode === "email_verification") {
      requireSystemEmailConfigured();
    }
    const [updated] = await tx
      .update(siteSettings)
      .set({ ...values, updatedAt: new Date() })
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
        details: { fields: Object.keys(values) }
      },
      tx
    );
    return updated;
  });
}
