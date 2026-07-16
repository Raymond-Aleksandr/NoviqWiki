"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import {
  ArrowRight,
  Bold,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  Quote,
  Search,
  Upload,
  X
} from "lucide-react";
import type { Messages } from "@/i18n";

export type EditorMediaItem = {
  id: string;
  safeFilename: string;
  publicUrl: string;
  mimeType: string;
  altText: string;
};

type Props = {
  name?: string;
  initialValue?: string;
  footer?: ReactNode;
  messages: Messages;
  mediaItems?: EditorMediaItem[];
};

export function MarkdownEditor({
  name = "markdown",
  initialValue = "",
  footer,
  messages,
  mediaItems = []
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaQuery, setMediaQuery] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState(mediaItems[0]?.id ?? "");
  const [manualUrl, setManualUrl] = useState("");
  const [manualAlt, setManualAlt] = useState("");
  const extensions = useMemo(() => [markdown()], []);
  const preview = useMemo(() => renderPreview(value, messages), [messages, value]);
  const filteredMedia = useMemo(() => {
    const needle = mediaQuery.trim().toLowerCase();
    if (!needle) return mediaItems;
    return mediaItems.filter((item) => item.safeFilename.toLowerCase().includes(needle));
  }, [mediaItems, mediaQuery]);
  const selectedMedia =
    filteredMedia.find((item) => item.id === selectedMediaId) ?? filteredMedia[0] ?? null;
  const activeMediaUrl = selectedMedia?.publicUrl ?? manualUrl.trim();
  const activeMediaAlt =
    selectedMedia?.altText || selectedMedia?.safeFilename || manualAlt.trim() || messages.altText;

  function insert(before: string, after = "", sample = "") {
    setValue(
      (current) =>
        `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${before}${sample}${after}`
    );
  }

  function insertSelectedMedia() {
    if (!activeMediaUrl) return;
    insert("![", `](${activeMediaUrl})`, activeMediaAlt);
    setMediaOpen(false);
  }

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" role="toolbar" aria-label={messages.markdownFormatting}>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.bold}
          onClick={() => insert("**", "**", "bold")}
        >
          <Bold size={16} aria-hidden="true" />
          <span className="sr-only">{messages.bold}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.italic}
          onClick={() => insert("*", "*", "italic")}
        >
          <Italic size={16} aria-hidden="true" />
          <span className="sr-only">{messages.italic}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.heading}
          onClick={() => insert("## ", "", messages.heading)}
        >
          <Heading2 size={16} aria-hidden="true" />
          <span className="sr-only">{messages.heading}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.list}
          onClick={() => insert("- ", "", messages.list)}
        >
          <List size={16} aria-hidden="true" />
          <span className="sr-only">{messages.list}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.quote}
          onClick={() => insert("> ", "", messages.quote)}
        >
          <Quote size={16} aria-hidden="true" />
          <span className="sr-only">{messages.quote}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.link}
          onClick={() => insert("[", "](https://example.com)", "link")}
        >
          <Link size={16} aria-hidden="true" />
          <span className="sr-only">{messages.link}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.image}
          onClick={() => setMediaOpen(true)}
        >
          <Image size={16} aria-hidden="true" />
          <span className="sr-only">{messages.image}</span>
        </button>
      </div>
      <div className="editor-columns">
        <div className="editor-code-pane">
          <CodeMirror
            value={value}
            minHeight="30rem"
            extensions={extensions}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
            onChange={setValue}
            aria-label={messages.markdownEditor}
          />
        </div>
        <div className="editor-preview" aria-label={messages.markdownPreview}>
          <div className="editor-preview-kicker">{messages.livePreview}</div>
          {preview}
        </div>
      </div>
      {footer ? <div className="editor-footer">{footer}</div> : null}
      <textarea name={name} value={value} readOnly hidden />
      {mediaOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="media-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-picker-title"
          >
            <div className="modal-header">
              <h2 id="media-picker-title">{messages.insertMedia}</h2>
              <button type="button" className="icon-button" onClick={() => setMediaOpen(false)}>
                <X size={16} aria-hidden="true" />
                <span className="sr-only">{messages.cancel}</span>
              </button>
            </div>
            <div className="modal-search-row">
              <label className="modal-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">{messages.mediaPickerSearch}</span>
                <input
                  value={mediaQuery}
                  onChange={(event) => setMediaQuery(event.target.value)}
                  placeholder={messages.mediaPickerSearch}
                />
              </label>
              <a className="button" href="/media#media-upload">
                <Upload size={15} aria-hidden="true" />
                {messages.upload}
              </a>
            </div>
            <div className="media-picker-body">
              <div className="media-picker-grid">
                {filteredMedia.length > 0 ? (
                  filteredMedia.map((item) => (
                    <button
                      type="button"
                      className={`media-picker-item ${item.id === selectedMedia?.id ? "active" : ""}`}
                      key={item.id}
                      onClick={() => {
                        setSelectedMediaId(item.id);
                        setManualUrl("");
                      }}
                      aria-pressed={item.id === selectedMedia?.id}
                    >
                      <span className="media-picker-thumb">
                        {item.mimeType.startsWith("image/") ? (
                          <img src={item.publicUrl} alt={item.altText || item.safeFilename} />
                        ) : (
                          <Image size={20} aria-hidden="true" />
                        )}
                      </span>
                      <span className="media-picker-name">{item.safeFilename}</span>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">
                      <Image size={22} aria-hidden="true" />
                    </span>
                    <strong>{messages.noMediaAssetsYet}</strong>
                    <p className="muted">{messages.mediaEmptyLibrary}</p>
                  </div>
                )}
              </div>
              <aside className="media-picker-detail">
                <label>
                  {messages.mediaUrl}
                  <input
                    className="field mono"
                    value={selectedMedia?.publicUrl ?? manualUrl}
                    onChange={(event) => {
                      setSelectedMediaId("");
                      setManualUrl(event.target.value);
                    }}
                  />
                </label>
                <label>
                  {messages.altText}
                  <input
                    className="field"
                    value={selectedMedia?.altText || manualAlt}
                    onChange={(event) => setManualAlt(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  disabled={!activeMediaUrl}
                  onClick={insertSelectedMedia}
                >
                  <ArrowRight size={15} aria-hidden="true" />
                  {messages.insertSelectedMedia}
                </button>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function renderPreview(value: string, messages: Messages): ReactNode[] | ReactNode {
  const nodes: ReactNode[] = [];
  let listItems: ReactNode[] = [];

  function flushList() {
    if (listItems.length > 0) {
      nodes.push(<ul key={`list-${nodes.length}`}>{listItems}</ul>);
      listItems = [];
    }
  }

  value.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      nodes.push(<h2 key={index}>{renderInline(trimmed.slice(2))}</h2>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      nodes.push(<h3 key={index}>{renderInline(trimmed.slice(3))}</h3>);
      return;
    }
    if (trimmed.startsWith("- ")) {
      listItems.push(<li key={index}>{renderInline(trimmed.slice(2))}</li>);
      return;
    }
    if (trimmed.startsWith("> ")) {
      flushList();
      nodes.push(<blockquote key={index}>{renderInline(trimmed.slice(2))}</blockquote>);
      return;
    }
    if (trimmed.startsWith("[[Category:")) {
      flushList();
      nodes.push(
        <p key={index}>
          <span className="badge">
            {trimmed.replace(/^\[\[Category:/, "").replace(/\]\]$/, "")}
          </span>
        </p>
      );
      return;
    }
    flushList();
    nodes.push(<p key={index}>{renderInline(trimmed)}</p>);
  });

  flushList();
  return nodes.length > 0 ? nodes : <p className="muted">{messages.previewEmpty}</p>;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const [target, label] = part.slice(2, -2).split("|");
        return (
          <span className="badge danger" key={index}>
            {label ?? target}
          </span>
        );
      }
      return part;
    });
}
