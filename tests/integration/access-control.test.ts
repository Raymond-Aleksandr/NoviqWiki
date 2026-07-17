import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { groups, roles } from "@/db/schema";
import {
  assignRoleToGroup,
  assignUserToGroup,
  createGroup,
  createRole,
  getGroupSummaries,
  hasPermission,
  updateGroup,
  updateRole
} from "@/modules/authorization/permissions";
import { updateSiteSettings } from "@/modules/settings/service";
import { completeSetup } from "@/modules/setup/service";
import { createUser } from "@/modules/users/service";
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
      test.executor
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
});
