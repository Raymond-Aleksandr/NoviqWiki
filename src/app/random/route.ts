import { type NextRequest } from "next/server";
import { getPrimarySiteWithSettings } from "@/db/site";
import { redirectWithinRequestHost } from "@/lib/request-url";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getRandomPublishedPage } from "@/modules/pages/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    return redirectWithinRequestHost(request, "/setup");
  }
  const session = await getCurrentSession();
  if (!(await hasPermission(session?.user.id, site.site.id, "page.read"))) {
    return redirectWithinRequestHost(request, "/login");
  }
  const page = await getRandomPublishedPage({ siteId: site.site.id });
  if (!page) {
    return redirectWithinRequestHost(request, "/pages");
  }
  return redirectWithinRequestHost(request, `/page/${page.slug}`);
}
