"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

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
  const formRef = useRef<HTMLFormElement>(null);
  const submissionInFlight = useRef(false);
  const status = pending ? pendingLabel : state.message;

  useEffect(() => {
    submissionInFlight.current = pending;
    if (!pending || !formRef.current) return;

    // React has already captured FormData, including the submitter's name and value.
    const submitters = Array.from(formRef.current.elements).filter(
      (element): element is HTMLButtonElement | HTMLInputElement =>
        (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
        (element.type === "submit" || element.type === "image") &&
        !element.disabled
    );
    submitters.forEach((element) => {
      element.disabled = true;
    });
    return () => {
      submitters.forEach((element) => {
        element.disabled = false;
      });
    };
  }, [pending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      aria-busy={pending}
      onSubmitCapture={(event) => {
        if (submissionInFlight.current) {
          event.preventDefault();
          return;
        }
        submissionInFlight.current = true;
      }}
    >
      {children}
      <span
        className={`action-form-feedback ${statusMode}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status ? (
          statusMode === "compact" ? (
            <span
              className={`form-status-dot ${pending ? "pending" : state.ok ? "ok" : "error"}`}
              title={status}
            >
              <span className="sr-only">{status}</span>
            </span>
          ) : (
            <span className={`action-form-status ${pending ? "muted" : state.ok ? "meta" : "error"}`}>
              {status}
            </span>
          )
        ) : null}
      </span>
    </form>
  );
}
