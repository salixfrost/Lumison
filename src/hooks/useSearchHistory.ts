import { useCallback, useMemo } from "react";

const STORAGE_KEY = "lumison_search_history";
const MAX_HISTORY = 10;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  source: "netease" | "archive" | "kugou" | "queue";
}

export function useSearchHistory() {
  const getHistory = useCallback((): SearchHistoryItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const addToHistory = useCallback((query: string, source: SearchHistoryItem["source"]) => {
    if (!query.trim()) return;

    try {
      const history = getHistory();
      const filtered = history.filter(item => item.query.toLowerCase() !== query.toLowerCase());

      const newItem: SearchHistoryItem = {
        query: query.trim(),
        timestamp: Date.now(),
        source,
      };

      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save search history:", e);
    }
  }, [getHistory]);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear search history:", e);
    }
  }, []);

  const recentQueries = useMemo(() => getHistory().slice(0, 5), [getHistory]);

  return {
    getHistory,
    addToHistory,
    clearHistory,
    recentQueries,
  };
}