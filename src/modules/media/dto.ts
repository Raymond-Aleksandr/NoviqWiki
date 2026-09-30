export type MediaLibraryItem = {
  id: string;
  safeFilename: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  altText: string;
};

export function serializeMedia(asset: MediaLibraryItem): MediaLibraryItem {
  return {
    id: asset.id,
    safeFilename: asset.safeFilename,
    publicUrl: asset.publicUrl,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    altText: asset.altText
  };
}
