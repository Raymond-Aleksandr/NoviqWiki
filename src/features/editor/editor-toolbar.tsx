"use client";

import { Bold, Heading2, Image, Italic, Link, List, Maximize2, Minimize2, Quote } from "lucide-react";
import type { EditorMessages, MarkdownCommand } from "./types";

const commands = [
  { command: "bold", icon: Bold },
  { command: "italic", icon: Italic },
  { command: "heading", icon: Heading2 },
  { command: "list", icon: List },
  { command: "quote", icon: Quote },
  { command: "link", icon: Link }
] as const;

export function EditorToolbar({
  messages, onCommand, onOpenMedia, expanded, onTogglePreview
}: {
  messages: EditorMessages;
  onCommand: (command: MarkdownCommand) => void;
  onOpenMedia: () => void;
  expanded: boolean;
  onTogglePreview: () => void;
}) {
  const previewLabel = expanded ? messages.collapsePreview : messages.expandPreview;
  return (
    <div className="editor-toolbar" role="toolbar" aria-label={messages.markdownFormatting}>
      {commands.map(({ command, icon: Icon }) => (
        <button
          key={command}
          className="editor-tool-button"
          type="button"
          title={messages[command]}
          data-editor-command={command}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onCommand(command)}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="sr-only">{messages[command]}</span>
        </button>
      ))}
      <button
        className="editor-tool-button"
        data-editor-command="image"
        type="button"
        title={messages.image}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onOpenMedia}
      >
        <Image size={16} aria-hidden="true" />
        <span className="sr-only">{messages.image}</span>
      </button>
      <span className="editor-toolbar-spacer" />
      <button
        className="editor-tool-button"
        type="button"
        title={previewLabel}
        aria-pressed={expanded}
        onClick={onTogglePreview}
      >
        {expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        <span className="sr-only">{previewLabel}</span>
      </button>
    </div>
  );
}
