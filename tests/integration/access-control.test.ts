import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { groups, roles } from "@/db/schema";
import {
  assignUserToGroup,
  createGroup,
  getGroupSummaries,
  hasPermission,
  updateGroup
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
});
