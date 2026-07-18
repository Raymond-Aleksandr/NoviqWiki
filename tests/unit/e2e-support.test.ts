import { describe, expect, it } from "vitest";
import { isResetSafeDatabaseUrl, resolveE2eDatabaseUrl } from "../../scripts/e2e-support";

describe("e2e database safety", () => {
  it("uses an explicit e2e database URL first", () => {
    expect(
      resolveE2eDatabaseUrl({
        NOVIQWIKI_E2E_DATABASE_URL: "postgres://user:pass@localhost:5432/custom_e2e",
        DATABASE_URL: "postgres://user:pass@localhost:5432/noviqwiki"
      })
    ).toBe("postgres://user:pass@localhost:5432/custom_e2e");
  });

  it("accepts ambient test databases but avoids ordinary app databases", () => {
    expect(
      resolveE2eDatabaseUrl({
        DATABASE_URL: "postgres://user:pass@localhost:5432/noviqwiki_test"
      })
    ).toBe("postgres://user:pass@localhost:5432/noviqwiki_test");
    expect(
      resolveE2eDatabaseUrl({
        DATABASE_URL: "postgres://user:pass@localhost:5432/noviqwiki"
      })
    ).toBe("postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki_e2e");
  });

  it("only treats test, e2e, and ci database names as reset-safe", () => {
    expect(isResetSafeDatabaseUrl("postgres://user:pass@localhost:5432/noviqwiki_e2e")).toBe(true);
    expect(isResetSafeDatabaseUrl("postgres://user:pass@localhost:5432/noviqwiki_test")).toBe(true);
    expect(isResetSafeDatabaseUrl("postgres://user:pass@localhost:5432/ci")).toBe(true);
    expect(isResetSafeDatabaseUrl("postgres://user:pass@localhost:5432/noviqwiki")).toBe(false);
  });
});
