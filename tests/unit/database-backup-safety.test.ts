import { chmod, mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertComposeDatabaseTarget,
  assertPathsDoNotOverlap,
  assertReadablePgDump,
  assertRestoreConfirmation,
  assertSafeArchiveEntryPath,
  assertSafeArchiveEntryType,
  assertSafeLocalMediaRoot,
  expectedRestoreConfirmation,
  isComposeDatabaseTarget,
  postgresCommandConnection,
  prepareSafeBackupDirectory,
  usesComposeMediaTools,
  usesComposeMediaVolume
} from "../../scripts/database-backup-safety";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("database backup safety", () => {
  it("only permits Compose fallback for the configured db service", () => {
    const env = { POSTGRES_USER: "wiki", POSTGRES_DB: "wiki_prod" };
    expect(() =>
      assertComposeDatabaseTarget("postgres://wiki:secret@db:5432/wiki_prod", env)
    ).not.toThrow();
    expect(() =>
      assertComposeDatabaseTarget("postgres://wiki:secret@database.example/wiki_prod", env)
    ).toThrow("only safe when DATABASE_URL targets the configured db service");
    expect(() =>
      assertComposeDatabaseTarget("postgres://other:secret@db:5432/wiki_prod", env)
    ).toThrow("only safe when DATABASE_URL targets the configured db service");
    expect(isComposeDatabaseTarget("postgres://wiki:secret@db:5432/wiki_prod", env)).toBe(true);
    expect(isComposeDatabaseTarget("postgres://wiki:secret@localhost:5432/wiki_prod", env)).toBe(
      false
    );
    expect(() =>
      assertComposeDatabaseTarget(
        "postgres://wiki:secret@db:5432/wiki_prod?database=other_database",
        env
      )
    ).toThrow("may not override its target");

    expect(usesComposeMediaTools(true, "local", "/app/media")).toBe(true);
    expect(usesComposeMediaTools(false, "local", "/app/media")).toBe(false);
    expect(usesComposeMediaTools(true, "s3", "/app/media")).toBe(false);
    expect(usesComposeMediaTools(true, "local", "/srv/noviqwiki/media")).toBe(false);
  });

  it("binds destructive confirmation to the parsed database and canonical media targets", async () => {
    const databaseUrl = "postgres://wiki:secret@db/wiki_prod";
    const databaseOnly = "restore:wiki@db:5432/wiki_prod";
    expect(expectedRestoreConfirmation(databaseUrl)).toBe(databaseOnly);
    expect(() => assertRestoreConfirmation(databaseUrl, "restore")).toThrow(databaseOnly);
    expect(() => assertRestoreConfirmation(databaseUrl, databaseOnly)).not.toThrow();

    const directory = await mkdtemp(path.join(tmpdir(), "noviqwiki-confirm-media-"));
    temporaryDirectories.push(directory);
    const mediaRoot = path.join(directory, "media target");
    await mkdir(mediaRoot);
    const canonicalMediaRoot = await assertSafeLocalMediaRoot(mediaRoot);
    const expectedWithMedia = `${databaseOnly}:media=${encodeURIComponent(canonicalMediaRoot)}`;
    expect(expectedRestoreConfirmation(databaseUrl, canonicalMediaRoot)).toBe(expectedWithMedia);
    expect(() => assertRestoreConfirmation(databaseUrl, databaseOnly, canonicalMediaRoot)).toThrow(
      expectedWithMedia
    );
    expect(() =>
      assertRestoreConfirmation(databaseUrl, expectedWithMedia, canonicalMediaRoot)
    ).not.toThrow();

    const otherMediaRoot = path.join(directory, "other-media");
    await mkdir(otherMediaRoot);
    const canonicalOtherRoot = await assertSafeLocalMediaRoot(otherMediaRoot);
    expect(() =>
      assertRestoreConfirmation(databaseUrl, expectedWithMedia, canonicalOtherRoot)
    ).toThrow("exact destructive restore target");

    const workspaceChild = path.join(process.cwd(), "src");
    const workspaceChildConfirmation = expectedRestoreConfirmation(databaseUrl, workspaceChild);
    expect(workspaceChildConfirmation).toContain(`media=${encodeURIComponent(workspaceChild)}`);
    expect(() => assertRestoreConfirmation(databaseUrl, databaseOnly, workspaceChild)).toThrow(
      workspaceChildConfirmation
    );
    expect(() => expectedRestoreConfirmation(databaseUrl, "relative/media")).toThrow(
      "canonical, normalized absolute path"
    );
  });

  it("keeps database passwords out of PostgreSQL client arguments", () => {
    const connection = postgresCommandConnection(
      "postgres://wiki:p%40ss%3Aword@database.example:5432/wiki_prod?sslmode=require"
    );
    expect(connection.env.PGDATABASE).toBe(
      "postgres://wiki@database.example:5432/wiki_prod?sslmode=require"
    );
    expect(connection.env.PGDATABASE).not.toContain("p%40ss");
    expect(connection.env.PGPASSWORD).toBe("p@ss:word");
    expect(connection.env.DATABASE_URL).toBeUndefined();
    expect(() =>
      postgresCommandConnection(
        "postgres://wiki:secret@database.example/wiki_prod?host=other.example"
      )
    ).toThrow("may not override its target");
    expect(() =>
      postgresCommandConnection(
        "postgres://wiki:secret@database.example/wiki_prod?password=other-secret"
      )
    ).toThrow("may not override its target");
  });

  it("accepts a complete plain pg_dump and rejects a truncated dump", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "noviqwiki-dump-"));
    temporaryDirectories.push(directory);
    const complete = path.join(directory, "complete.sql");
    const truncated = path.join(directory, "truncated.sql");
    await writeFile(
      complete,
      [
        "-- PostgreSQL database dump",
        "CREATE TABLE example (id integer);",
        "-- PostgreSQL database dump complete",
        ""
      ].join("\n")
    );
    await writeFile(
      truncated,
      ["-- PostgreSQL database dump", "CREATE TABLE partial_restore (id integer);", ""].join("\n")
    );

    await expect(assertReadablePgDump(complete)).resolves.toBeUndefined();
    await expect(assertReadablePgDump(truncated)).rejects.toThrow("incomplete or truncated");
  });

  it("rejects broad or linked local media roots", async () => {
    await expect(assertSafeLocalMediaRoot("/")).rejects.toThrow("dedicated media directory");
    await expect(assertSafeLocalMediaRoot(process.cwd())).rejects.toThrow(
      "dedicated media directory"
    );
    await expect(assertSafeLocalMediaRoot(homedir())).rejects.toThrow("dedicated media directory");

    const directory = await mkdtemp(path.join(tmpdir(), "noviqwiki-media-root-"));
    temporaryDirectories.push(directory);
    const mediaRoot = path.join(directory, "media");
    await mkdir(mediaRoot);
    await writeFile(path.join(directory, "outside.txt"), "outside");
    await symlink(path.join(directory, "outside.txt"), path.join(mediaRoot, "linked.txt"));
    await expect(assertSafeLocalMediaRoot(mediaRoot)).rejects.toThrow("symbolic link");
    await rm(path.join(mediaRoot, "linked.txt"));
    await writeFile(path.join(mediaRoot, "asset.txt"), "asset");
    await expect(assertSafeLocalMediaRoot(mediaRoot)).resolves.toBe(await realpath(mediaRoot));

    const canonicalParent = path.join(directory, "canonical-parent");
    const linkedParent = path.join(directory, "linked-parent");
    await mkdir(path.join(canonicalParent, "media"), { recursive: true });
    await symlink(canonicalParent, linkedParent);
    await expect(assertSafeLocalMediaRoot(path.join(linkedParent, "media"))).resolves.toBe(
      await realpath(path.join(canonicalParent, "media"))
    );
    await expect(assertSafeLocalMediaRoot(path.join(linkedParent, "new-media"))).resolves.toBe(
      path.join(await realpath(canonicalParent), "new-media")
    );
    expect(usesComposeMediaVolume("/app/media")).toBe(true);
  });

  it("accepts only relative regular-file media archive entries", () => {
    expect(() => assertSafeArchiveEntryPath("./site/2026/asset.png")).not.toThrow();
    expect(() => assertSafeArchiveEntryType("-rw------- user/group asset.png")).not.toThrow();
    expect(() => assertSafeArchiveEntryType("drwx------ user/group site/")).not.toThrow();
    expect(() => assertSafeArchiveEntryPath("../../etc/passwd")).toThrow("unsafe path");
    expect(() => assertSafeArchiveEntryPath("/etc/passwd")).toThrow("unsafe path");
    expect(() => assertSafeArchiveEntryType("lrwxrwxrwx user/group asset -> /etc/passwd")).toThrow(
      "regular files and directories"
    );
    expect(() => assertSafeArchiveEntryType("hrw------- user/group hard link")).toThrow(
      "regular files and directories"
    );
  });

  it("creates a private dedicated backup directory without mutating existing directories", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "noviqwiki-backup-root-"));
    temporaryDirectories.push(directory);
    const backupDirectory = path.join(directory, "private-backups");
    const prepared = await prepareSafeBackupDirectory(backupDirectory);
    expect(prepared).toBe(await realpath(backupDirectory));
    expect((await stat(backupDirectory)).mode & 0o777).toBe(0o700);

    const existing = path.join(directory, "existing-backups");
    await mkdir(existing, { mode: 0o755 });
    await chmod(existing, 0o755);
    await expect(prepareSafeBackupDirectory(existing)).rejects.toThrow("must already be private");
    expect((await stat(existing)).mode & 0o777).toBe(0o755);

    const linked = path.join(directory, "linked-backups");
    await symlink(backupDirectory, linked);
    await expect(prepareSafeBackupDirectory(linked)).rejects.toThrow("real directory");
    await expect(prepareSafeBackupDirectory("/")).rejects.toThrow("dedicated backup directory");
    await expect(prepareSafeBackupDirectory(process.cwd())).rejects.toThrow(
      "dedicated backup directory"
    );
  });

  it("rejects overlapping backup and media trees", () => {
    expect(() =>
      assertPathsDoNotOverlap("/srv/noviqwiki/backups", "/srv/noviqwiki/media")
    ).not.toThrow();
    expect(() =>
      assertPathsDoNotOverlap("/srv/noviqwiki/media/backups", "/srv/noviqwiki/media")
    ).toThrow("must not overlap");
    expect(() => assertPathsDoNotOverlap("/srv/noviqwiki", "/srv/noviqwiki/media")).toThrow(
      "must not overlap"
    );
  });
});
