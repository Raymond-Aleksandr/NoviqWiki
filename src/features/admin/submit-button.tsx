"use client";

import { useFormStatus } from "react-dom";
import { Plus, Save } from "lucide-react";

export function AdminSubmitButton({
  label,
  pendingLabel,
  create = false,
  compact = false
}: {
  label: string;
  pendingLabel: string;
  create?: boolean;
  compact?: boolean;
}) {
  const { pending } = useFormStatus();
  const Icon = create ? Plus : Save;
  return (
    <button type="submit" className={compact ? "button compact primary" : "primary"} disabled={pending}>
      <Icon size={15} aria-hidden="true" />
      {pending ? pendingLabel : label}
    </button>
  );
}
