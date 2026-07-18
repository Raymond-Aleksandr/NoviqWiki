import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auditLogs, users } from "@/db/schema";
import { completeSetup } from "@/modules/setup/service";
import { createManagedUser, listUsers } from "@/modules/users/service";
import { createTestDatabase } from "../helpers/test-db";

describe("user data transfer objects", () => {
  it("does not select password hashes for administrative user listings", async () => {
    const test = await createTestDatabase();
    await test.executor.insert(users).values({
      username: "admin",
      normalizedUsername: "admin",
      email: "admin@example.test",
      normalizedEmail: "admin@example.test",
      passwordHash: "$argon2id$must-not-leave-the-user-service",
      displayName: "Admin"
    });

    const [user] = await listUsers({}, test.executor);
    expect(user).toMatchObject({ username: "admin", email: "admin@example.test" });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("normalizedUsername");
    expect(user).not.toHaveProperty("normalizedEmail");

    await test.client.close();
  });

  it("atomically creates managed users and records the administrative action", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Managed Users Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "managed-users-owner@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    const baseInput = {
      siteId: setup.site.id,
      username: "managed-user",
      email: "managed-user@example.test",
      password: "ManagedUserPassword123",
      actorId: setup.owner.id,
      actorDisplayName: setup.owner.displayName
    };

    await expect(createManagedUser({ ...baseInput, username: "x" }, test.db)).rejects.toThrow();
    await expect(
      createManagedUser({ ...baseInput, email: "not-an-email" }, test.db)
    ).rejects.toThrow();
    await expect(createManagedUser({ ...baseInput, password: "weak" }, test.db)).rejects.toThrow();
    await expect(
      createManagedUser({ ...baseInput, displayName: "d".repeat(161) }, test.db)
    ).rejects.toThrow();

    await expect(
      createManagedUser({ ...baseInput, groupId: randomUUID() }, test.db)
    ).rejects.toThrow("Group not found");
    await expect(
      test.executor
        .select({ id: users.id })
        .from(users)
        .where(eq(users.normalizedUsername, "managed-user"))
    ).resolves.toHaveLength(0);

    const user = await createManagedUser(baseInput, test.db);
    const logs = await test.executor
      .select({ targetId: auditLogs.targetId })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.siteId, setup.site.id),
          eq(auditLogs.action, "user.created"),
          eq(auditLogs.targetId, user.id)
        )
      );
    expect(logs).toEqual([{ targetId: user.id }]);

    await test.client.close();
  });
});
