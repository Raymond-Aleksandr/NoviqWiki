import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(200, "Password is too long.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

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

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_.-]+$/),
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(160).optional(),
  password: passwordSchema
});

export const setupSchema = z.object({
  siteName: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(240).default("A modern self-hosted wiki"),
  baseUrl: z.string().trim().url(),
  registrationMode: z.enum(["open", "email_verification", "invite", "closed"]).default("closed"),
  mediaDriver: z.enum(["local", "s3"]).default("local"),
  ownerUsername: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_.-]+$/),
  ownerEmail: z.string().trim().email().max(320),
  ownerDisplayName: z.string().trim().min(1).max(160).optional(),
  ownerPassword: passwordSchema
});
