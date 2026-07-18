import { z } from "zod";
import { AppError } from "@/lib/errors";
import { MAX_PAGE_SLUG_LENGTH } from "@/modules/pages/title";

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_SETTINGS_URL_LENGTH = 2_048;
export const MAX_SETTINGS_TEXT_LENGTH = 50_000;
export const MAX_SEO_DESCRIPTION_LENGTH = 5_000;
export const MAX_FEATURED_ITEMS = 12;
export const MAX_ALLOWED_MEDIA_TYPES = 32;
export const MAX_MIME_TYPE_LENGTH = 255;

export const defaultAllowedMediaTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf"
] as const;

const mimeTypePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const activeMediaTypes = new Set([
  "application/javascript",
  "application/x-httpd-php",
  "application/xhtml+xml",
  "application/xml",
  "image/svg+xml",
  "text/html",
  "text/javascript",
  "text/xml"
]);
const inlineMediaTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export function isSafeAllowedMediaType(value: string) {
  const mimeType = value.trim().toLowerCase();
  return (
    mimeTypePattern.test(mimeType) && !activeMediaTypes.has(mimeType) && !mimeType.endsWith("+xml")
  );
}

export function isInlineSafeMediaType(value: string) {
  return inlineMediaTypes.has(value.trim().toLowerCase());
}

const allowedMediaTypesSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(MAX_MIME_TYPE_LENGTH)
      .refine(isSafeAllowedMediaType, "Allowed media types must be valid safe MIME types.")
  )
  .min(1, "Allowed media types must include at least one MIME type.")
  .max(MAX_ALLOWED_MEDIA_TYPES)
  .transform(uniqueValues);

export function normalizeAllowedMediaTypes(input: string | string[]) {
  const values = (Array.isArray(input) ? input : [input])
    .flatMap((value) => value.split(/[,\s]+/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (values.length === 0) {
    throw new AppError(
      "Allowed media types must include at least one MIME type.",
      "validation_error",
      422
    );
  }
  const parsed = allowedMediaTypesSchema.safeParse(values);
  if (!parsed.success) {
    throw new AppError(
      "Allowed media types must be valid safe MIME types.",
      "validation_error",
      422,
      {
        mimeType: values.find((value) => !isSafeAllowedMediaType(value))
      }
    );
  }
  return parsed.data;
}

const absoluteHttpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SETTINGS_URL_LENGTH)
  .refine(isAbsoluteHttpUrl, "URL must use HTTP or HTTPS.");

const publicUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SETTINGS_URL_LENGTH)
  .refine(isPublicUrl, "URL must be an HTTP(S) URL or a root-relative public path.");

const featuredItemsSchema = z
  .array(z.string().trim().min(1).max(MAX_PAGE_SLUG_LENGTH))
  .max(MAX_FEATURED_ITEMS)
  .transform(uniqueValues);

export const homepageSectionsSchema = z.strictObject({
  search: z.boolean(),
  featured: z.boolean(),
  recent: z.boolean(),
  categories: z.boolean(),
  layout: z.enum(["classic", "portal", "compact"]).optional(),
  showLogo: z.boolean().optional()
});

const siteSettingsShape = {
  tagline: z.string().max(240),
  baseUrl: absoluteHttpUrlSchema,
  logoUrl: publicUrlSchema.nullable(),
  faviconUrl: publicUrlSchema.nullable(),
  defaultLocale: z.enum(["en", "zh-CN"]),
  defaultAppearance: z.enum(["system", "light", "dark"]),
  publicMode: z.boolean(),
  registrationMode: z.enum(["open", "email_verification", "invite", "closed"]),
  defaultHomepage: z.string().max(220),
  footerContent: z.string().max(MAX_SETTINGS_TEXT_LENGTH),
  uploadMaxBytes: z.number().int().min(1).max(MAX_MEDIA_UPLOAD_BYTES),
  allowedMediaTypes: allowedMediaTypesSchema,
  homepageTitle: z.string().max(220),
  homepageIntro: z.string().max(MAX_SETTINGS_TEXT_LENGTH),
  homepageFeaturedPages: featuredItemsSchema,
  homepageFeaturedCategories: featuredItemsSchema,
  homepageSections: homepageSectionsSchema,
  seoTitle: z.string().max(220).nullable(),
  seoDescription: z.string().max(MAX_SEO_DESCRIPTION_LENGTH).nullable()
};

export const siteSettingsUpdateSchema = z.strictObject(siteSettingsShape).partial();
export type SiteSettingsUpdate = z.infer<typeof siteSettingsUpdateSchema>;

const checkboxSchema = z.preprocess((value) => value === "on", z.boolean());
const nullablePublicUrlFormSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? value : null),
  publicUrlSchema.nullable()
);
const nullableTextFormSchema = (schema: z.ZodType<string>) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null),
    schema.nullable()
  );
const emptyTextFormSchema = (schema: z.ZodType<string>) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : ""),
    schema
  );
const featuredItemsFormSchema = z
  .union([z.string(), z.undefined()])
  .transform((value) =>
    (value ?? "")
      .split(/[,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  )
  .pipe(featuredItemsSchema);
const allowedMediaTypesFormSchema = z.string().transform(normalizeAllowedMediaTypes);

export const settingsFormSchema = z
  .object({
    tagline: siteSettingsShape.tagline,
    baseUrl: siteSettingsShape.baseUrl,
    logoUrl: nullablePublicUrlFormSchema,
    faviconUrl: nullablePublicUrlFormSchema,
    defaultLocale: siteSettingsShape.defaultLocale,
    publicMode: checkboxSchema,
    registrationMode: siteSettingsShape.registrationMode,
    defaultHomepage: siteSettingsShape.defaultHomepage,
    homepageTitle: siteSettingsShape.homepageTitle,
    homepageIntro: siteSettingsShape.homepageIntro,
    homepageFeaturedPages: featuredItemsFormSchema,
    homepageFeaturedCategories: featuredItemsFormSchema,
    homepageSearch: checkboxSchema,
    homepageFeatured: checkboxSchema,
    homepageRecent: checkboxSchema,
    homepageCategories: checkboxSchema,
    homepageLayout: z.enum(["classic", "portal", "compact"]),
    homepageShowLogo: checkboxSchema,
    footerContent: emptyTextFormSchema(siteSettingsShape.footerContent),
    uploadMaxBytes: z.preprocess(
      (value) => value ?? 5_242_880,
      z.coerce.number().int().min(1).max(MAX_MEDIA_UPLOAD_BYTES)
    ),
    allowedMediaTypes: allowedMediaTypesFormSchema,
    seoTitle: nullableTextFormSchema(z.string().max(220)),
    seoDescription: nullableTextFormSchema(z.string().max(MAX_SEO_DESCRIPTION_LENGTH))
  })
  .transform((values) =>
    siteSettingsUpdateSchema.parse({
      tagline: values.tagline,
      baseUrl: values.baseUrl,
      logoUrl: values.logoUrl,
      faviconUrl: values.faviconUrl,
      defaultLocale: values.defaultLocale,
      publicMode: values.publicMode,
      registrationMode: values.registrationMode,
      defaultHomepage: values.defaultHomepage,
      homepageTitle: values.homepageTitle,
      homepageIntro: values.homepageIntro,
      homepageFeaturedPages: values.homepageFeaturedPages,
      homepageFeaturedCategories: values.homepageFeaturedCategories,
      homepageSections: {
        search: values.homepageSearch,
        featured: values.homepageFeatured,
        recent: values.homepageRecent,
        categories: values.homepageCategories,
        layout: values.homepageLayout,
        showLogo: values.homepageShowLogo
      },
      footerContent: values.footerContent,
      uploadMaxBytes: values.uploadMaxBytes,
      allowedMediaTypes: values.allowedMediaTypes,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription
    })
  );

function isAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function isPublicUrl(value: string) {
  if (isAbsoluteHttpUrl(value)) {
    return true;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  try {
    return new URL(value, "https://noviqwiki.invalid").origin === "https://noviqwiki.invalid";
  } catch {
    return false;
  }
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}
