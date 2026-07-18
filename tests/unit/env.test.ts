import { describe, expect, it } from "vitest";
import { canonicalApplicationBaseUrl, parseAppEnv } from "@/lib/env";

const productionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://noviqwiki:secret@database.example.test/noviqwiki",
  NOVIQWIKI_BASE_URL: "https://wiki.example.test",
  NOVIQWIKI_SECRET: "a".repeat(32)
} satisfies NodeJS.ProcessEnv;

describe("application environment", () => {
  it.each(["https://wiki.example.test", "http://localhost:3000"])(
    "accepts an absolute HTTP(S) canonical base URL: %s",
    (baseUrl) => {
      expect(
        parseAppEnv({ ...productionEnv, NOVIQWIKI_BASE_URL: baseUrl }).NOVIQWIKI_BASE_URL
      ).toBe(baseUrl);
    }
  );

  it.each(["ftp://wiki.example.test", "file:///tmp/wiki", "//wiki.example.test"])(
    "rejects a non-HTTP canonical base URL: %s",
    (baseUrl) => {
      expect(() => parseAppEnv({ ...productionEnv, NOVIQWIKI_BASE_URL: baseUrl })).toThrow();
    }
  );

  it("requires an explicit canonical base URL at production runtime", () => {
    const { NOVIQWIKI_BASE_URL: _omitted, ...withoutBaseUrl } = productionEnv;
    expect(() => parseAppEnv(withoutBaseUrl)).toThrow(
      "NOVIQWIKI_BASE_URL must be explicitly configured in production"
    );
  });

  it("allows the build phase to use the development default without weakening runtime checks", () => {
    const { NOVIQWIKI_BASE_URL: _omitted, ...withoutBaseUrl } = productionEnv;
    expect(
      parseAppEnv({ ...withoutBaseUrl, NEXT_PHASE: "phase-production-build" }).NOVIQWIKI_BASE_URL
    ).toBe("http://localhost:3000");
  });

  it("uses the deployment origin as canonical in production and the site fallback in development", () => {
    expect(
      canonicalApplicationBaseUrl(
        { NODE_ENV: "production", NOVIQWIKI_BASE_URL: "https://wiki.example.test" },
        "https://stale.example.test"
      )
    ).toBe("https://wiki.example.test");
    expect(
      canonicalApplicationBaseUrl(
        { NODE_ENV: "development", NOVIQWIKI_BASE_URL: "http://localhost:3000" },
        "http://localhost:3100"
      )
    ).toBe("http://localhost:3100");
  });

  it("accepts only SMTP transport URLs and normalizes empty optional email settings", () => {
    expect(
      parseAppEnv({
        ...productionEnv,
        NOVIQWIKI_SMTP_URL: "smtps://mailer.example.test:465",
        NOVIQWIKI_EMAIL_FROM: " NoviqWiki <no-reply@example.test> "
      })
    ).toMatchObject({
      NOVIQWIKI_SMTP_URL: "smtps://mailer.example.test:465",
      NOVIQWIKI_EMAIL_FROM: "NoviqWiki <no-reply@example.test>"
    });
    expect(() =>
      parseAppEnv({ ...productionEnv, NOVIQWIKI_SMTP_URL: "https://mailer.example.test" })
    ).toThrow();
    expect(() =>
      parseAppEnv({
        ...productionEnv,
        NOVIQWIKI_EMAIL_FROM: "sender@example.test\nBcc: bad@example"
      })
    ).toThrow();
    expect(
      parseAppEnv({ ...productionEnv, NOVIQWIKI_SMTP_URL: "", NOVIQWIKI_EMAIL_FROM: "" })
    ).toMatchObject({ NOVIQWIKI_SMTP_URL: undefined, NOVIQWIKI_EMAIL_FROM: undefined });
  });
});
