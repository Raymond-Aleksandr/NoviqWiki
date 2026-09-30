"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Code2, Copy, ImageIcon, Trash2 } from "lucide-react";
import type { MediaDetailsMessages } from "./messages";
import { getMediaMarkdown } from "./markdown";
import type { MediaAsset } from "./types";
import { useMediaReferences } from "./use-media-references";

function MediaReferences({
  asset,
  messages,
  onDelete
}: {
  asset: MediaAsset;
  messages: MediaDetailsMessages;
  onDelete: (asset: MediaAsset) => void;
}) {
  const { status, references } = useMediaReferences(asset.id);

  return (
    <section className="media-reference-panel" aria-label={messages.mediaReferences}>
      <div className="settings-kicker">{messages.references}</div>
      <div role="status" aria-live="polite">
        {status === "loading" ? <p className="muted">{messages.checkingReferences}</p> : null}
        {status === "error" ? <p className="error">{messages.referencesFailed}</p> : null}
        {status === "ready" && references.length === 0 ? (
          <p className="muted">{messages.noMediaReferences}</p>
        ) : null}
      </div>
      {references.length > 0 ? (
        <ul className="media-reference-list">
          {references.map((reference) => (
            <li key={reference.pageId}>
              <a href={`/page/${reference.slug}`}>{reference.title}</a>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="media-delete-form">
        {references.length > 0 ? (
          <div className="auth-note">
            <AlertTriangle size={16} aria-hidden="true" />
            {messages.deleteMayBreakLinks}
          </div>
        ) : null}
        <button className="danger" type="button" onClick={() => onDelete(asset)}>
          <Trash2 size={15} aria-hidden="true" />
          {messages.delete}
        </button>
      </div>
    </section>
  );
}

export function MediaDetails({
  asset,
  messages,
  onDelete
}: {
  asset: MediaAsset;
  messages: MediaDetailsMessages;
  onDelete?: (asset: MediaAsset) => void;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const copyRequest = useRef(0);
  const markdown = getMediaMarkdown(asset);

  useEffect(() => () => {
    copyRequest.current += 1;
  }, []);

  async function copyText(label: string, value: string) {
    const request = ++copyRequest.current;
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(value);
      if (request === copyRequest.current) setCopyStatus(`${label} ${messages.copiedSuffix}`);
    } catch {
      if (request === copyRequest.current) setCopyStatus(messages.clipboardFailed);
    }
  }

  return (
    <aside
      id="media-selected-details"
      className="media-detail"
      aria-label={messages.selectedMediaDetails}
    >
      <div className="media-detail-preview">
        {asset.mimeType.startsWith("image/") ? (
          <img src={asset.publicUrl} alt={asset.altText || asset.safeFilename} decoding="async" />
        ) : (
          <ImageIcon size={28} aria-hidden="true" />
        )}
      </div>
      <div className="media-detail-body">
        <div className="mono media-detail-name">{asset.safeFilename}</div>
        <div className="media-detail-meta">
          {asset.mimeType}
          {asset.width !== null && asset.height !== null ? ` · ${asset.width}×${asset.height}` : ""}
          {" · "}{asset.byteSize} {messages.bytes}
        </div>
        <code className="media-code" aria-label={messages.publicUrl}>{asset.publicUrl}</code>
        <code className="media-code" aria-label={messages.markdownSyntax}>{markdown}</code>
        <div className="media-actions">
          <button type="button" onClick={() => copyText(messages.publicUrl, asset.publicUrl)}>
            <Copy size={15} aria-hidden="true" />
            {messages.copyPublicUrl}
          </button>
          <button type="button" onClick={() => copyText(messages.markdownSyntax, markdown)}>
            <Code2 size={15} aria-hidden="true" />
            {messages.copyMarkdown}
          </button>
        </div>
        <p role="status" className="meta media-detail-copy-status">{copyStatus}</p>
        {onDelete ? <MediaReferences asset={asset} messages={messages} onDelete={onDelete} /> : null}
      </div>
    </aside>
  );
}
