import { NextResponse } from "next/server";
import { getPrimarySiteWithSettings } from "@/db/site";
import { decodeRouteParam } from "@/lib/route-params";
import { redirectWithinRequestHost } from "@/lib/request-url";
import { hasPermission } from "@/modules/authorization/permissions";
import { getCurrentSession } from "@/modules/auth/session";
import { getRevisionById } from "@/modules/pages/service";
import { resolvePageBySlug } from "@/modules/redirects/service";

type Props = {
  params: Promise<unknown>;
};

export async function GET(request: Request, { params }: Props) {
  const site = await getPrimarySiteWithSettings();
  const url = new URL(request.url);
  if (!site) {
    return redirectWithinRequestHost(request, "/setup");
  }
  const session = await getCurrentSession();
  if (!(await hasPermission(session?.user.id, site.site.id, "page.read"))) {
    return redirectWithinRequestHost(request, "/login");
  }

  const parsedParams = await params;
  const slug =
    typeof parsedParams === "object" &&
    parsedParams !== null &&
    "slug" in parsedParams &&
    typeof parsedParams.slug === "string"
      ? decodeRouteParam(parsedParams.slug)
      : "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!slug) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!from || !to || from === to) {
    return redirectWithinRequestHost(request, `/history/${encodeURIComponent(slug)}`);
  }

  const resolved = await resolvePageBySlug({
    siteId: site.site.id,
    slug,
    followContentRedirects: false
  }).catch(() => null);
  if (!resolved || resolved.page.status === "deleted") {
    return new NextResponse("Not found", { status: 404 });
  }

  const revisions = await Promise.all([
    getRevisionById(from).catch(() => null),
    getRevisionById(to).catch(() => null)
  ]);
  if (
    !revisions[0] ||
    !revisions[1] ||
    revisions[0].pageId !== resolved.page.id ||
    revisions[1].pageId !== resolved.page.id
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  return redirectWithinRequestHost(request, `/diff/${from}/${to}`);
}
