"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Code2, Copy, ImageIcon, Search, Trash2, Upload } from "lucide-react";
import type { ActionState } from "@/app/actions";

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
  emptyMessage = "Uploaded files will appear in this library."
}: {
  assets: MediaLibraryItem[];
  canUpload: boolean;
  canDelete: boolean;
  uploadAction: ServerAction;
  deleteAction: ServerAction;
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
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Clipboard access failed. Select and copy the text manually.");
    }
  }

  return (
    <>
      {canUpload ? (
        <section className="panel upload-panel" id="media-upload">
          <form ref={uploadFormRef} action={uploadFormAction} className="form">
            <label>
              File
              <input className="field" name="file" type="file" required />
            </label>
            <label>
              Alt text
              <input className="field" name="altText" />
            </label>
            <button className="primary" disabled={uploadPending}>
              <Upload size={16} aria-hidden="true" />
              Upload
            </button>
            {uploadPending ? <p className="muted">Working...</p> : null}
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
            <span className="sr-only">Search uploads by name</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by filename..."
            />
          </label>
          <div className="media-grid">
            {filteredAssets.length === 0 ? (
              <div className="empty-state">
                <strong>
                  {assets.length === 0 ? "No media assets yet." : "No media matched."}
                </strong>
                <p className="muted">
                  {assets.length === 0 ? emptyMessage : "Try another filename."}
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
        <aside className="media-detail" aria-label="Selected media details">
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
                  · {selected.byteSize} bytes
                </div>
                <code className="media-code">{selected.publicUrl}</code>
                <code className="media-code">{markdown}</code>
                <div className="media-actions">
                  <button type="button" onClick={() => copyText("Public URL", selected.publicUrl)}>
                    <Copy size={15} aria-hidden="true" />
                    Copy public URL
                  </button>
                  <button type="button" onClick={() => copyText("Markdown", markdown)}>
                    <Code2 size={15} aria-hidden="true" />
                    Copy Markdown
                  </button>
                </div>
                {copyStatus ? (
                  <p role="status" className="meta media-detail-copy-status">
                    {copyStatus}
                  </p>
                ) : null}
                {canDelete ? (
                  <section className="media-reference-panel" aria-label="Media references">
                    <div className="settings-kicker">References</div>
                    {referenceStatus === "loading" ? (
                      <p className="muted">Checking references...</p>
                    ) : null}
                    {referenceStatus === "error" ? (
                      <p className="error">References could not be loaded.</p>
                    ) : null}
                    {referenceStatus === "idle" && references.length === 0 ? (
                      <p className="muted">No published pages currently reference this file.</p>
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
                      <input type="hidden" name="assetId" value={selected.id} />
                      {references.length > 0 ? (
                        <label className="media-force-delete">
                          <input type="checkbox" name="force" />
                          Delete even though this file is referenced
                        </label>
                      ) : null}
                      {references.length > 0 ? (
                        <div className="auth-note">
                          <AlertTriangle size={16} aria-hidden="true" />
                          Deleting this file may leave broken image links.
                        </div>
                      ) : null}
                      <button className="danger" disabled={deletePending}>
                        <Trash2 size={15} aria-hidden="true" />
                        Delete
                      </button>
                      {deletePending ? <p className="muted">Working...</p> : null}
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
              <p className="muted">Select an upload to inspect metadata and insertion syntax.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
