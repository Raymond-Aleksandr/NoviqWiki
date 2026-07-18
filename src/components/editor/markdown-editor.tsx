"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Maximize2,
  Minimize2,
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
  initialPreviewHtml: string;
  previewMode: "create" | "edit";
  footer?: ReactNode;
  messages: Messages;
  mediaItems?: EditorMediaItem[];
};

export function MarkdownEditor({
  name = "markdown",
  initialValue = "",
  initialPreviewHtml,
  previewMode,
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
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [preview, setPreview] = useState<{
    html: string;
    status: "ready" | "loading" | "error";
  }>({ html: initialPreviewHtml, status: "ready" });
  const lastRenderedMarkdown = useRef(initialValue);
  const previewRequestId = useRef(0);
  const extensions = useMemo(() => [markdown()], []);
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

  useEffect(() => {
    const requestId = ++previewRequestId.current;
    if (value === lastRenderedMarkdown.current) {
      setPreview((current) =>
        current.status === "ready" ? current : { ...current, status: "ready" }
      );
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreview((current) => ({ ...current, status: "loading" }));
      try {
        const response = await fetch("/api/editor/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markdown: value, mode: previewMode }),
          signal: controller.signal
        });
        const payload = (await response.json()) as {
          data?: { html?: string };
        };
        if (!response.ok || typeof payload.data?.html !== "string") {
          throw new Error("Preview request failed.");
        }
        if (requestId !== previewRequestId.current) {
          return;
        }
        lastRenderedMarkdown.current = value;
        setPreview({ html: payload.data.html, status: "ready" });
      } catch {
        if (controller.signal.aborted || requestId !== previewRequestId.current) {
          return;
        }
        setPreview((current) => ({ ...current, status: "error" }));
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [previewMode, value]);

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
    <div className={`editor-shell ${previewExpanded ? "preview-expanded" : ""}`}>
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
          data-editor-command="image"
          type="button"
          title={messages.image}
          onClick={() => setMediaOpen(true)}
        >
          <Image size={16} aria-hidden="true" />
          <span className="sr-only">{messages.image}</span>
        </button>
        <span className="editor-toolbar-spacer" />
        <button
          className="editor-tool-button"
          type="button"
          title={previewExpanded ? messages.collapsePreview : messages.expandPreview}
          aria-pressed={previewExpanded}
          onClick={() => setPreviewExpanded((current) => !current)}
        >
          {previewExpanded ? (
            <Minimize2 size={16} aria-hidden="true" />
          ) : (
            <Maximize2 size={16} aria-hidden="true" />
          )}
          <span className="sr-only">
            {previewExpanded ? messages.collapsePreview : messages.expandPreview}
          </span>
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
        <div
          className="editor-preview"
          aria-label={messages.markdownPreview}
          aria-busy={preview.status === "loading"}
        >
          <div className="editor-preview-header">
            <div className="editor-preview-kicker">{messages.livePreview}</div>
            <div className={`editor-preview-status ${preview.status}`} aria-live="polite">
              {preview.status === "loading"
                ? messages.previewUpdating
                : preview.status === "error"
                  ? messages.previewFailed
                  : null}
            </div>
          </div>
          {preview.html ? (
            <div
              className="article-body editor-preview-body"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <p className="muted">{messages.previewEmpty}</p>
          )}
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
                    className="field"
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
