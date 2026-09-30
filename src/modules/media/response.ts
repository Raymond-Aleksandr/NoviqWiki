import { isInlineSafeMediaType } from "@/modules/settings/service";

export function getMediaCacheControl(publiclyReadable: boolean) {
  return publiclyReadable ? "public, max-age=0, must-revalidate" : "private, no-store, max-age=0";
}

export function getMediaContentDisposition(mimeType: string, safeFilename: string) {
  const disposition = isInlineSafeMediaType(mimeType) ? "inline" : "attachment";
  return `${disposition}; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
}
