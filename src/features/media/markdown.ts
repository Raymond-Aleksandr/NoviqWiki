import { mediaMarkdown } from "@/lib/media-markdown";
import type { MediaAsset } from "./types";

export function getMediaMarkdown(asset: MediaAsset) {
  return mediaMarkdown(
    asset.publicUrl,
    asset.altText || asset.safeFilename,
    asset.mimeType.startsWith("image/")
  ) ?? "";
}
