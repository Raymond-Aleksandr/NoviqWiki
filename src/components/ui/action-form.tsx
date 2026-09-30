"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  statusMode?: "inline" | "compact";
};

const initialState: ActionState = { ok: true };

export function ActionForm({
  action,
  children,
  className = "form",
  pendingLabel = "...",
  statusMode = "inline"
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className={className}>
      {children}
      {pending ? (
        statusMode === "compact" ? (
          <span className="form-status-dot pending" role="status" title={pendingLabel}>
            <span className="sr-only">{pendingLabel}</span>
          </span>
        ) : (
          <p className="muted">{pendingLabel}</p>
        )
      ) : null}
      {state.message && statusMode === "compact" ? (
        <span
          role="status"
          className={`form-status-dot ${state.ok ? "ok" : "error"}`}
          title={state.message}
        >
          <span className="sr-only">{state.message}</span>
        </span>
      ) : null}
      {state.message && statusMode === "inline" ? (
        <p role="status" className={state.ok ? "meta" : "error"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
