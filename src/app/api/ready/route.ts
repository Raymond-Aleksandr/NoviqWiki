import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ok, apiError } from "@/modules/api/responses";
import { getStorageAdapter } from "@/modules/media/storage";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const storageReady = await getStorageAdapter().isReady();
    return ok({ database: true, storage: storageReady });
  } catch (error) {
    return apiError(error);
  }
}
