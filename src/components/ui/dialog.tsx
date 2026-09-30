"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel: string;
  closeDisabled?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  closeLabel,
  closeDisabled = false
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    const previouslyFocused = document.activeElement;
    dialog.showModal();
    const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-autofocus]");
    initialFocus?.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open, portalTarget]);

  if (!portalTarget || !open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={["ui-dialog", className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(event) => {
        if (closeDisabled || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) onClose();
      }}
    >
      <header className="ui-dialog-header">
        <div>
          <h2 className="ui-dialog-title" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="ui-dialog-description" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </div>
        <button
          className="ui-dialog-close"
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          disabled={closeDisabled}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="ui-dialog-body">{children}</div>
    </dialog>,
    portalTarget
  );
}
