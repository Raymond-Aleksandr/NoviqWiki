"use client";

import { useId, useState } from "react";
import { GitCompare } from "lucide-react";
import type { Messages } from "@/i18n";
import type { RevisionOption } from "./types";

export type RevisionCompareMessages = Pick<
  Messages,
  "compareSelectedRevisions" | "fromRevision" | "toRevision" | "compare"
>;

export function RevisionCompareForm({
  pageSlug,
  options,
  messages
}: {
  pageSlug: string;
  options: RevisionOption[];
  messages: RevisionCompareMessages;
}) {
  const headingId = useId();
  const [from, setFrom] = useState(options[1]?.id ?? "");
  const [to, setTo] = useState(options[0]?.id ?? "");
  if (options.length < 2) return null;

  return (
    <form
      className="history-compare-form"
      action={`/history/${encodeURIComponent(pageSlug)}/compare`}
      method="get"
      aria-labelledby={headingId}
    >
      <div className="history-compare-heading" id={headingId}>
        <GitCompare size={16} aria-hidden="true" />
        <strong>{messages.compareSelectedRevisions}</strong>
      </div>
      <label>
        <span>{messages.fromRevision}</span>
        <select name="from" value={from} onChange={(event) => setFrom(event.target.value)}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label>
        <span>{messages.toRevision}</span>
        <select name="to" value={to} onChange={(event) => setTo(event.target.value)}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <button className="primary compact" type="submit">
        <GitCompare size={14} aria-hidden="true" />
        {messages.compare}
      </button>
    </form>
  );
}
