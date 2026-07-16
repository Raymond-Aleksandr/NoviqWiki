import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "@/db/client";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset a production database.");
  }
  await sqlClient.unsafe("drop schema if exists public cascade");
  await sqlClient.unsafe("drop schema if exists drizzle cascade");
  await sqlClient.unsafe("create schema public");
  await migrate(db, { migrationsFolder: "drizzle" });
  await sqlClient.end({ timeout: 5 });
  console.log("Reset and migrated e2e database schema.");
}

void main();
