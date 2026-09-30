"use client";

import { ImageIcon } from "lucide-react";
import type { MediaAsset } from "./types";

export function MediaCard({
  asset,
  selected,
  onSelect
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={`media-card media-card-button ${selected ? "active" : ""}`}
      type="button"
      onClick={() => onSelect(asset.id)}
      aria-pressed={selected}
      aria-label={asset.safeFilename}
      aria-controls="media-selected-details"
    >
      <span className="media-thumb">
        {asset.mimeType.startsWith("image/") ? (
          <img src={asset.publicUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <ImageIcon size={22} aria-hidden="true" />
        )}
      </span>
      <span className="media-filename" title={asset.safeFilename}>
        {asset.safeFilename}
      </span>
    </button>
  );
}
