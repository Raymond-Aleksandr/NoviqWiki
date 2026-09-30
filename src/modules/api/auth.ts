import { getPrimarySiteWithSettings } from "@/db/site";
import { ForbiddenError } from "@/lib/errors";
import { hmac, safeEqual } from "@/lib/crypto";
import { urlWithinRequestHost, type RequestUrlEnvironment } from "@/lib/request-url";
import { getCurrentSession } from "@/modules/auth/session";
import { requirePermission, type PermissionKey } from "@/modules/authorization/permissions";

export async function requireApiContext(permission?: PermissionKey, request?: Request) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    throw new ForbiddenError("Setup is required.");
  }
  const session = await getCurrentSession();
  if (request && !isSafeMethod(request.method)) {
    if (!session) {
      throw new ForbiddenError("Authentication required.");
    }
    assertApiCsrf(request, session.csrfToken);
  }
  if (permission) {
    await requirePermission(session?.user.id, site.site.id, permission);
  }
  return { site, session };
}

export function assertApiCsrf(
  request: Request,
  csrfToken: string,
  environment?: RequestUrlEnvironment
) {
  const origin = request.headers.get("origin");
  if (origin) {
    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      throw new ForbiddenError("Invalid request origin.");
    }
    if (normalizedOrigin !== urlWithinRequestHost(request, "/", environment).origin) {
      throw new ForbiddenError("Invalid request origin.");
    }
  } else if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ForbiddenError("Invalid request origin.");
  }

  const submittedToken = request.headers.get("x-csrf-token");
  if (!submittedToken || !safeEqual(hmac(submittedToken), hmac(csrfToken))) {
    throw new ForbiddenError("Invalid CSRF token.");
  }
}

function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}
