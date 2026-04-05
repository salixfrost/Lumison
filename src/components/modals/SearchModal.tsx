import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { SearchIcon, PlayIcon, PlusIcon, MoreVerticalIcon, NextIcon } from "../common/Icons";
import SmartImage from "../common/SmartImage";
import { Song } from "../../types";
import {
  getNeteaseAudioUrl,
  NeteaseTrackInfo,
} from "../../services/music/lyricsService";
import { StreamingTrack } from "../../services/streaming/types";
import { KugouTrack } from "../../services/music/kugouApi";
import { useKeyboardScope } from "../../hooks/useKeyboardScope";
import { useSearchModal } from "../../hooks/useSearchModal";
import { useI18n } from "../../contexts/I18nContext";
import { buildSongIdIndexMap } from "../../utils/songLookup";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Song[];
  onPlayQueueIndex: (index: number) => void;
  onImportAndPlay: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  accentColor: string;
}

const SEQUOIA_SCROLLBAR_STYLES = `
  .sequoia-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.0) transparent;
    transition: scrollbar-color 0.3s ease;
  }
  .sequoia-scrollbar:hover {
    scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
  }
  .sequoia-scrollbar::-webkit-scrollbar {
    width: 14px;
  }
  .sequoia-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .sequoia-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.0);
    border: 5px solid transparent;
    background-clip: content-box;
    border-radius: 99px;
    transition: background-color 0.3s ease;
  }
  .sequoia-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.4);
  }
  .sequoia-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.6);
  }
`;

const ANIMATION_STYLES = `
  @keyframes modal-in {
      0% { opacity: 0; transform: scale(0.96) translateY(-8px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes modal-out {
      0% { opacity: 1; transform: scale(1) translateY(0); }
      100% { opacity: 0; transform: scale(0.98) translateY(4px); }
  }
  @keyframes eq-bounce {
      0%, 100% { transform: scaleY(0.4); opacity: 0.8; }
      50% { transform: scaleY(1.0); opacity: 1; }
  }
  @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
  }
  .macos-modal-in { animation: modal-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; will-change: transform, opacity; }
  .macos-modal-out { animation: modal-out 0.15s cubic-bezier(0.32, 0.72, 0, 1) forwards; will-change: transform, opacity; }
  .skeleton-shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
`;

const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-xl">
    <div className="w-10 h-10 rounded-xl skeleton-shimmer shrink-0" />
    <div className="flex-1 flex flex-col gap-2">
      <div className="h-4 w-3/5 rounded skeleton-shimmer" />
      <div className="h-3 w-2/5 rounded skeleton-shimmer" />
    </div>
  </div>
);

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  queue,
  onPlayQueueIndex,
  onImportAndPlay,
  onAddToQueue,
  currentSong,
  isPlaying,
  accentColor,
}) => {
  const { t } = useI18n();
  // Animation State
  const [isRendering, setIsRendering] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const queueIndexMap = useMemo(() => buildSongIdIndexMap(queue), [queue]);

  // Refs
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Use search modal hook
  const search = useSearchModal({
    queue,
    currentSong,
    isPlaying,
    isOpen,
  });

  // --- Animation Handling ---
  useEffect(() => {
    if (isOpen) {
      setIsRendering(true);
      setIsClosing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (isRendering && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendering(false);
        setIsClosing(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendering]);

  // --- Close context menu on outside click ---
  useEffect(() => {
    if (!search.contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".context-menu-container")) {
        search.closeContextMenu();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [search.contextMenu]);

  // --- Close track menu on outside click ---
  useEffect(() => {
    if (!menuTrackId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".track-menu")) {
        closeMenu();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuTrackId]);

  // --- Keyboard Scope (High Priority: 100) ---
  useKeyboardScope(
    (e) => {
      if (!isOpen) return false;

      if (search.contextMenu) {
        search.closeContextMenu();
        return true;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          search.navigateDown();
          return true;
        }
        case "ArrowUp": {
          e.preventDefault();
          search.navigateUp();
          return true;
        }
        case "Enter": {
          e.preventDefault();
          if (search.selectedIndex >= 0) {
            handleSelection(search.selectedIndex);
          }
          return true;
        }
        case "Escape": {
          e.preventDefault();
          onClose();
          return true;
        }
        case "Tab": {
          e.preventDefault();
          search.switchTab();
          return true;
        }
      }
      return false;
    },
    100,
    isOpen,
  );

  // --- Actions ---

  const handleSelection = (index: number) => {
    if (search.activeTab === "queue") {
      const item = search.queueResults[index];
      if (item) {
        onPlayQueueIndex(item.i);
        onClose();
      }
    } else if (search.activeTab === "online") {
      if (search.onlineSource === "netease") {
        const track = search.neteaseResults[index];
        if (track) {
          playNeteaseTrack(track);
          onClose();
        }
      } else if (search.onlineSource === "kugou") {
        const track = search.kugouResults[index];
        if (track) {
          playKugouTrack(track);
          onClose();
        }
      } else {
        const track = search.archiveResults[index];
        if (track) {
          playArchiveTrack(track);
          onClose();
        }
      }
    }
  };

  const playNeteaseTrack = (track: NeteaseTrackInfo) => {
    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl?.replace("http:", "https:"),
      fileUrl: getNeteaseAudioUrl(track.id),
      isNetease: true,
      neteaseId: track.neteaseId,
      album: track.album,
      lyrics: [],
      needsLyricsMatch: true,
    };
    onImportAndPlay(song);
  };

  const addNeteaseToQueue = (track: NeteaseTrackInfo) => {
    if (search.isResultInQueue(track)) {
      return;
    }

    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl?.replace("http:", "https:"),
      fileUrl: getNeteaseAudioUrl(track.id),
      isNetease: true,
      neteaseId: track.neteaseId,
      album: track.album,
      lyrics: [],
      needsLyricsMatch: true,
    };
    onAddToQueue(song);
  };

  const playArchiveTrack = (track: StreamingTrack) => {
    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl || "",
      fileUrl: track.url,
      isAudioStream: true,
      audioStreamSource: 'internet-archive',
      album: "",
      lyrics: [],
      needsLyricsMatch: false,
    };
    onImportAndPlay(song);
  };

  const addArchiveToQueue = (track: StreamingTrack) => {
    if (search.isResultInQueue(track)) {
      return;
    }

    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl || "",
      fileUrl: track.url,
      isAudioStream: true,
      audioStreamSource: 'internet-archive',
      album: "",
      lyrics: [],
      needsLyricsMatch: false,
    };
    onAddToQueue(song);
  };

  const playKugouTrack = async (track: KugouTrack) => {
    try {
      const { getKugouSongUrl } = await import("../../services/music/kugouApi");
      const audioUrl = await getKugouSongUrl(track.hash);
      
      const song: Song = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl || "",
        fileUrl: audioUrl || "",
        isAudioStream: true,
        audioStreamSource: 'kugou',
        album: track.album || "",
        lyrics: [],
        needsLyricsMatch: false,
      };
      onImportAndPlay(song);
    } catch (error) {
      console.error("Failed to play KuGou track:", error);
    }
  };

  const addKugouToQueue = async (track: KugouTrack) => {
    if (search.isResultInQueue(track)) {
      return;
    }

    try {
      const { getKugouSongUrl } = await import("../../services/music/kugouApi");
      const audioUrl = await getKugouSongUrl(track.hash);
      
      const song: Song = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl || "",
        fileUrl: audioUrl || "",
        isAudioStream: true,
        audioStreamSource: 'kugou',
        album: track.album || "",
        lyrics: [],
        needsLyricsMatch: false,
      };
      onAddToQueue(song);
    } catch (error) {
      console.error("Failed to add KuGou track to queue:", error);
    }
  };

  const playAlbumSongs = async (album: { id: number; name: string; artist: { name: string }; picUrl?: string }) => {
    try {
      const { getAlbumDetail } = await import("../../services/music/neteaseApi");
      const result = await getAlbumDetail(album.id);
      const firstSong = result.songs[0];
      if (firstSong) {
        const song: Song = {
          id: firstSong.id,
          title: firstSong.name,
          artist: firstSong.artists.map(a => a.name).join(", "),
          coverUrl: album.picUrl?.replace("http:", "https:"),
          fileUrl: getNeteaseAudioUrl(firstSong.id),
          isNetease: true,
          neteaseId: firstSong.id.toString(),
          album: album.name,
          lyrics: [],
          needsLyricsMatch: true,
        };
        onImportAndPlay(song);
      }
    } catch (err) {
      console.error("Failed to play album:", err);
    }
  };

  const handleLanguageSelection = (idx: number) => {
    const track = search.languageResults[idx];
    if (track) {
      const song: Song = {
        id: track.id,
        title: track.name,
        artist: track.artists?.map(a => a.name).join(", ") || "",
        coverUrl: track.album?.picUrl?.replace("http:", "https:"),
        fileUrl: getNeteaseAudioUrl(track.id),
        isNetease: true,
        neteaseId: track.id.toString(),
        album: track.album?.name,
        lyrics: [],
        needsLyricsMatch: true,
      };
      onImportAndPlay(song);
    }
  };


  const handleMenuClick = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.left, y: rect.bottom + 4 });
    setMenuTrackId(trackId);
  };

  const closeMenu = () => {
    setMenuTrackId(null);
    setMenuPosition(null);
  };

  const activeMenuTrack = useMemo(() => {
    if (!menuTrackId) {
      return null;
    }

    return search.onlineSource === "netease"
      ? search.neteaseResultMap.get(menuTrackId) ?? null
      : search.archiveResultMap.get(menuTrackId) ?? null;
  }, [menuTrackId, search.onlineSource, search.neteaseResultMap, search.archiveResultMap]);

  // Reset refs


  if (!isRendering) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 select-none font-sans"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (!modalRef.current?.contains(target)) {
          onClose();
        }
        if (!target.closest(".context-menu-container") && !target.closest(".track-menu")) {
          search.closeContextMenu();
          closeMenu();
        }
      }}
    >
      <style>{SEQUOIA_SCROLLBAR_STYLES}</style>
      <style>{ANIMATION_STYLES}</style>

      {/* Backdrop - Animated */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
        aria-hidden="true"
      />

      {/* Modal Container - Sequoia Style */}
      <div
        className={`
        relative w-full max-w-[720px] h-[600px]
        bg-black/40 backdrop-blur-2xl saturate-150
        rounded-[20px]
        shadow-[0_50px_100px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)]
        flex flex-col overflow-hidden
        ${isClosing ? "macos-modal-out" : "macos-modal-in"}
        text-white
      `}
        ref={modalRef}
      >
        {/* Header Area */}
        <div className="flex flex-col px-5 pt-5 pb-3 gap-4 border-b border-white/10 shrink-0 bg-white/5 z-10">
          {/* Animated Tabs */}
          <div className="relative flex items-center justify-center p-1 rounded-lg self-center w-full max-w-md mb-1 bg-black/20 backdrop-blur-md shadow-inner">
            {/* Gliding Pill */}
            <div
              className="absolute top-1 bottom-1 rounded-[6px] bg-white/15 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{
                left: search.activeTab === "queue" ? "4px" : "calc(50% + 2px)",
                width: "calc(50% - 6px)",
              }}
            />

            <button
              onClick={() => {
                search.setActiveTab("queue");
                search.setQuery("");
              }}
              className={`
                        relative min-w-0 flex-1 py-1.5 px-1 text-xs sm:text-[13px] font-medium truncate transition-colors duration-200 z-10
                        ${search.activeTab === "queue" ? "text-white" : "text-white/50 hover:text-white/70"}
                    `}
            >
              {t("search.queue")}
            </button>
            <button
              onClick={() => {
                search.setActiveTab("online");
                search.setQuery("");
              }}
              className={`
                        relative min-w-0 flex-1 py-1.5 px-1 text-xs sm:text-[13px] font-medium truncate transition-colors duration-200 z-10
                        ${search.activeTab === "online" ? "text-white" : "text-white/50 hover:text-white/70"}
                    `}
            >
              {t("search.online")}
            </button>
          </div>

          {/* Search Bar with Provider Toggle */}
          <div className="relative group mx-2 flex flex-col gap-3">
            <div className="relative w-full">
              <input
                id="search-input"
                name="search"
                ref={inputRef}
                type="text"
                value={search.query}
                onChange={(e) => search.setQuery(e.target.value)}
                placeholder={
                  search.activeTab === "queue"
                    ? t("search.filterQueue")
                    : search.onlineSource === "netease"
                      ? t("search.netease") || "流媒体"
                      : search.onlineSource === "album"
                        ? t("search.album") || "专辑"
                        : t("search.archive") || "Archive"
                }
                aria-describedby="search-helper-text"
                className="
                          w-full pl-4 pr-4 py-3.5
                          bg-black/20 hover:bg-black/30 focus:bg-black/40
                          border border-white/5 focus:border-white/15
                          rounded-[12px]
                          text-lg font-medium text-white placeholder:text-white/20
                          outline-none
                          transition-all duration-200
                          shadow-inner
                      "
              />
              <div id="search-helper-text" className="mt-1.5 text-xs text-white/30 text-center">
                {search.activeTab === "queue"
                  ? (t("search.filterQueueHint") || "Filter songs in your playlist")
                  : search.onlineSource === "netease"
                    ? (t("search.neteaseHint") || "Search Netease Cloud Music library")
                    : search.onlineSource === "album"
                      ? (t("search.albumHint") || "Search for albums by artist or title")
                      : (t("search.archiveHint") || "Search Internet Archive free music collection")
                }
              </div>
            </div>

            {/* Provider Toggle (Only shown for Online tab) */}
            <div className={`flex items-center justify-center transition-all duration-300 overflow-hidden ${search.activeTab === "online" ? "h-9 opacity-100 mb-1" : "h-0 opacity-0"}`}>
              <div className="inline-flex max-w-full overflow-x-auto p-1 rounded-full bg-black/20 backdrop-blur-md border border-white/5 shadow-inner">
                <button
                  onClick={() => search.setOnlineSource("netease")}
                  className={`px-3 sm:px-4 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${search.onlineSource === "netease"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                    }`}
                >
                  {t("search.netease")}
                </button>
                <button
                  onClick={() => search.setOnlineSource("album")}
                  className={`px-3 sm:px-4 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${search.onlineSource === "album"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                    }`}
                >
                  {t("search.album")}
                </button>
                <button
                  onClick={() => search.setOnlineSource("archive")}
                  className={`px-3 sm:px-4 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${search.onlineSource === "archive"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                    }`}
                >
                  {t("search.archive")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto sequoia-scrollbar p-3 scroll-smooth"
          onScroll={search.handleScroll}
        >
          {/* Queue Results */}
          {search.activeTab === "queue" && (
            <div className="relative flex flex-col gap-1">
              {search.queueResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-white/20">
                  <span className="text-lg">{t("search.noSongsInQueue")}</span>
                </div>
              ) : (
                <>
                  {/* Floating Selection Background */}
                  {search.selectedIndex >= 0 && search.itemRefs.current[search.selectedIndex] && (
                    <div
                      className="absolute left-0 right-0 bg-white/[0.06] rounded-xl pointer-events-none transition-all duration-200 ease-out backdrop-blur-sm"
                      style={{
                        top: `${search.itemRefs.current[search.selectedIndex]?.offsetTop || 0}px`,
                        height: `${search.itemRefs.current[search.selectedIndex]?.offsetHeight || 56}px`,
                        zIndex: 0,
                      }}
                    />
                  )}

                  {search.queueResults.map(({ s, i }, idx) => {
                    const nowPlaying = search.isNowPlaying(s);
                    return (
                      <div
                        key={`${s.id}-${i}`}
                        ref={(el) => {
                          search.itemRefs.current[idx] = el;
                        }}
                        onClick={() => handleSelection(idx)}
                        onContextMenu={(e) =>
                          search.openContextMenu(e, s, "queue")
                        }
                        className={`
                                        relative z-10 group flex items-center gap-3 p-3 rounded-xl cursor-pointer
                                        transition-all duration-200 ease-out
                                        ${search.selectedIndex === idx ? "text-white bg-white/[0.05]" : "hover:bg-white/[0.03] text-white/90"}
                                    `}
                      >
                        <div className="relative w-10 h-10 rounded-xl bg-white/5 overflow-hidden shrink-0 shadow-md group-hover:shadow-lg transition-shadow duration-200">
                          {s.coverUrl ? (
                            <SmartImage
                              src={s.coverUrl}
                              alt={s.title}
                              containerClassName="w-full h-full"
                              imgClassName={`w-full h-full object-cover transition-opacity ${nowPlaying ? "opacity-40 blur-[1px]" : ""}`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs opacity-30">
                              ♪
                            </div>
                          )}

                          {/* Play Button on Hover or Selected */}
                          {!nowPlaying && (
                            <div className={`absolute inset-0 flex items-center justify-center bg-black/50 ${search.selectedIndex === idx ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-hover:transition-opacity group-hover:duration-150"}`}>
                              <PlayIcon className="w-4 h-4 fill-white drop-shadow-md" />
                            </div>
                          )}

                          {/* Now Playing Indicator */}
                          {nowPlaying && isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                              <div
                                className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite]"
                                style={{ height: "8px", color: accentColor }}
                              ></div>
                              <div
                                className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.2s]"
                                style={{ height: "14px", color: accentColor }}
                              ></div>
                              <div
                                className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.4s]"
                                style={{ height: "10px", color: accentColor }}
                              ></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                          <div
                            className={`text-[15px] font-medium truncate ${search.selectedIndex === idx ? "text-white" : nowPlaying ? "" : "text-white/90"}`}
                            style={nowPlaying ? { color: accentColor } : {}}
                          >
                            {s.title}
                          </div>
                          <div
                            className={`text-[13px] truncate ${search.selectedIndex === idx ? "text-white/70" : "text-white/40"}`}
                          >
                            {s.artist}
                          </div>
                        </div>
                        {search.selectedIndex === idx && (
                          <div className="mr-1">
                            <PlayIcon className="w-5 h-5 fill-white/80" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Online Results (Netease and Internet Archive) */}
          {search.activeTab === "online" && (
            <div className="relative flex flex-col gap-1 pb-4">
              {/* Netease Provider UI */}
              {search.onlineSource === "netease" && (
                <>
                  {/* No results after search */}
                  {search.showNeteaseEmpty && (
                    <div className="flex flex-col items-center justify-center h-64 text-white/20">
                      <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                      <span className="text-base font-medium">
                        {t("search.noMatchesFound")}
                      </span>
                    </div>
                  )}

                  {/* Loading State */}
                  {search.showNeteaseLoading && (
                    <div className="flex flex-col gap-1 py-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonRow key={i} />
                      ))}
                    </div>
                  )}

                  {/* Initial empty state */}
                  {search.showNeteaseInitial && (
                    <div className="flex flex-col items-center justify-center h-64 text-white/20">
                      <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                      <span className="text-base font-medium">
                        {t("search.searchCloudMusic")}
                      </span>
                    </div>
                  )}

                  {/* Results list */}
                  {search.neteaseResults.length > 0 && (
                    <>
                      {/* Floating Selection Background */}
                      {search.selectedIndex >= 0 && search.itemRefs.current[search.selectedIndex] && (
                        <div
                          className="absolute left-0 right-0 bg-white/25 backdrop-blur-md rounded-[10px] pointer-events-none transition-all duration-200 ease-out"
                          style={{
                            top: `${search.itemRefs.current[search.selectedIndex]?.offsetTop || 0}px`,
                            height: `${search.itemRefs.current[search.selectedIndex]?.offsetHeight || 56}px`,
                            zIndex: 0,
                          }}
                        />
                      )}

                      {search.neteaseResults.map((track, idx) => {
                        const nowPlaying = search.isNowPlaying(track);
                        const trackKey = search.getResultKey(track);
                        return (
                          <div
                            key={trackKey}
                            ref={(el) => {
                              search.itemRefs.current[idx] = el;
                            }}
                            onClick={() => handleSelection(idx)}
                            onContextMenu={(e) =>
                              search.openContextMenu(e, track, "netease")
                            }
                            className={`
                                            relative z-10 group flex items-center gap-3 p-3 rounded-xl cursor-pointer
                                            transition-all duration-200 ease-out
                                            ${search.selectedIndex === idx ? "text-white bg-white/[0.05]" : "hover:bg-white/[0.03] text-white/90"}
                                        `}
                          >
                            <div className="relative w-10 h-10 rounded-xl bg-white/5 overflow-hidden shrink-0 shadow-md group-hover:shadow-lg transition-shadow duration-200">
                              {track.coverUrl && (
                                <SmartImage
                                  src={track.coverUrl}
                                  alt={track.title}
                                  containerClassName="w-full h-full"
                                  imgClassName={`w-full h-full object-cover transition-opacity ${nowPlaying ? "opacity-40 blur-[1px]" : ""}`}
                                />
                              )}

                              {/* Play Button on Hover or Selected */}
                              {!nowPlaying && (
                                <div className={`absolute inset-0 flex items-center justify-center bg-black/50 ${search.selectedIndex === idx ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-hover:transition-opacity group-hover:duration-150"}`}>
                                  <PlayIcon className="w-4 h-4 fill-white drop-shadow-md" />
                                </div>
                              )}

                              {/* Now Playing Indicator */}
                              {nowPlaying && isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                                  <div
                                    className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite]"
                                    style={{ height: "8px", color: accentColor }}
                                  ></div>
                                  <div
                                    className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.2s]"
                                    style={{ height: "14px", color: accentColor }}
                                  ></div>
                                  <div
                                    className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.4s]"
                                    style={{ height: "10px", color: accentColor }}
                                  ></div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                              <div
                                className={`text-[15px] font-medium truncate ${search.selectedIndex === idx ? "text-white" : nowPlaying ? "" : "text-white/90"}`}
                                style={nowPlaying ? { color: accentColor } : {}}
                              >
                                {track.title}
                              </div>
                              <div
                                className={`text-[13px] truncate ${search.selectedIndex === idx ? "text-white/70" : "text-white/40"}`}
                              >
                                {track.artist}{" "}
                                <span className="opacity-50 mx-1">·</span>{" "}
                                {track.album}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleMenuClick(e, trackKey)}
                                className={`track-menu w-7 h-7 rounded-lg flex items-center justify-center transition-all ${menuTrackId === trackKey
                                  ? "bg-white/20 text-white"
                                  : "text-white/40 hover:bg-white/10 hover:text-white/70"
                                  }`}
                                title={t("search.moreOptions")}
                              >
                                <MoreVerticalIcon className="w-4 h-4" />
                              </button>
                              <span
                                className={`
                                                text-[10px] font-bold px-1.5 py-0.5 rounded border
                                                ${search.selectedIndex === idx
                                    ? "border-white/30 text-white/80 bg-white/20"
                                    : "border-white/10 text-white/30 bg-white/5"
                                  }
                                `}
                              >
                                {search.onlineSource === "netease" ? "流媒体" : search.onlineSource === "album" ? "专辑" : "语种"}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Loading Indicator */}
                      {search.neteaseProvider.hasMore && (
                        <div className="py-3 flex items-center justify-center">
                          {search.neteaseProvider.isLoading ? (
                            <div className="flex flex-col gap-2 w-full">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <SkeletonRow key={i} />
                              ))}
                            </div>
                          ) : (
                            <div className="text-white/20 text-xs">
                              {t("search.scrollForMore")}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Album Provider UI */}
              {search.onlineSource === "album" && (
                <>
                  {search.albumHasSearched && search.albumResults.length === 0 && !search.albumIsLoading && (
                    <div className="flex flex-col items-center justify-center h-64 text-white/20">
                      <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                      <span className="text-base font-medium">{t("search.noMatchesFound")}</span>
                    </div>
                  )}
                  {search.albumIsLoading && search.albumResults.length === 0 && (
                    <div className="flex flex-col gap-1 py-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonRow key={i} />
                      ))}
                    </div>
                  )}
                  {!search.albumHasSearched && search.albumResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-white/20">
                      <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                      <span className="text-base font-medium">{t("search.searchAlbum")}</span>
                    </div>
                  )}
                  {search.albumResults.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {search.albumResults.map((album, idx) => (
                        <div
                          key={album.id}
                          className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-white/5 cursor-pointer"
                          onClick={() => playAlbumSongs(album)}
                        >
                          <div className="w-12 h-12 rounded-lg bg-white/10 overflow-hidden">
                            <SmartImage
                              src={album.picUrl?.replace("http:", "https:")}
                              alt={album.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white/90 truncate">{album.name}</div>
                            <div className="text-xs text-white/40 truncate">{album.artist.name}</div>
                          </div>
                        </div>
                      ))}
                      {search.albumIsLoading && (
                        <div className="py-3 flex items-center justify-center">
                          <div className="flex flex-col gap-2 w-full">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <SkeletonRow key={i} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Archive Provider UI */}
              {search.onlineSource === "archive" && (
                <>
                  {search.showArchiveEmpty && (
                    <div className="flex flex-col items-center justify-center h-64 text-white/20">
                      <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                      <span className="text-base font-medium">{t("search.noMatchesFound")}</span>
                    </div>
                  )}
                  {search.showArchiveLoading && (
                    <div className="flex flex-col gap-1 py-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonRow key={i} />
                      ))}
                    </div>
                  )}
                  {search.showArchiveInitial && (
                    <div className="flex flex-col items-center justify-center h-64 text-white/20">
                      <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                      <span className="text-base font-medium">{t("search.searchInternetArchive")}</span>
                    </div>
                  )}
                  {search.archiveResults.length > 0 && (
                    <>
                      {search.selectedIndex >= 0 && search.itemRefs.current[search.selectedIndex] && (
                        <div
                          className="absolute left-0 right-0 bg-white/25 backdrop-blur-md rounded-[10px] pointer-events-none transition-all duration-200 ease-out"
                          style={{
                            top: `${search.itemRefs.current[search.selectedIndex]?.offsetTop || 0}px`,
                            height: `${search.itemRefs.current[search.selectedIndex]?.offsetHeight || 56}px`,
                            zIndex: 0,
                          }}
                        />
                      )}
                      {search.archiveResults.map((track, idx) => {
                        const nowPlaying = search.isNowPlaying(track);
                        const trackKey = search.getResultKey(track);
                        return (
                          <div
                            key={trackKey}
                            ref={(el) => {
                              search.itemRefs.current[idx] = el;
                            }}
                            onClick={() => handleSelection(idx)}
                            onContextMenu={(e) => search.openContextMenu(e, track, "archive")}
                            className={`
                              relative z-10 group flex items-center gap-3 p-3 rounded-[10px] cursor-pointer
                              ${search.selectedIndex === idx ? "text-white" : "hover:bg-white/5 hover:transition-colors hover:duration-150 text-white/90"}
                            `}
                          >
                            <div className="relative w-10 h-10 rounded-[6px] bg-white/5 overflow-hidden shrink-0 shadow-sm group-hover:shadow-lg transition-shadow duration-200">
                              {track.coverUrl && (
                                <SmartImage
                                  src={track.coverUrl}
                                  alt={track.title}
                                  containerClassName="w-full h-full"
                                  imgClassName={`w-full h-full object-cover transition-opacity ${nowPlaying ? "opacity-40 blur-[1px]" : ""}`}
                                />
                              )}
                              {!nowPlaying && (
                                <div className={`absolute inset-0 flex items-center justify-center bg-black/50 ${search.selectedIndex === idx ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-hover:transition-opacity group-hover:duration-150"}`}>
                                  <PlayIcon className="w-4 h-4 fill-white drop-shadow-md" />
                                </div>
                              )}
                              {nowPlaying && isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                                  <div
                                    className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite]"
                                    style={{ height: "8px", color: accentColor }}
                                  ></div>
                                  <div
                                    className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.2s]"
                                    style={{ height: "14px", color: accentColor }}
                                  ></div>
                                  <div
                                    className="w-[2px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.4s]"
                                    style={{ height: "10px", color: accentColor }}
                                  ></div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                              <div
                                className={`text-[15px] font-medium truncate ${search.selectedIndex === idx ? "text-white" : nowPlaying ? "" : "text-white/90"}`}
                                style={nowPlaying ? { color: accentColor } : {}}
                              >
                                {track.title}
                              </div>
                              <div
                                className={`text-[13px] truncate ${search.selectedIndex === idx ? "text-white/70" : "text-white/40"}`}
                              >
                                {track.artist}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleMenuClick(e, trackKey)}
                                className={`track-menu w-7 h-7 rounded-lg flex items-center justify-center transition-all ${menuTrackId === trackKey
                                  ? "bg-white/20 text-white"
                                  : "text-white/40 hover:bg-white/10 hover:text-white/70"
                                  }`}
                                title={t("search.moreOptions")}
                              >
                                <MoreVerticalIcon className="w-4 h-4" />
                              </button>
                              <span
                                className={`
                                  text-[10px] font-bold px-1.5 py-0.5 rounded border
                                  ${search.selectedIndex === idx
                                    ? "border-white/30 text-white/80 bg-white/20"
                                    : "border-white/10 text-white/30 bg-white/5"
                                  }
                                `}
                              >
                                IA
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Loading Indicator for IA */}
                      {search.archiveProvider.isLoading && (
                        <div className="py-3 flex items-center justify-center">
                          <div className="flex flex-col gap-2 w-full">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <SkeletonRow key={i} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Context Menu Portal */}
        {
          search.contextMenu &&
          createPortal(
            <div
              className="context-menu-container fixed z-[10000] w-48 bg-[#1e1e1e]/60 backdrop-blur-[80px] saturate-150 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left p-1.5 flex flex-col gap-0.5"
              style={{ top: search.contextMenu.y, left: search.contextMenu.x }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (search.contextMenu!.type === "queue") {
                    const qItem = search.contextMenu!.track as Song;
                    const idx = queueIndexMap.get(qItem.id) ?? -1;
                    onPlayQueueIndex(idx);
                  } else if (search.contextMenu!.type === "netease") {
                    playNeteaseTrack(
                      search.contextMenu!.track as NeteaseTrackInfo,
                    );
                  } else if (search.contextMenu!.type === "archive") {
                    playArchiveTrack(
                      search.contextMenu!.track as StreamingTrack,
                    );
                  } else if (search.contextMenu!.type === "kugou") {
                    playKugouTrack(
                      search.contextMenu!.track as KugouTrack,
                    );
                  }
                  search.closeContextMenu();
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                {t("search.playNow")}
              </button>

              {search.contextMenu.type === "netease" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addNeteaseToQueue(
                      search.contextMenu!.track as NeteaseTrackInfo,
                    );
                    search.closeContextMenu();
                  }}
                  disabled={search.isResultInQueue(search.contextMenu.track)}
                  className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t("search.addToQueue")}
                </button>
              )}
              {search.contextMenu.type === "archive" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addArchiveToQueue(
                      search.contextMenu!.track as StreamingTrack,
                    );
                    search.closeContextMenu();
                  }}
                  disabled={search.isResultInQueue(search.contextMenu.track)}
                  className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t("search.addToQueue")}
                </button>
              )}
              {search.contextMenu.type === "kugou" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addKugouToQueue(
                      search.contextMenu!.track as KugouTrack,
                    );
                    search.closeContextMenu();
                  }}
                  disabled={search.isResultInQueue(search.contextMenu.track)}
                  className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t("search.addToQueue")}
                </button>
              )}

            </div>,
            document.body,
          )
        }

        {/* Track Menu Portal */}
        {
          menuTrackId && menuPosition &&
          createPortal(
            <div
              className="track-menu fixed z-[10000] w-48 bg-[#1e1e1e]/60 backdrop-blur-[80px] saturate-150 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left p-1.5 flex flex-col gap-0.5"
              style={{ top: menuPosition.y, left: menuPosition.x }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const track = activeMenuTrack;
                  if (track) {
                    if (search.onlineSource === "netease") {
                      playNeteaseTrack(track as NeteaseTrackInfo);
                    } else {
                      playArchiveTrack(track as StreamingTrack);
                    }
                    closeMenu();
                    onClose();
                  }
                }}
                className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                {t("search.playNow")}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const track = activeMenuTrack;
                  if (track) {
                    if (search.onlineSource === "netease") {
                      addNeteaseToQueue(track as NeteaseTrackInfo);
                    } else {
                      addArchiveToQueue(track as StreamingTrack);
                    }
                    closeMenu();
                  }
                }}
                disabled={!!activeMenuTrack && search.isResultInQueue(activeMenuTrack)}
                className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <NextIcon className="w-4 h-4" />
                {t("search.playNext")}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const track = activeMenuTrack;
                  if (track) {
                    if (search.onlineSource === "netease") {
                      addNeteaseToQueue(track as NeteaseTrackInfo);
                    } else {
                      addArchiveToQueue(track as StreamingTrack);
                    }
                    closeMenu();
                  }
                }}
                disabled={!!activeMenuTrack && search.isResultInQueue(activeMenuTrack)}
                className="flex items-center gap-3 px-3 py-2 text-left text-[13px] text-white/90 hover:bg-blue-500 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <PlusIcon className="w-4 h-4" />
                {t("search.addToQueue")}
              </button>
            </div>,
            document.body,
          )
        }
      </div >
    </div >,
    document.body,
  );
};

export default SearchModal;
