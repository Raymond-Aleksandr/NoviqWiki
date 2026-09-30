import type { Messages } from "@/i18n";

export type MediaBrowseMessages = Pick<
  Messages,
  | "searchUploadsByName"
  | "searchByFilenamePlaceholder"
  | "noMediaAssetsYet"
  | "noMediaMatched"
  | "mediaEmptyLibrary"
  | "tryAnotherFilename"
  | "clearFilters"
  | "selectedMediaDetails"
  | "selectMediaHint"
>;

export type MediaDetailsMessages = Pick<
  Messages,
  | "selectedMediaDetails"
  | "bytes"
  | "publicUrl"
  | "markdownSyntax"
  | "copiedSuffix"
  | "clipboardFailed"
  | "copyPublicUrl"
  | "copyMarkdown"
  | "mediaReferences"
  | "references"
  | "checkingReferences"
  | "referencesFailed"
  | "noMediaReferences"
  | "deleteMayBreakLinks"
  | "delete"
>;

export type MediaUploadMessages = Pick<
  Messages,
  "upload" | "mediaLibraryDescription" | "file" | "altText" | "working" | "cancel"
>;

export type MediaDeleteMessages = Pick<
  Messages,
  | "delete"
  | "deleteMediaConfirmBody"
  | "deleteMayBreakLinks"
  | "destructiveActionWarning"
  | "deleteReferencedMedia"
  | "checkingReferences"
  | "referencesFailed"
  | "cancel"
  | "working"
>;

export type MediaLibraryMessages = MediaBrowseMessages &
  MediaDetailsMessages &
  MediaUploadMessages &
  MediaDeleteMessages;

export function getMediaLibraryMessages(messages: Messages): MediaLibraryMessages {
  return {
    searchUploadsByName: messages.searchUploadsByName,
    searchByFilenamePlaceholder: messages.searchByFilenamePlaceholder,
    noMediaAssetsYet: messages.noMediaAssetsYet,
    noMediaMatched: messages.noMediaMatched,
    mediaEmptyLibrary: messages.mediaEmptyLibrary,
    tryAnotherFilename: messages.tryAnotherFilename,
    clearFilters: messages.clearFilters,
    selectedMediaDetails: messages.selectedMediaDetails,
    selectMediaHint: messages.selectMediaHint,
    bytes: messages.bytes,
    publicUrl: messages.publicUrl,
    markdownSyntax: messages.markdownSyntax,
    copiedSuffix: messages.copiedSuffix,
    clipboardFailed: messages.clipboardFailed,
    copyPublicUrl: messages.copyPublicUrl,
    copyMarkdown: messages.copyMarkdown,
    mediaReferences: messages.mediaReferences,
    references: messages.references,
    checkingReferences: messages.checkingReferences,
    referencesFailed: messages.referencesFailed,
    noMediaReferences: messages.noMediaReferences,
    deleteMayBreakLinks: messages.deleteMayBreakLinks,
    delete: messages.delete,
    upload: messages.upload,
    mediaLibraryDescription: messages.mediaLibraryDescription,
    file: messages.file,
    altText: messages.altText,
    working: messages.working,
    cancel: messages.cancel,
    deleteMediaConfirmBody: messages.deleteMediaConfirmBody,
    destructiveActionWarning: messages.destructiveActionWarning,
    deleteReferencedMedia: messages.deleteReferencedMedia
  };
}
