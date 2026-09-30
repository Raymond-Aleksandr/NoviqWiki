import { registrationOptions } from "../model";
import type { SetupFieldsProps } from "./field";

export function AccessStep({ values, onChange, messages, disabled }: SetupFieldsProps) {
  return (
    <fieldset className="setup-choice-grid">
      <legend className="sr-only">{messages.registration}</legend>
      {registrationOptions.map(({ value, label, description }) => (
        <label key={value} className="setup-choice radio-row">
          <input
            type="radio"
            name="registration-choice"
            value={value}
            checked={values.registrationMode === value}
            onChange={() => onChange("registrationMode", value)}
            disabled={disabled}
          />
          <span><strong>{messages[label]}</strong><small>{messages[description]}</small></span>
        </label>
      ))}
    </fieldset>
  );
}
