import type { AdminOption } from "./structures";

type FieldProps = {
  label: string;
  name: string;
  help?: string;
  placeholder?: string;
} & (
  | { kind: "select"; value: string; options: AdminOption[] }
  | { kind: "textarea"; value: string }
  | { kind?: "input"; value: string | number; type?: "text" | "url" | "number"; readOnly?: boolean; min?: number; max?: number }
);

export function SettingsField(props: FieldProps) {
  const helpId = props.help ? `${props.name}-help` : undefined;
  return (
    <label>
      {props.label}
      {props.kind === "select" ? (
        <select name={props.name} defaultValue={props.value} aria-describedby={helpId}>
          {props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : props.kind === "textarea" ? (
        <textarea name={props.name} defaultValue={props.value} placeholder={props.placeholder} aria-describedby={helpId} />
      ) : (
        <input className="field" name={props.readOnly ? undefined : props.name} type={props.type ?? "text"} defaultValue={props.value} readOnly={props.readOnly} min={props.min} max={props.max} step={props.type === "number" ? 1 : undefined} placeholder={props.placeholder} aria-describedby={helpId} />
      )}
      {props.help ? <span className="muted" id={helpId}>{props.help}</span> : null}
    </label>
  );
}
