import { NextResponse } from "next/server";
import { getPrimarySiteWithSettings } from "@/db/site";
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
    return NextResponse.redirect(new URL("/setup", url));
  }
  const session = await getCurrentSession();
  if (!(await hasPermission(session?.user.id, site.site.id, "page.read"))) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const parsedParams = await params;
  const slug =
    typeof parsedParams === "object" &&
    parsedParams !== null &&
    "slug" in parsedParams &&
    typeof parsedParams.slug === "string"
      ? parsedParams.slug
      : "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!slug) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!from || !to || from === to) {
    return NextResponse.redirect(new URL(`/history/${encodeURIComponent(slug)}`, url));
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

  return NextResponse.redirect(new URL(`/diff/${from}/${to}`, url));
}
