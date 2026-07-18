import "dotenv/config";
import { constants, createReadStream } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getEnv } from "@/lib/env";
import {
  assertReadableMediaArchive,
  assertReadablePgDump,
  assertRegularMediaTree,
  assertRestoreConfirmation,
  assertSafeLocalMediaRoot,
  composeMediaRoot,
  isComposeDatabaseTarget,
  postgresCommandConnection,
  usesComposeMediaTools
} from "./database-backup-safety";

const resetSql =
  "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;\n";

type PreparedMediaRestore = {
  promote(): Promise<void>;
  rollback(): Promise<void>;
  commit(): Promise<void>;
  discard(): Promise<void>;
};

async function main() {
  const env = getEnv();
  const backupSql = process.env.NEXTWIKI_RESTORE_SQL;
  const mediaArchive = process.env.NEXTWIKI_RESTORE_MEDIA;

  if (!backupSql) {
    throw new Error("Set NEXTWIKI_RESTORE_SQL to the SQL backup file path.");
  }
  if (mediaArchive && env.NEXTWIKI_MEDIA_DRIVER !== "local") {
    throw new Error(
      "NEXTWIKI_RESTORE_MEDIA can only restore the local media driver; restore S3 objects with your object-storage backup tooling."
    );
  }
  const composeDatabase = isComposeDatabaseTarget(env.DATABASE_URL);
  const composeMedia =
    Boolean(mediaArchive) &&
    usesComposeMediaTools(composeDatabase, env.NEXTWIKI_MEDIA_DRIVER, env.NEXTWIKI_MEDIA_ROOT);
  const confirmedMediaRoot = mediaArchive
    ? composeMedia
      ? composeMediaRoot
      : await assertSafeLocalMediaRoot(env.NEXTWIKI_MEDIA_ROOT)
    : undefined;
  assertRestoreConfirmation(
    env.DATABASE_URL,
    process.env.NEXTWIKI_RESTORE_CONFIRM,
    confirmedMediaRoot
  );

  const stagedSql = await stageRestoreSql(backupSql);
  let restartComposeApp = false;
  let preparedMedia: PreparedMediaRestore | null = null;

  try {
    const requiresExplicitQuiescence = !composeDatabase || (Boolean(mediaArchive) && !composeMedia);
    if (requiresExplicitQuiescence && process.env.NEXTWIKI_RESTORE_QUIESCED !== "true") {
      throw new Error(
        "Stop application writes and set NEXTWIKI_RESTORE_QUIESCED=true before restoring a non-Compose database or local media path."
      );
    }
    if (composeDatabase) {
      restartComposeApp = stopComposeAppIfRunning();
    }

    if (mediaArchive && env.NEXTWIKI_MEDIA_DRIVER === "local") {
      await assertReadableMediaArchive(mediaArchive);
      if (composeMedia) {
        preparedMedia = await prepareComposeMediaRestore(mediaArchive);
      } else {
        preparedMedia = await prepareLocalMediaRestore(mediaArchive, confirmedMediaRoot!);
      }
    }

    try {
      await preparedMedia?.promote();
      try {
        if (composeDatabase) {
          await restoreSqlAtomically(
            "docker",
            [
              "compose",
              "exec",
              "-T",
              "db",
              "sh",
              "-c",
              'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --set=ON_ERROR_STOP=1'
            ],
            stagedSql.path
          );
        } else {
          assertLocalPsqlAvailable();
          const connection = postgresCommandConnection(env.DATABASE_URL);
          await restoreSqlAtomically(
            "psql",
            ["--set=ON_ERROR_STOP=1"],
            stagedSql.path,
            connection.env
          );
        }
      } catch (error) {
        await preparedMedia?.rollback();
        throw error;
      }
      await preparedMedia?.commit();
      console.log("Restore complete.");
    } catch (error) {
      await preparedMedia?.discard().catch(() => undefined);
      throw error;
    }
  } finally {
    try {
      if (restartComposeApp) {
        startComposeApp();
      }
    } finally {
      await rm(stagedSql.directory, { recursive: true, force: true });
    }
  }
}

async function stageRestoreSql(backupSql: string) {
  await assertReadablePgDump(backupSql);
  const directory = await mkdtemp(path.join(tmpdir(), "noviqwiki-restore-sql-"));
  await chmod(directory, 0o700);
  const stagedPath = path.join(directory, "restore.sql");
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const source = await open(backupSql, constants.O_RDONLY | noFollow);
    try {
      const sourceDetails = await source.stat();
      if (!sourceDetails.isFile() || sourceDetails.size === 0) {
        throw new Error("The SQL backup must remain a readable, non-empty regular file.");
      }
      const destination = await open(stagedPath, "wx", 0o600);
      await pipeline(source.createReadStream(), destination.createWriteStream());
    } finally {
      await source.close().catch(() => undefined);
    }
    await assertReadablePgDump(stagedPath);
    return { directory, path: stagedPath };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function restoreSqlAtomically(
  command: string,
  args: string[],
  backupSql: string,
  env?: NodeJS.ProcessEnv
) {
  const child = spawn(command, args, {
    env,
    stdio: ["pipe", "inherit", "inherit"]
  });
  if (!child.stdin) {
    throw new Error("The restore process did not provide an input stream.");
  }
  const processResult = waitForProcess(child, "Database restore");
  void processResult.catch(() => undefined);
  try {
    child.stdin.write("BEGIN;\n");
    child.stdin.write(resetSql);
    await pipeline(createReadStream(backupSql), child.stdin, { end: false });
    await endWritable(child.stdin, "\nCOMMIT;\n");
    await processResult;
  } catch (error) {
    child.stdin.destroy();
    await processResult.catch(() => undefined);
    throw error;
  }
}

function endWritable(stream: NodeJS.WritableStream, finalChunk: string) {
  return new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.end(finalChunk, resolve);
  });
}

async function prepareLocalMediaRestore(
  mediaArchive: string,
  confirmedMediaRoot: string
): Promise<PreparedMediaRestore> {
  const mediaRoot = await assertBoundLocalMediaRoot(confirmedMediaRoot);
  const parent = path.dirname(mediaRoot);
  const base = path.basename(mediaRoot);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(path.join(parent, `.${base}.noviqwiki-restore-new-`));
  await chmod(stage, 0o700);
  const extraction = spawnSync("tar", ["-xzf", mediaArchive, "-C", stage], {
    stdio: "inherit"
  });
  if (extraction.status !== 0) {
    await rm(stage, { recursive: true, force: true });
    throw new Error("Media staging failed.");
  }
  try {
    await assertRegularMediaTree(stage);
    await chmod(stage, 0o700);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }

  let previous: string | null = null;
  let promoted = false;
  return {
    async promote() {
      if (promoted) return;
      await assertBoundLocalMediaRoot(mediaRoot);
      if (await pathExists(mediaRoot)) {
        previous = await mkdtemp(path.join(parent, `.${base}.noviqwiki-restore-old-`));
        await rm(previous, { recursive: true });
        await rename(mediaRoot, previous);
      }
      try {
        await rename(stage, mediaRoot);
        promoted = true;
      } catch (error) {
        if (previous) {
          await rename(previous, mediaRoot).catch(() => undefined);
          previous = null;
        }
        throw error;
      }
    },
    async rollback() {
      if (!promoted) return;
      await rename(mediaRoot, stage);
      if (previous) {
        await rename(previous, mediaRoot);
        previous = null;
      }
      promoted = false;
    },
    async commit() {
      if (previous) {
        await rm(previous, { recursive: true });
        previous = null;
      }
    },
    async discard() {
      if (!promoted) {
        await rm(stage, { recursive: true, force: true });
      }
    }
  };
}

async function assertBoundLocalMediaRoot(confirmedMediaRoot: string) {
  const currentMediaRoot = await assertSafeLocalMediaRoot(confirmedMediaRoot);
  if (currentMediaRoot !== confirmedMediaRoot) {
    throw new Error(
      "NEXTWIKI_MEDIA_ROOT changed after restore confirmation; refusing to replace media."
    );
  }
  return currentMediaRoot;
}

async function prepareComposeMediaRestore(mediaArchive: string): Promise<PreparedMediaRestore> {
  const restoreId = crypto.randomUUID();
  const stage = `${composeMediaRoot}/.noviqwiki-restore-new-${restoreId}`;
  const previous = `${composeMediaRoot}/.noviqwiki-restore-old-${restoreId}`;
  try {
    await streamFileToCommand(
      mediaArchive,
      "docker",
      composeRunArgs(
        'set -eu; umask 077; mkdir "$1"; tar -xzf - -C "$1"; if find "$1" -mindepth 1 ! -type d ! -type f -print -quit | grep -q .; then echo \'Unsafe media entry type.\' >&2; exit 1; fi',
        stage
      ),
      "Docker Compose media staging"
    );
  } catch (error) {
    try {
      runComposeShell('set -eu; rm -rf -- "$1"', stage);
    } catch {
      // Preserve the original staging error; a later restore can remove the uniquely named residue.
    }
    throw error;
  }

  let promoted = false;
  return {
    async promote() {
      if (promoted) return;
      runComposeShell(
        'set -eu; root=$1; stage=$2; previous=$3; rollback() { mkdir -p "$stage"; find "$root" -mindepth 1 -maxdepth 1 ! -path "$stage" ! -path "$previous" -exec mv -t "$stage" -- {} +; if [ -d "$previous" ]; then find "$previous" -mindepth 1 -maxdepth 1 -exec mv -t "$root" -- {} +; rmdir "$previous"; fi; }; trap \'status=$?; if [ "$status" -ne 0 ]; then rollback; fi; exit "$status"\' EXIT; mkdir -m 700 "$previous"; find "$root" -mindepth 1 -maxdepth 1 ! -path "$stage" ! -path "$previous" -exec mv -t "$previous" -- {} +; find "$stage" -mindepth 1 -maxdepth 1 -exec mv -t "$root" -- {} +; rmdir "$stage"; trap - EXIT',
        composeMediaRoot,
        stage,
        previous
      );
      promoted = true;
    },
    async rollback() {
      if (!promoted) return;
      runComposeShell(
        'set -eu; root=$1; stage=$2; previous=$3; mkdir -m 700 "$stage"; find "$root" -mindepth 1 -maxdepth 1 ! -path "$stage" ! -path "$previous" -exec mv -t "$stage" -- {} +; if [ -d "$previous" ]; then find "$previous" -mindepth 1 -maxdepth 1 -exec mv -t "$root" -- {} +; rmdir "$previous"; fi',
        composeMediaRoot,
        stage,
        previous
      );
      promoted = false;
    },
    async commit() {
      runComposeShell('set -eu; rm -rf -- "$1"', previous);
    },
    async discard() {
      if (!promoted) {
        runComposeShell('set -eu; rm -rf -- "$1"', stage);
      }
    }
  };
}

function composeRunArgs(script: string, ...args: string[]) {
  return ["compose", "run", "--rm", "--no-deps", "-T", "app", "sh", "-c", script, "sh", ...args];
}

function runComposeShell(script: string, ...args: string[]) {
  const result = spawnSync("docker", composeRunArgs(script, ...args), { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("Docker Compose media restore operation failed.");
  }
}

async function streamFileToCommand(
  inputPath: string,
  command: string,
  args: string[],
  label: string
) {
  const child = spawn(command, args, { stdio: ["pipe", "inherit", "inherit"] });
  if (!child.stdin) {
    throw new Error(`${label} did not provide an input stream.`);
  }
  await Promise.all([
    pipeline(createReadStream(inputPath), child.stdin),
    waitForProcess(child, label)
  ]);
}

function assertLocalPsqlAvailable() {
  const version = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if ((version.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    throw new Error(
      "psql is required for a non-Compose DATABASE_URL. Install PostgreSQL client tools."
    );
  }
  if (version.status !== 0) {
    throw new Error("The local psql client is unavailable.");
  }
}

async function pathExists(value: string) {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function stopComposeAppIfRunning() {
  const running = spawnSync(
    "docker",
    ["compose", "ps", "--status", "running", "--services", "app"],
    { encoding: "utf8" }
  );
  if (running.status !== 0) {
    throw new Error("Unable to inspect the Docker Compose app before restore.");
  }
  if (!running.stdout.split(/\s+/).includes("app")) {
    return false;
  }
  const stopped = spawnSync("docker", ["compose", "stop", "app"], { stdio: "inherit" });
  if (stopped.status !== 0) {
    throw new Error("Unable to stop the Docker Compose app before restore.");
  }
  return true;
}

function startComposeApp() {
  const started = spawnSync("docker", ["compose", "start", "app"], { stdio: "inherit" });
  if (started.status !== 0) {
    throw new Error("Restore finished, but the Docker Compose app could not be restarted.");
  }
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
