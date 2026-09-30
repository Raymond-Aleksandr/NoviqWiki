"use client";

import { useCallback, useMemo, useState } from "react";
import type { MediaAsset } from "./types";

export function useMediaBrowser(assets: readonly MediaAsset[]) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(assets[0]?.id ?? null);
  const [removedIds, setRemovedIds] = useState<readonly string[]>([]);

  const availableAssets = useMemo(
    () => assets.filter((asset) => !removedIds.includes(asset.id)),
    [assets, removedIds]
  );
  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? availableAssets.filter((asset) => asset.safeFilename.toLowerCase().includes(needle))
      : availableAssets;
  }, [availableAssets, query]);
  const selected = filteredAssets.find((asset) => asset.id === selectedId) ?? filteredAssets[0] ?? null;

  const removeAsset = useCallback((id: string) => {
    setRemovedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  return {
    query,
    setQuery,
    availableAssets,
    filteredAssets,
    selected,
    selectAsset: setSelectedId,
    removeAsset
  };
}
