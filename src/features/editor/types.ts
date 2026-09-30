import type { Messages } from "@/i18n";

export type EditorMediaItem = {
  id: string;
  safeFilename: string;
  publicUrl: string;
  mimeType: string;
  altText: string;
};

export const editorMessageKeys = [
  "markdownFormatting", "markdownEditor", "markdownPreview", "bold", "italic",
  "heading", "list", "quote", "link", "image", "expandPreview", "collapsePreview",
  "livePreview", "previewUpdating", "previewFailed", "previewEmpty", "insertMedia",
  "cancel", "mediaPickerSearch", "upload", "noMediaAssetsYet", "mediaEmptyLibrary",
  "mediaUrl", "altText", "insertSelectedMedia", "requestInvalid", "noMediaMatched"
] as const satisfies readonly (keyof Messages)[];

export type EditorMessages = Pick<Messages, (typeof editorMessageKeys)[number]>;
export type PreviewMode = "create" | "edit";
export type PreviewState = { html: string; status: "ready" | "loading" | "error" };
export type MarkdownCommand = "bold" | "italic" | "heading" | "list" | "quote" | "link";
