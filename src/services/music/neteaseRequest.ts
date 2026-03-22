export const NETEASE_API_ENDPOINTS = [
  "https://163api.qijieya.cn",
  "https://music-api.heheda.top",
  "https://netease-cloud-music-api-psi-ten.vercel.app",
  "https://netease-api.fe-mm.com",
  "https://netease-music-api.vercel.app",
] as const;

export interface NeteaseRequestConfig {
  timeout?: number;
  retries?: number;
}

// Track which endpoints are known to be down to skip them quickly
const failedEndpoints = new Map<string, number>();
const ENDPOINT_COOLDOWN_MS = 60_000;

const isEndpointAvailable = (baseUrl: string) => {
  const failedAt = failedEndpoints.get(baseUrl);
  if (!failedAt) return true;
  if (Date.now() - failedAt > ENDPOINT_COOLDOWN_MS) {
    failedEndpoints.delete(baseUrl);
    return true;
  }
  return false;
};

// Proxies used only for endpoints that don't support CORS
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const fetchDirect = async (url: string, signal?: AbortSignal): Promise<any> => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fetchViaProxies = async (url: string, signal?: AbortSignal): Promise<any> => {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const res = await fetch(makeProxy(url), { signal });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // try next proxy
    }
  }
  throw new Error("All proxies failed");
};

// Endpoints known to support CORS natively (no proxy needed)
const CORS_SUPPORTED = new Set(["https://music-api.heheda.top"]);

export async function fetchNeteaseWithFallback(
  endpoint: string,
  config: NeteaseRequestConfig = {},
): Promise<any> {
  const { timeout = 8000 } = config;
  const candidates = NETEASE_API_ENDPOINTS.filter(isEndpointAvailable);
  const toTry = candidates.length > 0 ? candidates : [...NETEASE_API_ENDPOINTS];

  for (const baseUrl of toTry) {
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const fetcher = CORS_SUPPORTED.has(baseUrl) ? fetchDirect : fetchViaProxies;
      const result = await fetcher(url, controller.signal);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError" && !controller.signal.aborted) {
        throw error;
      }
      failedEndpoints.set(baseUrl, Date.now());
    }
  }

  throw new Error("All Netease API endpoints failed");
}
