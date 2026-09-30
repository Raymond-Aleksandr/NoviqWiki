"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Messages } from "@/i18n";

type CitationItem = { label: string; copyLabel: string; value: string; preformatted?: boolean };
type ClipboardMessages = Pick<Messages, "copiedSuffix" | "clipboardFailed">;

export function CitationList({
  items,
  title,
  messages
}: {
  items: CitationItem[];
  title: string;
  messages: ClipboardMessages;
}) {
  return (
    <section className="citation-list" aria-label={title}>
      {items.map((item) => <CitationCard key={item.label} item={item} messages={messages} />)}
    </section>
  );
}

function CitationCard({ item, messages }: { item: CitationItem; messages: ClipboardMessages }) {
  const headingId = useId();
  const statusId = useId();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [pending, setPending] = useState(false);

  async function copyCitation() {
    setPending(true);
    setStatus("idle");
    try {
      await navigator.clipboard.writeText(item.value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="data-panel citation-card" aria-labelledby={headingId}>
      <div className="admin-panel-heading citation-card-heading">
        <span id={headingId}>{item.label}</span>
        <button
          className="icon-button"
          type="button"
          aria-label={item.copyLabel}
          aria-describedby={status === "idle" ? undefined : statusId}
          title={item.copyLabel}
          disabled={pending}
          onClick={copyCitation}
        >
          {status === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
      {item.preformatted ? (
        <pre className="citation-block">{item.value}</pre>
      ) : (
        <p className="citation-block">{item.value}</p>
      )}
      <p className="meta citation-copy-status" id={statusId} role="status">
        {status === "copied" ? `${item.label} ${messages.copiedSuffix}` : status === "failed" ? messages.clipboardFailed : ""}
      </p>
    </article>
  );
}
