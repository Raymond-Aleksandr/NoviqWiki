import { spawnSync } from "node:child_process";
import {
  access,
  link,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSameFileIdentity,
  composeDockerArguments,
  composeTargetLabel,
  createComposeToolEnvironment,
  createDatabaseToolEnvironment,
  expectedRestoreConfirmation,
  isUnsafeMediaArchiveMember,
  parsePostgresTarget,
  prepareSafeMediaDestination,
  requireNoviqWikiSqlBackup,
  requireSafeMediaArchive,
  requireSafeMediaSource,
  repositoryRoot,
  withDatabaseToolEnvironment
} from "../../scripts/ops-safety";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("operations safety", () => {
  it("parses a PostgreSQL target without exposing credentials", () => {
    const target = parsePostgresTarget(
      "postgresql://private-user:private-password@db.example:5432/wiki"
    );
    expect(target).toMatchObject({
      url: "postgresql://private-user@db.example:5432/wiki",
      label: "db.example:5432/wiki",
      host: "db.example",
      port: "5432",
      database: "wiki",
      username: "private-user",
      password: "private-password"
    });
    expect(target.url).not.toContain("private-password");
    expect(expectedRestoreConfirmation("db.example:5432/wiki")).toBe(
      "restore:db.example:5432/wiki"
    );
    expect(parsePostgresTarget("postgres://db.example/wiki").label).toBe("db.example:5432/wiki");
  });

  it("clears ambient database and Compose routing overrides", () => {
    const databaseEnvironment = createDatabaseToolEnvironment({
      NODE_ENV: "test",
      PATH: "/bin",
      PGHOSTADDR: "192.0.2.10",
      PGPORT: "6432",
      PGDATABASE: "other",
      PGSERVICE: "other-service",
      PGPASSWORD: "credential"
    });
    expect(databaseEnvironment).toEqual({
      NODE_ENV: "test",
      PATH: "/bin",
      PGPASSWORD: "credential"
    });

    const composeEnvironment = createComposeToolEnvironment({
      NODE_ENV: "test",
      PATH: "/bin",
      COMPOSE_FILE: "/tmp/other.yaml",
      COMPOSE_PROJECT_NAME: "other",
      DOCKER_HOST: "tcp://192.0.2.20:2375"
    });
    expect(composeEnvironment).toEqual({ NODE_ENV: "test", PATH: "/bin" });
    expect(composeDockerArguments(["config", "--quiet"])).toEqual([
      "--context",
      "default",
      "compose",
      "--project-directory",
      repositoryRoot,
      "-f",
      path.join(repositoryRoot, "compose.yaml"),
      "-p",
      "noviqwiki",
      "config",
      "--quiet"
    ]);
    expect(expectedRestoreConfirmation(composeTargetLabel)).toBe(
      "restore:compose:default/noviqwiki/db/nextwiki"
    );
  });

  it("moves URL passwords into a temporary 0600 passfile", async () => {
    const target = parsePostgresTarget(
      "postgres://private-user:p%40ss%3Aword@db.example:5432/wiki"
    );
    let credentialFile = "";
    await withDatabaseToolEnvironment(target, async (environment) => {
      credentialFile = environment.PGPASSFILE ?? "";
      expect(credentialFile).not.toBe("");
      expect(environment.PGPASSWORD).toBeUndefined();
      expect((await stat(credentialFile)).mode & 0o777).toBe(0o600);
      expect(await readFile(credentialFile, "utf8")).toBe(
        "db.example:5432:wiki:private-user:p@ss\\:word\n"
      );
    });
    await expect(access(credentialFile)).rejects.toThrow();
  });

  it("rejects ambiguous or non-PostgreSQL database URLs", () => {
    expect(() => parsePostgresTarget("https://db.example/wiki")).toThrow(/postgres:\/\//);
    expect(() => parsePostgresTarget("postgres://db.example/")).toThrow(/one database/);
    expect(() => parsePostgresTarget("postgres://db.example/wiki/extra")).toThrow(/one database/);
    expect(() => parsePostgresTarget("postgres://db.example/wiki%2Fextra")).toThrow(
      /invalid database name/
    );
    expect(() => parsePostgresTarget("postgres://db.example/wiki?dbname=other")).toThrow(
      /override its database target/
    );
    expect(() => parsePostgresTarget("postgres://db-one,db-two/wiki")).toThrow(/include a host/);
  });

  it("accepts a recognizable NoviqWiki plain-text dump and rejects unrelated SQL", async () => {
    const root = await makeTemporaryRoot();
    const valid = path.join(root, "valid.sql");
    const truncated = path.join(root, "truncated.sql");
    const unrelated = path.join(root, "unrelated.sql");
    const structuralSql = [
      "-- PostgreSQL database dump",
      "CREATE TABLE public.sites (",
      "    id uuid NOT NULL",
      ");",
      "CREATE TABLE public.users (",
      "    id uuid NOT NULL",
      ");"
    ];
    await writeFile(valid, [...structuralSql, "-- PostgreSQL database dump complete"].join("\n"));
    await writeFile(truncated, structuralSql.join("\n"));
    await writeFile(unrelated, "drop schema public cascade;\n");

    expect((await requireNoviqWikiSqlBackup(valid)).size).toBeGreaterThan(0);
    await expect(requireNoviqWikiSqlBackup(truncated)).rejects.toThrow(/not a complete recognized/);
    await expect(requireNoviqWikiSqlBackup(unrelated)).rejects.toThrow(/not a complete recognized/);
  });

  it("detects a validated file changing before use", async () => {
    const root = await makeTemporaryRoot();
    const file = path.join(root, "backup.sql");
    await writeFile(file, "before");
    const before = await stat(file);
    await writeFile(file, "after with a different size");
    const after = await stat(file);

    expect(() => assertSameFileIdentity(before, after, "SQL backup")).toThrow(
      /changed after preflight/
    );
  });

  it("requires dedicated media paths and creates only a safe destination", async () => {
    const root = await makeTemporaryRoot();
    const source = path.join(root, "source-media");
    const destination = path.join(root, "restore-media");
    await mkdir(source);

    await expect(requireSafeMediaSource(source)).resolves.toBe(await realpath(source));
    await expect(requireSafeMediaSource(path.join(root, "missing"))).rejects.toThrow(
      /not an existing directory/
    );
    await expect(requireSafeMediaSource(process.cwd())).rejects.toThrow(/unsafe/);
    await expect(requireSafeMediaSource(path.dirname(process.cwd()))).rejects.toThrow(/unsafe/);
    const preparedDestination = await prepareSafeMediaDestination(destination);
    expect(preparedDestination).toBe(await realpath(destination));
  });

  it.skipIf(process.platform === "win32")(
    "rejects media archives containing symbolic links",
    async () => {
      const root = await makeTemporaryRoot();
      const source = path.join(root, "archive-source");
      const archive = path.join(root, "media.tar.gz");
      await mkdir(source);
      await writeFile(path.join(source, "asset.txt"), "asset");
      await symlink("asset.txt", path.join(source, "asset-link"));
      const tar = spawnSync("tar", ["-czf", archive, "-C", source, "."], {
        stdio: "inherit"
      });
      expect(tar.status).toBe(0);

      expect(() => requireSafeMediaArchive(archive)).toThrow(/regular files and directories/);
    }
  );

  it.skipIf(process.platform === "win32")(
    "rejects a symlink alias for the repository root",
    async () => {
      const root = await makeTemporaryRoot();
      const alias = path.join(root, "repository-alias");
      await symlink(repositoryRoot, alias, "dir");

      await expect(requireSafeMediaSource(alias)).rejects.toThrow(/unsafe/);
    }
  );

  it.skipIf(process.platform === "win32")(
    "rejects media archives containing hard links",
    async () => {
      const root = await makeTemporaryRoot();
      const source = path.join(root, "archive-source");
      const archive = path.join(root, "media.tar.gz");
      await mkdir(source);
      await writeFile(path.join(source, "asset.txt"), "asset");
      await link(path.join(source, "asset.txt"), path.join(source, "asset-copy"));
      const tar = spawnSync("tar", ["-czf", archive, "-C", source, "."], {
        stdio: "inherit"
      });
      expect(tar.status).toBe(0);

      expect(() => requireSafeMediaArchive(archive)).toThrow(/regular files and directories/);
    }
  );

  it("rejects unsafe archive member names without filesystem-specific fixtures", () => {
    expect(isUnsafeMediaArchiveMember("C:/escape.txt")).toBe(true);
    expect(isUnsafeMediaArchiveMember("C:escape.txt")).toBe(true);
    expect(isUnsafeMediaArchiveMember("../escape.txt")).toBe(true);
    expect(isUnsafeMediaArchiveMember("folder\\escape.txt")).toBe(true);
    expect(isUnsafeMediaArchiveMember("folder/asset.txt")).toBe(false);
  });
});

async function makeTemporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "noviqwiki-ops-"));
  temporaryRoots.push(root);
  return root;
}
