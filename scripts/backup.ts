import "dotenv/config";
import { randomUUID } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, realpath, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  composeDockerArguments,
  composeTargetLabel,
  createComposeToolEnvironment,
  parsePostgresTarget,
  requireNoviqWikiSqlBackup,
  requireSafeMediaArchive,
  requireSafeMediaSource,
  withDatabaseToolEnvironment
} from "./ops-safety";

async function main() {
  process.umask(0o077);
  const databaseTarget = parsePostgresTarget(
    process.env.DATABASE_URL ?? "postgres://nextwiki:nextwiki@localhost:5432/nextwiki"
  );
  const mediaDriver = process.env.NEXTWIKI_MEDIA_DRIVER ?? "local";
  const mediaRoot = process.env.NEXTWIKI_MEDIA_ROOT ?? "./media";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = process.env.NEXTWIKI_BACKUP_DIR ?? "backups";
  if (mediaDriver !== "local" && mediaDriver !== "s3") {
    throw new Error("NEXTWIKI_MEDIA_DRIVER must be local or s3.");
  }
  const safeMediaRoot = mediaDriver === "local" ? await requireSafeMediaSource(mediaRoot) : null;
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const safeBackupDir = await realpath(backupDir);
  if (safeMediaRoot) {
    const relativeBackupDir = path.relative(safeMediaRoot, safeBackupDir);
    if (
      relativeBackupDir === "" ||
      (!relativeBackupDir.startsWith(`..${path.sep}`) &&
        relativeBackupDir !== ".." &&
        !path.isAbsolute(relativeBackupDir))
    ) {
      throw new Error("NEXTWIKI_BACKUP_DIR must not be inside NEXTWIKI_MEDIA_ROOT.");
    }
  }
  const prefix = path.join(safeBackupDir, `noviqwiki-${timestamp}-${randomUUID()}`);
  const dumpPath = `${prefix}.sql`;
  const mediaPath = `${prefix}-media.tar.gz`;

  const dump = await withDatabaseToolEnvironment(databaseTarget, (environment) =>
    spawnSync("pg_dump", [databaseTarget.url, "-f", dumpPath], {
      env: environment,
      stdio: "inherit"
    })
  );
  if (dump.status !== 0) {
    await rm(dumpPath, { force: true });
    if ((dump.error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
      throw new Error(
        "pg_dump failed for DATABASE_URL. The Compose fallback is used only when pg_dump is unavailable."
      );
    }
    requireComposeFallbackConfirmation("pg_dump");

    const composeDump = (() => {
      const output = openSync(dumpPath, "w", 0o600);
      try {
        return spawnSync(
          "docker",
          composeDockerArguments([
            "exec",
            "-T",
            "db",
            "pg_dump",
            "-U",
            "nextwiki",
            "-d",
            "nextwiki",
            "-f",
            "-"
          ]),
          {
            env: createComposeToolEnvironment(),
            stdio: ["ignore", output, "inherit"]
          }
        );
      } finally {
        closeSync(output);
      }
    })();
    if (composeDump.status !== 0) {
      await rm(dumpPath, { force: true });
      throw new Error("pg_dump failed. Install PostgreSQL client tools or run Docker Compose.");
    }
  }

  try {
    await requireNoviqWikiSqlBackup(dumpPath);
  } catch (error) {
    await rm(dumpPath, { force: true });
    throw error;
  }

  if (safeMediaRoot) {
    const tar = spawnSync("tar", ["-czf", mediaPath, "-C", safeMediaRoot, "."], {
      stdio: "inherit"
    });
    if (tar.status !== 0) {
      await rm(mediaPath, { force: true });
      await rm(dumpPath, { force: true });
      throw new Error("Media archive failed.");
    }
    try {
      requireSafeMediaArchive(mediaPath);
    } catch (error) {
      await rm(mediaPath, { force: true });
      await rm(dumpPath, { force: true });
      throw error;
    }
  }

  console.log(`Backup created: ${dumpPath}`);
  if (mediaDriver === "local") {
    console.log(`Media archive created: ${mediaPath}`);
  }
}

void main();

function requireComposeFallbackConfirmation(tool: string) {
  if (process.env.NEXTWIKI_COMPOSE_FALLBACK !== "1") {
    throw new Error(
      `${tool} is unavailable. Install PostgreSQL client tools, or set NEXTWIKI_COMPOSE_FALLBACK=1 only after verifying the fixed ${composeTargetLabel} target.`
    );
  }
}
