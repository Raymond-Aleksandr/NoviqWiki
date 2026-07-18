import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { hasPermission } from "@/modules/authorization/permissions";
import { login, registerUser } from "@/modules/auth/service";
import {
  bootstrapOwner,
  completeSetup,
  getSetupMode,
  getSetupState,
  isSetupRequired
} from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("setup owner bootstrap", () => {
  it("creates an Owner for a populated site that has only non-Owner accounts", async () => {
    const test = await createTestDatabase();
    expect(await getSetupMode(test.executor)).toBe("initial");
    expect(await getSetupState(test.executor)).toEqual({ mode: "initial", site: null });

    const initial = await completeSetup(
      {
        siteName: "Portable Wiki",
        tagline: "Seeded content",
        baseUrl: "http://localhost:3000",
        defaultLocale: "zh-CN",
        registrationMode: "open",
        mediaDriver: "local",
        ownerUsername: "temporary-owner",
        ownerEmail: "temporary@example.test",
        ownerPassword: "TemporaryPassword123"
      },
      test.db
    );
    const existingReader = await registerUser(
      {
        username: "existing-reader",
        email: "existing-reader@example.test",
        password: "ExistingReaderPassword123"
      },
      test.db
    );
    await test.db.delete(users).where(eq(users.id, initial.owner.id));

    expect(await getSetupMode(test.executor)).toBe("owner");
    expect(await getSetupState(test.executor)).toMatchObject({
      mode: "owner",
      site: { id: initial.site.id, name: "Portable Wiki" }
    });
    expect(await isSetupRequired(test.executor)).toBe(true);
    await expect(
      login(
        { identifier: existingReader.username, password: "ExistingReaderPassword123" },
        test.executor
      )
    ).resolves.toMatchObject({ user: { id: existingReader.id } });
    await expect(
      registerUser(
        {
          username: "premature-reader",
          email: "premature-reader@example.test",
          password: "PrematureReaderPassword123"
        },
        test.db
      )
    ).rejects.toThrow(/setup is required/i);

    const [ownerResult, registrationResult] = await Promise.allSettled([
      bootstrapOwner(
        {
          ownerUsername: "portable-owner",
          ownerEmail: "owner@example.test",
          ownerPassword: "PortablePassword123"
        },
        test.db
      ),
      registerUser(
        {
          username: "concurrent-reader",
          email: "concurrent-reader@example.test",
          password: "ConcurrentReaderPassword123"
        },
        test.db
      )
    ]);
    if (ownerResult.status !== "fulfilled") {
      throw ownerResult.reason;
    }
    const { site, owner } = ownerResult.value;

    expect(site.id).toBe(initial.site.id);
    expect(owner.displayName).toBe("portable-owner");
    expect(owner.locale).toBe("zh-CN");
    expect(await getSetupMode(test.executor)).toBe("complete");
    expect(await isSetupRequired(test.executor)).toBe(false);
    await expect(
      login({ identifier: "portable-owner", password: "PortablePassword123" }, test.executor)
    ).resolves.toMatchObject({ user: { id: owner.id } });
    await expect(hasPermission(owner.id, site.id, "site.configure", test.executor)).resolves.toBe(
      true
    );
    if (registrationResult.status === "fulfilled") {
      await expect(
        hasPermission(registrationResult.value.id, site.id, "site.configure", test.executor)
      ).resolves.toBe(false);
    } else {
      expect(String(registrationResult.reason)).toMatch(/setup is required/i);
    }
    await expect(
      bootstrapOwner(
        {
          ownerUsername: "second-owner",
          ownerEmail: "second@example.test",
          ownerPassword: "SecondPassword123"
        },
        test.db
      )
    ).rejects.toThrow(/already been completed/i);
  });
});
