import type { PreviewMode, PreviewState } from "./types";

type RenderedPreview = { value: string; html: string; mode: PreviewMode };
type PreviewRequest = (value: string, mode: PreviewMode, signal: AbortSignal) => Promise<string>;

async function requestPreview(value: string, mode: PreviewMode, signal: AbortSignal) {
  const response = await fetch("/api/editor/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ markdown: value, mode }),
    signal
  });
  const payload = await response.json() as { data?: { html?: unknown } };
  if (!response.ok || typeof payload?.data?.html !== "string") {
    throw new Error("Invalid preview response.");
  }
  return payload.data.html;
}

/** Own debounce, cancellation and ordering independently of the React component lifecycle. */
export function createPreviewController({
  initial, onChange, request = requestPreview, delay = 250
}: {
  initial: RenderedPreview;
  onChange: (state: PreviewState) => void;
  request?: PreviewRequest;
  delay?: number;
}) {
  let rendered = initial;
  let html = initial.html;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;
  let disposed = false;

  function cancel() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending?.abort();
    pending = undefined;
  }

  return {
    update(value: string, mode: PreviewMode) {
      if (disposed) return;
      const id = ++generation;
      cancel();
      const cached = [rendered, initial].find((entry) => entry.value === value && entry.mode === mode);
      if (cached) {
        html = cached.html;
        onChange({ html, status: "ready" });
        return;
      }
      const controller = new AbortController();
      pending = controller;
      onChange({ html, status: "loading" });
      timer = setTimeout(() => {
        timer = undefined;
        void request(value, mode, controller.signal).then((result) => {
          if (disposed || controller.signal.aborted || id !== generation) return;
          rendered = { value, html: result, mode };
          html = result;
          onChange({ html, status: "ready" });
        }).catch(() => {
          if (disposed || controller.signal.aborted || id !== generation) return;
          onChange({ html, status: "error" });
        });
      }, delay);
    },
    dispose() {
      disposed = true;
      generation++;
      cancel();
    }
  };
}
