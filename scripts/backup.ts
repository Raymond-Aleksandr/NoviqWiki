import "dotenv/config";
import { mkdir, open, unlink } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { startComposeApp, stopComposeAppIfRunning } from "./compose-app-lifecycle";
import {
  assertPathsDoNotOverlap,
  assertReadableMediaArchive,
  assertReadablePgDump,
  assertSafeLocalMediaRoot,
  composeMediaRoot,
  isComposeDatabaseTarget,
  postgresCommandConnection,
  prepareSafeBackupDirectory,
  usesComposeMediaTools
} from "./database-backup-safety";

const privateFileMode = 0o600;

async function main() {
  const env = getEnv();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = await prepareSafeBackupDirectory(process.env.NOVIQWIKI_BACKUP_DIR ?? "backups");
  const prefix = path.join(backupDir, `noviqwiki-${timestamp}-${crypto.randomUUID()}`);
  const dumpPath = `${prefix}.sql`;
  const mediaPath = `${prefix}-media.tar.gz`;
  const composeDatabase = isComposeDatabaseTarget(env.DATABASE_URL);
  const composeMedia = usesComposeMediaTools(
    composeDatabase,
    env.NOVIQWIKI_MEDIA_DRIVER,
    env.NOVIQWIKI_MEDIA_ROOT
  );
  let localMediaRoot: string | null = null;
  if (env.NOVIQWIKI_MEDIA_DRIVER === "local") {
    assertPathsDoNotOverlap(
      backupDir,
      env.NOVIQWIKI_MEDIA_ROOT,
      "NOVIQWIKI_BACKUP_DIR",
      "NOVIQWIKI_MEDIA_ROOT"
    );
  }
  let restartComposeApp = false;
  const failures: unknown[] = [];

  try {
    if (composeMedia) {
      restartComposeApp = stopComposeAppIfRunning("backup");
    } else if (
      env.NOVIQWIKI_MEDIA_DRIVER === "local" &&
      process.env.NOVIQWIKI_BACKUP_QUIESCED !== "true"
    ) {
      throw new Error(
        "Stop application writes and set NOVIQWIKI_BACKUP_QUIESCED=true before backing up local media."
      );
    }

    if (env.NOVIQWIKI_MEDIA_DRIVER === "local" && !composeMedia) {
      localMediaRoot = await assertSafeLocalMediaRoot(env.NOVIQWIKI_MEDIA_ROOT);
      await mkdir(localMediaRoot, { recursive: true, mode: 0o700 });
      localMediaRoot = await assertSafeLocalMediaRoot(localMediaRoot);
      assertPathsDoNotOverlap(
        backupDir,
        localMediaRoot,
        "NOVIQWIKI_BACKUP_DIR",
        "NOVIQWIKI_MEDIA_ROOT"
      );
    }

    if (composeDatabase) {
      await streamComposeDump(dumpPath);
    } else {
      await runLocalPgDump(env.DATABASE_URL, dumpPath);
    }
    await assertReadablePgDump(dumpPath);

    if (env.NOVIQWIKI_MEDIA_DRIVER === "local") {
      if (composeMedia) {
        await streamCommandToPrivateFile(
          "docker",
          [
            "compose",
            "run",
            "--rm",
            "--no-deps",
            "-T",
            "app",
            "tar",
            "-czf",
            "-",
            "--exclude=./.noviqwiki-restore-*",
            "-C",
            composeMediaRoot,
            "."
          ],
          mediaPath,
          "Docker Compose media backup"
        );
      } else {
        await streamCommandToPrivateFile(
          "tar",
          ["-czf", "-", "--exclude=./.noviqwiki-restore-*", "-C", localMediaRoot!, "."],
          mediaPath,
          "Media archive"
        );
      }
      await assertReadableMediaArchive(mediaPath);
    }

    console.log(`Backup created: ${dumpPath}`);
    if (env.NOVIQWIKI_MEDIA_DRIVER === "local") {
      console.log(`Media archive created: ${mediaPath}`);
    }
  } catch (error) {
    failures.push(error);
    await Promise.all([
      unlink(dumpPath).catch(() => undefined),
      unlink(mediaPath).catch(() => undefined)
    ]);
  } finally {
    if (restartComposeApp) {
      try {
        startComposeApp("backup");
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, "Backup and application restart failed.");
  }
}

async function streamComposeDump(dumpPath: string) {
  await streamCommandToPrivateFile(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "sh",
      "-c",
      'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    ],
    dumpPath,
    "Docker Compose pg_dump"
  );
}

async function runLocalPgDump(databaseUrl: string, dumpPath: string) {
  const placeholder = await open(dumpPath, "wx", privateFileMode);
  await placeholder.close();
  const connection = postgresCommandConnection(databaseUrl);
  const dump = spawnSync("pg_dump", ["-f", dumpPath], {
    env: connection.env,
    stdio: "inherit"
  });
  if (dump.error || dump.status !== 0) {
    const unavailable = (dump.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
    throw new Error(
      unavailable
        ? "pg_dump is required for a non-Compose DATABASE_URL. Install PostgreSQL client tools."
        : `pg_dump failed${dump.signal ? ` with signal ${dump.signal}` : ` with exit code ${dump.status ?? "unknown"}`}.`,
      { cause: dump.error }
    );
  }
}

async function streamCommandToPrivateFile(
  command: string,
  args: string[],
  outputPath: string,
  label: string
) {
  const output = await open(outputPath, "wx", privateFileMode);
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"] });
  if (!child.stdout) {
    await output.close();
    throw new Error(`${label} did not provide an output stream.`);
  }
  await Promise.all([
    pipeline(child.stdout, output.createWriteStream()),
    waitForProcess(child, label)
  ]);
}

function waitForProcess(child: ReturnType<typeof spawn>, label: string) {
  return new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.`));
      }
    });
  });
}

void main();
