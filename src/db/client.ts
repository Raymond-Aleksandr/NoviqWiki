import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getDatabaseUrl } from "@/lib/env";

declare global {
  var __noviqwikiSql: postgres.Sql | undefined;
}

export function createSqlClient(connectionString = getDatabaseUrl()) {
  return postgres(connectionString, {
    max: Number(process.env.NOVIQWIKI_DB_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });
}

export function createDb(connectionString?: string) {
  const sqlClient = createSqlClient(connectionString);
  return drizzle(sqlClient, { schema });
}

function getGlobalSql() {
  if (!globalThis.__noviqwikiSql) {
    globalThis.__noviqwikiSql = createSqlClient();
  }
  return globalThis.__noviqwikiSql;
}

export const sqlClient = getGlobalSql();
export const db = drizzle(sqlClient, { schema });
export type RootDatabase = typeof db;
export type Database = Pick<RootDatabase, "select" | "insert" | "update" | "delete" | "execute">;
