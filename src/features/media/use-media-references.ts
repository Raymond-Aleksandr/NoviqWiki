"use client";

import { useEffect, useState } from "react";
import type { MediaReference, MediaReferenceState } from "./types";

const loadingState: MediaReferenceState = { status: "loading", references: [] };

function readReferences(payload: unknown): MediaReference[] {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("Invalid media references response.");
  }
  const data = payload.data;
  if (!data || typeof data !== "object" || !("references" in data) || !Array.isArray(data.references)) {
    throw new Error("Invalid media references response.");
  }
  return data.references.map((reference: unknown) => {
    if (
      !reference ||
      typeof reference !== "object" ||
      !("pageId" in reference) ||
      typeof reference.pageId !== "string" ||
      !("title" in reference) ||
      typeof reference.title !== "string" ||
      !("slug" in reference) ||
      typeof reference.slug !== "string"
    ) {
      throw new Error("Invalid media reference.");
    }
    return { pageId: reference.pageId, title: reference.title, slug: reference.slug };
  });
}

export function useMediaReferences(assetId: string) {
  const [result, setResult] = useState<MediaReferenceState & { assetId: string }>(() => ({
    ...loadingState,
    assetId
  }));

  useEffect(() => {
    const controller = new AbortController();
    setResult({ ...loadingState, assetId });

    async function loadReferences() {
      try {
        const response = await fetch(`/api/v1/media/${encodeURIComponent(assetId)}`, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Reference lookup failed.");
        const references = readReferences(await response.json());
        if (!controller.signal.aborted) {
          setResult({ assetId, status: "ready", references });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ assetId, status: "error", references: [] });
        }
      }
    }

    void loadReferences();
    return () => controller.abort();
  }, [assetId]);

  return result.assetId === assetId ? result : loadingState;
}
