import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://nextwiki:nextwiki@localhost:5432/nextwiki"),
  NEXTWIKI_BASE_URL: z.string().url().default("http://localhost:3000"),
  NEXTWIKI_SECRET: z.string().optional(),
  NEXTWIKI_MEDIA_DRIVER: z.enum(["local", "s3"]).default("local"),
  NEXTWIKI_MEDIA_ROOT: z.string().default("./media"),
  NEXTWIKI_STORAGE_PUBLIC_PATH: z.string().default("/media"),
  NEXTWIKI_SMTP_URL: z.string().optional(),
  NEXTWIKI_EMAIL_FROM: z.string().optional(),
  NEXTWIKI_S3_ENDPOINT: z.string().optional(),
  NEXTWIKI_S3_REGION: z.string().default("us-east-1"),
  NEXTWIKI_S3_BUCKET: z.string().optional(),
  NEXTWIKI_S3_ACCESS_KEY_ID: z.string().optional(),
  NEXTWIKI_S3_SECRET_ACCESS_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = envSchema.parse(process.env);
  const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (
    parsed.NODE_ENV === "production" &&
    !isProductionBuild &&
    (!parsed.NEXTWIKI_SECRET || parsed.NEXTWIKI_SECRET.length < 32)
  ) {
    throw new Error("NEXTWIKI_SECRET must be at least 32 characters in production.");
  }
  if (parsed.NEXTWIKI_MEDIA_DRIVER === "s3") {
    const missing = [
      ["NEXTWIKI_S3_ENDPOINT", parsed.NEXTWIKI_S3_ENDPOINT],
      ["NEXTWIKI_S3_BUCKET", parsed.NEXTWIKI_S3_BUCKET],
      ["NEXTWIKI_S3_ACCESS_KEY_ID", parsed.NEXTWIKI_S3_ACCESS_KEY_ID],
      ["NEXTWIKI_S3_SECRET_ACCESS_KEY", parsed.NEXTWIKI_S3_SECRET_ACCESS_KEY]
    ].filter(([, value]) => !value);
    if (missing.length > 0) {
      throw new Error(
        `S3 storage is configured but missing ${missing.map(([key]) => key).join(", ")}.`
      );
    }
  }
  cachedEnv = parsed;
  return parsed;
}

export function getDatabaseUrl() {
  return getEnv().DATABASE_URL;
}

export function getAppSecret() {
  const env = getEnv();
  if (env.NEXTWIKI_SECRET) {
    return env.NEXTWIKI_SECRET;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("NEXTWIKI_SECRET is required in production.");
  }
  return "development-only-secret-change-before-production-000000";
}
