import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditActionEnum, auditLogs } from "@/db/schema";

export type AuditAction = (typeof auditActionEnum.enumValues)[number];

export const auditActionValues = auditActionEnum.enumValues;

export function auditActionValue(value: string | null | undefined): AuditAction | undefined {
  return auditActionValues.includes(value as AuditAction) ? (value as AuditAction) : undefined;
}

export async function writeAuditLog(
  input: {
    siteId?: string | null;
    actorId?: string | null;
    actorDisplayName?: string | null;
    action: AuditAction;
    targetType: string;
    targetId?: string | null;
    requestId?: string | null;
    ipHash?: string | null;
    userAgent?: string | null;
    details?: Record<string, unknown>;
  },
  database: Database = db
) {
  const [log] = await database
    .insert(auditLogs)
    .values({
      siteId: input.siteId ?? null,
      actorId: input.actorId ?? null,
      actorDisplayName: input.actorDisplayName ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      requestId: input.requestId ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      details: input.details ?? {}
    })
    .returning();
  return log;
}

export async function listAuditLogs(
  input: { siteId: string; action?: AuditAction; query?: string; limit?: number; offset?: number },
  database: Database = db
) {
  const needle = input.query?.trim();
  const textFilter = needle
    ? or(
        ilike(auditLogs.actorDisplayName, `%${needle}%`),
        sql`${auditLogs.action}::text ilike ${`%${needle}%`}`,
        ilike(auditLogs.targetType, `%${needle}%`),
        ilike(auditLogs.targetId, `%${needle}%`),
        sql`${auditLogs.details}::text ilike ${`%${needle}%`}`
      )
    : undefined;
  const where = and(
    eq(auditLogs.siteId, input.siteId),
    input.action ? eq(auditLogs.action, input.action) : undefined,
    textFilter
  );
  const rows = await database
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);
  return { rows, count };
}
