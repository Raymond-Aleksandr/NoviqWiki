import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLogs, type auditActionEnum } from "@/db/schema";

type AuditAction = (typeof auditActionEnum.enumValues)[number];

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
  input: { siteId: string; action?: AuditAction; limit?: number; offset?: number },
  database: Database = db
) {
  const where = input.action
    ? and(eq(auditLogs.siteId, input.siteId), eq(auditLogs.action, input.action))
    : eq(auditLogs.siteId, input.siteId);
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
