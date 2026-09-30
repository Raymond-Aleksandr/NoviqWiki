"use client";

import { useState, type ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorToolbar } from "./editor-toolbar";
import { EditorPreview } from "./editor-preview";
import { MediaPicker } from "./media-picker";
import { useMarkdownEditor } from "./use-markdown-editor";
import { useMarkdownPreview } from "./use-markdown-preview";
import { useEditorTheme } from "./use-editor-theme";
import type { EditorMediaItem, EditorMessages, PreviewMode } from "./types";

export function MarkdownEditor({
  name = "markdown", initialValue = "", initialPreviewHtml, previewMode,
  footer, messages, mediaItems = []
}: {
  name?: string;
  initialValue?: string;
  initialPreviewHtml: string;
  previewMode: PreviewMode;
  footer?: ReactNode;
  messages: EditorMessages;
  mediaItems?: EditorMediaItem[];
}) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const editor = useMarkdownEditor(initialValue, messages);
  const theme = useEditorTheme();
  const preview = useMarkdownPreview({
    value: editor.value, initialValue, initialHtml: initialPreviewHtml, mode: previewMode
  });

  return (
    <div className={`editor-shell ${previewExpanded ? "preview-expanded" : ""}`}>
      <EditorToolbar
        messages={messages}
        onCommand={editor.runCommand}
        onOpenMedia={() => setMediaOpen(true)}
        expanded={previewExpanded}
        onTogglePreview={() => setPreviewExpanded((current) => !current)}
      />
      <div className="editor-columns">
        <div className="editor-code-pane">
          <CodeMirror
            value={editor.value}
            minHeight="30rem"
            extensions={editor.extensions}
            theme={theme}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
            onCreateEditor={editor.onCreateEditor}
            onChange={editor.setValue}
            aria-label={messages.markdownEditor}
          />
        </div>
        <EditorPreview preview={preview} messages={messages} />
      </div>
      {footer ? <div className="editor-footer">{footer}</div> : null}
      <textarea name={name} value={editor.value} readOnly hidden />
      <MediaPicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        mediaItems={mediaItems}
        messages={messages}
        onInsert={editor.insertMarkdown}
      />
    </div>
  );
}
