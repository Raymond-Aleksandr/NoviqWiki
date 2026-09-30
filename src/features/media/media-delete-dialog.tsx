"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";
import type { MediaDeleteMessages } from "./messages";
import type { MediaAction, MediaAsset } from "./types";
import { useMediaReferences } from "./use-media-references";

const initialState: ActionState = { ok: true };

export function MediaDeleteDialog({
  asset,
  action,
  messages,
  onClose,
  onDeleted
}: {
  asset: MediaAsset;
  action: MediaAction;
  messages: MediaDeleteMessages;
  onClose: () => void;
  onDeleted: (id: string, message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [force, setForce] = useState(false);
  const { status, references } = useMediaReferences(asset.id);
  const hasReferences = references.length > 0;

  useEffect(() => {
    if (!state.ok || !state.message) return;
    onDeleted(asset.id, state.message);
  }, [asset.id, state, onDeleted]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${messages.delete} · ${asset.safeFilename}`}
      description={messages.deleteMediaConfirmBody}
      className="confirm-dialog"
      closeLabel={messages.cancel}
      closeDisabled={pending}
    >
      <div className="confirm-warning">
        {hasReferences ? messages.deleteMayBreakLinks : messages.destructiveActionWarning}
      </div>
      <div role="status" aria-live="polite">
        {status === "loading" ? <p className="muted">{messages.checkingReferences}</p> : null}
        {status === "error" ? <p className="error">{messages.referencesFailed}</p> : null}
      </div>
      <form action={formAction} className="confirm-action-form">
        <input type="hidden" name="assetId" value={asset.id} />
        <label className="media-force-delete checkbox-row">
          <input
            type="checkbox"
            name="force"
            checked={force}
            required={hasReferences}
            disabled={pending}
            onChange={(event) => setForce(event.target.checked)}
          />
          <span>{messages.deleteReferencedMedia}</span>
        </label>
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "meta" : "error"}>
          {pending ? messages.working : state.message}
        </p>
        <div className="confirm-actions">
          <button type="button" disabled={pending} onClick={onClose} data-dialog-autofocus>
            <X size={15} aria-hidden="true" />
            {messages.cancel}
          </button>
          <button
            className="danger"
            disabled={pending || status === "loading" || (hasReferences && !force)}
          >
            <Trash2 size={15} aria-hidden="true" />
            {pending ? messages.working : messages.delete}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
