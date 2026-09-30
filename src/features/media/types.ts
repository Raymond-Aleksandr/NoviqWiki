import type { ActionState } from "@/lib/action-state";

export type MediaAsset = Readonly<{
  id: string;
  safeFilename: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  altText: string;
}>;

export type MediaReference = Readonly<{
  pageId: string;
  title: string;
  slug: string;
}>;

export type MediaAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type MediaReferenceState = {
  status: "loading" | "ready" | "error";
  references: readonly MediaReference[];
};
