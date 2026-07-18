import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiContext: vi.fn(),
  getPageWithCurrentRevision: vi.fn(),
  publishPage: vi.fn(),
  listPages: vi.fn()
}));

vi.mock("@/modules/api/auth", () => ({
  requireApiContext: mocks.requireApiContext
}));

vi.mock("@/modules/pages/service", () => ({
  MAX_PAGE_EDIT_SUMMARY_LENGTH: 1_000,
  MAX_PAGE_MARKDOWN_LENGTH: 1_000_000,
  archivePage: vi.fn(),
  assertPageVisibleForRead: vi.fn(),
  createPage: vi.fn(),
  getPageWithCurrentRevision: mocks.getPageWithCurrentRevision,
  listPages: mocks.listPages,
  publishPage: mocks.publishPage,
  renamePage: vi.fn(),
  restorePage: vi.fn(),
  setPageProtection: vi.fn(),
  softDeletePage: vi.fn()
}));

vi.mock("@/i18n/server", () => ({
  getRequestI18n: vi.fn(async () => ({
    messages: {
      requestInvalid: "The request is invalid.",
      unexpectedError: "An unexpected error occurred."
    }
  }))
}));

import { PATCH } from "@/app/api/v1/pages/[id]/route";
import { GET } from "@/app/api/v1/pages/route";

const routeContext = {
  site: { site: { id: "20000000-0000-4000-8000-000000000001" }, settings: null },
  session: {
    user: { id: "10000000-0000-4000-8000-000000000001", displayName: "Editor" },
    csrfToken: "csrf-token"
  }
};

describe("page API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiContext.mockResolvedValue(routeContext);
    mocks.listPages.mockResolvedValue([]);
  });

  it("returns validation_error for an empty PATCH instead of reading the page", async () => {
    const response = await PATCH(
      new Request("https://wiki.example.test/api/v1/pages/page-id", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{}"
      }),
      { params: Promise.resolve({ id: "20000000-0000-4000-8000-000000000002" }) }
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validation_error" }
    });
    expect(mocks.getPageWithCurrentRevision).not.toHaveBeenCalled();
    expect(mocks.publishPage).not.toHaveBeenCalled();
  });

  it("rejects malformed page identifiers before calling page services", async () => {
    const response = await PATCH(
      new Request("https://wiki.example.test/api/v1/pages/not-a-uuid", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: "# Updated" })
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    );

    expect(response.status).toBe(422);
    expect(mocks.publishPage).not.toHaveBeenCalled();
  });

  it("defaults page listings to published pages with bounded pagination", async () => {
    const response = await GET(new Request("https://wiki.example.test/api/v1/pages"));

    expect(response.status).toBe(200);
    expect(mocks.requireApiContext).toHaveBeenCalledTimes(1);
    expect(mocks.requireApiContext).toHaveBeenCalledWith("page.read");
    expect(mocks.listPages).toHaveBeenCalledWith({
      siteId: routeContext.site.site.id,
      query: undefined,
      status: "published",
      includeDeleted: false,
      limit: 50,
      offset: 0
    });
  });

  it("requires elevated permissions for draft listings", async () => {
    const response = await GET(
      new Request("https://wiki.example.test/api/v1/pages?status=draft&page=2&pageSize=25")
    );

    expect(response.status).toBe(200);
    expect(mocks.requireApiContext).toHaveBeenNthCalledWith(1, "page.read");
    expect(mocks.requireApiContext).toHaveBeenNthCalledWith(2, "page.edit");
    expect(mocks.listPages).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft", limit: 25, offset: 25 })
    );
  });

  it("rejects page sizes above the API cap", async () => {
    const response = await GET(new Request("https://wiki.example.test/api/v1/pages?pageSize=101"));

    expect(response.status).toBe(422);
    expect(mocks.listPages).not.toHaveBeenCalled();
  });
});
