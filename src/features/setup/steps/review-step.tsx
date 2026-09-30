import type { SetupMessages } from "../messages";
import { registrationLabel, type SetupMode, type SetupValues } from "../model";

export function ReviewStep({ values, mode, messages }: {
  values: SetupValues;
  mode: SetupMode;
  messages: SetupMessages;
}) {
  const details = [
    ...(mode === "initial" ? [
      { label: messages.setupSite, value: values.siteName },
      { label: messages.baseUrl, value: values.baseUrl },
      { label: messages.defaultLocale, value: values.defaultLocale === "zh-CN" ? messages.simplifiedChinese : messages.english },
      { label: messages.registration, value: registrationLabel(values.registrationMode, messages) },
      { label: messages.mediaStorage, value: values.mediaDriver === "local" ? messages.localFilesystem : messages.s3Storage }
    ] : []),
    { label: messages.owner, value: `${values.ownerUsername} · ${values.ownerEmail}` }
  ];
  return (
    <div className="setup-review">
      <dl>{details.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="muted">{mode === "owner" ? messages.ownerBootstrapNote : messages.setupOneTimeNote}</p>
    </div>
  );
}
