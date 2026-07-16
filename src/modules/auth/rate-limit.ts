import { and, count, eq, gt } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { rateLimitEvents } from "@/db/schema";
import { hmac } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

export async function assertRateLimit(
  input: { scope: string; key: string; limit: number; windowSeconds: number },
  database: Database = db
) {
  const since = new Date(Date.now() - input.windowSeconds * 1000);
  const keyHash = hmac(input.key);
  const [{ value }] = await database
    .select({ value: count() })
    .from(rateLimitEvents)
    .where(
      and(
        eq(rateLimitEvents.scope, input.scope),
        eq(rateLimitEvents.keyHash, keyHash),
        gt(rateLimitEvents.createdAt, since)
      )
    );
  if (value >= input.limit) {
    throw new AppError("Too many attempts. Try again later.", "rate_limited", 429);
  }
  await database.insert(rateLimitEvents).values({ scope: input.scope, keyHash });
}
