import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema";
import { apiError, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";

export async function GET() {
  try {
    const { site } = await requireApiContext("group.read");
    return ok({ groups: await db.select().from(groups).where(eq(groups.siteId, site.site.id)) });
  } catch (error) {
    return apiError(error);
  }
}
