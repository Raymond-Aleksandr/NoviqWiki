import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { getEnv } from "@/lib/env";

async function main() {
  const env = getEnv();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = process.env.NEXTWIKI_BACKUP_DIR ?? "backups";
  await mkdir(backupDir, { recursive: true });
  const prefix = path.join(backupDir, `noviqwiki-${timestamp}`);
  const dumpPath = `${prefix}.sql`;
  const mediaPath = `${prefix}-media.tar.gz`;

  const dump = spawnSync("pg_dump", [env.DATABASE_URL, "-f", dumpPath], { stdio: "inherit" });
  if (dump.status !== 0) {
    const composeDump = spawnSync(
      "docker",
      ["compose", "exec", "-T", "db", "pg_dump", "-U", "nextwiki", "-d", "nextwiki", "-f", "-"],
      { encoding: "utf8" }
    );
    if (composeDump.status !== 0) {
      throw new Error("pg_dump failed. Install PostgreSQL client tools or run Docker Compose.");
    }
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(dumpPath, composeDump.stdout)
    );
  }

  if (env.NEXTWIKI_MEDIA_DRIVER === "local") {
    await mkdir(env.NEXTWIKI_MEDIA_ROOT, { recursive: true });
    const tar = spawnSync("tar", ["-czf", mediaPath, "-C", env.NEXTWIKI_MEDIA_ROOT, "."], {
      stdio: "inherit"
    });
    if (tar.status !== 0) {
      throw new Error("Media archive failed.");
    }
  }

  console.log(`Backup created: ${dumpPath}`);
  if (env.NEXTWIKI_MEDIA_DRIVER === "local") {
    console.log(`Media archive created: ${mediaPath}`);
  }
}

void main();
