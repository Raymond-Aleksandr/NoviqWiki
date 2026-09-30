import { SetupField, type SetupFieldsProps } from "./field";

export function OwnerStep({ setupTokenRequired, ...props }: SetupFieldsProps & { setupTokenRequired: boolean }) {
  const { messages, ...fields } = props;
  return (
    <div className="setup-fields">
      {setupTokenRequired ? (
        <SetupField {...fields} name="setupToken" label={messages.setupToken} type="password" autoComplete="off" maxLength={300} hint={messages.setupTokenDescription} required />
      ) : null}
      <SetupField {...fields} name="ownerUsername" label={messages.username} autoComplete="username" minLength={2} maxLength={80} pattern={"[A-Za-z0-9_.\\-]+"} hint={messages.usernameCharacters} required />
      <SetupField {...fields} name="ownerEmail" label={messages.email} type="email" autoComplete="email" maxLength={320} required />
      <SetupField {...fields} name="ownerDisplayName" label={messages.displayName} autoComplete="nickname" maxLength={160} />
      <SetupField {...fields} name="ownerPassword" label={messages.password} type="password" autoComplete="new-password" minLength={12} maxLength={200} hint={`${messages.passwordLength} ${messages.passwordComplexity}`} required />
    </div>
  );
}
