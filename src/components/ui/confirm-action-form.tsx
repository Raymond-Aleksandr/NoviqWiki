"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  Pencil,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X
} from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { Dialog } from "@/components/ui/dialog";

type HiddenField = {
  name: string;
  value: string;
};

type ActionIconName =
  "archive" | "trash" | "rollback" | "reset" | "rename" | "protect" | "unprotect";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: HiddenField[];
  triggerLabel: string;
  triggerTitle?: string;
  triggerIconOnly?: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  warning?: string;
  danger?: boolean;
  triggerClassName?: string;
  icon?: ActionIconName;
  children?: ReactNode;
};

const initialState: ActionState = { ok: true };

export function ConfirmActionForm({
  action,
  hiddenFields,
  triggerLabel,
  triggerTitle,
  triggerIconOnly = false,
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
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const iconTone = danger
    ? "danger"
    : icon === "archive" || icon === "rename" || icon === "unprotect"
      ? "neutral"
      : "warning";

  useEffect(() => {
    if (state.ok && state.message) {
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        data-confirm-action={icon ?? "confirm"}
        aria-label={triggerIconOnly ? triggerLabel : undefined}
        title={triggerTitle ?? (triggerIconOnly ? triggerLabel : undefined)}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <ActionIcon icon={icon} size={14} />
        <span className={triggerIconOnly ? "sr-only" : undefined}>{triggerLabel}</span>
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
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={cancelLabel}
        closeDisabled={pending}
        className="confirm-dialog"
        title={
          <span className="confirm-dialog-heading">
            <span className={`confirm-dialog-icon ${iconTone}`}>
              {icon === "rename" ? (
                <Pencil size={19} aria-hidden="true" />
              ) : icon === "archive" ? (
                <Archive size={19} aria-hidden="true" />
              ) : icon === "protect" ? (
                <ShieldCheck size={19} aria-hidden="true" />
              ) : icon === "unprotect" ? (
                <ShieldOff size={19} aria-hidden="true" />
              ) : (
                <AlertTriangle size={19} aria-hidden="true" />
              )}
            </span>
            <span>{title}</span>
          </span>
        }
        description={body}
      >
        {warning ? <div className="confirm-warning">{warning}</div> : null}
        <form action={formAction} className="confirm-action-form" aria-busy={pending}>
          {hiddenFields.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}
          {children}
          {state.message && !state.ok ? (
            <p role="status" aria-live="polite" className="error">
              {state.message}
            </p>
          ) : null}
          <div className="confirm-actions">
            <button
              type="button"
              data-dialog-autofocus
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              <X size={15} aria-hidden="true" />
              {cancelLabel}
            </button>
            <button className={danger ? "danger" : "primary"} disabled={pending}>
              <ActionIcon icon={icon} size={14} />
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ActionIcon({ icon, size }: { icon?: ActionIconName; size: number }) {
  if (icon === "archive") {
    return <Archive size={size} aria-hidden="true" />;
  }
  if (icon === "trash") {
    return <Trash2 size={size} aria-hidden="true" />;
  }
  if (icon === "rollback" || icon === "reset") {
    return <RotateCcw size={size} aria-hidden="true" />;
  }
  if (icon === "rename") {
    return <Pencil size={size} aria-hidden="true" />;
  }
  if (icon === "protect") {
    return <ShieldCheck size={size} aria-hidden="true" />;
  }
  if (icon === "unprotect") {
    return <ShieldOff size={size} aria-hidden="true" />;
  }
  return null;
}
