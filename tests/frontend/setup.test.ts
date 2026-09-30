import assert from "node:assert/strict";
import test from "node:test";
import { en } from "../../src/i18n/en";
import { getSetupMessages } from "../../src/features/setup/messages";
import { createSetupValues, getSetupSteps, type SetupValues } from "../../src/features/setup/model";
import { validateSetupStep } from "../../src/features/setup/validation";
import { ownerSetupSchema, setupSchema } from "../../src/modules/auth/schemas";

const messages = getSetupMessages(en);

function backendAccepts(fixture: SetupValues, ownerOnly = false) {
  try {
    return (ownerOnly ? ownerSetupSchema : setupSchema).safeParse(fixture).success;
  } catch {
    // The current setup URL refinement can throw for malformed input; it still rejects that input.
    return false;
  }
}

function values(overrides: Partial<SetupValues> = {}): SetupValues {
  return {
    ...createSetupValues({
      siteName: "NoviqWiki",
      tagline: "Shared knowledge",
      baseUrl: "https://wiki.example.com",
      defaultLocale: "en",
      mediaDriver: "local"
    }),
    ownerUsername: "wiki.owner",
    ownerEmail: "owner@example.com",
    ownerDisplayName: "Wiki Owner",
    ownerPassword: "StrongPassword12",
    ...overrides
  };
}

test("required setup token is checked only in the owner step and only when configured", () => {
  const fixture = values({ setupToken: "   " });
  assert.equal(validateSetupStep("owner", fixture, messages, true)?.field, "setupToken");
  assert.equal(validateSetupStep("owner", fixture, messages, false), undefined);
  assert.equal(validateSetupStep("site", fixture, messages, true), undefined);
  assert.equal(validateSetupStep("owner", values({ setupToken: "owner-bootstrap-token" }), messages, true), undefined);
});

test("setup rejects blank site names and blank, malformed or non-HTTP base URLs", () => {
  assert.equal(validateSetupStep("site", values({ siteName: "  " }), messages, false)?.field, "siteName");
  for (const baseUrl of ["", "wiki.example.com", "https://", "ftp://example.com", "javascript:alert(1)"]) {
    const fixture = values({ baseUrl });
    assert.equal(backendAccepts(fixture), false, baseUrl);
    assert.equal(validateSetupStep("site", fixture, messages, false)?.field, "baseUrl", baseUrl);
  }
  for (const baseUrl of ["https://wiki.example.com", "http://localhost:3100", "  https://wiki.example.com/base  "]) {
    const fixture = values({ baseUrl });
    assert.equal(backendAccepts(fixture), true, baseUrl);
    assert.equal(validateSetupStep("site", fixture, messages, false), undefined, baseUrl);
  }
});

test("valid initial and owner-only setup modes expose and validate the right steps", () => {
  const fixture = values();
  assert.equal(setupSchema.safeParse(fixture).success, true);
  assert.equal(ownerSetupSchema.safeParse(fixture).success, true);
  const initial = getSetupSteps("initial", messages);
  assert.deepEqual(initial.map(({ id }) => id), ["site", "access", "storage", "owner", "review"]);
  for (const { id } of initial) assert.equal(validateSetupStep(id, fixture, messages, false), undefined);
  const owner = getSetupSteps("owner", messages);
  assert.deepEqual(owner.map(({ id }) => id), ["owner", "review"]);
  const bootstrap = values({ siteName: "", baseUrl: "", setupToken: "owner-bootstrap-token" });
  assert.equal(ownerSetupSchema.safeParse(bootstrap).success, true);
  for (const { id } of owner) assert.equal(validateSetupStep(id, bootstrap, messages, true), undefined);
});

test("owner username validation matches server constraints at accepted and rejected boundaries", () => {
  for (const ownerUsername of ["ab", "a".repeat(80), "wiki.owner-1_test", "  wiki.owner  "]) {
    const fixture = values({ ownerUsername });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, true, ownerUsername);
    assert.equal(validateSetupStep("owner", fixture, messages, false), undefined, ownerUsername);
  }
  for (const ownerUsername of ["", "a", "wiki owner", "wiki/owner", "a".repeat(81)]) {
    const fixture = values({ ownerUsername });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, false, ownerUsername);
    assert.equal(validateSetupStep("owner", fixture, messages, false)?.field, "ownerUsername", ownerUsername);
  }
});

test("owner email validation rejects addresses that the backend cannot accept", () => {
  for (const ownerEmail of ["owner@example.com", "owner+wiki@example.co.uk", "  owner@example.com  "]) {
    const fixture = values({ ownerEmail });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, true, ownerEmail);
    assert.equal(validateSetupStep("owner", fixture, messages, false), undefined, ownerEmail);
  }
  for (const ownerEmail of ["", "owner", "owner@", "@example.com", "first..last@example.com", "owner@example.c"]) {
    const fixture = values({ ownerEmail });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, false, ownerEmail);
    assert.equal(validateSetupStep("owner", fixture, messages, false)?.field, "ownerEmail", ownerEmail);
  }
});

test("owner passwords must satisfy server length and complexity constraints", () => {
  for (const ownerPassword of ["Abcdefghijk1", `Aa1${"x".repeat(197)}`]) {
    const fixture = values({ ownerPassword });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, true);
    assert.equal(validateSetupStep("owner", fixture, messages, false), undefined);
  }
  for (const ownerPassword of ["Aa123", "abcdefghijkl", "ABCDEFGHIJK1", "Abcdefghijkl", `Aa1${"x".repeat(198)}`]) {
    const fixture = values({ ownerPassword });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, false);
    assert.equal(validateSetupStep("owner", fixture, messages, false)?.field, "ownerPassword");
  }
});

test("site and setup-token length limits match backend acceptance", () => {
  const siteBoundary = values({ siteName: "n".repeat(160) });
  assert.equal(setupSchema.safeParse(siteBoundary).success, true);
  assert.equal(validateSetupStep("site", siteBoundary, messages, false), undefined);
  const longSite = values({ siteName: "n".repeat(161) });
  assert.equal(setupSchema.safeParse(longSite).success, false);
  assert.equal(validateSetupStep("site", longSite, messages, false)?.field, "siteName");

  const tokenBoundary = values({ setupToken: "t".repeat(300) });
  assert.equal(ownerSetupSchema.safeParse(tokenBoundary).success, true);
  assert.equal(validateSetupStep("owner", tokenBoundary, messages, true), undefined);
  const longToken = values({ setupToken: "t".repeat(301) });
  assert.equal(ownerSetupSchema.safeParse(longToken).success, false);
  assert.equal(validateSetupStep("owner", longToken, messages, true)?.field, "setupToken");
  assert.equal(validateSetupStep("owner", longToken, messages, false)?.field, "setupToken");
});

test("optional tagline and owner display name preserve empty values and enforce backend lengths", () => {
  for (const ownerDisplayName of ["", "   ", "n".repeat(160)]) {
    const fixture = values({ ownerDisplayName });
    assert.equal(ownerSetupSchema.safeParse(fixture).success, true);
    assert.equal(validateSetupStep("owner", fixture, messages, false), undefined);
  }
  const longName = values({ ownerDisplayName: "n".repeat(161) });
  assert.equal(ownerSetupSchema.safeParse(longName).success, false);
  assert.equal(validateSetupStep("owner", longName, messages, false)?.field, "ownerDisplayName");
  for (const tagline of ["", "n".repeat(240)]) {
    const fixture = values({ tagline });
    assert.equal(setupSchema.safeParse(fixture).success, true);
    assert.equal(validateSetupStep("site", fixture, messages, false), undefined);
  }
  const longTagline = values({ tagline: "n".repeat(241) });
  assert.equal(setupSchema.safeParse(longTagline).success, false);
  assert.equal(validateSetupStep("site", longTagline, messages, false)?.field, "tagline");
});
