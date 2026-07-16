import Link from "next/link";
import { resetPasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  return (
    <section className="panel">
      <h1>Choose a new password</h1>
      {token ? (
        <ActionForm action={resetPasswordAction}>
          <input type="hidden" name="token" value={token} />
          <label>
            New password
            <input
              className="field"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <button className="primary">Reset password</button>
        </ActionForm>
      ) : (
        <p role="alert" className="error">
          Reset token is missing.
        </p>
      )}
      <p>
        <Link href="/login">Return to login</Link>
      </p>
    </section>
  );
}
