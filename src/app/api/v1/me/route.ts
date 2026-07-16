import { getCurrentSession } from "@/modules/auth/session";
import { ok } from "@/modules/api/responses";

export async function GET() {
  const session = await getCurrentSession();
  return ok({ user: session?.user ?? null, csrfToken: session?.csrfToken ?? null });
}
