"use client";

import { useActionState, useEffect, useRef } from "react";
import { Upload, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";
import type { MediaUploadMessages } from "./messages";
import type { MediaAction } from "./types";

const initialState: ActionState = { ok: true };

export function MediaUploadDialog({
  action,
  messages,
  onClose,
  onUploaded
}: {
  action: MediaAction;
  messages: MediaUploadMessages;
  onClose: () => void;
  onUploaded: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.ok || !state.message) return;
    formRef.current?.reset();
    onUploaded(state.message);
  }, [state, onUploaded]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={messages.upload}
      description={messages.mediaLibraryDescription}
      className="confirm-dialog"
      closeLabel={messages.cancel}
      closeDisabled={pending}
    >
      <form ref={formRef} action={formAction} className="confirm-action-form">
        <div className="confirm-field-grid">
          <label>
            {messages.file}
            <input
              className="field"
              name="file"
              type="file"
              required
              disabled={pending}
              data-dialog-autofocus
            />
          </label>
          <label>
            {messages.altText}
            <input className="field" name="altText" maxLength={2000} disabled={pending} />
          </label>
        </div>
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "meta" : "error"}>
          {pending ? messages.working : state.message}
        </p>
        <div className="confirm-actions">
          <button type="button" disabled={pending} onClick={onClose}>
            <X size={15} aria-hidden="true" />
            {messages.cancel}
          </button>
          <button className="primary" disabled={pending}>
            <Upload size={16} aria-hidden="true" />
            {pending ? messages.working : messages.upload}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
