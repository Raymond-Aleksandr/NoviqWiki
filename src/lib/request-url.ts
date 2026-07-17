import { NextResponse, type NextRequest } from "next/server";

export function redirectWithinRequestHost(request: Request | NextRequest, pathname: string) {
  return NextResponse.redirect(urlWithinRequestHost(request, pathname));
}

export function urlWithinRequestHost(request: Request | NextRequest, pathname: string) {
  const nextUrl = "nextUrl" in request ? request.nextUrl : null;
  const url = nextUrl ? nextUrl.clone() : new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && isSafeHost(host)) {
    url.host = host;
    if (!hasExplicitPort(host)) {
      url.port = "";
    }
  }
  const protocol = request.headers.get("x-forwarded-proto");
  if (protocol === "http" || protocol === "https") {
    url.protocol = `${protocol}:`;
  }
  return url;
}

function isSafeHost(host: string) {
  return /^[a-z0-9.-]+(?::\d+)?$/i.test(host) || /^\[[0-9a-f:.]+\](?::\d+)?$/i.test(host);
}

function hasExplicitPort(host: string) {
  return host.startsWith("[") ? /\]:\d+$/.test(host) : /:\d+$/.test(host);
}
