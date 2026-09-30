import type { en } from "@/i18n/en";

type Messages = typeof en;

const auditActionMessageKeys = {
  "setup.complete": "auditActionSetupComplete",
  "auth.login": "auditActionAuthLogin",
  "auth.logout": "auditActionAuthLogout",
  "auth.login_failed": "auditActionAuthLoginFailed",
  "auth.password_reset_requested": "auditActionPasswordResetRequested",
  "auth.password_reset_completed": "auditActionPasswordResetCompleted",
  "user.created": "auditActionUserCreated",
  "user.updated": "auditActionUserUpdated",
  "user.suspended": "auditActionUserSuspended",
  "user.activated": "auditActionUserActivated",
  "group.updated": "auditActionGroupUpdated",
  "role.updated": "auditActionRoleUpdated",
  "page.created": "auditActionPageCreated",
  "page.draft_saved": "auditActionPageDraftSaved",
  "page.published": "auditActionPagePublished",
  "page.updated": "auditActionPageUpdated",
  "page.renamed": "auditActionPageRenamed",
  "page.deleted": "auditActionPageDeleted",
  "page.restored": "auditActionPageRestored",
  "page.rollback": "auditActionPageRollback",
  "media.uploaded": "auditActionMediaUploaded",
  "media.deleted": "auditActionMediaDeleted",
  "settings.updated": "auditActionSettingsUpdated",
  "backup.created": "auditActionBackupCreated",
  "backup.restored": "auditActionBackupRestored"
} satisfies Record<string, keyof Messages>;

export function auditActionLabel(action: string, messages: Messages) {
  const key = auditActionMessageKeys[action as keyof typeof auditActionMessageKeys];
  return key ? messages[key] : action;
}
