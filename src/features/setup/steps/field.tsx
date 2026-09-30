import type { InputHTMLAttributes } from "react";
import type { SetupMessages } from "../messages";
import type { SetupChange, SetupValues } from "../model";
import type { SetupValidationIssue } from "../validation";

export type SetupFieldsProps = {
  values: SetupValues;
  onChange: SetupChange;
  messages: SetupMessages;
  disabled: boolean;
  issue?: SetupValidationIssue;
};

type TextFieldName = {
  [K in keyof SetupValues]: string extends SetupValues[K] ? K : never
}[keyof SetupValues];

type Props = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "autoComplete" | "required" | "minLength" | "maxLength" | "inputMode" | "pattern"
> & Omit<SetupFieldsProps, "messages"> & {
  name: TextFieldName;
  label: string;
  hint?: string;
};

export function SetupField({ name, label, hint, values, onChange, disabled, issue, ...inputProps }: Props) {
  const id = `setup-${name}`;
  const invalid = issue?.field === name;
  const descriptions = [hint ? `${id}-hint` : "", invalid ? "setup-validation-message" : ""].filter(Boolean).join(" ");
  return (
    <label htmlFor={id}>
      {label}
      <input
        {...inputProps}
        id={id}
        className="field"
        data-setup-field={name}
        value={values[name]}
        onChange={(event) => onChange(name, event.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={descriptions || undefined}
      />
      {hint ? <small id={`${id}-hint`} className="muted">{hint}</small> : null}
    </label>
  );
}
