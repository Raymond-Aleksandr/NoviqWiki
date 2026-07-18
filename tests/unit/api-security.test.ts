import { describe, expect, it } from "vitest";
import { assertApiCsrf } from "@/modules/api/auth";
import {
  createPageApiSchema,
  listPagesApiQuerySchema,
  patchPageApiSchema,
  rollbackPageApiSchema
} from "@/modules/api/page-schemas";
import { MAX_PAGE_MARKDOWN_LENGTH } from "@/modules/pages/service";
import { toSafeUser } from "@/modules/users/service";
import { resolveTrustedClientIp } from "@/modules/auth/session";
import { urlWithinRequestHost } from "@/lib/request-url";
import type { User } from "@/db/schema";

describe("API request security", () => {
  it("accepts a matching CSRF token from the request origin", () => {
    const request = new Request("https://wiki.example.test/api/v1/pages", {
      method: "POST",
      headers: {
        origin: "https://wiki.example.test",
        "x-csrf-token": "session-token"
      }
    });

    expect(() => assertApiCsrf(request, "session-token")).not.toThrow();
  });

  it("rejects missing or incorrect CSRF tokens with a 403 application error", () => {
    for (const submittedToken of [undefined, "wrong-token"]) {
      const headers = new Headers({ origin: "https://wiki.example.test" });
      if (submittedToken) headers.set("x-csrf-token", submittedToken);
      const request = new Request("https://wiki.example.test/api/v1/pages", {
        method: "POST",
        headers
      });

      expect(() => assertApiCsrf(request, "session-token")).toThrowError(
        expect.objectContaining({ code: "forbidden", status: 403 })
      );
    }
  });

  it("rejects cross-origin requests even when they submit a valid token", () => {
    const request = new Request("https://wiki.example.test/api/v1/pages", {
      method: "POST",
      headers: {
        origin: "https://attacker.example.test",
        "x-csrf-token": "session-token"
      }
    });

    expect(() => assertApiCsrf(request, "session-token")).toThrowError(
      expect.objectContaining({ code: "forbidden", status: 403 })
    );
  });

  it("honors reverse-proxy origin headers", () => {
    const request = new Request("http://internal:3000/api/v1/pages", {
      method: "POST",
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "wiki.example.test",
        "x-forwarded-proto": "https",
        origin: "https://wiki.example.test",
        "x-csrf-token": "session-token"
      }
    });

    expect(() => assertApiCsrf(request, "session-token")).not.toThrow();
  });

  it("uses the configured production origin instead of forwarded host headers", () => {
    const production = {
      NODE_ENV: "production" as const,
      NEXTWIKI_BASE_URL: "https://wiki.example.test"
    };
    const legitimateRequest = new Request("http://internal:3000/api/v1/pages", {
      method: "POST",
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "attacker.example.test",
        "x-forwarded-proto": "http",
        origin: "https://wiki.example.test",
        "x-csrf-token": "session-token"
      }
    });
    expect(() => assertApiCsrf(legitimateRequest, "session-token", production)).not.toThrow();
    expect(urlWithinRequestHost(legitimateRequest, "/login", production).toString()).toBe(
      "https://wiki.example.test/login"
    );

    const spoofedRequest = new Request("http://internal:3000/api/v1/pages", {
      method: "POST",
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "attacker.example.test",
        "x-forwarded-proto": "https",
        origin: "https://attacker.example.test",
        "x-csrf-token": "session-token"
      }
    });
    expect(() => assertApiCsrf(spoofedRequest, "session-token", production)).toThrowError(
      expect.objectContaining({ code: "forbidden", status: 403 })
    );
  });
});

describe("trusted proxy client IP parsing", () => {
  const forwardedFor = "198.51.100.10, 203.0.113.20";

  it("ignores client-controlled forwarding headers unless proxy trust is configured", () => {
    expect(resolveTrustedClientIp(forwardedFor, undefined)).toBeNull();
  });

  it("selects the client address by trusted hop count", () => {
    expect(resolveTrustedClientIp(forwardedFor, 1)).toBe("203.0.113.20");
    expect(resolveTrustedClientIp(forwardedFor, 2)).toBe("198.51.100.10");
  });

  it("rejects missing hops and non-IP candidates", () => {
    expect(resolveTrustedClientIp("not-an-ip", 1)).toBeNull();
    expect(resolveTrustedClientIp("198.51.100.10", 2)).toBeNull();
  });
});

describe("page API schemas", () => {
  it("rejects empty, incomplete, and ambiguous page patches", () => {
    expect(patchPageApiSchema.safeParse({}).success).toBe(false);
    expect(patchPageApiSchema.safeParse({ editSummary: "no operation" }).success).toBe(false);
    expect(
      patchPageApiSchema.safeParse({ action: "archive", protectionLevel: "protected" }).success
    ).toBe(false);
  });

  it("accepts each supported page patch operation", () => {
    expect(patchPageApiSchema.safeParse({ action: "archive" }).success).toBe(true);
    expect(patchPageApiSchema.safeParse({ protectionLevel: "protected" }).success).toBe(true);
    expect(patchPageApiSchema.safeParse({ title: "Renamed page", slug: "renamed" }).success).toBe(
      true
    );
    expect(
      patchPageApiSchema.safeParse({ markdown: "# Updated", baseRevisionId: null }).success
    ).toBe(true);
  });

  it("limits Markdown and list pagination at the API boundary", () => {
    const oversizedMarkdown = "x".repeat(MAX_PAGE_MARKDOWN_LENGTH + 1);
    expect(
      createPageApiSchema.safeParse({ title: "Large page", markdown: oversizedMarkdown }).success
    ).toBe(false);
    expect(patchPageApiSchema.safeParse({ markdown: oversizedMarkdown }).success).toBe(false);
    expect(listPagesApiQuerySchema.parse({})).toMatchObject({
      status: "published",
      page: 1,
      pageSize: 50
    });
    expect(listPagesApiQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it("bounds page metadata and validates revision identifiers", () => {
    const oversizedSlug = "s".repeat(241);
    const oversizedSummary = "s".repeat(1_001);
    const oversizedQuery = "q".repeat(501);
    expect(createPageApiSchema.safeParse({ title: "Page", slug: oversizedSlug }).success).toBe(
      false
    );
    expect(
      createPageApiSchema.safeParse({ title: "Page", editSummary: oversizedSummary }).success
    ).toBe(false);
    expect(
      patchPageApiSchema.safeParse({ markdown: "# Page", editSummary: oversizedSummary }).success
    ).toBe(false);
    expect(
      patchPageApiSchema.safeParse({ markdown: "# Page", baseRevisionId: "not-a-uuid" }).success
    ).toBe(false);
    expect(listPagesApiQuerySchema.safeParse({ q: oversizedQuery }).success).toBe(false);
    expect(listPagesApiQuerySchema.safeParse({ unexpected: "field" }).success).toBe(false);
  });

  it("strictly validates rollback bodies", () => {
    const targetRevisionId = "30000000-0000-4000-8000-000000000001";
    expect(rollbackPageApiSchema.safeParse({ targetRevisionId }).success).toBe(true);
    expect(rollbackPageApiSchema.safeParse({ targetRevisionId: "not-a-uuid" }).success).toBe(false);
    expect(
      rollbackPageApiSchema.safeParse({ targetRevisionId, reason: "r".repeat(1_001) }).success
    ).toBe(false);
    expect(rollbackPageApiSchema.safeParse({ targetRevisionId, unexpected: true }).success).toBe(
      false
    );
  });
});

describe("safe user DTO", () => {
  it("keeps password and normalization fields out of serialized users", () => {
    const now = new Date();
    const user: User = {
      id: "10000000-0000-4000-8000-000000000001",
      username: "owner",
      normalizedUsername: "owner",
      email: "owner@example.test",
      normalizedEmail: "owner@example.test",
      passwordHash: "$argon2id$secret-hash",
      displayName: "Owner",
      status: "active",
      locale: "en",
      appearance: "system",
      emailVerifiedAt: now,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now
    };

    const dto = toSafeUser(user);
    expect(dto).toMatchObject({ id: user.id, username: user.username, email: user.email });
    expect(dto).not.toHaveProperty("passwordHash");
    expect(dto).not.toHaveProperty("normalizedUsername");
    expect(dto).not.toHaveProperty("normalizedEmail");
  });
});
