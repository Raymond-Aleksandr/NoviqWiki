import type { InputHTMLAttributes } from "react";

type Props = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "autoComplete" | "required" | "minLength" | "maxLength" | "pattern"
> & {
  name: string;
  label: string;
  hint?: string;
};

export function AuthField({ name, label, hint, ...inputProps }: Props) {
  const id = `auth-${name}`;
  return (
    <label htmlFor={id}>
      {label}
      <input
        {...inputProps}
        id={id}
        name={name}
        className="field input"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? <small id={`${id}-hint`} className="muted">{hint}</small> : null}
    </label>
  );
}
