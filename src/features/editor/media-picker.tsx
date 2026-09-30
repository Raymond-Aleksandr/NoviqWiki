"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Image, Search, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { mediaMarkdown } from "@/lib/media-markdown";
import type { EditorMediaItem, EditorMessages } from "./types";

export function MediaPicker({
  open, onClose, mediaItems, messages, onInsert
}: {
  open: boolean;
  onClose: () => void;
  mediaItems: EditorMediaItem[];
  messages: EditorMessages;
  onInsert: (markdown: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(mediaItems[0]?.id ?? "");
  const [manualUrl, setManualUrl] = useState("");
  const [altText, setAltText] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return mediaItems.filter((item) => item.safeFilename.toLocaleLowerCase().includes(needle));
  }, [mediaItems, query]);
  const selected = mediaItems.find((item) => item.id === selectedId) ?? null;
  const url = selected?.publicUrl ?? manualUrl;
  const label = altText ?? (selected?.altText || selected?.safeFilename || "");
  const snippet = mediaMarkdown(url, label, !selected || selected.mimeType.startsWith("image/"));
  const invalidUrl = url.trim().length > 0 && snippet === null;

  function insert() {
    if (!snippet) return;
    onClose();
    onInsert(snippet);
  }

  return (
    <Dialog open={open} onClose={onClose} title={messages.insertMedia} closeLabel={messages.cancel} className="media-picker-dialog">
      <div className="modal-search-row">
        <label className="modal-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{messages.mediaPickerSearch}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={messages.mediaPickerSearch} />
        </label>
        <a className="button" href="/media#media-upload">
          <Upload size={15} aria-hidden="true" />
          {messages.upload}
        </a>
      </div>
      <div className="media-picker-body">
        <div className="media-picker-grid">
          {filtered.length > 0 ? filtered.map((item) => (
            <button
              type="button"
              className={`media-picker-item ${item.id === selectedId ? "active" : ""}`}
              key={item.id}
              aria-pressed={item.id === selectedId}
              onClick={() => { setSelectedId(item.id); setManualUrl(""); setAltText(null); }}
            >
              <span className="media-picker-thumb">
                {item.mimeType.startsWith("image/") ? (
                  <img src={item.publicUrl} alt={item.altText || item.safeFilename} loading="lazy" />
                ) : <Image size={20} aria-hidden="true" />}
              </span>
              <span className="media-picker-name">{item.safeFilename}</span>
            </button>
          )) : (
            <div className="empty-state">
              <span className="empty-state-icon"><Image size={22} aria-hidden="true" /></span>
              <strong>{mediaItems.length === 0 ? messages.noMediaAssetsYet : messages.noMediaMatched}</strong>
              <p className="muted">{messages.mediaEmptyLibrary}</p>
            </div>
          )}
        </div>
        <aside className="media-picker-detail">
          <label>
            {messages.mediaUrl}
            <input
              className="field"
              value={url}
              aria-invalid={invalidUrl || undefined}
              onChange={(event) => {
                setSelectedId("");
                setManualUrl(event.target.value);
                if (altText === null) setAltText(label);
              }}
            />
          </label>
          <label>
            {messages.altText}
            <input className="field" value={label} onChange={(event) => setAltText(event.target.value)} />
          </label>
          {invalidUrl ? <p className="error" role="status">{messages.requestInvalid}</p> : null}
          <button type="button" className="primary" disabled={!snippet} onClick={insert}>
            <ArrowRight size={15} aria-hidden="true" />
            {messages.insertSelectedMedia}
          </button>
        </aside>
      </div>
    </Dialog>
  );
}
