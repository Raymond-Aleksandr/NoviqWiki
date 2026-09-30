import type { Messages } from "@/i18n";

const keys = [
  "firstRunSetup", "setupTitle", "setupIntro", "ownerBootstrapKicker", "ownerBootstrapTitle",
  "ownerBootstrapIntro", "setupStepsLabel", "setupSite", "setupIdentity", "setupSiteDescription",
  "setupAccess", "setupPolicy", "setupAccessDescription", "setupStorage", "setupMedia",
  "setupStorageDescription", "setupOwner", "setupAccount", "setupOwnerDescription", "setupReview",
  "setupLaunch", "setupReviewDescription", "siteName", "tagline", "baseUrl", "defaultLocale",
  "simplifiedChinese", "english", "registration", "mediaStorage", "owner", "username", "email",
  "displayName", "password", "setupToken", "setupTokenDescription", "registrationClosed",
  "registrationClosedDescription", "registrationInvite", "registrationInviteDescription",
  "registrationOpen", "registrationOpenDescription", "registrationEmailVerification",
  "registrationEmailVerificationDescription", "localFilesystem", "localFilesystemDescription",
  "s3Storage", "s3StorageDescription", "setupOneTimeNote", "ownerBootstrapNote", "back", "continue",
  "creatingSite", "creatingOwner", "completeSetup", "completeOwnerSetup", "enterSiteName",
  "enterValidBaseUrl", "enterOwnerUsername", "usernameCharacters", "enterOwnerEmail", "enterSetupToken",
  "passwordLength", "passwordComplexity", "requestInvalid"
] as const satisfies readonly (keyof Messages)[];

export type SetupMessages = Pick<Messages, (typeof keys)[number]>;

export function getSetupMessages(messages: Messages): SetupMessages {
  return Object.fromEntries(keys.map((key) => [key, messages[key]])) as SetupMessages;
}
