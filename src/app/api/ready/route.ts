import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { logger } from "@/lib/logger";
import { ok } from "@/modules/api/responses";
import { getStorageAdapter } from "@/modules/media/storage";

export async function GET() {
  let databaseReady = false;
  try {
    await db.execute(sql`select 1`);
    databaseReady = true;
    const storageReady = await getStorageAdapter().isReady();
    return readinessResponse({ database: true, storage: storageReady });
  } catch (error) {
    logger.error({ err: error }, "Readiness dependency check failed.");
    return readinessResponse({ database: databaseReady, storage: false });
  }
}

function readinessResponse(state: { database: boolean; storage: boolean }) {
  return ok(state, {
    status: state.database && state.storage ? 200 : 503,
    headers: { "cache-control": "no-store" }
  });
}
