import "dotenv/config";
import { spawnSync } from "node:child_process";
import { closeSync, fstatSync, openSync, type Stats } from "node:fs";
import {
  assertSameFileIdentity,
  composeDockerArguments,
  composeTargetLabel,
  createComposeToolEnvironment,
  createDatabaseToolEnvironment,
  expectedRestoreConfirmation,
  parsePostgresTarget,
  prepareSafeMediaDestination,
  requireNoviqWikiSqlBackup,
  requireReadableRegularFile,
  requireSafeMediaArchive,
  withDatabaseToolEnvironment,
  type PostgresTarget
} from "./ops-safety";

async function main() {
  process.umask(0o077);
  const databaseTarget = parsePostgresTarget(
    process.env.DATABASE_URL ?? "postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki"
  );
  const mediaDriver = process.env.NOVIQWIKI_MEDIA_DRIVER ?? "local";
  const mediaRoot = process.env.NOVIQWIKI_MEDIA_ROOT ?? "./media";
  const backupSql = process.env.NOVIQWIKI_RESTORE_SQL;
  const mediaArchive = process.env.NOVIQWIKI_RESTORE_MEDIA;

  if (!backupSql) {
    throw new Error("Set NOVIQWIKI_RESTORE_SQL to the SQL backup file path.");
  }
  if (mediaDriver !== "local" && mediaDriver !== "s3") {
    throw new Error("NOVIQWIKI_MEDIA_DRIVER must be local or s3.");
  }
  const sqlIdentity = await requireNoviqWikiSqlBackup(backupSql);
  let mediaIdentity: Stats | null = null;
  if (mediaArchive) {
    if (mediaDriver !== "local") {
      throw new Error("NOVIQWIKI_RESTORE_MEDIA can be used only with local media storage.");
    }
    mediaIdentity = await requireReadableRegularFile(mediaArchive, "Media archive");
    requireSafeMediaArchive(mediaArchive);
  }

  const mode = resolveDatabaseMode();
  const targetLabel = mode === "local" ? databaseTarget.label : composeTargetLabel;
  const expectedConfirmation = expectedRestoreConfirmation(targetLabel);
  if (process.env.NOVIQWIKI_RESTORE_CONFIRM !== expectedConfirmation) {
    throw new Error(
      `Set NOVIQWIKI_RESTORE_CONFIRM=${expectedConfirmation} to confirm destructive restore of this exact target.`
    );
  }
  const safeMediaRoot = mediaArchive ? await prepareSafeMediaDestination(mediaRoot) : null;

  const input = openSync(backupSql, "r");
  try {
    assertSameFileIdentity(sqlIdentity, fstatSync(input), "SQL backup");
    await restoreDatabase(mode, databaseTarget, input);
  } finally {
    closeSync(input);
  }

  if (mediaArchive && mediaIdentity && safeMediaRoot) {
    const currentMediaIdentity = await requireReadableRegularFile(mediaArchive, "Media archive");
    assertSameFileIdentity(mediaIdentity, currentMediaIdentity, "Media archive");
    requireSafeMediaArchive(mediaArchive);
    const tar = spawnSync("tar", ["-xzf", mediaArchive, "-C", safeMediaRoot], {
      stdio: "inherit"
    });
    if (tar.status !== 0) {
      throw new Error("Media restore failed.");
    }
  }

  console.log("Restore complete.");
}

type DatabaseMode = "local" | "compose";

function resolveDatabaseMode(): DatabaseMode {
  const probe = spawnSync("psql", ["--version"], {
    env: createDatabaseToolEnvironment(),
    stdio: "ignore"
  });
  if (probe.status === 0) {
    return "local";
  }
  if ((probe.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    requireComposeFallbackConfirmation("psql");
    return "compose";
  }
  throw new Error("Unable to verify the local psql executable; refusing to reset a database.");
}

async function restoreDatabase(mode: DatabaseMode, databaseTarget: PostgresTarget, input: number) {
  const resetSql =
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;";
  const restore =
    mode === "local"
      ? await withDatabaseToolEnvironment(databaseTarget, (environment) =>
          spawnSync(
            "psql",
            [
              "-X",
              databaseTarget.url,
              "-v",
              "ON_ERROR_STOP=1",
              "--single-transaction",
              "-c",
              resetSql,
              "-f",
              "-"
            ],
            { env: environment, stdio: [input, "inherit", "inherit"] }
          )
        )
      : spawnSync(
          "docker",
          composeDockerArguments([
            "exec",
            "-T",
            "db",
            "psql",
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "noviqwiki",
            "-d",
            "noviqwiki",
            "--single-transaction",
            "-c",
            resetSql,
            "-f",
            "-"
          ]),
          {
            env: createComposeToolEnvironment(),
            stdio: [input, "inherit", "inherit"]
          }
        );
  if (restore.status !== 0) {
    throw new Error(
      "psql restore failed; the schema reset and import transaction was rolled back."
    );
  }
}

void main();

function requireComposeFallbackConfirmation(tool: string) {
  if (process.env.NOVIQWIKI_COMPOSE_FALLBACK !== "1") {
    throw new Error(
      `${tool} is unavailable. Install PostgreSQL client tools, or set NOVIQWIKI_COMPOSE_FALLBACK=1 only after verifying the fixed ${composeTargetLabel} target.`
    );
  }
}
