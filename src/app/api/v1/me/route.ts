import { getCurrentSession } from "@/modules/auth/session";
import { ok } from "@/modules/api/responses";
import { toSafeUser } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  return ok({
    user: session ? toSafeUser(session.user) : null,
    csrfToken: session?.csrfToken ?? null
  });
}
