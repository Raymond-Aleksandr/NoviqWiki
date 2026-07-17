import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";

const defaultE2eDatabaseUrl = "postgres://nextwiki:nextwiki@localhost:5432/nextwiki_e2e";
const safeDatabaseNamePattern = /(^|[_-])(test|e2e|ci)([_-]|$)/i;

type E2eEnvironment = Record<string, string | undefined>;

export type E2eDatabaseResetResult = {
  databaseUrl: string;
  databaseLabel: string;
  createdDatabase: boolean;
};

export function resolveE2eDatabaseUrl(env: E2eEnvironment = process.env) {
  const explicit = env.NEXTWIKI_E2E_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const ambient = env.DATABASE_URL?.trim();
  if (ambient && isResetSafeDatabaseUrl(ambient)) {
    return ambient;
  }

  return defaultE2eDatabaseUrl;
}

export function isResetSafeDatabaseUrl(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  return safeDatabaseNamePattern.test(parsed.databaseName);
}

export function databaseLabel(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  return `${parsed.host}/${parsed.databaseName}`;
}

export async function resetE2eDatabase(
  env: E2eEnvironment = process.env
): Promise<E2eDatabaseResetResult> {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to reset an e2e database while NODE_ENV=production.");
  }

  const databaseUrl = resolveE2eDatabaseUrl(env);
  assertSafeResetTarget(databaseUrl);
  const createdDatabase = await ensureE2eDatabaseExists(databaseUrl);
  const sqlClient = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });
  const database = drizzle(sqlClient, { schema });

  try {
    await sqlClient.unsafe("drop schema if exists public cascade");
    await sqlClient.unsafe("drop schema if exists drizzle cascade");
    await sqlClient.unsafe("create schema public");
    await migrate(database, { migrationsFolder: "drizzle" });
  } finally {
    await sqlClient.end({ timeout: 5 });
  }

  return {
    databaseUrl,
    databaseLabel: databaseLabel(databaseUrl),
    createdDatabase
  };
}

function assertSafeResetTarget(databaseUrl: string) {
  if (!isResetSafeDatabaseUrl(databaseUrl)) {
    throw new Error(
      `Refusing to reset database "${databaseLabel(databaseUrl)}". ` +
        "Use NEXTWIKI_E2E_DATABASE_URL with a database name containing test, e2e, or ci."
    );
  }
}

async function ensureE2eDatabaseExists(databaseUrl: string) {
  if (await canConnect(databaseUrl)) {
    return false;
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  const attempts = ["postgres", "template1"];
  let lastError: unknown;

  for (const databaseName of attempts) {
    const maintenanceUrl = withDatabase(databaseUrl, databaseName);
    const maintenanceClient = postgres(maintenanceUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false
    });
    try {
      await maintenanceClient.unsafe(`create database ${quoteIdentifier(parsed.databaseName)}`);
      return true;
    } catch (error) {
      lastError = error;
    } finally {
      await maintenanceClient.end({ timeout: 5 }).catch(() => undefined);
    }
  }

  throw new Error(
    `Could not create e2e database "${databaseLabel(databaseUrl)}". ` +
      "Create it manually or set NEXTWIKI_E2E_DATABASE_URL to an existing disposable database.",
    { cause: lastError }
  );
}

async function canConnect(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 2,
    prepare: false
  });
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

function withDatabase(databaseUrl: string, databaseName: string) {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function parseDatabaseUrl(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("E2E database URL must use postgres:// or postgresql://.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName) {
    throw new Error("E2E database URL must include a database name.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error("E2E database name may only contain letters, numbers, underscores, or dashes.");
  }
  return {
    databaseName,
    host: parsed.host
  };
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
