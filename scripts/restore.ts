import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { getEnv } from "@/lib/env";

async function main() {
  const env = getEnv();
  const backupSql = process.env.NEXTWIKI_RESTORE_SQL;
  const mediaArchive = process.env.NEXTWIKI_RESTORE_MEDIA;

  if (!backupSql) {
    throw new Error("Set NEXTWIKI_RESTORE_SQL to the SQL backup file path.");
  }
  if (process.env.NEXTWIKI_RESTORE_CONFIRM !== "restore") {
    throw new Error("Set NEXTWIKI_RESTORE_CONFIRM=restore to confirm destructive restore.");
  }

  const resetSql =
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;";
  const reset = spawnSync("psql", [env.DATABASE_URL, "-c", resetSql], { stdio: "inherit" });
  const hasLocalPsql = reset.status === 0;
  if (!hasLocalPsql) {
    const composeReset = spawnSync(
      "docker",
      ["compose", "exec", "-T", "db", "psql", "-U", "nextwiki", "-d", "nextwiki", "-c", resetSql],
      { stdio: "inherit" }
    );
    if (composeReset.status !== 0) {
      throw new Error("Database reset failed before restore.");
    }
  }

  if (hasLocalPsql) {
    const restore = spawnSync("psql", [env.DATABASE_URL, "-f", backupSql], { stdio: "inherit" });
    if (restore.status !== 0) {
      throw new Error("psql restore failed.");
    }
  } else {
    const sql = await readFile(backupSql);
    const composeRestore = spawnSync(
      "docker",
      ["compose", "exec", "-T", "db", "psql", "-U", "nextwiki", "-d", "nextwiki"],
      { input: sql, stdio: ["pipe", "inherit", "inherit"] }
    );
    if (composeRestore.status !== 0) {
      throw new Error("psql restore failed.");
    }
  }

  if (mediaArchive && env.NEXTWIKI_MEDIA_DRIVER === "local") {
    await mkdir(env.NEXTWIKI_MEDIA_ROOT, { recursive: true });
    const tar = spawnSync("tar", ["-xzf", mediaArchive, "-C", env.NEXTWIKI_MEDIA_ROOT], {
      stdio: "inherit"
    });
    if (tar.status !== 0) {
      throw new Error("Media restore failed.");
    }
  }

  console.log("Restore complete.");
}

void main();
