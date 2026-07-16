import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, RootDatabase } from "@/db/client";

export async function createTestDatabase() {
  const client = new PGlite();
  const database = drizzle(client, { schema });
  const migration = await readFile("drizzle/0000_peaceful_shiva.sql", "utf8");
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await client.exec(statement);
  }
  return {
    client,
    db: database as unknown as RootDatabase,
    executor: database as unknown as Database
  };
}
