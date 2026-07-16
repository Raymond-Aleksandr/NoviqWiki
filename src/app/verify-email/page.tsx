import Link from "next/link";
import { verifyEmailAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  return (
    <section className="panel">
      <h1>Verify email</h1>
      {token ? (
        <ActionForm action={verifyEmailAction}>
          <input type="hidden" name="token" value={token} />
          <button className="primary">Verify email address</button>
        </ActionForm>
      ) : (
        <p role="alert" className="error">
          Verification token is missing.
        </p>
      )}
      <p>
        <Link href="/login">Return to login</Link>
      </p>
    </section>
  );
}
