import { desc, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLogs } from "@/db/schema";

export async function listRecentChanges(
  input: { siteId: string; limit?: number; offset?: number; action?: string },
  database: Database = db
) {
  const query = database
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.siteId, input.siteId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return query;
}
