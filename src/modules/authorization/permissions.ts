import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type Database, type RootDatabase } from "@/db/client";
import {
  groups,
  groupRoles,
  permissions,
  rolePermissions,
  roles,
  siteSettings,
  userGroups,
  users
} from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { writeAuditLog } from "@/modules/audit/service";

export const permissionKeys = [
  "site.view",
  "site.configure",
  "page.read",
  "page.create",
  "page.edit",
  "page.publish",
  "page.protect",
  "page.rename",
  "page.delete",
  "page.restore",
  "page.rollback",
  "revision.read",
  "media.read",
  "media.upload",
  "media.delete",
  "user.read",
  "user.manage",
  "group.read",
  "group.manage",
  "role.read",
  "role.manage",
  "audit.read",
  "backup.create"
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

const anonymousReadPermissions = new Set<PermissionKey>([
  "site.view",
  "page.read",
  "revision.read",
  "media.read"
]);

export const defaultRolePermissions: Record<string, PermissionKey[]> = {
  reader: ["site.view", "page.read", "revision.read", "media.read"],
  contributor: [
    "site.view",
    "page.read",
    "page.create",
    "page.edit",
    "revision.read",
    "media.read",
    "media.upload"
  ],
  editor: [
    "site.view",
    "page.read",
    "page.create",
    "page.edit",
    "page.publish",
    "revision.read",
    "media.read",
    "media.upload"
  ],
  moderator: [
    "site.view",
    "page.read",
    "page.create",
    "page.edit",
    "page.publish",
    "page.protect",
    "page.rename",
    "page.delete",
    "page.restore",
    "page.rollback",
    "revision.read",
    "media.read",
    "media.upload",
    "media.delete",
    "audit.read"
  ],
  administrator: [
    "site.view",
    "site.configure",
    "page.read",
    "page.create",
    "page.edit",
    "page.publish",
    "page.protect",
    "page.rename",
    "page.delete",
    "page.restore",
    "page.rollback",
    "revision.read",
    "media.read",
    "media.upload",
    "media.delete",
    "user.read",
    "user.manage",
    "group.read",
    "group.manage",
    "role.read",
    "role.manage",
    "audit.read",
    "backup.create"
  ],
  owner: [...permissionKeys]
};

export const builtInRoles = [
  { name: "Reader", normalizedName: "reader", description: "Read public wiki content." },
  {
    name: "Contributor",
    normalizedName: "contributor",
    description: "Create and edit drafts."
  },
  { name: "Editor", normalizedName: "editor", description: "Publish page changes." },
  { name: "Moderator", normalizedName: "moderator", description: "Moderate pages and media." },
  {
    name: "Administrator",
    normalizedName: "administrator",
    description: "Manage site settings and users."
  },
  { name: "Owner", normalizedName: "owner", description: "Full site ownership." }
] as const;

export async function ensureDefaultAuthorization(siteId: string, database: Database = db) {
  await database
    .insert(permissions)
    .values(permissionKeys.map((key) => ({ key, description: key })))
    .onConflictDoNothing();

  const createdRoles = new Map<string, string>();
  for (const role of builtInRoles) {
    const [created] = await database
      .insert(roles)
      .values({ ...role, siteId, builtIn: true })
      .onConflictDoUpdate({
        target: [roles.siteId, roles.normalizedName],
        set: { description: role.description, builtIn: true, updatedAt: new Date() }
      })
      .returning();
    createdRoles.set(role.normalizedName, created.id);
  }

  for (const [roleName, keys] of Object.entries(defaultRolePermissions)) {
    const roleId = createdRoles.get(roleName);
    if (!roleId) {
      continue;
    }
    await database
      .insert(rolePermissions)
      .values(keys.map((permissionKey) => ({ roleId, permissionKey })))
      .onConflictDoNothing();
  }

  const [ownerGroup] = await database
    .insert(groups)
    .values({
      siteId,
      name: "Owners",
      normalizedName: "owners",
      description: "Users with the built-in Owner role.",
      builtIn: true
    })
    .onConflictDoUpdate({
      target: [groups.siteId, groups.normalizedName],
      set: {
        description: "Users with the built-in Owner role.",
        builtIn: true,
        updatedAt: new Date()
      }
    })
    .returning();
  const ownerRoleId = createdRoles.get("owner");
  if (ownerRoleId) {
    await database
      .insert(groupRoles)
      .values({ groupId: ownerGroup.id, roleId: ownerRoleId })
      .onConflictDoNothing();
  }

  const [readerGroup] = await database
    .insert(groups)
    .values({
      siteId,
      name: "Readers",
      normalizedName: "readers",
      description: "Default read-only group.",
      builtIn: true
    })
    .onConflictDoUpdate({
      target: [groups.siteId, groups.normalizedName],
      set: { description: "Default read-only group.", builtIn: true, updatedAt: new Date() }
    })
    .returning();
  const readerRoleId = createdRoles.get("reader");
  if (readerRoleId) {
    await database
      .insert(groupRoles)
      .values({ groupId: readerGroup.id, roleId: readerRoleId })
      .onConflictDoNothing();
  }

  return { ownerGroupId: ownerGroup.id, readerGroupId: readerGroup.id };
}

export async function assignUserToGroup(userId: string, groupId: string, database: Database = db) {
  await database.insert(userGroups).values({ userId, groupId }).onConflictDoNothing();
}

export async function createGroup(
  input: { siteId: string; name: string; description?: string },
  database: Database = db
) {
  const normalizedName = input.name.trim().toLowerCase();
  const [group] = await database
    .insert(groups)
    .values({
      siteId: input.siteId,
      name: input.name.trim(),
      normalizedName,
      description: input.description ?? ""
    })
    .onConflictDoUpdate({
      target: [groups.siteId, groups.normalizedName],
      set: { description: input.description ?? "", updatedAt: new Date() }
    })
    .returning();
  return group;
}

export async function getGroupSummaries(siteId: string, database: Database = db) {
  return database
    .select({
      id: groups.id,
      siteId: groups.siteId,
      name: groups.name,
      normalizedName: groups.normalizedName,
      description: groups.description,
      builtIn: groups.builtIn,
      roleIds: sql<
        string[]
      >`coalesce(array_agg(${roles.id}::text order by ${roles.name}) filter (where ${roles.id} is not null), ARRAY[]::text[])`,
      roleNames: sql<
        string[]
      >`coalesce(array_agg(${roles.name} order by ${roles.name}) filter (where ${roles.id} is not null), ARRAY[]::text[])`,
      roleNormalizedNames: sql<
        string[]
      >`coalesce(array_agg(${roles.normalizedName} order by ${roles.name}) filter (where ${roles.id} is not null), ARRAY[]::text[])`
    })
    .from(groups)
    .leftJoin(groupRoles, eq(groupRoles.groupId, groups.id))
    .leftJoin(roles, eq(roles.id, groupRoles.roleId))
    .where(eq(groups.siteId, siteId))
    .groupBy(groups.id)
    .orderBy(groups.name);
}

export async function updateGroup(
  input: {
    siteId: string;
    groupId: string;
    name: string;
    description?: string;
    roleIds: string[];
    actorId?: string;
    actorDisplayName?: string;
  },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(groups)
      .where(and(eq(groups.id, input.groupId), eq(groups.siteId, input.siteId)))
      .limit(1);
    if (!group) {
      throw new NotFoundError("Group not found.");
    }

    const nextName = input.name.trim();
    if (!nextName) {
      throw new ConflictError("Group name is required.");
    }
    const normalizedName = nextName.toLowerCase();
    if (group.builtIn && normalizedName !== group.normalizedName) {
      throw new ForbiddenError("Built-in groups cannot be renamed.");
    }
    if (normalizedName !== group.normalizedName) {
      const [duplicate] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.siteId, input.siteId), eq(groups.normalizedName, normalizedName)))
        .limit(1);
      if (duplicate && duplicate.id !== group.id) {
        throw new ConflictError("A group with that name already exists.");
      }
    }

    const uniqueRoleIds = Array.from(new Set(input.roleIds.filter(Boolean)));
    const validRoles =
      uniqueRoleIds.length > 0
        ? await tx
            .select({ id: roles.id })
            .from(roles)
            .where(and(eq(roles.siteId, input.siteId), inArray(roles.id, uniqueRoleIds)))
        : [];
    if (validRoles.length !== uniqueRoleIds.length) {
      throw new NotFoundError("Role not found.");
    }

    const [updated] = await tx
      .update(groups)
      .set({
        name: group.builtIn ? group.name : nextName,
        normalizedName: group.builtIn ? group.normalizedName : normalizedName,
        description: input.description?.trim() ?? "",
        updatedAt: new Date()
      })
      .where(eq(groups.id, group.id))
      .returning();

    await tx.delete(groupRoles).where(eq(groupRoles.groupId, group.id));
    if (uniqueRoleIds.length > 0) {
      await tx
        .insert(groupRoles)
        .values(uniqueRoleIds.map((roleId) => ({ groupId: group.id, roleId })))
        .onConflictDoNothing();
    }

    if ((await countActiveOwners(input.siteId, tx)) < 1) {
      throw new ForbiddenError("The final active Owner cannot be suspended or demoted.");
    }

    if (input.actorId) {
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: "group.updated",
          targetType: "group",
          targetId: group.id,
          details: {
            name: updated.name,
            roleIds: uniqueRoleIds
          }
        },
        tx
      );
    }

    return updated;
  });
}

export async function createRole(
  input: {
    siteId: string;
    name: string;
    description?: string;
    permissionKeys?: PermissionKey[];
    actorId?: string;
    actorDisplayName?: string;
  },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const normalizedName = input.name.trim().toLowerCase();
    if (!normalizedName) {
      throw new ConflictError("Role name is required.");
    }
    const [existing] = await tx
      .select({ id: roles.id, builtIn: roles.builtIn })
      .from(roles)
      .where(and(eq(roles.siteId, input.siteId), eq(roles.normalizedName, normalizedName)))
      .limit(1);
    if (existing?.builtIn) {
      throw new ForbiddenError("Built-in roles cannot be edited.");
    }
    if (existing) {
      throw new ConflictError("A role with that name already exists.");
    }

    const [role] = await tx
      .insert(roles)
      .values({
        siteId: input.siteId,
        name: input.name.trim(),
        normalizedName,
        description: input.description ?? ""
      })
      .returning();
    const selectedPermissions = Array.from(new Set(input.permissionKeys ?? []));
    if (selectedPermissions.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(selectedPermissions.map((permissionKey) => ({ roleId: role.id, permissionKey })))
        .onConflictDoNothing();
    }
    if (input.actorId) {
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: "role.updated",
          targetType: "role",
          targetId: role.id,
          details: {
            name: role.name,
            created: true,
            permissionKeys: selectedPermissions
          }
        },
        tx
      );
    }
    return role;
  });
}

export async function updateRole(
  input: {
    siteId: string;
    roleId: string;
    name: string;
    description?: string;
    permissionKeys: PermissionKey[];
    actorId?: string;
    actorDisplayName?: string;
  },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const [role] = await tx
      .select()
      .from(roles)
      .where(and(eq(roles.id, input.roleId), eq(roles.siteId, input.siteId)))
      .limit(1);
    if (!role) {
      throw new NotFoundError("Role not found.");
    }
    if (role.builtIn) {
      throw new ForbiddenError("Built-in roles cannot be edited.");
    }

    const nextName = input.name.trim();
    if (!nextName) {
      throw new ConflictError("Role name is required.");
    }
    const normalizedName = nextName.toLowerCase();
    if (normalizedName !== role.normalizedName) {
      const [duplicate] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.siteId, input.siteId), eq(roles.normalizedName, normalizedName)))
        .limit(1);
      if (duplicate && duplicate.id !== role.id) {
        throw new ConflictError("A role with that name already exists.");
      }
    }

    const selectedPermissions = Array.from(new Set(input.permissionKeys));
    const [updated] = await tx
      .update(roles)
      .set({
        name: nextName,
        normalizedName,
        description: input.description?.trim() ?? "",
        updatedAt: new Date()
      })
      .where(eq(roles.id, role.id))
      .returning();

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    if (selectedPermissions.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(
          selectedPermissions.map((permissionKey) => ({
            roleId: role.id,
            permissionKey
          }))
        )
        .onConflictDoNothing();
    }

    if (input.actorId) {
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: "role.updated",
          targetType: "role",
          targetId: role.id,
          details: {
            name: updated.name,
            permissionKeys: selectedPermissions
          }
        },
        tx
      );
    }

    return updated;
  });
}

export async function assignRoleToGroup(groupId: string, roleId: string, database: Database = db) {
  await database.insert(groupRoles).values({ groupId, roleId }).onConflictDoNothing();
}

export async function getUserGroupMemberships(
  siteId: string,
  userIds: string[],
  database: Database = db
) {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) {
    return [];
  }
  return database
    .select({
      userId: userGroups.userId,
      groupId: groups.id,
      groupName: groups.name,
      groupNormalizedName: groups.normalizedName,
      roleName: roles.name,
      roleNormalizedName: roles.normalizedName
    })
    .from(userGroups)
    .innerJoin(groups, eq(groups.id, userGroups.groupId))
    .leftJoin(groupRoles, eq(groupRoles.groupId, groups.id))
    .leftJoin(roles, eq(roles.id, groupRoles.roleId))
    .where(and(eq(groups.siteId, siteId), inArray(userGroups.userId, uniqueUserIds)))
    .orderBy(groups.name, roles.name);
}

export async function updateUserGroups(
  input: {
    siteId: string;
    userId: string;
    groupIds: string[];
    actorId?: string;
    actorDisplayName?: string;
  },
  database: RootDatabase = db
) {
  return database.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const siteGroups = await tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.siteId, input.siteId));
    const siteGroupIds = new Set(siteGroups.map((group) => group.id));
    const selectedGroupIds = Array.from(new Set(input.groupIds.filter((id) => id.trim() !== "")));
    const invalidGroup = selectedGroupIds.find((groupId) => !siteGroupIds.has(groupId));
    if (invalidGroup) {
      throw new NotFoundError("Group not found.");
    }

    if (siteGroups.length > 0) {
      await tx.delete(userGroups).where(
        and(
          eq(userGroups.userId, input.userId),
          inArray(
            userGroups.groupId,
            siteGroups.map((group) => group.id)
          )
        )
      );
    }

    if (selectedGroupIds.length > 0) {
      await tx
        .insert(userGroups)
        .values(selectedGroupIds.map((groupId) => ({ userId: input.userId, groupId })))
        .onConflictDoNothing();
    }

    if ((await countActiveOwners(input.siteId, tx)) < 1) {
      throw new ForbiddenError("The final active Owner cannot be suspended or demoted.");
    }

    if (input.actorId) {
      await writeAuditLog(
        {
          siteId: input.siteId,
          actorId: input.actorId,
          actorDisplayName: input.actorDisplayName,
          action: "user.updated",
          targetType: "user",
          targetId: user.id,
          details: {
            username: user.username,
            groupIds: selectedGroupIds,
            groupNames: siteGroups
              .filter((group) => selectedGroupIds.includes(group.id))
              .map((group) => group.name)
          }
        },
        tx
      );
    }

    return getUserGroupMemberships(input.siteId, [input.userId], tx);
  });
}

export async function getUserPermissions(userId: string, siteId: string, database: Database = db) {
  const rows = await database
    .select({ key: rolePermissions.permissionKey })
    .from(userGroups)
    .innerJoin(groups, eq(groups.id, userGroups.groupId))
    .innerJoin(groupRoles, eq(groupRoles.groupId, groups.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, groupRoles.roleId))
    .where(and(eq(userGroups.userId, userId), eq(groups.siteId, siteId)));
  return new Set(rows.map((row) => row.key as PermissionKey));
}

export async function hasPermission(
  userId: string | null | undefined,
  siteId: string,
  permission: PermissionKey,
  database: Database = db
) {
  if (!userId) {
    if (!anonymousReadPermissions.has(permission)) {
      return false;
    }
    return isPublicReadEnabled(siteId, database);
  }
  const userPermissions = await getUserPermissions(userId, siteId, database);
  return userPermissions.has(permission);
}

export async function requirePermission(
  userId: string | null | undefined,
  siteId: string,
  permission: PermissionKey,
  database: Database = db
) {
  if (!(await hasPermission(userId, siteId, permission, database))) {
    throw new ForbiddenError();
  }
}

async function isPublicReadEnabled(siteId: string, database: Database) {
  const [settings] = await database
    .select({ publicMode: siteSettings.publicMode })
    .from(siteSettings)
    .where(eq(siteSettings.siteId, siteId))
    .limit(1);
  return settings?.publicMode ?? true;
}

export async function getRoleSummaries(siteId: string, database: Database = db) {
  const rows = await database
    .select({
      id: roles.id,
      name: roles.name,
      normalizedName: roles.normalizedName,
      description: roles.description,
      builtIn: roles.builtIn,
      permissions: sql<
        string[]
      >`coalesce(array_agg(${rolePermissions.permissionKey}) filter (where ${rolePermissions.permissionKey} is not null), ARRAY[]::text[])`
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(roles.siteId, siteId))
    .groupBy(roles.id)
    .orderBy(roles.name);
  return rows;
}

export async function isFinalActiveOwner(userId: string, siteId: string, database: Database = db) {
  const ownerRoleRows = await database
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.siteId, siteId), eq(roles.normalizedName, "owner")))
    .limit(1);
  const ownerRole = ownerRoleRows[0];
  if (!ownerRole) {
    return false;
  }
  const activeOwnerRows = await database
    .select({ userId: userGroups.userId })
    .from(userGroups)
    .innerJoin(groups, eq(groups.id, userGroups.groupId))
    .innerJoin(groupRoles, eq(groupRoles.groupId, groups.id))
    .innerJoin(users, eq(users.id, userGroups.userId))
    .where(
      and(
        eq(groups.siteId, siteId),
        eq(groupRoles.roleId, ownerRole.id),
        eq(users.status, "active"),
        inArray(userGroups.userId, [userId])
      )
    );
  if (activeOwnerRows.length === 0) {
    return false;
  }
  const [{ count }] = await database
    .select({ count: sql<number>`count(distinct ${userGroups.userId})::int` })
    .from(userGroups)
    .innerJoin(groups, eq(groups.id, userGroups.groupId))
    .innerJoin(groupRoles, eq(groupRoles.groupId, groups.id))
    .innerJoin(users, eq(users.id, userGroups.userId))
    .where(
      and(
        eq(groups.siteId, siteId),
        eq(groupRoles.roleId, ownerRole.id),
        eq(users.status, "active")
      )
    );
  return count <= 1;
}

async function countActiveOwners(siteId: string, database: Database) {
  const [{ count }] = await database
    .select({ count: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .innerJoin(userGroups, eq(userGroups.userId, users.id))
    .innerJoin(groups, eq(groups.id, userGroups.groupId))
    .innerJoin(groupRoles, eq(groupRoles.groupId, groups.id))
    .innerJoin(roles, eq(roles.id, groupRoles.roleId))
    .where(
      and(eq(groups.siteId, siteId), eq(roles.normalizedName, "owner"), eq(users.status, "active"))
    );
  return count;
}
