export const permissionKeys = [
  "site.view",
  "site.configure",
  "page.read",
  "page.create",
  "page.edit",
  "page.publish",
  "page.protect",
  "page.rename",
  "page.delete",
  "page.restore",
  "page.rollback",
  "revision.read",
  "media.read",
  "media.upload",
  "media.delete",
  "user.read",
  "user.manage",
  "group.read",
  "group.manage",
  "role.read",
  "role.manage",
  "audit.read",
  "backup.create"
] as const;

export type PermissionKey = (typeof permissionKeys)[number];
