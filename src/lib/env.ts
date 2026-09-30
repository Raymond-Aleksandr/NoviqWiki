import { z } from "zod";

const optionalTrustedProxyHops = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().min(1).max(16).optional()
);

const absoluteHttpUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Must use the HTTP or HTTPS protocol.");

const optionalSmtpUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .url()
    .refine((value) => ["smtp:", "smtps:"].includes(new URL(value).protocol), {
      message: "Must use the SMTP or SMTPS protocol."
    })
    .optional()
);

const optionalEmailFrom = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((value) => !/[\r\n]/.test(value), "Must not contain line breaks.")
    .optional()
);

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki"),
  NOVIQWIKI_BASE_URL: absoluteHttpUrl.default("http://localhost:3000"),
  NOVIQWIKI_SECRET: z.string().optional(),
  NOVIQWIKI_SETUP_TOKEN: z.string().optional(),
  NOVIQWIKI_TRUSTED_PROXY_HOPS: optionalTrustedProxyHops,
  NOVIQWIKI_MEDIA_DRIVER: z.enum(["local", "s3"]).default("local"),
  NOVIQWIKI_MEDIA_ROOT: z.string().default("./media"),
  NOVIQWIKI_STORAGE_PUBLIC_PATH: z.literal("/media").default("/media"),
  NOVIQWIKI_SMTP_URL: optionalSmtpUrl,
  NOVIQWIKI_EMAIL_FROM: optionalEmailFrom,
  NOVIQWIKI_S3_ENDPOINT: z.string().optional(),
  NOVIQWIKI_S3_REGION: z.string().default("us-east-1"),
  NOVIQWIKI_S3_BUCKET: z.string().optional(),
  NOVIQWIKI_S3_ACCESS_KEY_ID: z.string().optional(),
  NOVIQWIKI_S3_SECRET_ACCESS_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }
  cachedEnv = parseAppEnv(process.env);
  return cachedEnv;
}

export function parseAppEnv(environment: NodeJS.ProcessEnv) {
  const parsed = envSchema.parse(environment);
  const isProductionBuild = environment.NEXT_PHASE === "phase-production-build";
  if (
    parsed.NODE_ENV === "production" &&
    !isProductionBuild &&
    (!parsed.NOVIQWIKI_SECRET || parsed.NOVIQWIKI_SECRET.length < 32)
  ) {
    throw new Error("NOVIQWIKI_SECRET must be at least 32 characters in production.");
  }
  if (parsed.NODE_ENV === "production" && !isProductionBuild && !environment.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL must be explicitly configured in production.");
  }
  if (
    parsed.NODE_ENV === "production" &&
    !isProductionBuild &&
    !environment.NOVIQWIKI_BASE_URL?.trim()
  ) {
    throw new Error("NOVIQWIKI_BASE_URL must be explicitly configured in production.");
  }
  if (parsed.NOVIQWIKI_MEDIA_DRIVER === "s3") {
    const missing = [
      ["NOVIQWIKI_S3_ENDPOINT", parsed.NOVIQWIKI_S3_ENDPOINT],
      ["NOVIQWIKI_S3_BUCKET", parsed.NOVIQWIKI_S3_BUCKET],
      ["NOVIQWIKI_S3_ACCESS_KEY_ID", parsed.NOVIQWIKI_S3_ACCESS_KEY_ID],
      ["NOVIQWIKI_S3_SECRET_ACCESS_KEY", parsed.NOVIQWIKI_S3_SECRET_ACCESS_KEY]
    ].filter(([, value]) => !value);
    if (missing.length > 0) {
      throw new Error(
        `S3 storage is configured but missing ${missing.map(([key]) => key).join(", ")}.`
      );
    }
  }
  return parsed;
}

export function getDatabaseUrl() {
  return getEnv().DATABASE_URL;
}

export function canonicalApplicationBaseUrl(
  environment: Pick<AppEnv, "NOVIQWIKI_BASE_URL" | "NODE_ENV"> = getEnv(),
  siteBaseUrl?: string | null
) {
  if (environment.NODE_ENV === "production") {
    return environment.NOVIQWIKI_BASE_URL;
  }
  return siteBaseUrl ?? environment.NOVIQWIKI_BASE_URL;
}

export function getAppSecret() {
  const env = getEnv();
  if (env.NOVIQWIKI_SECRET) {
    return env.NOVIQWIKI_SECRET;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("NOVIQWIKI_SECRET is required in production.");
  }
  return "development-only-secret-change-before-production-000000";
}
