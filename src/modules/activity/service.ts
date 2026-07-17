import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLogs, pages, type AuditLog } from "@/db/schema";

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type ListRecentChangesInput = {
  siteId: string;
  limit?: number;
  offset?: number;
  action?: AuditLog["action"];
  actions?: readonly AuditLog["action"][];
  publicOnly?: boolean;
};

export type RecentChangeWithTarget = AuditLog & {
  targetLabel: string;
};

export async function listRecentChanges(input: ListRecentChangesInput, database: Database = db) {
  const query = database
    .select()
    .from(auditLogs)
    .where(recentChangesWhere(input))
    .orderBy(desc(auditLogs.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return query;
}

export async function countRecentChanges(input: ListRecentChangesInput, database: Database = db) {
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(recentChangesWhere(input));
  return count;
}

export async function listRecentChangesPage(
  input: ListRecentChangesInput,
  database: Database = db
) {
  const [rows, count] = await Promise.all([
    listRecentChangesWithTargets(input, database),
    countRecentChanges(input, database)
  ]);
  return { rows, count };
}

export async function listRecentChangesWithTargets(
  input: ListRecentChangesInput,
  database: Database = db
): Promise<RecentChangeWithTarget[]> {
  const changes = await listRecentChanges(input, database);
  const pageIds = [
    ...new Set(
      changes
        .filter(
          (change) =>
            change.targetType === "page" && change.targetId && uuidPattern.test(change.targetId)
        )
        .map((change) => change.targetId as string)
    )
  ];
  const pageRows =
    pageIds.length > 0
      ? await database
          .select({ id: pages.id, title: pages.title })
          .from(pages)
          .where(inArray(pages.id, pageIds))
      : [];
  const pageTitles = new Map(pageRows.map((page) => [page.id, page.title]));

  return changes.map((change) => ({
    ...change,
    targetLabel: recentChangeTargetLabel(change, pageTitles.get(change.targetId ?? ""))
  }));
}

function recentChangeTargetLabel(change: AuditLog, pageTitle?: string) {
  const title = detailString(change.details, "title");
  const from = detailString(change.details, "from");
  const to = detailString(change.details, "to");
  const filename = detailString(change.details, "filename");
  if (from && to) return `${from} -> ${to}`;
  if (title) return title;
  if (filename) return filename;
  if (pageTitle) return pageTitle;
  return `${change.targetType}${change.targetId ? `:${change.targetId.slice(0, 8)}` : ""}`;
}

function detailString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function recentChangesWhere(input: ListRecentChangesInput) {
  const actionFilter = input.actions?.length
    ? inArray(auditLogs.action, [...input.actions])
    : input.action
      ? eq(auditLogs.action, input.action)
      : undefined;
  return and(
    eq(auditLogs.siteId, input.siteId),
    actionFilter,
    input.publicOnly ? inArray(auditLogs.action, [...publicRecentChangeActions]) : undefined
  );
}
