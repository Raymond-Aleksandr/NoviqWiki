"use client";

import { useEffect, useRef, useState } from "react";
import { createPreviewController } from "./preview-controller";
import type { PreviewMode, PreviewState } from "./types";

export function useMarkdownPreview({
  value, initialValue, initialHtml, mode
}: { value: string; initialValue: string; initialHtml: string; mode: PreviewMode }): PreviewState {
  const [preview, setPreview] = useState<PreviewState>({ html: initialHtml, status: "ready" });
  const initial = useRef({ value: initialValue, html: initialHtml, mode });
  const controller = useRef<ReturnType<typeof createPreviewController> | null>(null);

  useEffect(() => {
    const instance = createPreviewController({ initial: initial.current, onChange: setPreview });
    controller.current = instance;
    return () => {
      instance.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.update(value, mode);
  }, [mode, value]);

  return preview;
}
