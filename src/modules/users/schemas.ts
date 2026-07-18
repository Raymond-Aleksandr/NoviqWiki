import { z } from "zod";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
  usernameSchema
} from "@/modules/auth/schemas";

export const managedUserSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    displayName: displayNameSchema.optional(),
    password: passwordSchema,
    locale: z.string().trim().min(1).max(16),
    groupId: z.string().uuid().optional()
  })
  .strict();
