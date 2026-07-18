import { describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { RootDatabase } from "@/db/client";
import { auditLogs, groups, pages, roles, sessions, siteSettings, users } from "@/db/schema";
import { createSession } from "@/modules/auth/session";
import {
  assignRoleToGroup,
  assignUserToGroup,
  createGroup,
  createGroupWithRoles,
  createRole,
  getGroupSummaries,
  getUserGroupMemberships,
  hasPermission,
  permissionKeys,
  requirePagePublishPermissions,
  updateGroup,
  updateRole,
  updateUserGroups
} from "@/modules/authorization/permissions";
import { updateSiteSettings } from "@/modules/settings/service";
import { archivePage, createPage } from "@/modules/pages/service";
import { completeSetup } from "@/modules/setup/service";
import { createUser, resetManagedUserSessions, setUserStatus } from "@/modules/users/service";
import { createTestDatabase } from "../helpers/test-db";

describe("site visibility access control", () => {
  it("enforces private wiki mode for anonymous read permissions", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Private Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-private@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    await expect(hasPermission(null, setup.site.id, "site.view", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "page.read", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "revision.read", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "media.read", test.executor)).resolves.toBe(
      true
    );
    await expect(hasPermission(null, setup.site.id, "page.create", test.executor)).resolves.toBe(
      false
    );

    await updateSiteSettings(
      {
        siteId: setup.site.id,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName,
        values: { publicMode: false }
      },
      test.db
    );

    await expect(hasPermission(null, setup.site.id, "site.view", test.executor)).resolves.toBe(
      false
    );
    await expect(hasPermission(null, setup.site.id, "page.read", test.executor)).resolves.toBe(
      false
    );
    await expect(hasPermission(null, setup.site.id, "revision.read", test.executor)).resolves.toBe(
      false
    );
    await expect(hasPermission(null, setup.site.id, "media.read", test.executor)).resolves.toBe(
      false
    );
    await expect(
      hasPermission(setup.owner.id, setup.site.id, "page.read", test.executor)
    ).resolves.toBe(true);
  });

  it("rechecks settings permissions inside the write transaction", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Settings authorization race Wiki",
        tagline: "Original tagline",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "settings-race-owner",
        ownerEmail: "settings-race-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const manager = await createUser(
      {
        username: "settings-manager",
        email: "settings-manager@example.test",
        password: "SettingsManager123"
      },
      test.executor
    );
    const managerRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Settings manager",
        permissionKeys: ["site.view", "site.configure"]
      },
      test.db
    );
    const managerGroup = await createGroup(
      { siteId: setup.site.id, name: "Settings managers" },
      test.executor
    );
    await assignRoleToGroup(managerGroup.id, managerRole.id, test.executor);
    await assignUserToGroup(manager.id, managerGroup.id, test.executor);

    const race = pauseNextTransaction(test.db);
    const mutation = updateSiteSettings(
      {
        siteId: setup.site.id,
        actorId: manager.id,
        actorDisplayName: manager.displayName,
        values: { tagline: "Unauthorized tagline" }
      },
      race.database
    );
    const assertion = expect(mutation).rejects.toThrow("permission");
    await race.entered;
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: manager.id,
        status: "suspended",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    race.release();
    await assertion;

    const [settings] = await test.executor
      .select({ tagline: siteSettings.tagline })
      .from(siteSettings)
      .where(eq(siteSettings.siteId, setup.site.id));
    expect(settings?.tagline).toBe("Original tagline");
  });

  it("rechecks page mutation permissions inside the write transaction", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Page authorization race Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "page-race-owner",
        ownerEmail: "page-race-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const moderator = await createUser(
      {
        username: "page-moderator",
        email: "page-moderator@example.test",
        password: "PageModerator123"
      },
      test.executor
    );
    const deleteRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Page archiver",
        permissionKeys: ["page.delete"]
      },
      test.db
    );
    const moderatorGroup = await createGroup(
      { siteId: setup.site.id, name: "Page archivers" },
      test.executor
    );
    await assignRoleToGroup(moderatorGroup.id, deleteRole.id, test.executor);
    await assignUserToGroup(moderator.id, moderatorGroup.id, test.executor);
    await expect(
      createPage(
        {
          siteId: setup.site.id,
          title: "Unauthorized creation",
          markdown: "# Unauthorized",
          publish: false,
          actorId: moderator.id,
          actorDisplayName: moderator.displayName
        },
        test.db
      )
    ).rejects.toThrow("permission");

    const created = await createPage(
      {
        siteId: setup.site.id,
        title: "Protected from stale authorization",
        markdown: "# Still published",
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const race = pauseNextTransaction(test.db);
    const mutation = archivePage(
      {
        pageId: created.page.id,
        actorId: moderator.id,
        actorDisplayName: moderator.displayName
      },
      race.database
    );
    const assertion = expect(mutation).rejects.toThrow("permission");
    await race.entered;
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: moderator.id,
        status: "suspended",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    race.release();
    await assertion;

    const [page] = await test.executor
      .select({ status: pages.status })
      .from(pages)
      .where(eq(pages.id, created.page.id));
    expect(page?.status).toBe("published");
  });

  it("updates group role assignments while preserving the final Owner invariant", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Groups Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-groups@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const editor = await createUser(
      {
        username: "editor",
        email: "editor-groups@example.test",
        password: "EditorPassword123",
        displayName: "Editor"
      },
      test.executor
    );
    const [editorRole] = await test.executor
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.siteId, setup.site.id), eq(roles.normalizedName, "editor")))
      .limit(1);
    if (!editorRole) {
      throw new Error("Expected setup to create the Editor role.");
    }
    const editorGroup = await createGroup(
      { siteId: setup.site.id, name: "Documentation editors" },
      test.executor
    );
    await assignUserToGroup(editor.id, editorGroup.id, test.executor);

    await expect(
      hasPermission(editor.id, setup.site.id, "page.publish", test.executor)
    ).resolves.toBe(false);
    await updateGroup(
      {
        siteId: setup.site.id,
        groupId: editorGroup.id,
        name: "Documentation editors",
        description: "Can publish documentation pages.",
        roleIds: [editorRole.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    await expect(
      hasPermission(editor.id, setup.site.id, "page.publish", test.executor)
    ).resolves.toBe(true);

    const summaries = await getGroupSummaries(setup.site.id, test.executor);
    expect(summaries.find((group) => group.id === editorGroup.id)?.roleNames).toContain("Editor");

    const [ownerGroup] = await test.executor
      .select()
      .from(groups)
      .where(and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "owners")))
      .limit(1);
    if (!ownerGroup) {
      throw new Error("Expected setup to create the Owners group.");
    }
    await expect(
      updateGroup(
        {
          siteId: setup.site.id,
          groupId: ownerGroup.id,
          name: ownerGroup.name,
          description: ownerGroup.description,
          roleIds: [],
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("The final active Owner cannot be suspended or demoted.");
    await expect(
      hasPermission(setup.owner.id, setup.site.id, "role.manage", test.executor)
    ).resolves.toBe(true);
  });

  it("creates groups with roles atomically and audits empty assignments", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Atomic Groups Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "atomic-groups-owner",
        ownerEmail: "atomic-groups-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const [editorRole] = await test.executor
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.siteId, setup.site.id), eq(roles.normalizedName, "editor")))
      .limit(1);
    if (!editorRole) {
      throw new Error("Expected setup to create the Editor role.");
    }

    const assigned = await createGroupWithRoles(
      {
        siteId: setup.site.id,
        name: "Atomic editors",
        description: "Original description",
        roleIds: [editorRole.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(
      (await getGroupSummaries(setup.site.id, test.executor)).find(
        (group) => group.id === assigned.id
      )?.roleNames
    ).toEqual(["Editor"]);

    await expect(
      createGroupWithRoles(
        {
          siteId: setup.site.id,
          name: "Atomic editors",
          description: "Attempted overwrite",
          roleIds: [],
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("already exists");
    const [preserved] = await test.executor
      .select({ description: groups.description })
      .from(groups)
      .where(eq(groups.id, assigned.id));
    expect(preserved.description).toBe("Original description");

    await expect(
      createGroupWithRoles(
        {
          siteId: setup.site.id,
          name: "Invalid role group",
          roleIds: [crypto.randomUUID()],
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("Role not found");
    const invalidGroups = await test.executor
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "invalid role group"))
      );
    expect(invalidGroups).toHaveLength(0);

    const empty = await createGroupWithRoles(
      {
        siteId: setup.site.id,
        name: "Audited empty group",
        roleIds: [],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const [audit] = await test.executor
      .select({ actorId: auditLogs.actorId, details: auditLogs.details })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.siteId, setup.site.id),
          eq(auditLogs.action, "group.updated"),
          eq(auditLogs.targetId, empty.id)
        )
      );
    expect(audit).toMatchObject({
      actorId: setup.owner.id,
      details: { created: true, name: "Audited empty group", roleIds: [] }
    });
  });

  it("updates custom role permissions without allowing built-in role mutation", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Roles Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-roles@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const reviewer = await createUser(
      {
        username: "reviewer",
        email: "reviewer@example.test",
        password: "ReviewerPassword123",
        displayName: "Reviewer"
      },
      test.executor
    );
    const reviewerGroup = await createGroup(
      { siteId: setup.site.id, name: "Reviewers" },
      test.executor
    );
    const reviewerRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Reviewer",
        description: "Can inspect pages.",
        permissionKeys: ["site.view", "page.read"]
      },
      test.db
    );
    await assignUserToGroup(reviewer.id, reviewerGroup.id, test.executor);
    await assignRoleToGroup(reviewerGroup.id, reviewerRole.id, test.executor);

    await expect(
      hasPermission(reviewer.id, setup.site.id, "page.publish", test.executor)
    ).resolves.toBe(false);
    await updateRole(
      {
        siteId: setup.site.id,
        roleId: reviewerRole.id,
        name: "Reviewer",
        description: "Can inspect and publish pages.",
        permissionKeys: ["site.view", "page.read", "page.publish"],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    await expect(
      hasPermission(reviewer.id, setup.site.id, "page.publish", test.executor)
    ).resolves.toBe(true);

    const [ownerRole] = await test.executor
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.siteId, setup.site.id), eq(roles.normalizedName, "owner")))
      .limit(1);
    if (!ownerRole) {
      throw new Error("Expected setup to create the Owner role.");
    }
    await expect(
      createRole(
        {
          siteId: setup.site.id,
          name: "Owner",
          description: "Attempted overwrite",
          permissionKeys: []
        },
        test.db
      )
    ).rejects.toThrow("Built-in roles cannot be edited.");
    await expect(
      updateRole(
        {
          siteId: setup.site.id,
          roleId: ownerRole.id,
          name: "Owner",
          description: "Attempted overwrite",
          permissionKeys: [],
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("Built-in roles cannot be edited.");
    await expect(
      hasPermission(setup.owner.id, setup.site.id, "backup.create", test.executor)
    ).resolves.toBe(true);
    await expect(
      hasPermission(setup.owner.id, setup.site.id, "role.manage", test.executor)
    ).resolves.toBe(true);
  });

  it("updates user group memberships while preserving the final Owner invariant", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "User Groups Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-user-groups@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const member = await createUser(
      {
        username: "member",
        email: "member-user-groups@example.test",
        password: "MemberPassword123",
        displayName: "Member"
      },
      test.executor
    );
    const [readerGroup] = await test.executor
      .select()
      .from(groups)
      .where(and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "readers")))
      .limit(1);
    const [editorRole] = await test.executor
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.siteId, setup.site.id), eq(roles.normalizedName, "editor")))
      .limit(1);
    if (!readerGroup || !editorRole) {
      throw new Error("Expected setup to create reader group and editor role.");
    }
    const editorGroup = await createGroup(
      { siteId: setup.site.id, name: "Article editors" },
      test.executor
    );
    await updateGroup(
      {
        siteId: setup.site.id,
        groupId: editorGroup.id,
        name: editorGroup.name,
        description: editorGroup.description,
        roleIds: [editorRole.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );

    await updateUserGroups(
      {
        siteId: setup.site.id,
        userId: member.id,
        groupIds: [readerGroup.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    await expect(hasPermission(member.id, setup.site.id, "page.read", test.executor)).resolves.toBe(
      true
    );
    await expect(
      hasPermission(member.id, setup.site.id, "page.publish", test.executor)
    ).resolves.toBe(false);

    const memberships = await updateUserGroups(
      {
        siteId: setup.site.id,
        userId: member.id,
        groupIds: [editorGroup.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    expect(memberships.map((membership) => membership.groupName)).toEqual(["Article editors"]);
    await expect(
      hasPermission(member.id, setup.site.id, "page.publish", test.executor)
    ).resolves.toBe(true);
    await expect(
      getUserGroupMemberships(setup.site.id, [member.id], test.executor)
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: editorGroup.id, groupName: "Article editors" })
      ])
    );

    await expect(
      updateUserGroups(
        {
          siteId: setup.site.id,
          userId: setup.owner.id,
          groupIds: [],
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("The final active Owner cannot be suspended or demoted.");
    await expect(
      hasPermission(setup.owner.id, setup.site.id, "role.manage", test.executor)
    ).resolves.toBe(true);
  });

  it("prevents delegated managers from granting permissions above their own", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Grant Ceiling Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "grant-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const manager = await createUser(
      {
        username: "delegated-manager",
        email: "delegated-manager@example.test",
        password: "DelegatedManager123"
      },
      test.executor
    );
    const managerRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Delegated role manager",
        permissionKeys: ["site.view", "group.manage", "role.manage"]
      },
      test.db
    );
    const managerGroup = await createGroup(
      { siteId: setup.site.id, name: "Delegated role managers" },
      test.executor
    );
    await assignRoleToGroup(managerGroup.id, managerRole.id, test.executor);
    await assignUserToGroup(manager.id, managerGroup.id, test.executor);

    await expect(
      createRole(
        {
          siteId: setup.site.id,
          name: "Escalated role",
          permissionKeys: ["backup.create"],
          actorId: manager.id,
          actorDisplayName: manager.displayName
        },
        test.db
      )
    ).rejects.toThrow("cannot grant permissions");

    const [administratorRole] = await test.executor
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.siteId, setup.site.id), eq(roles.normalizedName, "administrator")))
      .limit(1);
    if (!administratorRole) {
      throw new Error("Expected setup to create the Administrator role.");
    }
    await expect(
      createGroupWithRoles(
        {
          siteId: setup.site.id,
          name: "Escalated group",
          roleIds: [administratorRole.id],
          actorId: manager.id,
          actorDisplayName: manager.displayName
        },
        test.db
      )
    ).rejects.toThrow("cannot grant permissions");
    const escalatedGroups = await test.executor
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "escalated group")));
    expect(escalatedGroups).toHaveLength(0);

    const suspendedRace = pauseNextTransaction(test.db);
    const suspendedMutation = createGroupWithRoles(
      {
        siteId: setup.site.id,
        name: "Suspended manager group",
        roleIds: [],
        actorId: manager.id,
        actorDisplayName: manager.displayName
      },
      suspendedRace.database
    );
    const suspendedAssertion = expect(suspendedMutation).rejects.toThrow("permission");
    await suspendedRace.entered;
    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: manager.id,
        status: "suspended",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    suspendedRace.release();
    await expect(
      hasPermission(manager.id, setup.site.id, "group.manage", test.executor)
    ).resolves.toBe(false);
    await suspendedAssertion;

    await setUserStatus(
      {
        siteId: setup.site.id,
        userId: manager.id,
        status: "active",
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const revokedRace = pauseNextTransaction(test.db);
    const revokedMutation = createGroupWithRoles(
      {
        siteId: setup.site.id,
        name: "Revoked manager group",
        roleIds: [],
        actorId: manager.id,
        actorDisplayName: manager.displayName
      },
      revokedRace.database
    );
    const revokedAssertion = expect(revokedMutation).rejects.toThrow("permission");
    await revokedRace.entered;
    await updateUserGroups(
      {
        siteId: setup.site.id,
        userId: manager.id,
        groupIds: [],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    revokedRace.release();
    await revokedAssertion;
    const staleGroups = await test.executor
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.siteId, setup.site.id),
          inArray(groups.normalizedName, ["suspended manager group", "revoked manager group"])
        )
      );
    expect(staleGroups).toHaveLength(0);
  });

  it("requires both edit and publish permission to publish an existing page", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Publish Permissions Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "publish-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const publisher = await createUser(
      {
        username: "publisher-only",
        email: "publisher-only@example.test",
        password: "PublisherOnlyPassword123"
      },
      test.executor
    );
    const publisherRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Publisher only",
        permissionKeys: ["page.publish"]
      },
      test.db
    );
    const publisherGroup = await createGroup(
      { siteId: setup.site.id, name: "Publisher only" },
      test.executor
    );
    await assignRoleToGroup(publisherGroup.id, publisherRole.id, test.executor);
    await assignUserToGroup(publisher.id, publisherGroup.id, test.executor);

    await expect(
      requirePagePublishPermissions(publisher.id, setup.site.id, test.executor)
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
    await expect(
      requirePagePublishPermissions(setup.owner.id, setup.site.id, test.executor)
    ).resolves.toBeUndefined();
  });

  it("reserves Owner membership changes for active Owners", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Owner Grants Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-grants@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const administrator = await createUser(
      {
        username: "administrator",
        email: "administrator@example.test",
        password: "AdministratorPassword123"
      },
      test.executor
    );
    const administratorRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Full delegated administrator",
        permissionKeys: [...permissionKeys]
      },
      test.db
    );
    const administratorGroup = await createGroup(
      { siteId: setup.site.id, name: "Full delegated administrators" },
      test.executor
    );
    await assignRoleToGroup(administratorGroup.id, administratorRole.id, test.executor);
    await assignUserToGroup(administrator.id, administratorGroup.id, test.executor);
    const [ownerGroup] = await test.executor
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "owners")));
    if (!ownerGroup) {
      throw new Error("Expected setup to create the Owners group.");
    }

    await expect(
      updateUserGroups(
        {
          siteId: setup.site.id,
          userId: administrator.id,
          groupIds: [ownerGroup.id],
          actorId: administrator.id,
          actorDisplayName: administrator.displayName
        },
        test.db
      )
    ).rejects.toThrow("Only an active Owner");
    await expect(
      updateUserGroups(
        {
          siteId: setup.site.id,
          userId: setup.owner.id,
          groupIds: [],
          actorId: administrator.id,
          actorDisplayName: administrator.displayName
        },
        test.db
      )
    ).rejects.toThrow("Only an active Owner");
  });

  it("reserves Owner status changes and managed session resets for active Owners", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Owner Account Management Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner-account-manager",
        ownerEmail: "owner-account-manager@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const administrator = await createUser(
      {
        username: "account-administrator",
        email: "account-administrator@example.test",
        password: "AdministratorPassword123"
      },
      test.executor
    );
    const administratorRole = await createRole(
      {
        siteId: setup.site.id,
        name: "Account administrator",
        permissionKeys: [...permissionKeys]
      },
      test.db
    );
    const administratorGroup = await createGroup(
      { siteId: setup.site.id, name: "Account administrators" },
      test.executor
    );
    await assignRoleToGroup(administratorGroup.id, administratorRole.id, test.executor);
    await assignUserToGroup(administrator.id, administratorGroup.id, test.executor);
    const secondOwner = await createUser(
      {
        username: "owner-account-target",
        email: "owner-account-target@example.test",
        password: "SecondOwnerPassword123"
      },
      test.executor
    );
    const [ownerGroup] = await test.executor
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "owners")));
    if (!ownerGroup) {
      throw new Error("Expected setup to create the Owners group.");
    }
    await updateUserGroups(
      {
        siteId: setup.site.id,
        userId: secondOwner.id,
        groupIds: [ownerGroup.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );
    const initialSession = await createSession({ userId: secondOwner.id }, test.executor);

    await expect(
      setUserStatus(
        {
          siteId: setup.site.id,
          userId: secondOwner.id,
          status: "suspended",
          actorId: administrator.id,
          actorDisplayName: administrator.displayName
        },
        test.db
      )
    ).rejects.toThrow("Only an active Owner");
    await expect(
      resetManagedUserSessions(
        {
          siteId: setup.site.id,
          userId: secondOwner.id,
          actorId: administrator.id
        },
        test.db
      )
    ).rejects.toThrow("Only an active Owner");
    const [stillActiveSession] = await test.executor
      .select({ revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(eq(sessions.id, initialSession.session.id));
    expect(stillActiveSession.revokedAt).toBeNull();

    await expect(
      resetManagedUserSessions(
        {
          siteId: setup.site.id,
          userId: secondOwner.id,
          actorId: setup.owner.id
        },
        test.db
      )
    ).resolves.toBeUndefined();
    const [revokedSession] = await test.executor
      .select({ revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(eq(sessions.id, initialSession.session.id));
    expect(revokedSession.revokedAt).toBeTruthy();
    const resetAudits = await test.executor
      .select({ actorId: auditLogs.actorId, details: auditLogs.details })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.siteId, setup.site.id),
          eq(auditLogs.action, "user.updated"),
          eq(auditLogs.targetId, secondOwner.id)
        )
      );
    expect(resetAudits).toContainEqual({
      actorId: setup.owner.id,
      details: { reason: "sessions_reset" }
    });

    await createSession({ userId: secondOwner.id }, test.executor);
    await expect(
      setUserStatus(
        {
          siteId: setup.site.id,
          userId: secondOwner.id,
          status: "suspended",
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).resolves.toMatchObject({ status: "suspended" });
    await expect(
      setUserStatus(
        {
          siteId: setup.site.id,
          userId: setup.owner.id,
          status: "suspended",
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ).rejects.toThrow("The final active Owner");
  });

  it("serializes concurrent Owner suspensions and preserves one active Owner", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Concurrent Owners Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner-one",
        ownerEmail: "owner-one@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const secondOwner = await createUser(
      {
        username: "owner-two",
        email: "owner-two@example.test",
        password: "SecondOwnerPassword123"
      },
      test.executor
    );
    const [ownerGroup] = await test.executor
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.siteId, setup.site.id), eq(groups.normalizedName, "owners")));
    if (!ownerGroup) {
      throw new Error("Expected setup to create the Owners group.");
    }
    await updateUserGroups(
      {
        siteId: setup.site.id,
        userId: secondOwner.id,
        groupIds: [ownerGroup.id],
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );

    const outcomes = await Promise.allSettled([
      setUserStatus(
        {
          siteId: setup.site.id,
          userId: setup.owner.id,
          status: "suspended",
          actorId: secondOwner.id,
          actorDisplayName: secondOwner.displayName
        },
        test.db
      ),
      setUserStatus(
        {
          siteId: setup.site.id,
          userId: secondOwner.id,
          status: "suspended",
          actorId: setup.owner.id,
          actorDisplayName: setup.owner.displayName
        },
        test.db
      )
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    const activeOwners = await test.executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.status, "active"));
    expect(activeOwners).toHaveLength(1);
  });
});

function pauseNextTransaction(database: RootDatabase) {
  let markEntered!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  type TransactionCallback = Parameters<RootDatabase["transaction"]>[0];
  const paused = new Proxy(database, {
    get(target, property) {
      if (property === "transaction") {
        return async (callback: TransactionCallback) => {
          markEntered();
          await gate;
          return database.transaction(callback);
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as RootDatabase;
  return { database: paused, entered, release };
}
