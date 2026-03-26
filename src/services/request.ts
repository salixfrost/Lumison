export type ProxyFn = (url: string) => string;

const CORS_PROXIES: ProxyFn[] = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const LOG_PREFIX = '[Request]';

const log = (level: 'info' | 'warn' | 'error', message: string, data?: object) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const fmt = (msg: string) => `${timestamp} ${LOG_PREFIX} ${msg}`;
  
  if (level === 'error') {
    console.error(fmt(message), data || '');
  } else if (level === 'warn') {
    console.warn(fmt(message), data || '');
  } else {
    console.log(fmt(message), data || '');
  }
};

interface RequestOptions {
  timeout?: number;
  retries?: number;
  proxies?: ProxyFn[];
  cacheCORS?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface RequestResult<T> {
  data: T | null;
  error: string | null;
  source: 'direct' | 'proxy' | 'fallback';
}

const corsCache = new Set<string>();
const failedOrigins = new Map<string, number>();
const ORIGIN_COOLDOWN = 60_000;

const getOrigin = (url: string): string => {
  try { return new URL(url).origin; } catch { return url; }
};

const isOriginAvailable = (origin: string): boolean => {
  const failedAt = failedOrigins.get(origin);
  if (!failedAt) return true;
  if (Date.now() - failedAt > ORIGIN_COOLDOWN) {
    failedOrigins.delete(origin);
    return true;
  }
  return false;
};

const fetchDirect = async (url: string, signal?: AbortSignal): Promise<unknown> => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fetchViaProxyChain = async (
  url: string,
  proxies: ProxyFn[],
  signal?: AbortSignal
): Promise<unknown> => {
  for (const proxyFn of proxies) {
    try {
      const proxyUrl = proxyFn(url);
      const res = await fetch(proxyUrl, { signal });
      if (!res.ok) continue;
      return await res.json();
    } catch { continue; }
  }
  throw new Error('All proxies failed');
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 500
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        log('warn', `Retry ${attempt + 1}/${retries} after ${delay}ms`, { error: lastError.message });
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError;
};

export const fetchWithFallback = async <T>(
  url: string,
  options: RequestOptions = {}
): Promise<RequestResult<T>> => {
  const {
    timeout = 5000,
    retries = 0,
    proxies = CORS_PROXIES,
    cacheCORS = true,
    signal,
  } = options;

  const origin = getOrigin(url);
  const useDirect = corsCache.has(origin) || isOriginAvailable(origin);
  
  log('info', `Fetching ${url}`, { useDirect, origin });

  const attemptFetch = async (fetcher: (u: string, s?: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    
    try {
      const data = await fetcher(url, controller.signal);
      clearTimeout(timer);
      
      if (useDirect && cacheCORS) {
        corsCache.add(origin);
      }
      failedOrigins.delete(origin);
      
      return data as T;
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  };

  const tryFetchers = async (): Promise<T> => {
    if (useDirect) {
      try {
        return await attemptFetch(fetchDirect) as Promise<T>;
      } catch (e) {
        log('warn', 'Direct failed, trying proxies', { error: String(e), origin });
        if (!corsCache.has(origin)) {
          failedOrigins.set(origin, Date.now());
        }
      }
    }
    
    return await attemptFetch((u, s) => fetchViaProxyChain(u, proxies, s)) as Promise<T>;
  };

  try {
    const data = retries > 0
      ? await withRetry(tryFetchers, retries)
      : await tryFetchers();

    return {
      data,
      error: null,
      source: useDirect ? 'direct' : 'proxy',
    };
  } catch (error) {
    log('error', 'All fetch attempts failed', { url, error: String(error) });
    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
      source: 'fallback',
    };
  }
};

export const fetchJSON = async <T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> => {
  const result = await fetchWithFallback<T>(url, options);
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data as T;
};

export const clearCORSCache = () => corsCache.clear();
export const clearFailedOrigins = () => failedOrigins.clear();

export const fetchViaProxy = async <T>(
  targetUrl: string,
  options?: { timeout?: number; signal?: AbortSignal }
): Promise<T> => {
  return fetchJSON<T>(targetUrl, {
    timeout: options?.timeout,
    signal: options?.signal,
  });
};