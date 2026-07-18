import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiContext: vi.fn(),
  getMediaReferences: vi.fn(),
  deleteMedia: vi.fn()
}));

vi.mock("@/modules/api/auth", () => ({
  requireApiContext: mocks.requireApiContext
}));

vi.mock("@/modules/media/service", () => ({
  getMediaReferences: mocks.getMediaReferences,
  deleteMedia: mocks.deleteMedia
}));

vi.mock("@/i18n/server", () => ({
  getRequestI18n: vi.fn(async () => ({
    messages: {
      requestInvalid: "The request is invalid.",
      unexpectedError: "An unexpected error occurred."
    }
  }))
}));

import { DELETE, GET } from "@/app/api/v1/media/[id]/route";

const validMediaId = "30000000-0000-4000-8000-000000000001";
const session = {
  user: { id: "10000000-0000-4000-8000-000000000001", displayName: "Media Admin" }
};

describe("media API route parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiContext.mockResolvedValue({ session });
    mocks.getMediaReferences.mockResolvedValue([]);
    mocks.deleteMedia.mockResolvedValue(undefined);
  });

  it("rejects a non-UUID media id before reading references", async () => {
    const response = await GET(new Request("https://wiki.example.test/api/v1/media/not-an-id"), {
      params: Promise.resolve({ id: "not-an-id" })
    });

    expect(response.status).toBe(422);
    expect(mocks.getMediaReferences).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID media id before deletion", async () => {
    const response = await DELETE(
      new Request("https://wiki.example.test/api/v1/media/not-an-id", { method: "DELETE" }),
      { params: Promise.resolve({ id: "not-an-id" }) }
    );

    expect(response.status).toBe(422);
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
  });

  it("passes a valid UUID to the media service", async () => {
    const response = await GET(
      new Request(`https://wiki.example.test/api/v1/media/${validMediaId}`),
      { params: Promise.resolve({ id: validMediaId }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.getMediaReferences).toHaveBeenCalledWith(validMediaId);
  });
});
