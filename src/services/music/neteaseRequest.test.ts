import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils", () => ({
  fetchViaProxy: vi.fn(),
}));

vi.mocked = vi.fn;

import { fetchNeteaseWithFallback } from "./neteaseRequest";

describe("fetchNeteaseWithFallback", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses primary endpoint first when request succeeds", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const result = await fetchNeteaseWithFallback("/cloudsearch?keywords=test", {
      retries: 0,
    });

    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as any).mock.calls[0]?.[0]).toContain(
      "https://music-api.heheda.top/cloudsearch?keywords=test",
    );
  });

  it("falls back to backup endpoint when primary fails", async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source: "backup" }),
      });

    const result = await fetchNeteaseWithFallback("/lyric/new?id=1", {
      retries: 0,
    });

    expect(result).toEqual({ source: "backup" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstCallUrl = (global.fetch as any).mock.calls[0]?.[0];
    const secondCallUrl = (global.fetch as any).mock.calls[1]?.[0];
    expect(firstCallUrl).toContain("music-api.heheda.top");
    expect(secondCallUrl).toContain("163api.qijieya.cn");
  });

  it("throws when all endpoints fail", async () => {
    (global.fetch as any).mockRejectedValue(new Error("network error"));

    await expect(
      fetchNeteaseWithFallback("/song/detail?ids=1", { retries: 0 }),
    ).rejects.toThrow("All Netease API endpoints failed");
  });

  it("keeps absolute URL unchanged", async () => {
    const absoluteUrl = "https://custom.example.com/cloudsearch?keywords=abc";
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source: "absolute" }),
    });

    const result = await fetchNeteaseWithFallback(absoluteUrl, { retries: 0 });

    expect(result).toEqual({ source: "absolute" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as any).mock.calls[0]?.[0]).toBe(absoluteUrl);
  });

  it("retries on same endpoint before switching base URL", async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error("attempt 1 failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source: "primary-after-retry" }),
      });

    const result = await fetchNeteaseWithFallback("/cloudsearch?keywords=retry", {
      retries: 1,
    });

    expect(result).toEqual({ source: "primary-after-retry" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as any).mock.calls[0]?.[0]).toContain("https://music-api.heheda.top");
    expect((global.fetch as any).mock.calls[1]?.[0]).toContain("https://music-api.heheda.top");
  });

  it("switches to backup only after exhausting retries on primary", async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error("primary attempt 1 failed"))
      .mockRejectedValueOnce(new Error("primary attempt 2 failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source: "backup-after-primary-exhausted" }),
      });

    const result = await fetchNeteaseWithFallback("/song/detail?ids=42", {
      retries: 1,
    });

    expect(result).toEqual({ source: "backup-after-primary-exhausted" });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const firstCallUrl = (global.fetch as any).mock.calls[0]?.[0];
    const secondCallUrl = (global.fetch as any).mock.calls[1]?.[0];
    const thirdCallUrl = (global.fetch as any).mock.calls[2]?.[0];
    expect(firstCallUrl).toContain("music-api.heheda.top");
    expect(secondCallUrl).toContain("music-api.heheda.top");
    expect(thirdCallUrl).toContain("163api.qijieya.cn");
  });
});