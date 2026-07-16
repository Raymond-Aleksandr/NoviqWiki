"use client";

import { useActionState, useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, RotateCcw, Trash2, X } from "lucide-react";
import type { ActionState } from "@/app/actions";

type HiddenField = {
  name: string;
  value: string;
};

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: HiddenField[];
  triggerLabel: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  warning?: string;
  danger?: boolean;
  triggerClassName?: string;
  icon?: "trash" | "rollback";
  children?: ReactNode;
};

const initialState: ActionState = { ok: true };

export function ConfirmActionForm({
  action,
  hiddenFields,
  triggerLabel,
  title,
  body,
  warning,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  danger = false,
  triggerClassName = "button compact",
  icon,
  children
}: Props) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok && state.message) {
      setOpen(false);
    }
  }, [state.message, state.ok]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        <ActionIcon icon={icon} size={14} />
        {triggerLabel}
      </button>
      {state.message && !open ? (
        <span
          role="status"
          className={`form-status-dot ${state.ok ? "ok" : "error"}`}
          title={state.message}
        >
          <span className="sr-only">{state.message}</span>
        </span>
      ) : null}
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="confirm-dialog-heading">
              <span className={`confirm-dialog-icon ${danger ? "danger" : "warning"}`}>
                <AlertTriangle size={19} aria-hidden="true" />
              </span>
              <div>
                <h2 id={titleId}>{title}</h2>
                <p>{body}</p>
              </div>
            </div>
            {warning ? <div className="confirm-warning">{warning}</div> : null}
            <form action={formAction} className="confirm-action-form">
              {hiddenFields.map((field) => (
                <input key={field.name} type="hidden" name={field.name} value={field.value} />
              ))}
              {children}
              {state.message && !state.ok ? (
                <p role="status" className="error">
                  {state.message}
                </p>
              ) : null}
              <div className="confirm-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  <X size={15} aria-hidden="true" />
                  {cancelLabel}
                </button>
                <button className={danger ? "danger" : "primary"} disabled={pending}>
                  <ActionIcon icon={icon} size={14} />
                  {pending ? pendingLabel : confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ActionIcon({ icon, size }: { icon?: "trash" | "rollback"; size: number }) {
  if (icon === "trash") {
    return <Trash2 size={size} aria-hidden="true" />;
  }
  if (icon === "rollback") {
    return <RotateCcw size={size} aria-hidden="true" />;
  }
  return null;
}
