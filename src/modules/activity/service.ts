import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLogs, type AuditLog } from "@/db/schema";

const publicRecentChangeActions = [
  "page.created",
  "page.published",
  "page.updated",
  "page.renamed",
  "page.deleted",
  "page.restored",
  "page.rollback",
  "media.uploaded",
  "media.deleted"
] as const;

export async function listRecentChanges(
  input: {
    siteId: string;
    limit?: number;
    offset?: number;
    action?: AuditLog["action"];
    publicOnly?: boolean;
  },
  database: Database = db
) {
  const query = database
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.siteId, input.siteId),
        input.action ? eq(auditLogs.action, input.action) : undefined,
        input.publicOnly ? inArray(auditLogs.action, [...publicRecentChangeActions]) : undefined
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return query;
}
