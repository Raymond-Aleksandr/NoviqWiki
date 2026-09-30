import type { ReactNode } from "react";
import { ActionForm } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/action-state";
import { AdminSubmitButton } from "./submit-button";

export function AdminRecordForm({
  action,
  className,
  record,
  nameLabel,
  descriptionLabel,
  submitLabel,
  pendingLabel,
  children
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  className: string;
  record?: { field: string; id: string; name: string; description: string; nameReadOnly?: boolean };
  nameLabel: string;
  descriptionLabel: string;
  submitLabel: string;
  pendingLabel: string;
  children?: ReactNode;
}) {
  return (
    <ActionForm action={action} className={className} pendingLabel={pendingLabel}>
      {record ? <input type="hidden" name={record.field} value={record.id} /> : null}
      <label>
        {nameLabel}
        <input className="field" name="name" defaultValue={record?.name} readOnly={record?.nameReadOnly} required />
      </label>
      <label>
        {descriptionLabel}
        <input className="field" name="description" defaultValue={record?.description} />
      </label>
      {children}
      <AdminSubmitButton label={submitLabel} pendingLabel={pendingLabel} create={!record} />
    </ActionForm>
  );
}
