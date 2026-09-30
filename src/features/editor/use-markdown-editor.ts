"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { keymap, type EditorView } from "@codemirror/view";
import { markdownCommandTransaction } from "./commands";
import type { EditorMessages, MarkdownCommand } from "./types";

export function useMarkdownEditor(initialValue: string, messages: EditorMessages) {
  const [value, setValue] = useState(initialValue);
  const viewRef = useRef<EditorView | null>(null);
  const format = useCallback((view: EditorView, command: MarkdownCommand) => {
    view.dispatch(markdownCommandTransaction(view.state, command, messages[command]));
    view.focus();
    return true;
  }, [messages]);
  const extensions = useMemo(() => [
    markdown(),
    keymap.of([
      { key: "Mod-b", run: (view) => format(view, "bold") },
      { key: "Mod-i", run: (view) => format(view, "italic") },
      { key: "Mod-k", run: (view) => format(view, "link") }
    ])
  ], [format]);
  const onCreateEditor = useCallback((view: EditorView) => { viewRef.current = view; }, []);
  const runCommand = useCallback((command: MarkdownCommand) => {
    if (viewRef.current) format(viewRef.current, command);
  }, [format]);
  const insertMarkdown = useCallback((content: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ ...view.state.replaceSelection(content), scrollIntoView: true, userEvent: "input" });
    // Native dialog restores its trigger's focus when closing; focus the editor after that happens.
    window.requestAnimationFrame(() => {
      if (view.contentDOM.isConnected) view.focus();
    });
  }, []);

  return { value, setValue, extensions, onCreateEditor, runCommand, insertMarkdown };
}
