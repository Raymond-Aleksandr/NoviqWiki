import assert from "node:assert/strict";
import test from "node:test";
import { getMediaMarkdown } from "../../src/features/media/markdown";
import type { MediaAsset } from "../../src/features/media/types";

const asset: MediaAsset = {
  id: "test-asset",
  safeFilename: "Reference (1).pdf",
  publicUrl: "/media/reference (1).pdf",
  mimeType: "application/pdf",
  byteSize: 128,
  width: null,
  height: null,
  altText: ""
};

test("copying a document from the media library produces a file link", () => {
  assert.equal(getMediaMarkdown(asset), "[Reference (1).pdf](/media/reference%20%281%29.pdf)");
});

test("copying an image preserves the editable alt text and safe destination", () => {
  assert.equal(
    getMediaMarkdown({ ...asset, mimeType: "image/png", altText: "Figure [one]" }),
    "![Figure \\[one\\]](/media/reference%20%281%29.pdf)"
  );
});
