import { z } from "zod";

const optionalDisplayNameSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(160).optional()
);

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(200, "Password is too long.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[A-Za-z0-9_.-]+$/);

export const emailSchema = z.string().trim().email().max(320);
export const displayNameSchema = z.string().trim().min(1).max(160);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200)
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(320)
});

export const passwordResetSchema = z.object({
  token: z.string().trim().min(20).max(300),
  password: passwordSchema
});

export const emailVerificationSchema = z.object({
  token: z.string().trim().min(20).max(300)
});

export const emailVerificationRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).max(320)
  })
  .strict();

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  displayName: optionalDisplayNameSchema,
  password: passwordSchema
});

export const setupSchema = z.object({
  setupToken: z.string().trim().max(300).optional(),
  siteName: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(240).default("A modern self-hosted wiki"),
  baseUrl: z
    .string()
    .trim()
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Base URL must use HTTP or HTTPS."
    }),
  defaultLocale: z.enum(["en", "zh-CN"]).default("en"),
  registrationMode: z.enum(["open", "email_verification", "invite", "closed"]).default("closed"),
  mediaDriver: z.enum(["local", "s3"]).default("local"),
  ownerUsername: usernameSchema,
  ownerEmail: emailSchema,
  ownerDisplayName: optionalDisplayNameSchema,
  ownerPassword: passwordSchema
});

export const ownerSetupSchema = setupSchema.pick({
  setupToken: true,
  ownerUsername: true,
  ownerEmail: true,
  ownerDisplayName: true,
  ownerPassword: true
});
