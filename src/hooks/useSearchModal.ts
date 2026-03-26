import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Song } from "../types";
import { NeteaseTrackInfo } from "../services/music/lyricsService";
import { useQueueSearchProvider } from "./useQueueSearchProvider";
import {
  useNeteaseSearchProvider,
} from "./useNeteaseSearchProvider";
import { useKugouSearchProvider } from "./useKugouSearchProvider";
import { useInternetArchiveSearch } from "./useInternetArchiveSearch";
import { StreamingTrack } from "../services/streaming/types";
import { KugouTrack } from "../services/music/kugouApi";
import { searchAlbums, type NeteaseAlbum, searchByLanguage } from "../services/music/neteaseApi";
import { buildSongIdIndexMap } from "../utils/songLookup";
import {
  buildSearchResultKeySet,
  buildSearchResultMap,
  dedupeSearchResults,
  getSearchResultKey,
} from "../utils/searchResultLookup";
import { PERFORMANCE_CONFIG } from "../config/performance";
import { useSearchHistory } from "./useSearchHistory";

type SearchSource = "queue" | "online";
type SearchResultItem = Song | NeteaseTrackInfo | StreamingTrack | KugouTrack;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  track: SearchResultItem;
  type: SearchSource | "netease" | "archive" | "kugou";
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
  const [onlineSource, setOnlineSource] = useState<"netease" | "archive" | "kugou" | "album" | "language">("netease");

  // Navigation State
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Search Providers
  const queueProvider = useQueueSearchProvider({ queue });
  const neteaseProvider = useNeteaseSearchProvider();
  const archiveProvider = useInternetArchiveSearch();
  const kugouProvider = useKugouSearchProvider();

  // Queue search results (real-time)
  const [queueResults, setQueueResults] = useState<{ s: Song; i: number }[]>(
    [],
  );

  // Offset for Netease pagination
  const [neteaseOffset, setNeteaseOffset] = useState(0);

  // Archive search state
  const [archiveHasSearched, setArchiveHasSearched] = useState(false);

  // Album search state
  const [albumResults, setAlbumResults] = useState<NeteaseAlbum[]>([]);
  const [albumOffset, setAlbumOffset] = useState(0);
  const [albumHasSearched, setAlbumHasSearched] = useState(false);
  const [albumIsLoading, setAlbumIsLoading] = useState(false);

  // Language search state
  const [languageResults, setLanguageResults] = useState<Array<{ id: number; name: string; artists: Array<{ id: number; name: string }>; album: { id: number; name: string; picUrl: string }; duration: number }>>([]);
  const [languageHasSearched, setLanguageHasSearched] = useState(false);
  const [languageIsLoading, setLanguageIsLoading] = useState(false);

  const LIMIT = 30;
  const trimmedQuery = query.trim();
  const isOnlineNetease = activeTab === "online" && onlineSource === "netease";
  const isOnlineArchive = activeTab === "online" && onlineSource === "archive";
  const isOnlineKugou = activeTab === "online" && onlineSource === "kugou";
  const isOnlineAlbum = activeTab === "online" && onlineSource === "album";
  const isOnlineLanguage = activeTab === "online" && onlineSource === "language";
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
  const kugouResults = useMemo(
    () => dedupeSearchResults(kugouProvider.results),
    [kugouProvider.results],
  );
  const neteaseResultMap = useMemo(
    () => buildSearchResultMap(neteaseResults),
    [neteaseResults],
  );
  const archiveResultMap = useMemo(
    () => buildSearchResultMap(archiveResults),
    [archiveResults],
  );
  const kugouResultMap = useMemo(
    () => buildSearchResultMap(kugouResults),
    [kugouResults],
  );

  const queueSearch = queueProvider.search;
  const neteasePerformSearch = neteaseProvider.performSearch;
  const neteaseLoadMore = neteaseProvider.loadMore;
  const neteaseIsLoading = neteaseProvider.isLoading;
  const neteaseHasMore = neteaseProvider.hasMore;
  const archiveSearch = archiveProvider.search;
  const clearArchiveResults = archiveProvider.clear;
  const kugouPerformSearch = kugouProvider.performSearch;
  const kugouIsLoading = kugouProvider.isLoading;
  const kugouHasMore = kugouProvider.hasMore;
  const kugouLoadMore = kugouProvider.loadMore;

  const { addToHistory, recentQueries } = useSearchHistory();

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
    addToHistory(query, "netease");
  }, [query, neteasePerformSearch, addToHistory]);

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
    addToHistory(query, "archive");
  }, [query, archiveSearch, addToHistory]);

  const performKugouSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSelectedIndex(-1);
    await kugouPerformSearch(query);
    addToHistory(query, "kugou");
  }, [query, kugouPerformSearch, addToHistory]);

  const loadMoreKugou = useCallback(async () => {
    if (kugouIsLoading || !kugouHasMore) return;
    const nextOffset = kugouResults.length;
    await kugouLoadMore(query, nextOffset, LIMIT);
  }, [kugouIsLoading, kugouHasMore, kugouLoadMore, kugouResults.length, query]);

  const performAlbumSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSelectedIndex(-1);
    setAlbumIsLoading(true);
    setAlbumHasSearched(true);
    setAlbumOffset(0);
    try {
      const result = await searchAlbums(query, { limit: LIMIT });
      setAlbumResults(result.albums);
    } catch (err) {
      console.error("Album search error:", err);
      setAlbumResults([]);
    } finally {
      setAlbumIsLoading(false);
    }
  }, [query]);

  const loadMoreAlbums = useCallback(async () => {
    if (albumIsLoading) return;
    setAlbumIsLoading(true);
    const nextOffset = albumOffset + LIMIT;
    try {
      const result = await searchAlbums(query, { limit: LIMIT, offset: nextOffset });
      setAlbumResults((prev) => [...prev, ...result.albums]);
      setAlbumOffset(nextOffset);
    } catch (err) {
      console.error("Load more albums error:", err);
    } finally {
      setAlbumIsLoading(false);
    }
  }, [query, albumOffset, albumIsLoading]);

  const performLanguageSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSelectedIndex(-1);
    setLanguageIsLoading(true);
    setLanguageHasSearched(true);
    try {
      const result = await searchByLanguage(query, { limit: LIMIT });
      setLanguageResults(result.songs);
    } catch (err) {
      console.error("Language search error:", err);
      setLanguageResults([]);
    } finally {
      setLanguageIsLoading(false);
    }
  }, [query]);

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
      } else if (onlineSource === "archive") {
        clearArchiveResults();
        setArchiveHasSearched(false);
      } else if (onlineSource === "kugou") {
        void kugouPerformSearch("");
      } else if (onlineSource === "album") {
        setAlbumResults([]);
        setAlbumHasSearched(false);
      } else if (onlineSource === "language") {
        setLanguageResults([]);
        setLanguageHasSearched(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (onlineSource === "netease") {
        performNeteaseSearch();
      } else if (onlineSource === "archive") {
        performArchiveSearch();
      } else if (onlineSource === "kugou") {
        performKugouSearch();
      } else if (onlineSource === "album") {
        performAlbumSearch();
      } else if (onlineSource === "language") {
        performLanguageSearch();
      }
    }, PERFORMANCE_CONFIG.debounce.search);

    return () => clearTimeout(timer);
  }, [
    activeTab,
    onlineSource,
    performArchiveSearch,
    performNeteaseSearch,
    performKugouSearch,
    performAlbumSearch,
    performLanguageSearch,
    trimmedQuery,
    neteasePerformSearch,
    clearArchiveResults,
  ]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (activeTab === "online" && onlineSource === "netease") {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 200) {
          loadMoreNetease();
        }
      } else if (activeTab === "online" && onlineSource === "album") {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 200) {
          loadMoreAlbums();
        }
      }
    },
    [activeTab, onlineSource, loadMoreNetease, loadMoreAlbums],
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
    } else if (onlineSource === "album") {
      listLength = albumResults.length;
    } else if (onlineSource === "language") {
      listLength = languageResults.length;
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
    albumResults.length,
    languageResults.length,
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
    (e: React.MouseEvent, item: SearchResultItem, type: SearchSource | "netease" | "archive" | "kugou") => {
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

  const showKugouEmpty =
    isOnlineKugou &&
    kugouProvider.hasSearched &&
    kugouResults.length === 0 &&
    !kugouProvider.isLoading;

  const showKugouLoading =
    isOnlineKugou &&
    kugouProvider.isLoading &&
    kugouResults.length === 0;

  const showKugouInitial =
    isOnlineKugou &&
    !kugouProvider.hasSearched &&
    trimmedQuery.length === 0;

  const showAlbumEmpty =
    isOnlineAlbum &&
    albumHasSearched &&
    albumResults.length === 0 &&
    !albumIsLoading;

  const showAlbumLoading =
    isOnlineAlbum &&
    albumIsLoading &&
    albumResults.length === 0;

  const showAlbumInitial =
    isOnlineAlbum &&
    !albumHasSearched &&
    trimmedQuery.length === 0;

  const showLanguageEmpty =
    isOnlineLanguage &&
    languageHasSearched &&
    languageResults.length === 0 &&
    !languageIsLoading;

  const showLanguageLoading =
    isOnlineLanguage &&
    languageIsLoading &&
    languageResults.length === 0;

  const showLanguageInitial =
    isOnlineLanguage &&
    !languageHasSearched &&
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
    kugouProvider,
    neteaseResults,
    archiveResults,
    kugouResults,
    neteaseResultMap,
    archiveResultMap,
    kugouResultMap,

    // Results
    queueResults,

    // Refs
    itemRefs,

    // Actions
    performNeteaseSearch,
    performArchiveSearch,
    performKugouSearch,
    loadMoreNetease,
    loadMoreKugou,
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
    recentQueries,

    // Display flags
    showNeteaseEmpty,
    showNeteaseInitial,
    showNeteaseLoading,
    showArchiveEmpty,
    showArchiveInitial,
    showArchiveLoading,
    showKugouEmpty,
    showKugouInitial,
    showKugouLoading,
    isOnlineKugou,

    // Album & Language search
    albumResults,
    albumHasSearched,
    albumIsLoading,
    languageResults,
    languageHasSearched,
    languageIsLoading,

    // Constants
    LIMIT,
  };
};
