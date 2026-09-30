import type { AdminOption } from "./structures";

export function AdminCheckboxList({ legend, name, options, selected = [], className, code = false }: {
  legend: string;
  name: string;
  options: AdminOption[];
  selected?: string[];
  className: string;
  code?: boolean;
}) {
  const selectedValues = new Set(selected);
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className={className}>
        {options.map((option) => (
          <label className="checkbox-row permission-checkbox" key={option.value}>
            <input type="checkbox" name={name} value={option.value} defaultChecked={selectedValues.has(option.value)} />
            <span className={code ? "mono" : undefined}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
