import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { writeAuditLog } from "@/modules/audit/service";

export const defaultAllowedMediaTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf"
] as const;

const unsafeSvgMime = "image/svg+xml";
const mimeTypePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

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
  homepageSections: {
    search: boolean;
    featured: boolean;
    recent: boolean;
    categories: boolean;
    layout?: "classic" | "portal" | "compact";
    showLogo?: boolean;
  };
  seoTitle: string | null;
  seoDescription: string | null;
}>;

export function normalizeAllowedMediaTypes(input: string | string[]) {
  const values = (Array.isArray(input) ? input : [input])
    .flatMap((value) => value.split(/[,\s]+/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  if (unique.length === 0) {
    throw new AppError(
      "Allowed media types must include at least one MIME type.",
      "validation_error",
      422
    );
  }
  const invalid = unique.find((value) => value === unsafeSvgMime || !mimeTypePattern.test(value));
  if (invalid) {
    throw new AppError(
      "Allowed media types must be valid safe MIME types.",
      "validation_error",
      422,
      {
        mimeType: invalid
      }
    );
  }
  return unique;
}

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
