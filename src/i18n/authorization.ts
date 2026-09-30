import type { Messages } from "@/i18n";

type NamedAuthorizationItem = {
  name: string;
  normalizedName?: string | null;
  description?: string | null;
  builtIn?: boolean | null;
};

const roleNameKeys = {
  reader: "roleReader",
  contributor: "roleContributor",
  editor: "roleEditor",
  moderator: "roleModerator",
  administrator: "roleAdministrator",
  owner: "roleOwner"
} as const;

const roleDescriptionKeys = {
  reader: "roleReaderDescription",
  contributor: "roleContributorDescription",
  editor: "roleEditorDescription",
  moderator: "roleModeratorDescription",
  administrator: "roleAdministratorDescription",
  owner: "roleOwnerDescription"
} as const;

const groupNameKeys = {
  owners: "groupOwners",
  readers: "groupReaders"
} as const;

const groupDescriptionKeys = {
  owners: "groupOwnersDescription",
  readers: "groupReadersDescription"
} as const;

export function roleDisplayName(role: NamedAuthorizationItem, messages: Messages) {
  const normalizedName = normalized(role);
  const key = normalizedName ? roleNameKeys[normalizedName as keyof typeof roleNameKeys] : null;
  return key ? messages[key] : role.name;
}

export function roleDescription(role: NamedAuthorizationItem, messages: Messages) {
  const normalizedName = normalized(role);
  const key = normalizedName
    ? roleDescriptionKeys[normalizedName as keyof typeof roleDescriptionKeys]
    : null;
  return key ? messages[key] : role.description || messages.noDescriptionProvided;
}

export function groupDisplayName(group: NamedAuthorizationItem, messages: Messages) {
  const normalizedName = normalized(group);
  const key = normalizedName ? groupNameKeys[normalizedName as keyof typeof groupNameKeys] : null;
  return key ? messages[key] : group.name;
}

export function groupDescription(group: NamedAuthorizationItem, messages: Messages) {
  const normalizedName = normalized(group);
  const key = normalizedName
    ? groupDescriptionKeys[normalizedName as keyof typeof groupDescriptionKeys]
    : null;
  return key ? messages[key] : group.description || messages.noDescriptionProvided;
}

function normalized(item: NamedAuthorizationItem) {
  return item.builtIn === false ? null : item.normalizedName?.trim().toLowerCase();
}
