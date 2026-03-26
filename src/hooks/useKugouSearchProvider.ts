import { useState, useCallback, useRef } from "react";
import { SearchProvider, SearchResultItem } from "./useSearchProvider";
import {
  searchKugou,
  getKugouSongUrl,
  KugouTrack,
} from "../services/music/kugouApi";

const LIMIT = 30;
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  data: KugouTrack[];
  timestamp: number;
}

interface KugouSearchProviderExtended extends SearchProvider {
  performSearch: (query: string) => Promise<void>;
  hasSearched: boolean;
  results: KugouTrack[];
  getAudioUrl: (hash: string) => Promise<string | null>;
}

export const useKugouSearchProvider = (): KugouSearchProviderExtended => {
  const [results, setResults] = useState<KugouTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const getCachedResults = useCallback((query: string): KugouTrack[] | null => {
    const entry = cacheRef.current.get(query.toLowerCase());
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL) {
      cacheRef.current.delete(query.toLowerCase());
      return null;
    }

    return entry.data;
  }, []);

  const setCachedResults = useCallback((query: string, data: KugouTrack[]) => {
    if (cacheRef.current.size >= 20) {
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey) cacheRef.current.delete(firstKey);
    }

    cacheRef.current.set(query.toLowerCase(), {
      data,
      timestamp: Date.now(),
    });
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const cached = getCachedResults(query);
    if (cached) {
      setResults(cached);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await searchKugou(query, LIMIT, 0);
      setResults(data);
      setCachedResults(query, data);
      setHasMore(data.length >= LIMIT);
    } catch (error) {
      console.error('KuGou search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [getCachedResults, setCachedResults]);

  const search = useCallback(async (query: string) => {
    await performSearch(query);
    return results as SearchResultItem[];
  }, [performSearch, results]);

  const loadMore = useCallback(async (_query: string, offset: number, limit: number) => {
    const data = await searchKugou(_query, limit, offset);
    setResults(prev => [...prev, ...data]);
    setHasMore(data.length >= limit);
    return data as SearchResultItem[];
  }, []);

  const getAudioUrl = useCallback(async (hash: string) => {
    return getKugouSongUrl(hash);
  }, []);

  return {
    id: 'kugou',
    label: '酷狗',
    requiresExplicitSearch: true,
    search,
    loadMore,
    hasMore,
    isLoading,
    performSearch,
    hasSearched,
    results,
    getAudioUrl,
  };
};