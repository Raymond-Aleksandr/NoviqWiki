"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function AuthSubmitButton({
  children,
  pendingLabel
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="primary button-primary" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
