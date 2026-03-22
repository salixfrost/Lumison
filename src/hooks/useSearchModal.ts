import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Song } from "../types";
import { NeteaseTrackInfo } from "../services/music/lyricsService";
import { useQueueSearchProvider } from "./useQueueSearchProvider";
import {
  useNeteaseSearchProvider,
} from "./useNeteaseSearchProvider";
import { useInternetArchiveSearch } from "./useInternetArchiveSearch";
import { StreamingTrack } from "../services/streaming/types";
import { buildSongIdIndexMap } from "../utils/songLookup";
import {
  buildSearchResultKeySet,
  buildSearchResultMap,
  dedupeSearchResults,
  getSearchResultKey,
} from "../utils/searchResultLookup";

type SearchSource = "queue" | "online";
type SearchResultItem = Song | NeteaseTrackInfo | StreamingTrack;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  track: SearchResultItem;
  type: SearchSource | "netease" | "archive";
}

interface UseSearchModalParams {
  queue: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isOpen: boolean;
}

export const useSearchModal = ({
  queue,
  currentSong,
  isPlaying,
  isOpen,
}: UseSearchModalParams) => {
  // Search query state
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchSource>("queue");
  const [onlineSource, setOnlineSource] = useState<"netease" | "archive">("netease");

  // Navigation State
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Search Providers
  const queueProvider = useQueueSearchProvider({ queue });
  const neteaseProvider = useNeteaseSearchProvider();
  const archiveProvider = useInternetArchiveSearch();

  // Queue search results (real-time)
  const [queueResults, setQueueResults] = useState<{ s: Song; i: number }[]>(
    [],
  );

  // Offset for Netease pagination
  const [neteaseOffset, setNeteaseOffset] = useState(0);

  // Archive search state
  const [archiveHasSearched, setArchiveHasSearched] = useState(false);

  const LIMIT = 30;
  const trimmedQuery = query.trim();
  const isOnlineNetease = activeTab === "online" && onlineSource === "netease";
  const isOnlineArchive = activeTab === "online" && onlineSource === "archive";
  const queueIndexMap = useMemo(() => buildSongIdIndexMap(queue), [queue]);
  const queueResultKeySet = useMemo(
    () => buildSearchResultKeySet(queue),
    [queue],
  );
  const neteaseResults = useMemo(
    () => dedupeSearchResults(neteaseProvider.results),
    [neteaseProvider.results],
  );
  const archiveResults = useMemo(
    () => dedupeSearchResults(archiveProvider.results),
    [archiveProvider.results],
  );
  const neteaseResultMap = useMemo(
    () => buildSearchResultMap(neteaseResults),
    [neteaseResults],
  );
  const archiveResultMap = useMemo(
    () => buildSearchResultMap(archiveResults),
    [archiveResults],
  );

  const queueSearch = queueProvider.search;
  const neteasePerformSearch = neteaseProvider.performSearch;
  const neteaseLoadMore = neteaseProvider.loadMore;
  const neteaseIsLoading = neteaseProvider.isLoading;
  const neteaseHasMore = neteaseProvider.hasMore;
  const archiveSearch = archiveProvider.search;
  const clearArchiveResults = archiveProvider.clear;

  // Update queue results in real-time

  useEffect(() => {
    if (activeTab === "queue") {
      queueSearch(query).then((results) => {
        const mappedResults = (results as Song[]).map((s) => {
          const originalIndex = queueIndexMap.get(s.id) ?? -1;
          return { s, i: originalIndex };
        });
        setQueueResults(mappedResults);
      });
    }
  }, [query, activeTab, queueSearch, queueIndexMap]);

  // Reset selected index when switching tabs or query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [activeTab, onlineSource, query]);

  // Reset context menu when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContextMenu(null);
    }
  }, [isOpen]);

  // --- Search Actions ---

  const performNeteaseSearch = useCallback(async () => {
    if (!query.trim()) return;
    setNeteaseOffset(0);
    setSelectedIndex(-1);
    await neteasePerformSearch(query);
  }, [query, neteasePerformSearch]);

  const loadMoreNetease = useCallback(async () => {
    if (neteaseIsLoading || !neteaseHasMore) return;
    const nextOffset = neteaseOffset + LIMIT;
    await neteaseLoadMore(query, nextOffset, LIMIT);
    setNeteaseOffset(nextOffset);
  }, [neteaseIsLoading, neteaseHasMore, neteaseLoadMore, neteaseOffset, query]);

  const performArchiveSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSelectedIndex(-1);
    setArchiveHasSearched(true);
    await archiveSearch(query, { limit: 20 });
  }, [query, archiveSearch]);

  // Auto-search for online providers when query changes (with debounce)
  useEffect(() => {
    if (activeTab !== "online") {
      return;
    }

    // When query is cleared, reset provider states so the next search starts cleanly.
    if (trimmedQuery.length === 0) {
      setSelectedIndex(-1);
      setNeteaseOffset(0);

      if (onlineSource === "netease") {
        void neteasePerformSearch("");
      } else {
        clearArchiveResults();
        setArchiveHasSearched(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (onlineSource === "netease") {
        performNeteaseSearch();
      } else {
        performArchiveSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    activeTab,
    onlineSource,
    performArchiveSearch,
    performNeteaseSearch,
    trimmedQuery,
    neteasePerformSearch,
    clearArchiveResults,
  ]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (activeTab === "online" && onlineSource === "netease") {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 100) {
          loadMoreNetease();
        }
      }
    },
    [activeTab, onlineSource, loadMoreNetease],
  );

  // --- Navigation ---

  const scrollToItem = useCallback((index: number) => {
    const el = itemRefs.current[index];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  const navigateDown = useCallback(() => {
    let listLength = 0;
    if (activeTab === "queue") {
      listLength = queueResults.length;
    } else if (onlineSource === "netease") {
      listLength = neteaseResults.length;
    } else if (onlineSource === "archive") {
      listLength = archiveResults.length;
    }

    if (listLength === 0) return;

    const next = Math.min(selectedIndex + 1, listLength - 1);
    setSelectedIndex(next);
    scrollToItem(next);
  }, [
    activeTab,
    onlineSource,
    selectedIndex,
    queueResults.length,
    neteaseResults.length,
    archiveResults.length,
    scrollToItem,
  ]);

  const navigateUp = useCallback(() => {
    const prev = Math.max(selectedIndex - 1, 0);
    setSelectedIndex(prev);
    scrollToItem(prev);
  }, [selectedIndex, scrollToItem]);

  const switchTab = useCallback(() => {
    setActiveTab((prev) => (prev === "queue" ? "online" : "queue"));
    setSelectedIndex(-1);
  }, []);

  // --- Context Menu ---

  const openContextMenu = useCallback(
    (e: React.MouseEvent, item: SearchResultItem, type: SearchSource | "netease" | "archive") => {
      e.preventDefault();
      let x = e.clientX;
      let y = e.clientY;

      if (x + 200 > window.innerWidth) x -= 200;
      if (y + 100 > window.innerHeight) y -= 100;

      setContextMenu({
        visible: true,
        x,
        y,
        track: item,
        type,
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // --- Now Playing Matcher ---
  const isNowPlaying = useCallback(
    (item: SearchResultItem) => {
      if (!currentSong) return false;
      if ("isNetease" in item && item.isNetease && currentSong.isNetease) {
        return item.neteaseId === currentSong.neteaseId;
      }
      return (
        item.title === currentSong.title && item.artist === currentSong.artist
      );
    },
    [currentSong],
  );

  const isResultInQueue = useCallback(
    (item: SearchResultItem) => queueResultKeySet.has(getSearchResultKey(item)),
    [queueResultKeySet],
  );

  // Determine what to show in results area
  const showNeteaseEmpty =
    isOnlineNetease &&
    neteaseProvider.hasSearched &&
    neteaseResults.length === 0 &&
    !neteaseProvider.isLoading;

  const showNeteaseLoading =
    isOnlineNetease &&
    neteaseProvider.isLoading &&
    neteaseResults.length === 0;

  const showNeteaseInitial =
    isOnlineNetease &&
    !neteaseProvider.hasSearched &&
    trimmedQuery.length === 0;

  const showArchiveEmpty =
    isOnlineArchive &&
    archiveHasSearched &&
    archiveResults.length === 0 &&
    !archiveProvider.isLoading;

  const showArchiveLoading =
    isOnlineArchive &&
    archiveProvider.isLoading &&
    archiveResults.length === 0;

  const showArchiveInitial =
    isOnlineArchive &&
    !archiveHasSearched &&
    trimmedQuery.length === 0;

  return {
    // State
    query,
    setQuery,
    activeTab,
    setActiveTab,
    onlineSource,
    setOnlineSource,
    selectedIndex,
    contextMenu,

    // Providers
    queueProvider,
    neteaseProvider,
    archiveProvider,
    neteaseResults,
    archiveResults,
    neteaseResultMap,
    archiveResultMap,

    // Results
    queueResults,

    // Refs
    itemRefs,

    // Actions
    performNeteaseSearch,
    performArchiveSearch,
    loadMoreNetease,
    handleScroll,

    // Navigation
    navigateDown,
    navigateUp,
    switchTab,
    scrollToItem,

    // Context Menu
    openContextMenu,
    closeContextMenu,

    // Helpers
    isNowPlaying,
    isResultInQueue,
    getResultKey: getSearchResultKey,

    // Display flags
    showNeteaseEmpty,
    showNeteaseInitial,
    showNeteaseLoading,
    showArchiveEmpty,
    showArchiveInitial,
    showArchiveLoading,

    // Constants
    LIMIT,
  };
};
