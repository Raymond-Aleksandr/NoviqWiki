import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  lockPageGraphForTransaction,
  lockSearchIndexRebuildForTransaction,
  lockSearchIndexWriterForTransaction
} from "@/db/advisory-locks";
import type { RootDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import {
  auditLogs,
  groups,
  mediaAssets,
  pageRevisions,
  pages,
  searchIndex,
  siteSettings,
  sites,
  userGroups,
  users
} from "@/db/schema";
import { registerUser } from "@/modules/auth/service";
import { sendEmailVerification } from "@/modules/auth/recovery";
import {
  assignRoleToGroup,
  assignUserToGroup,
  createGroup,
  createRole
} from "@/modules/authorization/permissions";
import { deleteMedia } from "@/modules/media/service";
import type { StorageAdapter } from "@/modules/media/storage";
import { archivePage, createPage, publishPage } from "@/modules/pages/service";
import { rebuildSearchIndex } from "@/modules/search/service";
import { completeSetup } from "@/modules/setup/service";
import { updateSiteSettings } from "@/modules/settings/service";
import { createUser, setUserStatus } from "@/modules/users/service";

vi.mock("@/modules/auth/email", () => ({
  requireSystemEmailConfigured: vi.fn()
}));
vi.mock("@/modules/auth/recovery", () => ({
  sendEmailVerification: vi.fn(async () => true)
}));

const postgresUrl = process.env.NEXTWIKI_TEST_POSTGRES_URL?.trim();
const describeWithPostgres = postgresUrl ? describe : describe.skip;

describeWithPostgres("PostgreSQL concurrency", () => {
  let client: ReturnType<typeof postgres>;
  let database: RootDatabase;
  let siteId: string;
  let actor: { actorId: string; actorDisplayName: string };

  beforeAll(async () => {
    client = postgres(postgresUrl!, { max: 10, prepare: false });
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "drizzle" });
    const setup = await completeSetup(
      {
        siteName: "PostgreSQL Concurrency Wiki",
        tagline: "Concurrency tests",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "concurrency-owner",
        ownerEmail: "concurrency-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      database
    );
    siteId = setup.site.id;
    actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("rechecks registration policy after slow credential preparation", async () => {
    await setRegistrationMode("open");
    const username = `registration-closed-${crypto.randomUUID()}`;
    const registrationGate = pauseNextTransactionBeforeStart(database);
    const registration = registerUser(
      {
        username,
        email: `${username}@example.test`,
        password: "ConcurrentRegistration123"
      },
      registrationGate.database
    );
    await registrationGate.entered;

    await setRegistrationMode("closed");
    registrationGate.release();
    await expect(registration).rejects.toMatchObject({
      code: "forbidden",
      message: "Public registration is closed."
    });
    const created = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    expect(created).toHaveLength(0);
  });

  it("holds the registration policy lock through atomic email-verification registration", async () => {
    vi.mocked(sendEmailVerification).mockClear();
    await setRegistrationMode("email_verification");
    const username = `registration-pending-${crypto.randomUUID()}`;
    const registrationGate = pauseNextTransactionBeforeCommit(database);
    const registration = registerUser(
      {
        username,
        email: `${username}@example.test`,
        password: "ConcurrentRegistration123"
      },
      registrationGate.database
    );
    await registrationGate.entered;
    expect(sendEmailVerification).not.toHaveBeenCalled();
    const invisible = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    expect(invisible).toHaveLength(0);

    let updateSettled = false;
    const openRegistration = setRegistrationMode("open").then(() => {
      updateSettled = true;
    });
    await delay(200);
    expect(updateSettled).toBe(false);

    registrationGate.release();
    const user = await registration;
    await openRegistration;
    expect(user.status).toBe("pending");
    expect(sendEmailVerification).toHaveBeenCalledOnce();
    expect(sendEmailVerification).toHaveBeenCalledWith({ userId: user.id }, expect.anything());
    const assignments = await database
      .select({ group: groups.normalizedName })
      .from(userGroups)
      .innerJoin(groups, eq(groups.id, userGroups.groupId))
      .where(eq(userGroups.userId, user.id));
    expect(assignments).toEqual([{ group: "readers" }]);
    const createdLogs = await database
      .select({ details: auditLogs.details })
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, user.id), eq(auditLogs.action, "user.created")));
    expect(createdLogs).toEqual([{ details: { registrationMode: "email_verification" } }]);
    const [settings] = await database
      .select({ registrationMode: siteSettings.registrationMode })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, siteId));
    expect(settings?.registrationMode).toBe("open");
  });

  it("allows unrelated page writers to share an authorization snapshot", async () => {
    const first = await createPublishedPage("Parallel Page A", "# Parallel A");
    const second = await createPublishedPage("Parallel Page B", "# Parallel B");
    const blocker = deferred<void>();
    const ready = deferred<void>();
    const held = database.transaction(async (tx) => {
      await lockSearchIndexWriterForTransaction(siteId, tx);
      await tx.execute(sql`
        select ${sites.id}
        from ${sites}
        where ${sites.id} = ${siteId}
        for share
      `);
      await tx.execute(
        sql`select ${pages.id} from ${pages} where ${pages.id} = ${first.page.id} for update`
      );
      ready.resolve();
      await blocker.promise;
    });
    await ready.promise;

    const operation = archivePage({ pageId: second.page.id, ...actor }, database);
    await expectCompletesWhileHeld(operation, blocker, held);
  });

  it("waits for authorization changes and rejects a newly suspended actor", async () => {
    const moderator = await createUser(
      {
        username: `concurrent-moderator-${crypto.randomUUID()}`,
        email: `concurrent-moderator-${crypto.randomUUID()}@example.test`,
        password: "ConcurrentModerator123"
      },
      database
    );
    const deleteRole = await createRole(
      {
        siteId,
        name: `Concurrent page deleter ${crypto.randomUUID()}`,
        permissionKeys: ["page.delete"]
      },
      database
    );
    const deleteGroup = await createGroup(
      { siteId, name: `Concurrent page deleters ${crypto.randomUUID()}` },
      database
    );
    await assignRoleToGroup(deleteGroup.id, deleteRole.id, database);
    await assignUserToGroup(moderator.id, deleteGroup.id, database);
    const target = await createPublishedPage("Authorization Snapshot", "# Still published");

    const suspensionGate = pauseNextTransactionBeforeCommit(database);
    const suspension = setUserStatus(
      {
        siteId,
        userId: moderator.id,
        status: "suspended",
        actorId: actor.actorId,
        actorDisplayName: actor.actorDisplayName
      },
      suspensionGate.database
    );
    await suspensionGate.entered;

    let settled = false;
    const outcome = archivePage(
      {
        pageId: target.page.id,
        actorId: moderator.id,
        actorDisplayName: moderator.displayName
      },
      database
    ).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );
    void outcome.then(() => {
      settled = true;
    });
    await delay(200);
    expect(settled).toBe(false);

    suspensionGate.release();
    await suspension;
    expect(await outcome).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        message: "You do not have permission to perform this action."
      })
    });
    const [preserved] = await database
      .select({ status: pages.status })
      .from(pages)
      .where(eq(pages.id, target.page.id));
    expect(preserved?.status).toBe("published");
  });

  it("keeps search rebuild locks independent from authorization locks", async () => {
    const authorizationBlocker = deferred<void>();
    const authorizationReady = deferred<void>();
    const authorizationHeld = database.transaction(async (tx) => {
      await tx.execute(sql`
        select ${sites.id}
        from ${sites}
        where ${sites.id} = ${siteId}
        for no key update
      `);
      authorizationReady.resolve();
      await authorizationBlocker.promise;
    });
    await authorizationReady.promise;
    await expectCompletesWhileHeld(
      rebuildSearchIndex(siteId, database),
      authorizationBlocker,
      authorizationHeld
    );

    const rebuildBlocker = deferred<void>();
    const rebuildReady = deferred<void>();
    const rebuildHeld = database.transaction(async (tx) => {
      await lockSearchIndexRebuildForTransaction(siteId, tx);
      rebuildReady.resolve();
      await rebuildBlocker.promise;
    });
    await rebuildReady.promise;
    await expectCompletesWhileHeld(
      createRole(
        {
          siteId,
          name: `Concurrent Role ${crypto.randomUUID()}`,
          description: "Must not wait for a search rebuild."
        },
        database
      ),
      rebuildBlocker,
      rebuildHeld
    );
  });

  it("leaves the search index consistent after a concurrent publish and rebuild", async () => {
    const target = await createPublishedPage("Concurrent Search", "# Search\n\nOld token");
    const blocker = deferred<void>();
    const ready = deferred<void>();
    const held = database.transaction(async (tx) => {
      await lockSearchIndexRebuildForTransaction(siteId, tx);
      ready.resolve();
      await blocker.promise;
    });
    await ready.promise;

    const publish = publishPage(
      {
        pageId: target.page.id,
        markdown: "# Search\n\nNew concurrency token",
        baseRevisionId: target.revision.id,
        editSummary: "Concurrent publish",
        ...actor
      },
      database
    );
    await delay(50);
    const rebuild = rebuildSearchIndex(siteId, database);
    blocker.resolve();
    await held;
    await Promise.all([publish, rebuild]);

    const [current] = await database
      .select({ plainText: pageRevisions.plainText })
      .from(pages)
      .innerJoin(pageRevisions, eq(pages.currentRevisionId, pageRevisions.id))
      .where(eq(pages.id, target.page.id));
    const [indexed] = await database
      .select({ plainText: searchIndex.plainText })
      .from(searchIndex)
      .where(eq(searchIndex.pageId, target.page.id));
    expect(indexed?.plainText).toBe(current?.plainText);
    expect(indexed?.plainText).toContain("New concurrency token");
  });

  it("serializes redirect-loop and cross-table alias races", async () => {
    const redirectA = await createPublishedPage("Concurrent Redirect A", "# Redirect A");
    const redirectB = await createPublishedPage("Concurrent Redirect B", "# Redirect B");
    const redirectResults = await Promise.allSettled([
      publishPage(
        {
          pageId: redirectA.page.id,
          markdown: "#REDIRECT [[Concurrent Redirect B]]",
          baseRevisionId: redirectA.revision.id,
          ...actor
        },
        database
      ),
      publishPage(
        {
          pageId: redirectB.page.id,
          markdown: "#REDIRECT [[Concurrent Redirect A]]",
          baseRevisionId: redirectB.revision.id,
          ...actor
        },
        database
      )
    ]);
    expect(redirectResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const redirectFailure = redirectResults.find((result) => result.status === "rejected");
    expect(redirectFailure).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "Redirect loop detected." })
    });

    const aliasResults = await Promise.allSettled([
      createPage(
        {
          siteId,
          title: "Canonical Alias Race",
          slug: "custom-alias-race",
          markdown: "Draft A",
          publish: false,
          ...actor
        },
        database
      ),
      createPage(
        {
          siteId,
          title: "Alias Race Competitor",
          slug: "canonical-alias-race",
          markdown: "Draft B",
          publish: false,
          ...actor
        },
        database
      )
    ]);
    expect(aliasResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const aliasFailure = aliasResults.find((result) => result.status === "rejected");
    expect(aliasFailure).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        message: "A page with this title or slug already exists."
      })
    });
  });

  it("serializes media deletion behind a concurrent page publication", async () => {
    const target = await createPublishedPage("Concurrent Media", "# Media before reference");
    const storageKey = `${siteId}/concurrent-media.png`;
    const [asset] = await database
      .insert(mediaAssets)
      .values({
        siteId,
        uploaderId: actor.actorId,
        originalFilename: "concurrent-media.png",
        safeFilename: "concurrent-media.png",
        storageKey,
        publicUrl: `/media/${storageKey}`,
        mimeType: "image/png",
        byteSize: 128,
        contentHash: `concurrent-media-${crypto.randomUUID()}`
      })
      .returning();
    const blocker = deferred<void>();
    const ready = deferred<void>();
    const held = database.transaction(async (tx) => {
      await lockPageGraphForTransaction(siteId, tx);
      ready.resolve();
      await blocker.promise;
    });
    await ready.promise;

    const publish = publishPage(
      {
        pageId: target.page.id,
        markdown: `# Media after reference\n\n![asset](/media/${storageKey})`,
        baseRevisionId: target.revision.id,
        editSummary: "Add media during deletion",
        ...actor
      },
      database
    );
    await waitForAdvisoryWaiters(1);
    const deletedKeys: string[] = [];
    const deletion = deleteMedia(
      { assetId: asset.id, force: false, ...actor },
      database,
      storageAdapter(deletedKeys)
    );
    try {
      await waitForAdvisoryWaiters(2);
    } finally {
      blocker.resolve();
      await held;
    }

    const [published, deleted] = await Promise.allSettled([publish, deletion]);
    expect(published.status).toBe("fulfilled");
    expect(deleted).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        message: "Media is still referenced by stored page revisions or drafts."
      })
    });
    expect(deletedKeys).toEqual([]);
    const [activeAsset] = await database
      .select({ deletedAt: mediaAssets.deletedAt })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, asset.id));
    expect(activeAsset?.deletedAt).toBeNull();
  });

  async function createPublishedPage(title: string, markdown: string) {
    const created = await createPage(
      { siteId, title, markdown, publish: true, ...actor },
      database
    );
    if (!("revision" in created) || !created.revision) {
      throw new Error("Expected a published page revision.");
    }
    return { page: created.page, revision: created.revision };
  }

  async function setRegistrationMode(
    registrationMode: "open" | "email_verification" | "invite" | "closed"
  ) {
    await updateSiteSettings(
      {
        siteId,
        actorId: actor.actorId,
        actorDisplayName: actor.actorDisplayName,
        values: { registrationMode }
      },
      database
    );
  }

  async function waitForAdvisoryWaiters(expected: number) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [row] = await client<{ count: number }[]>`
        select count(*)::int as count
        from pg_locks
        where locktype = 'advisory' and not granted
      `;
      if ((row?.count ?? 0) >= expected) {
        return;
      }
      await delay(20);
    }
    throw new Error(`Timed out waiting for ${expected} advisory lock waiter(s).`);
  }
});

function storageAdapter(deletedKeys: string[]): StorageAdapter {
  return {
    async put(key) {
      return { key, publicUrl: `/media/${key}` };
    },
    async delete(key) {
      deletedKeys.push(key);
    },
    async getPublicUrl(key) {
      return `/media/${key}`;
    },
    async read() {
      return new Uint8Array();
    },
    async isReady() {
      return true;
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function pauseNextTransactionBeforeCommit(database: RootDatabase) {
  const entered = deferred<void>();
  const releaseGate = deferred<void>();
  type TransactionCallback = Parameters<RootDatabase["transaction"]>[0];
  const paused = new Proxy(database, {
    get(target, property) {
      if (property === "transaction") {
        return (callback: TransactionCallback) =>
          database.transaction(async (tx) => {
            const result = await callback(tx);
            entered.resolve();
            await releaseGate.promise;
            return result;
          });
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as RootDatabase;
  return {
    database: paused,
    entered: entered.promise,
    release: () => releaseGate.resolve()
  };
}

function pauseNextTransactionBeforeStart(database: RootDatabase) {
  const entered = deferred<void>();
  const releaseGate = deferred<void>();
  type TransactionCallback = Parameters<RootDatabase["transaction"]>[0];
  const paused = new Proxy(database, {
    get(target, property) {
      if (property === "transaction") {
        return async (callback: TransactionCallback) => {
          entered.resolve();
          await releaseGate.promise;
          return database.transaction(callback);
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as RootDatabase;
  return {
    database: paused,
    entered: entered.promise,
    release: () => releaseGate.resolve()
  };
}

async function expectCompletesWhileHeld<T>(
  operation: Promise<T>,
  blocker: ReturnType<typeof deferred<void>>,
  held: Promise<unknown>
) {
  let completed: boolean;
  try {
    completed = await Promise.race([operation.then(() => true), delay(750).then(() => false)]);
  } finally {
    blocker.resolve();
    await held;
  }
  await operation;
  expect(completed).toBe(true);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
