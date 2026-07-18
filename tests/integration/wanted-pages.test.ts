import { describe, expect, it } from "vitest";
import {
  archivePage,
  createPage,
  listDeadEndPages,
  listOrphanedPages,
  listPageBacklinks,
  listPageOutboundLinks,
  listWantedPages,
  renamePage,
  softDeletePage
} from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("wanted pages", () => {
  it("lists missing internal link targets from visible published pages", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Wanted Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-wanted@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const actor = {
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };

    await createPage(
      {
        siteId: setup.site.id,
        title: "Existing Target",
        markdown: "# Existing Target",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Published Source",
        markdown: "[[Wanted Topic]] and [[Existing Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Second Source",
        markdown: "[[Wanted Topic]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Draft Source",
        markdown: "[[Draft Wanted]]",
        publish: false,
        ...actor
      },
      test.db
    );
    const archived = await createPage(
      {
        siteId: setup.site.id,
        title: "Archived Source",
        markdown: "[[Archived Wanted]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await archivePage({ pageId: archived.page.id, ...actor }, test.db);
    const deleted = await createPage(
      {
        siteId: setup.site.id,
        title: "Deleted Source",
        markdown: "[[Deleted Wanted]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await softDeletePage({ pageId: deleted.page.id, ...actor }, test.db);

    let wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).toHaveLength(1);
    expect(wanted[0]).toMatchObject({
      targetTitle: "Wanted Topic",
      targetNormalizedTitle: "wanted topic",
      sourceCount: 2
    });

    await createPage(
      {
        siteId: setup.site.id,
        title: "Wanted Topic",
        markdown: "# Wanted Topic",
        publish: true,
        ...actor
      },
      test.db
    );
    wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).toHaveLength(0);

    const aliasTarget = await createPage(
      {
        siteId: setup.site.id,
        title: "Old Alias Target",
        markdown: "# Old Alias Target",
        publish: true,
        ...actor
      },
      test.db
    );
    const aliasSource = await createPage(
      {
        siteId: setup.site.id,
        title: "Alias Source",
        markdown: "[[Old Alias Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    await renamePage(
      {
        pageId: aliasTarget.page.id,
        newTitle: "New Alias Target",
        createAlias: true,
        ...actor
      },
      test.db
    );
    wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).toHaveLength(0);
    const outbound = await listPageOutboundLinks(
      { siteId: setup.site.id, pageId: aliasSource.page.id },
      test.executor
    );
    expect(outbound).toContainEqual(
      expect.objectContaining({
        targetPageId: aliasTarget.page.id,
        targetSlug: "new-alias-target",
        exists: true
      })
    );

    const lateSource = await createPage(
      {
        siteId: setup.site.id,
        title: "Late Binding Source",
        markdown: "[[Late Bound Target]]",
        publish: true,
        ...actor
      },
      test.db
    );
    wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).toContainEqual(
      expect.objectContaining({ targetNormalizedTitle: "late bound target", sourceCount: 1 })
    );

    const lateTarget = await createPage(
      {
        siteId: setup.site.id,
        title: "Late Bound Target",
        markdown: "# Late Bound Target",
        publish: true,
        ...actor
      },
      test.db
    );
    const renamedLateTarget = await renamePage(
      {
        pageId: lateTarget.page.id,
        newTitle: "Renamed Late Target",
        newSlug: "renamed-late-route",
        createAlias: true,
        ...actor
      },
      test.db
    );
    expect(renamedLateTarget.slug).toBe("renamed-late-route");

    wanted = await listWantedPages({ siteId: setup.site.id }, test.executor);
    expect(wanted).not.toContainEqual(
      expect.objectContaining({ targetNormalizedTitle: "late bound target" })
    );
    const lateOutbound = await listPageOutboundLinks(
      { siteId: setup.site.id, pageId: lateSource.page.id },
      test.executor
    );
    expect(lateOutbound).toContainEqual(
      expect.objectContaining({
        targetPageId: lateTarget.page.id,
        targetSlug: "renamed-late-route",
        exists: true
      })
    );
    let lateBacklinks = await listPageBacklinks(
      { siteId: setup.site.id, pageId: lateTarget.page.id },
      test.executor
    );
    expect(lateBacklinks.map((row) => row.pageId)).toContain(lateSource.page.id);
    let orphaned = await listOrphanedPages({ siteId: setup.site.id }, test.executor);
    expect(orphaned.map((row) => row.pageId)).not.toContain(lateTarget.page.id);
    let deadEnds = await listDeadEndPages({ siteId: setup.site.id }, test.executor);
    expect(deadEnds.map((row) => row.pageId)).not.toContain(lateSource.page.id);

    const addressSource = await createPage(
      {
        siteId: setup.site.id,
        title: "Address Resolution Source",
        markdown: "[[renamed-late-route|Actual slug]] and [[Late Bound Target|Alias]]",
        publish: true,
        ...actor
      },
      test.db
    );
    const addressOutbound = await listPageOutboundLinks(
      { siteId: setup.site.id, pageId: addressSource.page.id },
      test.executor
    );
    expect(addressOutbound).toHaveLength(2);
    expect(
      addressOutbound.every(
        (link) => link.targetPageId === lateTarget.page.id && link.exists === true
      )
    ).toBe(true);
    lateBacklinks = await listPageBacklinks(
      { siteId: setup.site.id, pageId: lateTarget.page.id },
      test.executor
    );
    expect(lateBacklinks.map((row) => row.pageId)).toEqual(
      expect.arrayContaining([lateSource.page.id, addressSource.page.id])
    );
    orphaned = await listOrphanedPages({ siteId: setup.site.id }, test.executor);
    expect(orphaned.map((row) => row.pageId)).not.toContain(lateTarget.page.id);
    deadEnds = await listDeadEndPages({ siteId: setup.site.id }, test.executor);
    expect(deadEnds.map((row) => row.pageId)).not.toContain(addressSource.page.id);
  });
});
