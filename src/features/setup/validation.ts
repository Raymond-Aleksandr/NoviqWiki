import type { SetupMessages } from "./messages";
import type { SetupStepId, SetupValues } from "./model";
import { setupSchema } from "@/modules/auth/schemas";

export type SetupValidationIssue = { field: keyof SetupValues; message: string };
type ValidationMessages = Pick<
  SetupMessages,
  "enterSiteName" | "enterValidBaseUrl" | "enterSetupToken" | "enterOwnerUsername" |
  "usernameCharacters" | "enterOwnerEmail" | "passwordLength" | "passwordComplexity" | "requestInvalid"
>;

export function validateSetupStep(
  step: SetupStepId,
  values: SetupValues,
  messages: ValidationMessages,
  setupTokenRequired: boolean
): SetupValidationIssue | undefined {
  const fields = setupSchema.shape;
  if (step === "site") {
    const name = fields.siteName.safeParse(values.siteName);
    if (!name.success) {
      return {
        field: "siteName",
        message: name.error.issues.some(({ code }) => code === "too_small")
          ? messages.enterSiteName
          : messages.requestInvalid
      };
    }
    if (!fields.tagline.safeParse(values.tagline).success) {
      return { field: "tagline", message: messages.requestInvalid };
    }
    try {
      // The backend URL refinement assumes a valid URL. Guard it before sharing that shape.
      const url = new URL(values.baseUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      if (!fields.baseUrl.safeParse(values.baseUrl).success) throw new Error();
    } catch {
      return { field: "baseUrl", message: messages.enterValidBaseUrl };
    }
    if (!fields.defaultLocale.safeParse(values.defaultLocale).success) {
      return { field: "defaultLocale", message: messages.requestInvalid };
    }
  }

  if (step === "access" && !fields.registrationMode.safeParse(values.registrationMode).success) {
    return { field: "registrationMode", message: messages.requestInvalid };
  }

  if (step === "storage" && !fields.mediaDriver.safeParse(values.mediaDriver).success) {
    return { field: "mediaDriver", message: messages.requestInvalid };
  }

  if (step === "owner") {
    if (setupTokenRequired && !values.setupToken.trim()) {
      return { field: "setupToken", message: messages.enterSetupToken };
    }
    if (!fields.setupToken.safeParse(values.setupToken).success) {
      return { field: "setupToken", message: messages.requestInvalid };
    }
    const username = fields.ownerUsername.safeParse(values.ownerUsername);
    if (!username.success) {
      const codes = username.error.issues.map(({ code }) => code);
      return {
        field: "ownerUsername",
        message: codes.includes("too_small")
          ? messages.enterOwnerUsername
          : codes.includes("too_big") ? messages.requestInvalid : messages.usernameCharacters
      };
    }
    if (!fields.ownerEmail.safeParse(values.ownerEmail).success) {
      return { field: "ownerEmail", message: messages.enterOwnerEmail };
    }
    if (!fields.ownerDisplayName.safeParse(values.ownerDisplayName).success) {
      return { field: "ownerDisplayName", message: messages.requestInvalid };
    }
    const password = fields.ownerPassword.safeParse(values.ownerPassword);
    if (!password.success) {
      const codes = password.error.issues.map(({ code }) => code);
      return {
        field: "ownerPassword",
        message: codes.includes("too_small")
          ? messages.passwordLength
          : codes.includes("too_big") ? messages.requestInvalid : messages.passwordComplexity
      };
    }
  }
}
