import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composeSource = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");
const ciSource = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("Compose database configuration", () => {
  it("requires a complete DATABASE_URL instead of interpolating POSTGRES_PASSWORD", () => {
    expect(composeSource).toContain(
      "DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL to a complete PostgreSQL URL with URL-encoded credentials}"
    );
    expect(composeSource).not.toMatch(/^\s*DATABASE_URL:.*POSTGRES_PASSWORD/m);
  });

  it("fails closed when database or signing secrets are empty", () => {
    expect(composeSource).toContain(
      "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD to the raw database password}"
    );
    expect(composeSource).toContain(
      "NEXTWIKI_SECRET: ${NEXTWIKI_SECRET:?Set NEXTWIKI_SECRET to a stable random secret}"
    );
    expect(composeSource).toContain(
      "NEXTWIKI_BASE_URL: ${NEXTWIKI_BASE_URL:?Set NEXTWIKI_BASE_URL to the canonical public URL}"
    );
  });

  it("passes optional SMTP delivery settings into the application container", () => {
    expect(composeSource).toContain("NEXTWIKI_SMTP_URL: ${NEXTWIKI_SMTP_URL:-}");
    expect(composeSource).toContain("NEXTWIKI_EMAIL_FROM: ${NEXTWIKI_EMAIL_FROM:-}");
  });

  it("provides explicit CI-only values to the Docker Compose job", () => {
    const dockerJob = ciSource.split("\n  docker:\n")[1];
    expect(dockerJob).toBeDefined();
    expect(dockerJob).toMatch(/\n {4}env:\n/);
    expect(dockerJob).toContain("POSTGRES_PASSWORD:");
    expect(dockerJob).toContain("DATABASE_URL: postgres://nextwiki:");
    expect(dockerJob).toContain("NEXTWIKI_BASE_URL: http://localhost:3000");
    expect(dockerJob).toContain("NEXTWIKI_SECRET:");
  });
});
