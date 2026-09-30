import type { Messages } from "@/i18n";
import { editorMessageKeys, type EditorMessages } from "./types";

export function getEditorMessages(messages: Messages): EditorMessages {
  return Object.fromEntries(editorMessageKeys.map((key) => [key, messages[key]])) as EditorMessages;
}
