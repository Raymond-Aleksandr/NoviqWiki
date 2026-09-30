import type { EditorMessages, PreviewState } from "./types";

export function EditorPreview({ preview, messages }: { preview: PreviewState; messages: EditorMessages }) {
  return (
    <section className="editor-preview" aria-label={messages.markdownPreview} aria-busy={preview.status === "loading"}>
      <div className="editor-preview-header">
        <div className="editor-preview-kicker">{messages.livePreview}</div>
        <div className={`editor-preview-status ${preview.status}`} role="status">
          {preview.status === "loading" ? messages.previewUpdating : preview.status === "error" ? messages.previewFailed : null}
        </div>
      </div>
      {preview.html ? (
        <div className="article-body editor-preview-body" dangerouslySetInnerHTML={{ __html: preview.html }} />
      ) : <p className="muted">{messages.previewEmpty}</p>}
    </section>
  );
}
