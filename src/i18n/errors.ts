import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import type { Messages } from "@/i18n";

type MessageKey = keyof Messages;

const exactMessageKeys: Record<string, MessageKey> = {
  "You do not have permission to perform this action.": "permissionDenied",
  "Authentication required.": "loginToContinue",
  "Setup is required.": "setupRequired",
  "Setup has already been completed.": "setupAlreadyCompleted",
  "The request is invalid.": "requestInvalid",
  "The requested resource was not found.": "resourceNotFound",
  "The resource changed before this request was applied.": "resourceConflict",
  "Invalid username, email, or password.": "invalidCredentials",
  "This account is not active.": "accountNotActive",
  "Site setup is required before registration.": "setupRequired",
  "Public registration is closed.": "registrationClosedError",
  "Too many attempts. Try again later.": "rateLimited",
  "Verification link is invalid or expired.": "invalidOrExpiredLink",
  "Reset link is invalid or expired.": "invalidOrExpiredLink",
  "A user with that username or email already exists.": "userAlreadyExists",
  "User not found.": "userNotFound",
  "The final active Owner cannot be suspended or demoted.": "finalOwnerInvariant",
  "Group name is required.": "groupNameRequired",
  "A group with that name already exists.": "groupAlreadyExists",
  "Built-in groups cannot be renamed.": "builtInGroupRenameDenied",
  "Role name is required.": "roleNameRequired",
  "A role with that name already exists.": "roleAlreadyExists",
  "Built-in roles cannot be edited.": "builtInRoleEditDenied",
  "Role not found.": "roleNotFound",
  "A page with this title or slug already exists.": "pageDuplicate",
  "Deleted pages must be restored before editing.": "deletedPageEdit",
  "This page is protected.": "protectedPageDenied",
  "The page changed after this editor loaded it.": "editConflict",
  "Page not found.": "pageNotFound",
  "Revision not found.": "revisionNotFound",
  "Revisions belong to different pages.": "revisionsDifferentPages",
  "Target revision belongs to another page.": "targetRevisionDifferentPage",
  "Category not found.": "categoryNotFound",
  "Redirect loop detected.": "redirectLoopDetected",
  "Redirect target not found.": "redirectTargetNotFound",
  "Redirect depth exceeded.": "redirectDepthExceeded",
  "File is required.": "selectFileToUpload",
  "File is empty.": "fileEmpty",
  "File is larger than the configured upload limit.": "fileTooLarge",
  "This file type is not allowed.": "fileTypeNotAllowed",
  "Unsafe filename.": "unsafeFilename",
  "Media asset not found.": "mediaNotFound",
  "Media is still referenced by published pages.": "mediaStillReferenced"
};

const codeMessageKeys: Record<string, MessageKey> = {
  forbidden: "permissionDenied",
  not_found: "resourceNotFound",
  conflict: "resourceConflict",
  validation_error: "requestInvalid",
  setup_required: "setupRequired",
  invalid_credentials: "invalidCredentials",
  rate_limited: "rateLimited",
  invalid_token: "invalidOrExpiredLink",
  missing_file: "selectFileToUpload",
  empty_upload: "fileEmpty",
  upload_too_large: "fileTooLarge",
  unsupported_media_type: "fileTypeNotAllowed",
  unsafe_filename: "unsafeFilename"
};

export function localizeErrorMessage(error: unknown, messages: Messages) {
  if (error instanceof ZodError) {
    return messages.requestInvalid;
  }
  if (error instanceof AppError) {
    return resolveErrorKey(error, messages);
  }
  if (error instanceof Error) {
    return exactMessageKeys[error.message]
      ? String(messages[exactMessageKeys[error.message]])
      : messages.unexpectedError;
  }
  return messages.unexpectedError;
}

export function localizeAppError(error: AppError, messages: Messages) {
  return resolveErrorKey(error, messages);
}

function resolveErrorKey(error: AppError, messages: Messages) {
  const exactKey = exactMessageKeys[error.message];
  if (exactKey) {
    return String(messages[exactKey]);
  }
  const codeKey = codeMessageKeys[error.code];
  if (codeKey) {
    return String(messages[codeKey]);
  }
  return messages.unexpectedError;
}
