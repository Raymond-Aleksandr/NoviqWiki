import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sqlClient, db } from "@/db/client";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`select pg_advisory_lock(hashtext('noviqwiki.migrations'))`);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Database migrations complete.");
  } finally {
    await db.execute(sql`select pg_advisory_unlock(hashtext('noviqwiki.migrations'))`);
    await sqlClient.end({ timeout: 5 });
  }
}

void main();
