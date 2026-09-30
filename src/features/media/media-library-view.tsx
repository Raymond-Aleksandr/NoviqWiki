"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Search, Upload, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaCard } from "./media-card";
import { MediaDeleteDialog } from "./media-delete-dialog";
import { MediaDetails } from "./media-details";
import { MediaUploadDialog } from "./media-upload-dialog";
import type { MediaLibraryMessages } from "./messages";
import type { MediaAction, MediaAsset } from "./types";
import { useMediaBrowser } from "./use-media-browser";

export function MediaLibraryView({
  assets,
  uploadAction,
  deleteAction,
  messages,
  emptyMessage
}: {
  assets: readonly MediaAsset[];
  uploadAction?: MediaAction;
  deleteAction?: MediaAction;
  messages: MediaLibraryMessages;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    query,
    setQuery,
    availableAssets,
    filteredAssets,
    selected,
    selectAsset,
    removeAsset
  } = useMediaBrowser(assets);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [status, setStatus] = useState("");
  const canUpload = Boolean(uploadAction);
  const openUpload = useCallback(() => {
    setStatus("");
    setUploadOpen(true);
  }, []);
  const openDelete = useCallback((asset: MediaAsset) => {
    setStatus("");
    setDeleteTarget(asset);
  }, []);

  useEffect(() => {
    if (!canUpload) return;
    function openFromHash() {
      if (window.location.hash === "#media-upload") openUpload();
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [canUpload, openUpload]);

  const onUploaded = useCallback((message: string) => {
    setUploadOpen(false);
    setStatus(message);
    setQuery("");
    router.refresh();
  }, [router, setQuery]);

  const onDeleted = useCallback((id: string, message: string) => {
    removeAsset(id);
    setDeleteTarget(null);
    setStatus(message);
    router.refresh();
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [removeAsset, router]);

  const isEmptyLibrary = availableAssets.length === 0;
  const emptyAction = isEmptyLibrary
    ? (uploadAction ? (
      <button type="button" onClick={openUpload}>
        <Upload size={16} aria-hidden="true" />
        {messages.upload}
      </button>
    ) : undefined)
    : <button type="button" onClick={() => setQuery("")}>{messages.clearFilters}</button>;

  return (
    <>
      {uploadAction ? (
        <section className="panel upload-panel" id="media-upload">
          <div className="upload-panel-heading">
            <span className="icon-chip"><Upload size={16} aria-hidden="true" /></span>
            <div>
              <h2>{messages.upload}</h2>
              <p>{messages.mediaLibraryDescription}</p>
            </div>
            <button
              type="button"
              className="primary media-upload-trigger"
              aria-haspopup="dialog"
              onClick={openUpload}
            >
              <Upload size={16} aria-hidden="true" />
              {messages.upload}
            </button>
          </div>
        </section>
      ) : null}
      <p className="meta media-library-status" role="status">{status}</p>
      <div className="media-layout">
        <div>
          <div className="media-search">
            <Search size={16} aria-hidden="true" />
            <label htmlFor={searchId} className="sr-only">{messages.searchUploadsByName}</label>
            <input
              id={searchId}
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.searchByFilenamePlaceholder}
              aria-controls="media-library-results"
            />
            {query ? (
              <button
                type="button"
                className="icon-button media-filter-reset"
                aria-label={messages.clearFilters}
                title={messages.clearFilters}
                onClick={() => setQuery("")}
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div
            id="media-library-results"
            className="media-grid"
            role="group"
            aria-label={messages.searchUploadsByName}
          >
            {filteredAssets.length === 0 ? (
              <EmptyState
                title={isEmptyLibrary ? messages.noMediaAssetsYet : messages.noMediaMatched}
                description={isEmptyLibrary
                  ? (emptyMessage ?? messages.mediaEmptyLibrary)
                  : messages.tryAnotherFilename}
                action={emptyAction}
              />
            ) : filteredAssets.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                selected={asset.id === selected?.id}
                onSelect={selectAsset}
              />
            ))}
          </div>
          <p className="sr-only" role="status">
            {filteredAssets.length === 0
              ? (isEmptyLibrary ? messages.noMediaAssetsYet : messages.noMediaMatched)
              : ""}
          </p>
        </div>
        {selected ? (
          <MediaDetails
            key={selected.id}
            asset={selected}
            messages={messages}
            onDelete={deleteAction ? openDelete : undefined}
          />
        ) : (
          <aside
            id="media-selected-details"
            className="media-detail"
            aria-label={messages.selectedMediaDetails}
          >
            <div className="media-detail-preview"><ImageIcon size={28} aria-hidden="true" /></div>
            <div className="media-detail-body"><p className="muted">{messages.selectMediaHint}</p></div>
          </aside>
        )}
      </div>
      {uploadAction && uploadOpen ? (
        <MediaUploadDialog
          action={uploadAction}
          messages={messages}
          onClose={() => setUploadOpen(false)}
          onUploaded={onUploaded}
        />
      ) : null}
      {deleteAction && deleteTarget ? (
        <MediaDeleteDialog
          key={deleteTarget.id}
          asset={deleteTarget}
          action={deleteAction}
          messages={messages}
          onClose={() => setDeleteTarget(null)}
          onDeleted={onDeleted}
        />
      ) : null}
    </>
  );
}
