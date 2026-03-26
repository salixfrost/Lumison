import { useCallback, useRef } from "react";

export interface SearchCacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface SearchCacheOptions {
  ttl?: number;
  maxSize?: number;
}

const DEFAULT_TTL = 5 * 60 * 1000;
const DEFAULT_MAX_SIZE = 50;

export function useSearchCache<T>(options: SearchCacheOptions = {}) {
  const { ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX_SIZE } = options;
  const cacheRef = useRef<Map<string, SearchCacheEntry<T>>>(new Map());

  const get = useCallback(
    (key: string): T | null => {
      const entry = cacheRef.current.get(key);
      if (!entry) return null;

      if (Date.now() - entry.timestamp > ttl) {
        cacheRef.current.delete(key);
        return null;
      }

      return entry.data;
    },
    [ttl]
  );

  const set = useCallback(
    (key: string, data: T) => {
      if (cacheRef.current.size >= maxSize) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) cacheRef.current.delete(firstKey);
      }

      cacheRef.current.set(key, {
        data,
        timestamp: Date.now(),
      });
    },
    [maxSize]
  );

  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const has = useCallback(
    (key: string): boolean => {
      const entry = cacheRef.current.get(key);
      if (!entry) return false;

      if (Date.now() - entry.timestamp > ttl) {
        cacheRef.current.delete(key);
        return false;
      }

      return true;
    },
    [ttl]
  );

  return { get, set, clear, has };
}