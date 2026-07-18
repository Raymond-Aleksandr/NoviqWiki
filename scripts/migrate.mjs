import "dotenv/config";
import console from "node:console";
import process from "node:process";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured before running migrations.");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });
  const database = drizzle(client);
  let locked = false;
  try {
    await database.execute(sql`select pg_advisory_lock(hashtext('noviqwiki.migrations'))`);
    locked = true;
    await migrate(database, { migrationsFolder: "drizzle" });
    console.log("Database migrations complete.");
  } finally {
    try {
      if (locked) {
        await database.execute(sql`select pg_advisory_unlock(hashtext('noviqwiki.migrations'))`);
      }
    } finally {
      await client.end({ timeout: 5 });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
