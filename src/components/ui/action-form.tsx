"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
};

const initialState: ActionState = { ok: true };

export function ActionForm({ action, children, className = "form", pendingLabel = "..." }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className={className}>
      {children}
      {pending ? <p className="muted">{pendingLabel}</p> : null}
      {state.message ? (
        <p role="status" className={state.ok ? "meta" : "error"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
