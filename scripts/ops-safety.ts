import { constants, createReadStream, realpathSync, type Stats } from "node:fs";
import { spawnSync } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const composeProjectName = "noviqwiki";
export const composeTargetLabel = `compose:default/${composeProjectName}/db/nextwiki`;

export type PostgresTarget = {
  url: string;
  label: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password?: string;
};

export function parsePostgresTarget(databaseUrl: string): PostgresTarget {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.hostname.includes(",")
  ) {
    throw new Error("DATABASE_URL must use postgres:// or postgresql:// and include a host.");
  }
  const targetOverrideKeys = [
    "host",
    "hostaddr",
    "port",
    "dbname",
    "service",
    "servicefile",
    "user",
    "password",
    "passfile",
    "sslpassword"
  ];
  if (targetOverrideKeys.some((key) => parsed.searchParams.has(key))) {
    throw new Error("DATABASE_URL must not override its database target through query parameters.");
  }
  if (parsed.hash) {
    throw new Error("DATABASE_URL must not contain a URL fragment.");
  }
  const encodedDatabase = parsed.pathname.replace(/^\//, "");
  if (!encodedDatabase || encodedDatabase.includes("/")) {
    throw new Error("DATABASE_URL must identify exactly one database name.");
  }
  let database: string;
  try {
    database = decodeURIComponent(encodedDatabase);
  } catch {
    throw new Error("DATABASE_URL contains an invalid encoded database name.");
  }
  if (!database || database.includes("/") || /[\r\n]/.test(database)) {
    throw new Error("DATABASE_URL contains an invalid database name.");
  }
  const username = decodeUrlCredential(parsed.username, "username");
  const password = decodeUrlCredential(parsed.password, "password");
  if (password && !username) {
    throw new Error("DATABASE_URL must include a username when it contains a password.");
  }
  const port = parsed.port || "5432";
  parsed.port = port;
  parsed.password = "";
  return {
    url: parsed.toString(),
    label: `${parsed.host}/${database}`,
    host: parsed.hostname.replace(/^\[|\]$/g, ""),
    port,
    database,
    username,
    password: password || undefined
  };
}

export function expectedRestoreConfirmation(targetLabel: string) {
  return `restore:${targetLabel}`;
}

export function composeDockerArguments(command: string[]) {
  return [
    "--context",
    "default",
    "compose",
    "--project-directory",
    repositoryRoot,
    "-f",
    path.join(repositoryRoot, "compose.yaml"),
    "-p",
    composeProjectName,
    ...command
  ];
}

export function createDatabaseToolEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...source,
    NODE_ENV: normalizeNodeEnvironment(source.NODE_ENV ?? process.env.NODE_ENV)
  };
  for (const key of [
    "PGHOST",
    "PGHOSTADDR",
    "PGPORT",
    "PGDATABASE",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR"
  ]) {
    delete environment[key];
  }
  return environment;
}

export function createComposeToolEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...source,
    NODE_ENV: normalizeNodeEnvironment(source.NODE_ENV ?? process.env.NODE_ENV)
  };
  for (const key of [
    "COMPOSE_FILE",
    "COMPOSE_PROJECT_NAME",
    "COMPOSE_PROJECT_DIRECTORY",
    "DOCKER_HOST",
    "DOCKER_CONTEXT"
  ]) {
    delete environment[key];
  }
  return environment;
}

export async function withDatabaseToolEnvironment<T>(
  target: PostgresTarget,
  callback: (environment: NodeJS.ProcessEnv) => T | Promise<T>
) {
  const environment = createDatabaseToolEnvironment();
  const password = target.password ?? environment.PGPASSWORD;
  delete environment.PGPASSWORD;
  if (!password) {
    return callback(environment);
  }

  const credentialDirectory = await mkdtemp(path.join(tmpdir(), "noviqwiki-pgpass-"));
  const credentialFile = path.join(credentialDirectory, "pgpass");
  await chmod(credentialDirectory, 0o700);
  const fields = [target.host, target.port, target.database, target.username || "*", password].map(
    escapePgpassField
  );
  await writeFile(credentialFile, `${fields.join(":")}\n`, { mode: 0o600 });
  environment.PGPASSFILE = credentialFile;
  try {
    return await callback(environment);
  } finally {
    await rm(credentialDirectory, { recursive: true, force: true });
  }
}

export async function requireReadableRegularFile(filePath: string, label: string) {
  const file = await stat(filePath).catch(() => null);
  if (!file?.isFile()) {
    throw new Error(`${label} is not a readable regular file: ${filePath}`);
  }
  await access(filePath, constants.R_OK).catch(() => {
    throw new Error(`${label} is not readable: ${filePath}`);
  });
  return file;
}

export async function requireNoviqWikiSqlBackup(filePath: string) {
  const file = await requireReadableRegularFile(filePath, "SQL backup");
  if (file.size === 0) {
    throw new Error(`SQL backup is empty: ${filePath}`);
  }

  let hasPostgresDumpHeader = false;
  let hasPostgresDumpCompletion = false;
  let hasSitesTable = false;
  let hasUsersTable = false;
  let restrictToken: string | null = null;
  let unrestrictToken: string | null = null;
  const lines = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    hasPostgresDumpHeader ||= line.trim() === "-- PostgreSQL database dump";
    hasPostgresDumpCompletion ||= line.trim() === "-- PostgreSQL database dump complete";
    hasSitesTable ||= line.startsWith("CREATE TABLE public.sites (");
    hasUsersTable ||= line.startsWith("CREATE TABLE public.users (");
    if (line.startsWith("\\restrict ")) {
      restrictToken = line.slice("\\restrict ".length).trim();
    }
    if (line.startsWith("\\unrestrict ")) {
      unrestrictToken = line.slice("\\unrestrict ".length).trim();
    }
  }

  if (
    !hasPostgresDumpHeader ||
    !hasPostgresDumpCompletion ||
    !hasSitesTable ||
    !hasUsersTable ||
    (restrictToken !== null && restrictToken !== unrestrictToken)
  ) {
    throw new Error(
      "SQL backup is not a complete recognized NoviqWiki plain-text pg_dump (expected dump header, sites and users tables, and completion marker)."
    );
  }
  return file;
}

export async function requireSafeMediaSource(configuredPath: string) {
  const resolved = path.resolve(configuredPath);
  assertSafeMediaRoot(resolved);
  const source = await stat(resolved).catch(() => null);
  if (!source?.isDirectory()) {
    throw new Error(`NEXTWIKI_MEDIA_ROOT is not an existing directory: ${resolved}`);
  }
  await access(resolved, constants.R_OK | constants.X_OK).catch(() => {
    throw new Error(`NEXTWIKI_MEDIA_ROOT is not readable: ${resolved}`);
  });
  const canonical = await realpath(resolved);
  assertSafeMediaRoot(canonical);
  return canonical;
}

export async function prepareSafeMediaDestination(configuredPath: string) {
  const resolved = path.resolve(configuredPath);
  assertSafeMediaRoot(resolved);
  await mkdir(resolved, { recursive: true });
  const canonical = await realpath(resolved);
  assertSafeMediaRoot(canonical);
  await access(canonical, constants.W_OK | constants.X_OK).catch(() => {
    throw new Error(`NEXTWIKI_MEDIA_ROOT is not writable: ${canonical}`);
  });
  return canonical;
}

export function requireSafeMediaArchive(filePath: string) {
  const archivePath = path.resolve(filePath);
  const names = spawnSync("tar", ["-tzf", archivePath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (names.status !== 0) {
    throw new Error("Media archive could not be listed safely with tar.");
  }
  const members = names.stdout.split(/\r?\n/).filter(Boolean);
  if (members.length === 0) {
    throw new Error("Media archive is empty.");
  }
  for (const member of members) {
    if (isUnsafeMediaArchiveMember(member)) {
      throw new Error(`Media archive contains an unsafe path: ${member}`);
    }
  }

  const verbose = spawnSync("tar", ["-tvzf", archivePath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (verbose.status !== 0) {
    throw new Error("Media archive metadata could not be inspected safely with tar.");
  }
  if (
    verbose.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .some((line) => {
        const type = line.trimStart().charAt(0);
        return type !== "-" && type !== "d";
      })
  ) {
    throw new Error("Media archive may contain only regular files and directories.");
  }
}

export function isUnsafeMediaArchiveMember(member: string) {
  const normalized = path.posix.normalize(member.replace(/^\.\//, ""));
  const hasControlCharacter = [...member].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  return (
    path.posix.isAbsolute(member) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    member.includes("\\") ||
    /^[A-Za-z]:/.test(normalized) ||
    hasControlCharacter
  );
}

export function assertSameFileIdentity(expected: Stats, actual: Stats, label: string) {
  if (
    expected.dev !== actual.dev ||
    expected.ino !== actual.ino ||
    expected.size !== actual.size ||
    expected.mtimeMs !== actual.mtimeMs ||
    expected.ctimeMs !== actual.ctimeMs
  ) {
    throw new Error(`${label} changed after preflight validation; refusing to continue.`);
  }
}

function assertSafeMediaRoot(resolvedPath: string) {
  const root = path.parse(resolvedPath).root;
  const depth = path.relative(root, resolvedPath).split(path.sep).filter(Boolean).length;
  const canonicalPath = canonicalExistingPath(resolvedPath);
  const unsafeAnchors = [
    canonicalExistingPath(process.cwd()),
    canonicalExistingPath(repositoryRoot)
  ];
  if (
    canonicalPath === root ||
    canonicalPath === canonicalExistingPath(homedir()) ||
    unsafeAnchors.some((anchor) => isSamePathOrAncestor(canonicalPath, anchor)) ||
    depth < 2
  ) {
    throw new Error(
      `Refusing unsafe NEXTWIKI_MEDIA_ROOT: ${resolvedPath}. Use a dedicated media subdirectory.`
    );
  }
}

function decodeUrlCredential(value: string, label: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (/[\r\n]/.test(decoded)) {
      throw new Error();
    }
    return decoded;
  } catch {
    throw new Error(`DATABASE_URL contains an invalid encoded ${label}.`);
  }
}

function escapePgpassField(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

function canonicalExistingPath(value: string) {
  try {
    return realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function isSamePathOrAncestor(candidate: string, target: string) {
  const relative = path.relative(candidate, target);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function normalizeNodeEnvironment(value: string | undefined) {
  return value === "production" || value === "test" ? value : "development";
}
