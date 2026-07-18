import { constants } from "node:fs";
import { access, lstat, mkdir, open, opendir, realpath, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import path from "node:path";

const dumpMarker = "-- PostgreSQL database dump";
const dumpCompleteMarker = "-- PostgreSQL database dump complete";
const sampleBytes = 64 * 1024;
export const composeMediaRoot = "/app/media";

type DatabaseTarget = {
  username: string;
  hostname: string;
  port: string;
  database: string;
};

export function postgresCommandConnection(databaseUrl: string) {
  parseDatabaseTarget(databaseUrl);
  const target = new URL(databaseUrl);
  const password = decodeURIComponent(target.password);
  target.password = "";
  const env = { ...process.env };
  delete env.DATABASE_URL;
  env.PGDATABASE = target.toString();
  if (password) {
    env.PGPASSWORD = password;
  }
  return { env };
}

export function assertComposeDatabaseTarget(
  databaseUrl: string,
  env: Record<string, string | undefined> = process.env
) {
  const target = parseDatabaseTarget(databaseUrl);
  const expectedUser = env.POSTGRES_USER?.trim() || "nextwiki";
  const expectedDatabase = env.POSTGRES_DB?.trim() || "nextwiki";

  if (
    target.hostname !== "db" ||
    target.port !== "5432" ||
    target.username !== expectedUser ||
    target.database !== expectedDatabase
  ) {
    throw new Error(
      "Docker Compose database tooling is only safe when DATABASE_URL targets the configured db service. Install PostgreSQL client tools to operate on any other database."
    );
  }
}

export function isComposeDatabaseTarget(
  databaseUrl: string,
  env: Record<string, string | undefined> = process.env
) {
  try {
    assertComposeDatabaseTarget(databaseUrl, env);
    return true;
  } catch {
    return false;
  }
}

export function expectedRestoreConfirmation(databaseUrl: string, canonicalMediaRoot?: string) {
  const target = parseDatabaseTarget(databaseUrl);
  const hostname = target.hostname.includes(":") ? `[${target.hostname}]` : target.hostname;
  const databaseConfirmation = `restore:${encodeConfirmationComponent(target.username)}@${hostname}:${target.port}/${encodeConfirmationComponent(target.database)}`;

  if (canonicalMediaRoot === undefined) {
    return databaseConfirmation;
  }

  assertCanonicalAbsoluteMediaRoot(canonicalMediaRoot);
  return `${databaseConfirmation}:media=${encodeConfirmationComponent(canonicalMediaRoot)}`;
}

export function assertRestoreConfirmation(
  databaseUrl: string,
  confirmation: string | undefined,
  canonicalMediaRoot?: string
) {
  const expected = expectedRestoreConfirmation(databaseUrl, canonicalMediaRoot);
  if (confirmation !== expected) {
    throw new Error(
      `Set NEXTWIKI_RESTORE_CONFIRM=${expected} to confirm the exact destructive restore target.`
    );
  }
}

export function usesComposeMediaVolume(mediaRoot: string) {
  return path.resolve(mediaRoot) === composeMediaRoot;
}

export function usesComposeMediaTools(
  composeDatabase: boolean,
  mediaDriver: string,
  mediaRoot: string
) {
  return composeDatabase && mediaDriver === "local" && usesComposeMediaVolume(mediaRoot);
}

export async function prepareSafeBackupDirectory(backupDirectory: string) {
  const resolved = path.resolve(backupDirectory);
  assertDedicatedBackupPath(resolved);

  try {
    const existing = await lstat(resolved);
    if (existing.isSymbolicLink() || !existing.isDirectory()) {
      throw new Error("NEXTWIKI_BACKUP_DIR must be a real directory, not a link or file.");
    }
    const canonical = await realpath(resolved);
    assertDedicatedBackupPath(canonical);
    assertOwnedByCurrentUser(existing, "NEXTWIKI_BACKUP_DIR");
    if ((existing.mode & 0o077) !== 0) {
      throw new Error(
        "An existing NEXTWIKI_BACKUP_DIR must already be private (mode 0700 or stricter)."
      );
    }
    return canonical;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(resolved, { recursive: true, mode: 0o700 });
  const created = await lstat(resolved);
  const canonical = await realpath(resolved);
  assertDedicatedBackupPath(canonical);
  if (!created.isDirectory() || created.isSymbolicLink()) {
    throw new Error("NEXTWIKI_BACKUP_DIR could not be created as a private real directory.");
  }
  assertOwnedByCurrentUser(created, "NEXTWIKI_BACKUP_DIR");
  if ((created.mode & 0o077) !== 0) {
    throw new Error("NEXTWIKI_BACKUP_DIR could not be created with private permissions.");
  }
  return canonical;
}

export function assertPathsDoNotOverlap(
  firstPath: string,
  secondPath: string,
  firstLabel = "The first path",
  secondLabel = "the second path"
) {
  const first = path.resolve(firstPath);
  const second = path.resolve(secondPath);
  if (
    first === second ||
    first.startsWith(`${second}${path.sep}`) ||
    second.startsWith(`${first}${path.sep}`)
  ) {
    throw new Error(`${firstLabel} and ${secondLabel} must not overlap.`);
  }
}

export async function assertSafeLocalMediaRoot(mediaRoot: string) {
  const resolved = path.resolve(mediaRoot);
  assertDedicatedMediaPath(resolved);

  try {
    const details = await lstat(resolved);
    if (details.isSymbolicLink() || !details.isDirectory()) {
      throw new Error("The local media root must be a real directory, not a link or file.");
    }
    const canonical = await realpath(resolved);
    assertDedicatedMediaPath(canonical);
    await assertRegularMediaTree(canonical);
    return canonical;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const canonical = await canonicalizePotentialPath(resolved);
  assertDedicatedMediaPath(canonical);
  return canonical;
}

export function assertSafeArchiveEntryPath(entry: string) {
  const value = entry.endsWith("\r") ? entry.slice(0, -1) : entry;
  if (!value || value.includes("\0") || path.posix.isAbsolute(value)) {
    throw new Error("The media archive contains an unsafe path.");
  }
  const withoutDot = value.replace(/^(?:\.\/)+/, "");
  if (withoutDot === "" || withoutDot === ".") {
    return;
  }
  if (withoutDot.split("/").some((segment) => segment === "..")) {
    throw new Error("The media archive contains an unsafe path.");
  }
}

export function assertSafeArchiveEntryType(verboseLine: string) {
  const type = verboseLine[0];
  if (type !== "-" && type !== "d") {
    throw new Error("The media archive may contain only regular files and directories.");
  }
}

export async function assertReadableMediaArchive(mediaArchive: string) {
  await access(mediaArchive, constants.R_OK);
  const details = await stat(mediaArchive);
  if (!details.isFile() || details.size === 0) {
    throw new Error("The media archive must be a readable, non-empty regular file.");
  }
  let paths = 0;
  await inspectTar(mediaArchive, false, (line) => {
    assertSafeArchiveEntryPath(line);
    paths += 1;
  });
  if (paths === 0) {
    throw new Error("The media archive is empty.");
  }
  await inspectTar(mediaArchive, true, assertSafeArchiveEntryType);
}

export async function assertRegularMediaTree(root: string) {
  const directory = await opendir(root);
  for await (const entry of directory) {
    const entryPath = path.join(root, entry.name);
    const details = await lstat(entryPath);
    if (details.isSymbolicLink()) {
      throw new Error("The media tree contains a symbolic link.");
    }
    if (details.isDirectory()) {
      await assertRegularMediaTree(entryPath);
      continue;
    }
    if (!details.isFile() || details.nlink !== 1) {
      throw new Error("The media tree may contain only regular, unlinked files and directories.");
    }
  }
}

export async function assertReadablePgDump(backupSql: string) {
  await access(backupSql, constants.R_OK);
  const details = await stat(backupSql);
  if (!details.isFile() || details.size === 0) {
    throw new Error("The SQL backup must be a readable, non-empty regular file.");
  }

  const handle = await open(backupSql, "r");
  try {
    const headLength = Math.min(details.size, sampleBytes);
    const head = Buffer.alloc(headLength);
    await handle.read(head, 0, headLength, 0);
    const headText = head.toString("utf8");
    if (headText.includes("\0") || !headText.includes(dumpMarker)) {
      throw new Error("The restore file is not a plain SQL backup created by pg_dump.");
    }

    const tailLength = Math.min(details.size, sampleBytes);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, details.size - tailLength);
    if (!tail.toString("utf8").includes(dumpCompleteMarker)) {
      throw new Error("The pg_dump backup is incomplete or truncated.");
    }
  } finally {
    await handle.close();
  }
}

function parseDatabaseTarget(databaseUrl: string): DatabaseTarget {
  const target = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }
  const database = decodeURIComponent(target.pathname.replace(/^\//, ""));
  const username = decodeURIComponent(target.username);
  if (!target.hostname || !database) {
    throw new Error("DATABASE_URL must include a hostname and database name.");
  }
  const targetOverrides = [
    "database",
    "dbname",
    "host",
    "hostaddr",
    "password",
    "port",
    "service",
    "user"
  ];
  if (targetOverrides.some((key) => target.searchParams.has(key))) {
    throw new Error("DATABASE_URL may not override its target through query parameters.");
  }
  return {
    username,
    hostname: target.hostname,
    port: target.port || "5432",
    database
  };
}

function assertDedicatedBackupPath(target: string) {
  const root = path.parse(target).root;
  const protectedPaths = [process.cwd(), homedir()].map((value) => path.resolve(value));
  if (
    target === root ||
    path.dirname(target) === root ||
    protectedPaths.some(
      (protectedPath) =>
        protectedPath === target || protectedPath.startsWith(`${target}${path.sep}`)
    )
  ) {
    throw new Error(
      "NEXTWIKI_BACKUP_DIR must point to a dedicated backup directory, not a filesystem root, home directory, or workspace ancestor."
    );
  }
}

function assertOwnedByCurrentUser(details: { uid: number }, label: string) {
  const currentUid = process.getuid?.();
  if (currentUid !== undefined && details.uid !== currentUid) {
    throw new Error(`${label} must be owned by the current operating-system user.`);
  }
}

function assertDedicatedMediaPath(target: string) {
  const root = path.parse(target).root;
  const protectedPaths = [process.cwd(), homedir()].map((value) => path.resolve(value));
  if (
    target === root ||
    path.dirname(target) === root ||
    protectedPaths.some(
      (protectedPath) =>
        protectedPath === target || protectedPath.startsWith(`${target}${path.sep}`)
    )
  ) {
    throw new Error(
      "NEXTWIKI_MEDIA_ROOT must point to a dedicated media directory, not a filesystem root, home directory, or workspace ancestor."
    );
  }
}

function assertCanonicalAbsoluteMediaRoot(mediaRoot: string) {
  if (!path.isAbsolute(mediaRoot) || path.resolve(mediaRoot) !== mediaRoot) {
    throw new Error(
      "The confirmed local media root must be a canonical, normalized absolute path."
    );
  }
  assertDedicatedMediaPath(mediaRoot);
}

async function canonicalizePotentialPath(target: string) {
  const missingSegments: string[] = [];
  let existingAncestor = target;

  while (true) {
    try {
      const canonicalAncestor = await realpath(existingAncestor);
      return path.join(canonicalAncestor, ...missingSegments);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) {
        throw error;
      }
      missingSegments.unshift(path.basename(existingAncestor));
      existingAncestor = parent;
    }
  }
}

function encodeConfirmationComponent(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

async function inspectTar(mediaArchive: string, verbose: boolean, inspect: (line: string) => void) {
  const child = spawn("tar", [verbose ? "-tvzf" : "-tzf", mediaArchive], {
    stdio: ["ignore", "pipe", "inherit"]
  });
  if (!child.stdout) {
    throw new Error("The media archive could not be inspected.");
  }
  let validationError: unknown;
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) {
    try {
      inspect(line);
    } catch (error) {
      validationError = error;
      child.kill();
      break;
    }
  }
  try {
    await waitForProcess(child, "Media archive validation");
  } catch (error) {
    if (!validationError) throw error;
  }
  if (validationError) throw validationError;
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
