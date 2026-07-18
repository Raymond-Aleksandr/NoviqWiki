import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getStorageAdapter: vi.fn(),
  isReady: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@/db/client", () => ({ db: { execute: mocks.execute } }));
vi.mock("@/modules/media/storage", () => ({
  getStorageAdapter: mocks.getStorageAdapter
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));

import { GET } from "@/app/api/ready/route";

describe("readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue(undefined);
    mocks.isReady.mockResolvedValue(true);
    mocks.getStorageAdapter.mockReturnValue({ isReady: mocks.isReady });
  });

  it("returns a non-cacheable success only when both dependencies are ready", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { database: true, storage: true }
    });
  });

  it("returns a non-cacheable 503 when the database check throws", async () => {
    mocks.execute.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { database: false, storage: false }
    });
    expect(mocks.isReady).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledOnce();
  });

  it("returns a non-cacheable 503 when the storage probe throws", async () => {
    mocks.isReady.mockRejectedValue(new Error("storage unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { database: true, storage: false }
    });
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});
