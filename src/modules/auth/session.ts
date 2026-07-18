import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { sessions, users, type User } from "@/db/schema";
import { hmac, randomToken, safeEqual } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export const sessionCookieName = "noviqwiki_session";
export const csrfCookieName = "noviqwiki_csrf";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;

export type CurrentSession = {
  sessionId: string;
  user: User;
  csrfToken: string;
};

export async function createSession(
  input: { userId: string; request?: Request },
  database: Database = db
) {
  const token = randomToken(48);
  const csrfToken = randomToken(32);
  const userAgent = input.request?.headers.get("user-agent") ?? null;
  const ipHash = input.request ? hmac(getClientIp(input.request)) : null;
  const [session] = await database
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: hmac(token),
      csrfSecretHash: hmac(csrfToken),
      userAgent,
      ipHash,
      expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000)
    })
    .returning();
  return { session, token, csrfToken };
}

export async function setSessionCookies(token: string, csrfToken: string) {
  const cookieStore = await cookies();
  const secure = shouldUseSecureCookies(getEnv().NOVIQWIKI_BASE_URL);
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
  cookieStore.set(csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
}

export function shouldUseSecureCookies(baseUrl: string) {
  return new URL(baseUrl).protocol === "https:";
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  cookieStore.delete(csrfCookieName);
}

export async function getCurrentSession(database: Database = db): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const csrfToken = cookieStore.get(csrfCookieName)?.value;
  if (!token || !csrfToken) {
    return null;
  }
  const tokenHash = hmac(token);
  const [row] = await database
    .select({
      sessionId: sessions.id,
      csrfSecretHash: sessions.csrfSecretHash,
      user: users
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "active")
      )
    )
    .limit(1);
  if (!row || !safeEqual(row.csrfSecretHash, hmac(csrfToken))) {
    return null;
  }
  return { sessionId: row.sessionId, user: row.user, csrfToken };
}

export async function requireCurrentUser(database: Database = db) {
  const session = await getCurrentSession(database);
  if (!session) {
    return null;
  }
  return session.user;
}

export async function invalidateCurrentSession(database: Database = db) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await database
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.tokenHash, hmac(token)));
  }
  await clearSessionCookies();
}

export async function invalidateUserSessions(userId: string, database: Database = db) {
  await database
    .update(sessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(sessions.userId, userId));
}

export async function assertCsrf(request: Request, session: CurrentSession) {
  const header = request.headers.get("x-csrf-token");
  const formHeader = request.headers.get("next-action");
  if (formHeader) {
    return;
  }
  if (!header || !safeEqual(hmac(header), hmac(session.csrfToken))) {
    throw new Response("Invalid CSRF token.", { status: 403 });
  }
}

export async function getRequestMetadata(request?: Request) {
  if (request) {
    return {
      userAgent: request.headers.get("user-agent"),
      ipHash: hmac(getClientIp(request))
    };
  }
  const headerStore = await headers();
  return {
    userAgent: headerStore.get("user-agent"),
    ipHash: hmac(headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown")
  };
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
