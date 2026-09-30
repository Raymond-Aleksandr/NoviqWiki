import type { Locale } from "@/i18n";
import type { SetupMessages } from "./messages";

export type SetupMode = "initial" | "owner";

export type SetupValues = {
  setupToken: string;
  siteName: string;
  tagline: string;
  baseUrl: string;
  defaultLocale: Locale;
  registrationMode: "closed" | "open" | "email_verification" | "invite";
  mediaDriver: "local" | "s3";
  ownerUsername: string;
  ownerEmail: string;
  ownerDisplayName: string;
  ownerPassword: string;
};

export type SetupChange = <K extends keyof SetupValues>(key: K, value: SetupValues[K]) => void;
export type SetupStepId = "site" | "access" | "storage" | "owner" | "review";
export type SetupStep = { id: SetupStepId; title: string; eyebrow: string; description: string };

export const registrationOptions = [
  { value: "closed", label: "registrationClosed", description: "registrationClosedDescription" },
  { value: "invite", label: "registrationInvite", description: "registrationInviteDescription" },
  { value: "open", label: "registrationOpen", description: "registrationOpenDescription" },
  { value: "email_verification", label: "registrationEmailVerification", description: "registrationEmailVerificationDescription" }
] as const;

export function createSetupValues({
  siteName,
  tagline,
  baseUrl,
  defaultLocale,
  mediaDriver
}: Pick<SetupValues, "siteName" | "tagline" | "baseUrl" | "defaultLocale" | "mediaDriver">): SetupValues {
  return {
    setupToken: "",
    siteName,
    tagline,
    baseUrl,
    defaultLocale,
    registrationMode: "closed",
    mediaDriver,
    ownerUsername: "",
    ownerEmail: "",
    ownerDisplayName: "",
    ownerPassword: ""
  };
}

export function getSetupSteps(mode: SetupMode, messages: SetupMessages): SetupStep[] {
  const steps: SetupStep[] = [
    { id: "site", title: messages.setupSite, eyebrow: messages.setupIdentity, description: messages.setupSiteDescription },
    { id: "access", title: messages.setupAccess, eyebrow: messages.setupPolicy, description: messages.setupAccessDescription },
    { id: "storage", title: messages.setupStorage, eyebrow: messages.setupMedia, description: messages.setupStorageDescription },
    { id: "owner", title: messages.setupOwner, eyebrow: messages.setupAccount, description: messages.setupOwnerDescription },
    { id: "review", title: messages.setupReview, eyebrow: messages.setupLaunch, description: messages.setupReviewDescription }
  ];
  return mode === "owner" ? steps.filter(({ id }) => id === "owner" || id === "review") : steps;
}

export function registrationLabel(mode: SetupValues["registrationMode"], messages: SetupMessages) {
  const option = registrationOptions.find(({ value }) => value === mode)!;
  return messages[option.label];
}
