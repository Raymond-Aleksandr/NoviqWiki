import { SetupField, type SetupFieldsProps } from "./field";

export function SiteStep(props: SetupFieldsProps) {
  const { messages, ...fields } = props;
  const { values, onChange, disabled } = fields;
  return (
    <div className="setup-fields">
      <SetupField {...fields} name="siteName" label={messages.siteName} autoComplete="organization" maxLength={160} required />
      <SetupField {...fields} name="tagline" label={messages.tagline} maxLength={240} />
      <SetupField {...fields} name="baseUrl" label={messages.baseUrl} type="url" inputMode="url" required />
      <label htmlFor="setup-defaultLocale">
        {messages.defaultLocale}
        <select
          id="setup-defaultLocale"
          value={values.defaultLocale}
          disabled={disabled}
          onChange={(event) => onChange("defaultLocale", event.target.value === "zh-CN" ? "zh-CN" : "en")}
        >
          <option value="zh-CN">{messages.simplifiedChinese}</option>
          <option value="en">{messages.english}</option>
        </select>
      </label>
    </div>
  );
}
