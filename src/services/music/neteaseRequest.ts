import { fetchWithFallback, fetchJSON, withRetry, ProxyFn } from "../request";

export const NETEASE_API_ENDPOINTS = [
  "https://music-api.heheda.top",
  "https://163api.qijieya.cn",
  "https://netease-cloud-music-api-psi-ten.vercel.app",
  "https://netease-api.fe-mm.com",
  "https://netease-music-api.vercel.app",
] as const;

const CORS_PROXIES: ProxyFn[] = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const CORS_SUPPORTED = new Set(["https://music-api.heheda.top"]);

export interface NeteaseRequestConfig {
  timeout?: number;
  retries?: number;
}

export const fetchDirect = async (url: string, signal?: AbortSignal): Promise<unknown> => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const fetchViaProxies = async (
  url: string,
  signal?: AbortSignal
): Promise<unknown> => {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const res = await fetch(makeProxy(url), { signal });
      if (!res.ok) continue;
      return await res.json();
    } catch { continue; }
  }
  throw new Error("All proxies failed");
};

export async function fetchNeteaseWithFallback(
  endpoint: string,
  config: NeteaseRequestConfig = {},
): Promise<unknown> {
  const { timeout = 5000, retries = 0 } = config;

  const tryEndpoint = async (baseUrl: string) => {
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
    const fetcher = CORS_SUPPORTED.has(baseUrl) ? fetchDirect : fetchViaProxies;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    try {
      const result = await fetcher(url, controller.signal);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError" && !controller.signal.aborted) {
        throw error;
      }
      throw error;
    }
  };

  if (retries > 0) {
    for (const baseUrl of NETEASE_API_ENDPOINTS) {
      try {
        return await withRetry(() => tryEndpoint(baseUrl), retries);
      } catch { continue; }
    }
  } else {
    for (const baseUrl of NETEASE_API_ENDPOINTS) {
      try {
        return await tryEndpoint(baseUrl);
      } catch { continue; }
    }
  }

  throw new Error("All Netease API endpoints failed");
}

export const fetchNetease = async <T>(
  endpoint: string,
  config: NeteaseRequestConfig = {}
): Promise<T> => {
  const { timeout = 5000, retries = 0 } = config;
  
  return fetchJSON<T>(endpoint, {
    timeout,
    retries,
    proxies: CORS_PROXIES,
  });
};