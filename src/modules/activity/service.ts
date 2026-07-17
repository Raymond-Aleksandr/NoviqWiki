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

export type RecentChangeFilter = "all" | "created" | "edited" | "published" | "rollback" | "media";

const recentChangeFilterActions = {
  created: ["page.created"],
  edited: ["page.updated", "page.renamed", "page.deleted", "page.restored"],
  published: ["page.published"],
  rollback: ["page.rollback"],
  media: ["media.uploaded", "media.deleted"]
} satisfies Record<Exclude<RecentChangeFilter, "all">, AuditLog["action"][]>;

export function recentChangeFilterValue(value: string | undefined): RecentChangeFilter {
  if (
    value === "created" ||
    value === "edited" ||
    value === "published" ||
    value === "rollback" ||
    value === "media"
  ) {
    return value;
  }
  return "all";
}

export function actionsForRecentChangeFilter(filter: RecentChangeFilter) {
  return filter === "all" ? undefined : recentChangeFilterActions[filter];
}

export async function listRecentChanges(
  input: {
    siteId: string;
    limit?: number;
    offset?: number;
    action?: AuditLog["action"];
    actions?: readonly AuditLog["action"][];
    publicOnly?: boolean;
  },
  database: Database = db
) {
  const actionFilter = input.actions?.length
    ? inArray(auditLogs.action, [...input.actions])
    : input.action
      ? eq(auditLogs.action, input.action)
      : undefined;

  const query = database
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.siteId, input.siteId),
        actionFilter,
        input.publicOnly ? inArray(auditLogs.action, [...publicRecentChangeActions]) : undefined
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return query;
}
