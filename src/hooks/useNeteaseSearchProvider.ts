import { useState, useCallback, useRef } from "react";
import { SearchProvider } from "./useSearchProvider";
import {
    searchNetEase,
    NeteaseTrackInfo,
} from "../services/music/lyricsService";
import { dedupeSearchResults } from "../utils/searchResultLookup";

const LIMIT = 30;
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000;
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  data: NeteaseTrackInfo[];
  timestamp: number;
}

interface NeteaseSearchProviderExtended extends SearchProvider {
    performSearch: (query: string) => Promise<void>;
    hasSearched: boolean;
    results: NeteaseTrackInfo[];
}

export const useNeteaseSearchProvider = (): NeteaseSearchProviderExtended => {
    const [results, setResults] = useState<NeteaseTrackInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [hasSearched, setHasSearched] = useState(false);
    const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

    const getCachedResults = useCallback((query: string): NeteaseTrackInfo[] | null => {
        const entry = cacheRef.current.get(query.toLowerCase());
        if (!entry) return null;

        if (Date.now() - entry.timestamp > CACHE_TTL) {
            cacheRef.current.delete(query.toLowerCase());
            return null;
        }

        return entry.data;
    }, []);

    const setCachedResults = useCallback((query: string, data: NeteaseTrackInfo[]) => {
        if (cacheRef.current.size >= 20) {
            const firstKey = cacheRef.current.keys().next().value;
            if (firstKey) cacheRef.current.delete(firstKey);
        }

        cacheRef.current.set(query.toLowerCase(), {
            data,
            timestamp: Date.now(),
        });
    }, []);

    const fetchPage = useCallback(
        async (
            query: string,
            offset: number,
            limit: number,
            errorLabel: string,
        ): Promise<NeteaseTrackInfo[] | null> => {
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    return await searchNetEase(query, { limit, offset });
                } catch (e) {
                    lastError = e instanceof Error ? e : new Error(String(e));
                    console.error(`${errorLabel} Attempt ${attempt + 1}:`, lastError.message);

                    if (attempt < MAX_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
                    }
                }
            }

            console.error(errorLabel, lastError);
            return null;
        },
        [],
    );

    const performSearch = useCallback(async (query: string) => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            setResults([]);
            setHasSearched(false);
            setHasMore(true);
            return;
        }

        const cachedResults = getCachedResults(normalizedQuery);
        if (cachedResults) {
            setResults(dedupeSearchResults(cachedResults));
            setHasMore(cachedResults.length >= LIMIT);
            setHasSearched(true);
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setResults([]);
        setHasMore(true);

        const searchResults = await fetchPage(
            normalizedQuery,
            0,
            LIMIT,
            "Netease search failed:",
        );

        if (!searchResults) {
            setHasMore(false);
            setIsLoading(false);
            return;
        }

        const dedupedResults = dedupeSearchResults(searchResults);
        setCachedResults(normalizedQuery, dedupedResults);
        setResults(dedupedResults);
        setHasMore(searchResults.length >= LIMIT);
        setIsLoading(false);
    }, [fetchPage, getCachedResults, setCachedResults]);

    const loadMore = useCallback(
        async (
            query: string,
            offset: number,
            limit: number,
        ): Promise<NeteaseTrackInfo[]> => {
            if (isLoading || !hasMore) return [];

            setIsLoading(true);
            const searchResults = await fetchPage(query, offset, limit, "Load more failed:");

            if (!searchResults) {
                setHasMore(false);
                setIsLoading(false);
                return [];
            }

            if (searchResults.length === 0) {
                setHasMore(false);
            } else {
                setResults((prev) => dedupeSearchResults([...prev, ...searchResults]));
            }

            setIsLoading(false);
            return searchResults;
        },
        [fetchPage, isLoading, hasMore],
    );

    return {
        id: "netease",
        label: "Netease", // Not used in UI, translated directly in SearchModal
        requiresExplicitSearch: true,
        isLoading,
        hasMore,
        hasSearched,
        results,

        search: async (): Promise<NeteaseTrackInfo[]> => {
            // For explicit search providers, this returns current results
            // Actual search is triggered by performSearch
            return results;
        },

        loadMore,
        performSearch,
    };
};
