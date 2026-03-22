import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNeteaseWithFallback } from "./neteaseRequest";
import { fetchViaProxy } from "../utils";

vi.mock("../utils", () => ({
  fetchViaProxy: vi.fn(),
}));

const mockedFetchViaProxy = vi.mocked(fetchViaProxy);

describe("fetchNeteaseWithFallback", () => {
  beforeEach(() => {
    mockedFetchViaProxy.mockReset();
  });

  it("uses primary endpoint first when request succeeds", async () => {
    mockedFetchViaProxy.mockResolvedValueOnce({ ok: true });

    const result = await fetchNeteaseWithFallback("/cloudsearch?keywords=test", {
      retries: 0,
    });

    expect(result).toEqual({ ok: true });
    expect(mockedFetchViaProxy).toHaveBeenCalledTimes(1);
    expect(mockedFetchViaProxy.mock.calls[0]?.[0]).toContain(
      "https://163api.qijieya.cn/cloudsearch?keywords=test",
    );
  });

  it("falls back to backup endpoint when primary fails", async () => {
    mockedFetchViaProxy
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockResolvedValueOnce({ source: "backup" });

    const result = await fetchNeteaseWithFallback("/lyric/new?id=1", {
      retries: 0,
    });

    expect(result).toEqual({ source: "backup" });
    expect(mockedFetchViaProxy).toHaveBeenCalledTimes(2);
    expect(mockedFetchViaProxy.mock.calls[0]?.[0]).toContain("https://163api.qijieya.cn");
    expect(mockedFetchViaProxy.mock.calls[1]?.[0]).toContain(
      "https://netease-cloud-music-api-psi-ten.vercel.app",
    );
  });

  it("throws when all endpoints fail", async () => {
    mockedFetchViaProxy.mockRejectedValue(new Error("network error"));

    await expect(
      fetchNeteaseWithFallback("/song/detail?ids=1", { retries: 0 }),
    ).rejects.toThrow("All Netease API endpoints failed");
  });

  it("keeps absolute URL unchanged", async () => {
    const absoluteUrl = "https://custom.example.com/cloudsearch?keywords=abc";
    mockedFetchViaProxy.mockResolvedValueOnce({ source: "absolute" });

    const result = await fetchNeteaseWithFallback(absoluteUrl, { retries: 0 });

    expect(result).toEqual({ source: "absolute" });
    expect(mockedFetchViaProxy).toHaveBeenCalledTimes(1);
    expect(mockedFetchViaProxy.mock.calls[0]?.[0]).toBe(absoluteUrl);
  });

  it("retries on same endpoint before switching base URL", async () => {
    mockedFetchViaProxy
      .mockRejectedValueOnce(new Error("attempt 1 failed"))
      .mockResolvedValueOnce({ source: "primary-after-retry" });

    const result = await fetchNeteaseWithFallback("/cloudsearch?keywords=retry", {
      retries: 1,
    });

    expect(result).toEqual({ source: "primary-after-retry" });
    expect(mockedFetchViaProxy).toHaveBeenCalledTimes(2);
    expect(mockedFetchViaProxy.mock.calls[0]?.[0]).toContain("https://163api.qijieya.cn");
    expect(mockedFetchViaProxy.mock.calls[1]?.[0]).toContain("https://163api.qijieya.cn");
  });

  it("switches to backup only after exhausting retries on primary", async () => {
    mockedFetchViaProxy
      .mockRejectedValueOnce(new Error("primary attempt 1 failed"))
      .mockRejectedValueOnce(new Error("primary attempt 2 failed"))
      .mockResolvedValueOnce({ source: "backup-after-primary-exhausted" });

    const result = await fetchNeteaseWithFallback("/song/detail?ids=42", {
      retries: 1,
    });

    expect(result).toEqual({ source: "backup-after-primary-exhausted" });
    expect(mockedFetchViaProxy).toHaveBeenCalledTimes(3);
    expect(mockedFetchViaProxy.mock.calls[0]?.[0]).toContain("https://163api.qijieya.cn");
    expect(mockedFetchViaProxy.mock.calls[1]?.[0]).toContain("https://163api.qijieya.cn");
    expect(mockedFetchViaProxy.mock.calls[2]?.[0]).toContain(
      "https://netease-cloud-music-api-psi-ten.vercel.app",
    );
  });
});
