"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Code2, Copy, ImageIcon, Search, Trash2, Upload, X } from "lucide-react";
import type { ActionState } from "@/app/actions";
import type { Messages } from "@/i18n";

export type MediaLibraryItem = {
  id: string;
  safeFilename: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  altText: string;
  createdAt: string;
};

type MediaReference = {
  pageId: string;
  title: string;
  slug: string;
};

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const initialActionState: ActionState = { ok: true };

export function MediaLibrary({
  assets,
  canUpload,
  canDelete,
  uploadAction,
  deleteAction,
  messages,
  emptyMessage
}: {
  assets: MediaLibraryItem[];
  canUpload: boolean;
  canDelete: boolean;
  uploadAction: ServerAction;
  deleteAction: ServerAction;
  messages: Messages;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [uploadState, uploadFormAction, uploadPending] = useActionState(
    uploadAction,
    initialActionState
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialActionState
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? "");
  const [copyStatus, setCopyStatus] = useState("");
  const [references, setReferences] = useState<MediaReference[]>([]);
  const [referenceStatus, setReferenceStatus] = useState<"idle" | "loading" | "error">("idle");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((asset) => asset.safeFilename.toLowerCase().includes(needle));
  }, [assets, query]);

  useEffect(() => {
    if (!filteredAssets.some((asset) => asset.id === selectedId)) {
      setSelectedId(filteredAssets[0]?.id ?? "");
    }
  }, [filteredAssets, selectedId]);

  useEffect(() => {
    if (!uploadState.message || !uploadState.ok) return;
    uploadFormRef.current?.reset();
    router.refresh();
  }, [router, uploadState.message, uploadState.ok]);

  useEffect(() => {
    if (!deleteState.message || !deleteState.ok) return;
    setDeleteDialogOpen(false);
    setSelectedId("");
    router.refresh();
  }, [deleteState.message, deleteState.ok, router]);

  const selected = assets.find((asset) => asset.id === selectedId) ?? filteredAssets[0] ?? null;
  const markdown = selected
    ? `![${selected.altText || selected.safeFilename}](${selected.publicUrl})`
    : "";

  useEffect(() => {
    if (!selected || !canDelete) {
      setReferences([]);
      setReferenceStatus("idle");
      return;
    }
    const controller = new AbortController();
    setReferenceStatus("loading");
    fetch(`/api/v1/media/${selected.id}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Reference lookup failed.");
        const payload = (await response.json()) as {
          data?: { references?: MediaReference[] };
        };
        setReferences(payload.data?.references ?? []);
        setReferenceStatus("idle");
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        setReferences([]);
        setReferenceStatus("error");
      });
    return () => controller.abort();
  }, [canDelete, selected]);

  async function copyText(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} ${messages.copiedSuffix}`);
    } catch {
      setCopyStatus(messages.clipboardFailed);
    }
  }

  return (
    <>
      {canUpload ? (
        <section className="panel upload-panel" id="media-upload">
          <div className="upload-panel-heading">
            <span className="icon-chip">
              <Upload size={16} aria-hidden="true" />
            </span>
            <div>
              <h2>{messages.upload}</h2>
              <p>{messages.mediaLibraryDescription}</p>
            </div>
          </div>
          <form ref={uploadFormRef} action={uploadFormAction} className="form">
            <label>
              {messages.file}
              <input className="field" name="file" type="file" required />
            </label>
            <label>
              {messages.altText}
              <input className="field" name="altText" maxLength={2000} />
            </label>
            <button className="primary" disabled={uploadPending}>
              <Upload size={16} aria-hidden="true" />
              {messages.upload}
            </button>
            {uploadPending ? <p className="muted">{messages.working}</p> : null}
            {uploadState.message ? (
              <p role="status" className={uploadState.ok ? "meta" : "error"}>
                {uploadState.message}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      <div className="media-layout">
        <div>
          <label className="media-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{messages.searchUploadsByName}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.searchByFilenamePlaceholder}
            />
          </label>
          <div className="media-grid">
            {filteredAssets.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <ImageIcon size={22} aria-hidden="true" />
                </span>
                <strong>
                  {assets.length === 0 ? messages.noMediaAssetsYet : messages.noMediaMatched}
                </strong>
                <p className="muted">
                  {assets.length === 0
                    ? (emptyMessage ?? messages.mediaEmptyLibrary)
                    : messages.tryAnotherFilename}
                </p>
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <button
                  className={`media-card media-card-button ${asset.id === selected?.id ? "active" : ""}`}
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(asset.id);
                    setCopyStatus("");
                  }}
                  aria-pressed={asset.id === selected?.id}
                >
                  <span className="media-thumb">
                    {asset.mimeType.startsWith("image/") ? (
                      <img src={asset.publicUrl} alt={asset.altText || asset.safeFilename} />
                    ) : (
                      <ImageIcon size={22} aria-hidden="true" />
                    )}
                  </span>
                  <span className="media-filename">{asset.safeFilename}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <aside className="media-detail" aria-label={messages.selectedMediaDetails}>
          <div className="media-detail-preview">
            {selected?.mimeType.startsWith("image/") ? (
              <img src={selected.publicUrl} alt={selected.altText || selected.safeFilename} />
            ) : (
              <ImageIcon size={28} aria-hidden="true" />
            )}
          </div>
          <div className="media-detail-body">
            {selected ? (
              <>
                <div className="mono media-detail-name">{selected.safeFilename}</div>
                <div className="media-detail-meta">
                  {selected.mimeType}
                  {selected.width && selected.height
                    ? ` · ${selected.width}x${selected.height}`
                    : ""}{" "}
                  · {selected.byteSize} {messages.bytes}
                </div>
                <code className="media-code">{selected.publicUrl}</code>
                <code className="media-code">{markdown}</code>
                <div className="media-actions">
                  <button
                    type="button"
                    onClick={() => copyText(messages.publicUrl, selected.publicUrl)}
                  >
                    <Copy size={15} aria-hidden="true" />
                    {messages.copyPublicUrl}
                  </button>
                  <button type="button" onClick={() => copyText(messages.markdownSyntax, markdown)}>
                    <Code2 size={15} aria-hidden="true" />
                    {messages.copyMarkdown}
                  </button>
                </div>
                {copyStatus ? (
                  <p role="status" className="meta media-detail-copy-status">
                    {copyStatus}
                  </p>
                ) : null}
                {canDelete ? (
                  <section className="media-reference-panel" aria-label={messages.mediaReferences}>
                    <div className="settings-kicker">{messages.references}</div>
                    {referenceStatus === "loading" ? (
                      <p className="muted">{messages.checkingReferences}</p>
                    ) : null}
                    {referenceStatus === "error" ? (
                      <p className="error">{messages.referencesFailed}</p>
                    ) : null}
                    {referenceStatus === "idle" && references.length === 0 ? (
                      <p className="muted">{messages.noMediaReferences}</p>
                    ) : null}
                    {references.length > 0 ? (
                      <ul className="media-reference-list">
                        {references.map((reference) => (
                          <li key={reference.pageId}>
                            <a href={`/page/${reference.slug}`}>{reference.title}</a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <form action={deleteFormAction} className="media-delete-form">
                      {references.length > 0 ? (
                        <div className="auth-note">
                          <AlertTriangle size={16} aria-hidden="true" />
                          {messages.deleteMayBreakLinks}
                        </div>
                      ) : null}
                      <button
                        className="danger"
                        disabled={deletePending}
                        type="button"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {messages.delete}
                      </button>
                      {deletePending ? <p className="muted">{messages.working}</p> : null}
                      {deleteState.message ? (
                        <p role="status" className={deleteState.ok ? "meta" : "error"}>
                          {deleteState.message}
                        </p>
                      ) : null}
                    </form>
                  </section>
                ) : null}
              </>
            ) : (
              <p className="muted">{messages.selectMediaHint}</p>
            )}
          </div>
        </aside>
      </div>
      {selected && deleteDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-delete-title"
          >
            <div className="confirm-dialog-heading">
              <span className="confirm-dialog-icon danger">
                <AlertTriangle size={19} aria-hidden="true" />
              </span>
              <div>
                <h2 id="media-delete-title">
                  {messages.delete} · {selected.safeFilename}
                </h2>
                <p>{messages.deleteMediaConfirmBody}</p>
              </div>
            </div>
            {references.length > 0 ? (
              <div className="confirm-warning">{messages.deleteMayBreakLinks}</div>
            ) : (
              <div className="confirm-warning">{messages.destructiveActionWarning}</div>
            )}
            <form action={deleteFormAction} className="confirm-action-form">
              <input type="hidden" name="assetId" value={selected.id} />
              {references.length > 0 ? (
                <label className="media-force-delete checkbox-row">
                  <input type="checkbox" name="force" />
                  <span>{messages.deleteReferencedMedia}</span>
                </label>
              ) : null}
              {deleteState.message && !deleteState.ok ? (
                <p role="status" className="error">
                  {deleteState.message}
                </p>
              ) : null}
              <div className="confirm-actions">
                <button type="button" onClick={() => setDeleteDialogOpen(false)}>
                  <X size={15} aria-hidden="true" />
                  {messages.cancel}
                </button>
                <button className="danger" disabled={deletePending}>
                  <Trash2 size={15} aria-hidden="true" />
                  {deletePending ? messages.working : messages.delete}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
