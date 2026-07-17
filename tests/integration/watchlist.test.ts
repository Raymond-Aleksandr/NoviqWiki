import { describe, expect, it } from "vitest";
import { pageWatchlist } from "@/db/schema";
import { writeAuditLog } from "@/modules/audit/service";
import { createPage, softDeletePage } from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import {
  countWatchedPages,
  isPageWatched,
  listWatchedPages,
  listWatchlistChanges,
  unwatchPage,
  watchPage
} from "@/modules/watchlist/service";
import { createTestDatabase } from "../helpers/test-db";

describe("watchlist", () => {
  it("tracks watched pages and filters recent changes to those pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Watch Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-watch@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };
    const watched = await createPage(
      {
        siteId: setup.site.id,
        title: "Watched Topic",
        markdown: "# Watched Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    const unwatched = await createPage(
      {
        siteId: setup.site.id,
        title: "Unwatched Topic",
        markdown: "# Unwatched Topic",
        publish: true,
        ...actor
      },
      test.db
    );

    await watchPage(
      { siteId: setup.site.id, userId: setup.owner.id, pageId: watched.page.id },
      test.executor
    );
    await watchPage(
      { siteId: setup.site.id, userId: setup.owner.id, pageId: watched.page.id },
      test.executor
    );

    const watchRows = await test.executor.select().from(pageWatchlist);
    expect(watchRows).toHaveLength(1);
    await expect(
      isPageWatched(
        { siteId: setup.site.id, userId: setup.owner.id, pageId: watched.page.id },
        test.executor
      )
    ).resolves.toBe(true);
    await expect(
      countWatchedPages({ siteId: setup.site.id, userId: setup.owner.id }, test.executor)
    ).resolves.toBe(1);
    await expect(
      listWatchedPages({ siteId: setup.site.id, userId: setup.owner.id }, test.executor)
    ).resolves.toMatchObject([{ title: "Watched Topic", slug: "watched-topic" }]);

    await writeAuditLog(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        action: "page.updated",
        targetType: "page",
        targetId: watched.page.id,
        details: { title: watched.page.title }
      },
      test.executor
    );
    await writeAuditLog(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        action: "page.updated",
        targetType: "page",
        targetId: unwatched.page.id,
        details: { title: unwatched.page.title }
      },
      test.executor
    );

    const changes = await listWatchlistChanges(
      { siteId: setup.site.id, userId: setup.owner.id, actions: ["page.updated"] },
      test.executor
    );
    expect(changes.count).toBe(1);
    expect(changes.rows).toMatchObject([{ targetLabel: "Watched Topic" }]);

    await unwatchPage(
      { siteId: setup.site.id, userId: setup.owner.id, pageId: watched.page.id },
      test.executor
    );
    await expect(
      isPageWatched(
        { siteId: setup.site.id, userId: setup.owner.id, pageId: watched.page.id },
        test.executor
      )
    ).resolves.toBe(false);
    const afterUnwatch = await listWatchlistChanges(
      { siteId: setup.site.id, userId: setup.owner.id, actions: ["page.updated"] },
      test.executor
    );
    expect(afterUnwatch.count).toBe(0);
    expect(afterUnwatch.rows).toHaveLength(0);

    await watchPage(
      { siteId: setup.site.id, userId: setup.owner.id, pageId: unwatched.page.id },
      test.executor
    );
    await softDeletePage(
      {
        pageId: unwatched.page.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.executor
    );
    await expect(
      countWatchedPages({ siteId: setup.site.id, userId: setup.owner.id }, test.executor)
    ).resolves.toBe(0);
    await expect(
      listWatchedPages({ siteId: setup.site.id, userId: setup.owner.id }, test.executor)
    ).resolves.toHaveLength(0);
  });
});
