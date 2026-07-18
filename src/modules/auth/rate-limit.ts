import { lt, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { rateLimitBuckets } from "@/db/schema";
import { hmac } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

export async function assertRateLimit(
  input: { scope: string; key: string; limit: number; windowSeconds: number },
  database: Database = db
) {
  const now = new Date();
  const expiredBefore = new Date(now.getTime() - input.windowSeconds * 1000);
  const encodedExpiredBefore = sql.param(expiredBefore, rateLimitBuckets.windowStartedAt);
  const encodedNow = sql.param(now, rateLimitBuckets.windowStartedAt);
  const keyHash = hmac(input.key);
  if (input.scope.endsWith(".global")) {
    await database
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.updatedAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  }
  const [bucket] = await database
    .insert(rateLimitBuckets)
    .values({
      scope: input.scope,
      keyHash,
      windowStartedAt: now,
      attempts: 1,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.scope, rateLimitBuckets.keyHash],
      set: {
        windowStartedAt: sql`case
          when ${rateLimitBuckets.windowStartedAt} <= ${encodedExpiredBefore}
          then ${encodedNow}
          else ${rateLimitBuckets.windowStartedAt}
        end`,
        attempts: sql`case
          when ${rateLimitBuckets.windowStartedAt} <= ${encodedExpiredBefore}
          then 1
          else least(${rateLimitBuckets.attempts} + 1, ${input.limit + 1})
        end`,
        updatedAt: now
      }
    })
    .returning({ attempts: rateLimitBuckets.attempts });
  if (!bucket || bucket.attempts > input.limit) {
    throw new AppError("Too many attempts. Try again later.", "rate_limited", 429);
  }
}
