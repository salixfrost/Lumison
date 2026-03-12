import React, { Suspense, lazy, useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useToast } from "./hooks/useToast";
import ShaderBackground from "./components/layout/ShaderBackground";
import FluidBackground from "./components/layout/FluidBackground";
import Controls from "./components/player/Controls";
import LyricsView from "./components/player/LyricsView";
import KeyboardShortcuts from "./components/ui/KeyboardShortcuts";
import TopBar from "./components/layout/TopBar";
import SpeedIndicator from "./components/common/SpeedIndicator";
import { usePlaylist } from "./hooks/usePlaylist";
import { usePlayer } from "./hooks/usePlayer";
import { keyboardRegistry } from "./services/ui/keyboardRegistry";
import MediaSessionController from "./components/player/MediaSessionController";
import { useTheme } from "./contexts/ThemeContext";
import { useI18n } from "./contexts/I18nContext";
import { getSupportedAudioFormats } from "./services/utils";
import { usePerformanceOptimization, useOptimizedAudio } from "./hooks/usePerformanceOptimization";
import { UpdateService } from "./services/updateService";
import { getPlatformConfig } from "./services/music/multiPlatformLyrics";
import { PlayState, Song } from "./types";
import { useWebViewOptimization, useOptimizedBackdropFilter } from "./hooks/useWebViewOptimization";
import { buildSongLookupIndexMap, getSongLookupKey } from "./utils/songLookup";

const importPlaylistPanel = () => import("./components/player/PlaylistPanel");
const importSearchModal = () => import("./components/modals/SearchModal");
const importUpdateNotification = () => import("./components/modals/UpdateNotification");
const importAlbumMode = () => import("./components/ui/AlbumMode");

const LazyPlaylistPanel = lazy(importPlaylistPanel);
const LazySearchModal = lazy(importSearchModal);
const LazyUpdateNotification = lazy(importUpdateNotification);
const LazyAlbumMode = lazy(importAlbumMode);

const App: React.FC = () => {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { t } = useI18n();

  // Performance monitoring
  usePerformanceOptimization();
  useWebViewOptimization();
  useOptimizedBackdropFilter(true);

  // Log supported audio formats and platform config on app start
  useEffect(() => {
    // Log supported audio formats
    const formats = getSupportedAudioFormats();
    console.log('🎵 Supported Audio Formats:');
    Object.entries(formats).forEach(([format, supported]) => {
      console.log(`   ${supported ? '✅' : '❌'} ${format.toUpperCase()}`);
    });

    // Log lyrics platform configuration
    const platformConfig = getPlatformConfig();
    console.log('\n🎵 Lyrics Platform Configuration:');
    console.log('   Primary sources (parallel search):');
    console.log(`     ${platformConfig.netease ? '✅' : '❌'} Netease Music (网易云音乐) - Word-by-word lyrics`);
    console.log(`     ${platformConfig.thirdParty ? '✅' : '❌'} Third-party APIs (7 sources)`);
    console.log('       • LrcLib, LRCAPI, Lyrics.ovh, Syair.info');
    console.log('       • ChartLyrics, Musixmatch, OpenLyrics');
  }, []);

  // Check for updates on app start (silent check)
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const updateInfo = await UpdateService.checkForUpdates();
        if (updateInfo.available && updateInfo.latestVersion) {
          // Wait 3 seconds before showing notification (don't interrupt startup)
          setTimeout(() => {
            setUpdateVersion(updateInfo.latestVersion!);
            setUpdateAvailable(true);
          }, 3000);
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    };

    checkUpdates();
  }, []);

  const playlist = usePlaylist();
  const player = usePlayer({
    queue: playlist.queue,
    originalQueue: playlist.originalQueue,
    updateSongInQueue: playlist.updateSongInQueue,
    setQueue: playlist.setQueue,
    setOriginalQueue: playlist.setOriginalQueue,
  });

  const {
    audioRef,
    currentSong,
    playState,
    currentTime,
    duration,
    playMode,
    matchStatus,
    accentColor,
    togglePlay,
    toggleMode,
    handleSeek,
    playNext,
    playPrev,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlaylistAddition,
    playIndex,
    addSongAndPlay,
    handleAudioEnded,
    play,
    pause,
    resolvedAudioSrc,
    isBuffering,
  } = player;

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hasOpenedPlaylist, setHasOpenedPlaylist] = useState(false);
  const [hasOpenedSearch, setHasOpenedSearch] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [volume, setVolume] = useState(1);
  const [showSpeedIndicator, setShowSpeedIndicator] = useState(false);
  const speedIndicatorTimerRef = useRef<number | null>(null);
  const hasPrefetchedLazyChunksRef = useRef(false);

  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [activePanel, setActivePanel] = useState<"controls" | "lyrics">(
    "controls",
  );
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const mobileViewportRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(() => {
    if (typeof window === "undefined") return 0;
    return window.innerWidth;
  });
  const [lyricsFontSize, setLyricsFontSize] = useState(46);

  // Background type state
  const [backgroundType, setBackgroundType] = useState<'fluid' | 'shader1'>('fluid');

  // View mode state - 'default' or 'lyrics'
  const [viewMode, setViewMode] = useState<'default' | 'lyrics'>('default');
  const [hasEnteredLyricsMode, setHasEnteredLyricsMode] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Exit button visibility state for lyrics mode
  const [showExitButton, setShowExitButton] = useState(true);
  const exitButtonTimerRef = useRef<number | null>(null);

  // Track if user has ever played (to keep layout split after first play)
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const queueLookupIndexMap = useMemo(
    () => buildSongLookupIndexMap(playlist.queue),
    [playlist.queue],
  );
  const hasLoadedSong = Boolean(currentSong) || playlist.queue.length > 0;

  const preloadPlaylistPanel = useCallback(() => {
    void importPlaylistPanel();
  }, []);

  const preloadSearchModal = useCallback(() => {
    void importSearchModal();
  }, []);

  const preloadUpdateNotification = useCallback(() => {
    void importUpdateNotification();
  }, []);

  const preloadAlbumMode = useCallback(() => {
    void importAlbumMode();
  }, []);

  const handleOpenSearch = useCallback(() => {
    preloadSearchModal();
    setShowSearch(true);
  }, [preloadSearchModal]);

  const handleOpenPlaylist = useCallback(() => {
    preloadPlaylistPanel();
    setShowPlaylist(true);
  }, [preloadPlaylistPanel]);

  const handleTogglePlaylist = useCallback(() => {
    preloadPlaylistPanel();
    setShowPlaylist((prev) => !prev);
  }, [preloadPlaylistPanel]);

  const handleViewModeChange = useCallback((mode: 'default' | 'lyrics') => {
    if (mode === 'lyrics') {
      preloadAlbumMode();
    }
    setViewMode(mode);
  }, [preloadAlbumMode]);

  // Update hasEverPlayed when playing starts with lyrics
  useEffect(() => {
    if (playState === PlayState.PLAYING && currentSong?.lyrics && currentSong.lyrics.length > 0) {
      setHasEverPlayed(true);
    }
  }, [playState, currentSong?.lyrics]);

  // Optimize audio element
  useOptimizedAudio(audioRef);

  // Speed change handler with indicator
  const handleSpeedChange = (newSpeed: number) => {
    player.setSpeed(newSpeed);

    // Show speed indicator
    setShowSpeedIndicator(true);

    // Clear existing timer
    if (speedIndicatorTimerRef.current) {
      window.clearTimeout(speedIndicatorTimerRef.current);
    }

    // Hide after 1.5 seconds
    speedIndicatorTimerRef.current = window.setTimeout(() => {
      setShowSpeedIndicator(false);
    }, 1500);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (speedIndicatorTimerRef.current) {
        window.clearTimeout(speedIndicatorTimerRef.current);
      }
      if (exitButtonTimerRef.current) {
        window.clearTimeout(exitButtonTimerRef.current);
      }
    };
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle exit button auto-hide in lyrics mode
  useEffect(() => {
    if (viewMode !== 'lyrics') {
      // Reset when not in lyrics mode
      setShowExitButton(true);
      if (exitButtonTimerRef.current) {
        window.clearTimeout(exitButtonTimerRef.current);
        exitButtonTimerRef.current = null;
      }
      return;
    }

    // Show button and start timer when entering lyrics mode
    setShowExitButton(true);

    const resetTimer = () => {
      if (exitButtonTimerRef.current) {
        window.clearTimeout(exitButtonTimerRef.current);
      }

      setShowExitButton(true);

      exitButtonTimerRef.current = window.setTimeout(() => {
        setShowExitButton(false);
      }, 5000);
    };

    // Initial timer
    resetTimer();

    // Show button on mouse move
    const handleMouseMove = () => {
      resetTimer();
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (exitButtonTimerRef.current) {
        window.clearTimeout(exitButtonTimerRef.current);
      }
    };
  }, [viewMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioRef]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const runPrefetch = () => {
      if (hasPrefetchedLazyChunksRef.current) {
        return;
      }

      hasPrefetchedLazyChunksRef.current = true;
      preloadSearchModal();
      preloadPlaylistPanel();
      preloadAlbumMode();
      preloadUpdateNotification();
    };

    const onFirstInteraction = () => {
      runPrefetch();
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
    };

    window.addEventListener("pointerdown", onFirstInteraction, { passive: true });
    window.addEventListener("keydown", onFirstInteraction);
    window.addEventListener("touchstart", onFirstInteraction, { passive: true });

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => {
        runPrefetch();
      }, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(() => {
        runPrefetch();
      }, 1500);
    }

    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);

      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [preloadAlbumMode, preloadPlaylistPanel, preloadSearchModal, preloadUpdateNotification]);

  useEffect(() => {
    if (showPlaylist) {
      setHasOpenedPlaylist(true);
    }
  }, [showPlaylist]);

  useEffect(() => {
    if (showSearch) {
      setHasOpenedSearch(true);
    }
  }, [showSearch]);

  useEffect(() => {
    if (viewMode === "lyrics") {
      setHasEnteredLyricsMode(true);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 1024px)");
    const updateLayout = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileLayout(event.matches);
    };
    updateLayout(query);
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setActivePanel("controls");
      setTouchStartX(null);
      setDragOffsetX(0);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateWidth = () => {
      setPaneWidth(window.innerWidth);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    window.visualViewport?.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
      window.visualViewport?.removeEventListener("resize", updateWidth);
    };
  }, [isMobileLayout]);

  // Global Keyboard Registry Initialization
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboardRegistry.handle(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Global Search Shortcut (Registered directly via useEffect for simplicity, or could use useKeyboardScope with high priority)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        preloadSearchModal();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preloadSearchModal]);

  // Handle song changes (auto-play, etc)
  useEffect(() => {
    if (!currentSong || !audioRef.current) return;
  }, [currentSong, audioRef]);

  const handleFileChange = async (files: FileList) => {
    const wasEmpty = playlist.queue.length === 0;
    const addedSongs = await playlist.addLocalFiles(files);
    if (addedSongs.length > 0) {
      setTimeout(() => {
        handlePlaylistAddition(addedSongs, wasEmpty);
      }, 0);
    }
  };

  const handleImportUrl = async (input: string): Promise<boolean> => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    const wasEmpty = playlist.queue.length === 0;
    const result = await playlist.importFromUrl(trimmed);
    if (!result.success) {
      toast.error(result.message ?? "Failed to load songs from URL");
      return false;
    }
    if (result.songs.length > 0) {
      setTimeout(() => {
        handlePlaylistAddition(result.songs, wasEmpty);
      }, 0);
      toast.success(`Successfully imported ${result.songs.length} songs`);
      return true;
    }
    return false;
  };

  const handleImportAndPlay = (song: Song) => {
    const existingIndex = queueLookupIndexMap.get(getSongLookupKey(song)) ?? -1;

    if (existingIndex !== -1) {
      // Song already in queue, just play it
      playIndex(existingIndex);
    } else {
      // Add and play atomically - no race conditions!
      addSongAndPlay(song);
    }
  };

  const handleAddToQueue = (song: Song) => {
    if (queueLookupIndexMap.has(getSongLookupKey(song))) {
      return;
    }

    playlist.setQueue((prev) => [...prev, song]);
    playlist.setOriginalQueue((prev) => [...prev, song]);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobileLayout) return;
    setTouchStartX(event.touches[0]?.clientX ?? null);
    setDragOffsetX(0);
    setIsDragging(true);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobileLayout || touchStartX === null) return;
    const currentX = event.touches[0]?.clientX;
    if (currentX === undefined) return;
    const deltaX = currentX - touchStartX;
    const containerWidth = event.currentTarget.getBoundingClientRect().width;
    const limitedDelta = Math.max(
      Math.min(deltaX, containerWidth),
      -containerWidth,
    );
    setDragOffsetX(limitedDelta);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobileLayout || touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) {
      setTouchStartX(null);
      setDragOffsetX(0);
      setIsDragging(false);
      return;
    }
    const deltaX = endX - touchStartX;
    const threshold = 60;
    if (deltaX > threshold) {
      setActivePanel("controls");
    } else if (deltaX < -threshold) {
      setActivePanel("lyrics");
    }
    setTouchStartX(null);
    setDragOffsetX(0);
    setIsDragging(false);
  };

  const handleTouchCancel = () => {
    if (isMobileLayout) {
      setTouchStartX(null);
      setDragOffsetX(0);
      setIsDragging(false);
    }
  };

  const toggleIndicator = () => {
    setActivePanel((prev) => (prev === "controls" ? "lyrics" : "controls"));
    setDragOffsetX(0);
    setIsDragging(false);
  };

  // Memoize controls section to prevent unnecessary re-renders
  const controlsSection = useMemo(() => {
    if (!hasLoadedSong) {
      return null;
    }

    return (
      <div className={`flex flex-col items-center justify-center w-full h-full z-30 relative ${hasEverPlayed ? 'pt-0' : 'pt-32'}`}>
        <div className="relative flex flex-col items-center gap-8 w-full max-w-[360px] px-4">
          <Controls
            isPlaying={playState === PlayState.PLAYING}
            onPlayPause={togglePlay}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            title={currentSong?.title || t("player.welcomeTitle")}
            artist={currentSong?.artist || t("player.selectSong")}
            album={currentSong?.album}
            audioRef={audioRef}
            onNext={playNext}
            onPrev={playPrev}
            playMode={playMode}
            onToggleMode={toggleMode}
            onTogglePlaylist={handleOpenPlaylist}
            accentColor={accentColor}
            volume={volume}
            onVolumeChange={setVolume}
            speed={player.speed}
            preservesPitch={player.preservesPitch}
            onSpeedChange={handleSpeedChange}
            onTogglePreservesPitch={player.togglePreservesPitch}
            coverUrl={currentSong?.coverUrl}
            isBuffering={isBuffering}
            showVolumePopup={showVolumePopup}
            setShowVolumePopup={setShowVolumePopup}
            showSettingsPopup={showSettingsPopup}
            setShowSettingsPopup={setShowSettingsPopup}
          />

          {/* Floating Playlist Panel */}
          {(hasOpenedPlaylist || showPlaylist) && (
            <Suspense fallback={null}>
              <LazyPlaylistPanel
                isOpen={showPlaylist}
                onClose={() => setShowPlaylist(false)}
                queue={playlist.queue}
                currentSongId={currentSong?.id}
                onPlay={playIndex}
                onImport={handleImportUrl}
                onRemove={playlist.removeSongs}
                accentColor={accentColor}
                onFilesSelected={handleFileChange}
                onSearchClick={handleOpenSearch}
              />
            </Suspense>
          )}
        </div>
      </div>
    );
  }, [hasLoadedSong, playState, currentTime, duration, currentSong?.title, currentSong?.artist, currentSong?.id, currentSong?.coverUrl, t, playNext, playPrev, playMode, accentColor, volume, player.speed, player.preservesPitch, isBuffering, showVolumePopup, showSettingsPopup, showPlaylist, playlist.queue, playlist.removeSongs, hasEverPlayed, handleOpenPlaylist, handleOpenSearch]);

  const lyricsVersion = currentSong?.lyrics ? currentSong.lyrics.length : 0;
  const lyricsKey = currentSong ? `${currentSong.id}-${lyricsVersion}` : "no-song";

  // Memoize lyrics section to prevent unnecessary re-renders
  const lyricsSection = useMemo(() => {
    if (!hasLoadedSong) {
      return null;
    }

    return (
      <div className="w-full h-full relative z-20 flex flex-col justify-center px-4 lg:pl-4">
        <LyricsView
          key={lyricsKey}
          lyrics={currentSong?.lyrics || []}
          audioRef={audioRef}
          isPlaying={playState === PlayState.PLAYING}
          currentTime={currentTime}
          onSeekRequest={handleSeek}
          matchStatus={matchStatus}
          fontSize={lyricsFontSize}
          accentColor={accentColor}
        />
      </div>
    );
  }, [hasLoadedSong, lyricsKey, currentSong?.lyrics, playState, currentTime, matchStatus, lyricsFontSize, accentColor]);

  const fallbackWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  const effectivePaneWidth = paneWidth || fallbackWidth;
  const baseOffset = activePanel === "lyrics" ? -effectivePaneWidth : 0;
  const mobileTranslate = baseOffset + dragOffsetX;

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden theme-transition bg-black">
      {backgroundType === 'fluid' && (
        <FluidBackground
          key={isMobileLayout ? "mobile" : "desktop"}
          colors={currentSong?.colors || []}
          coverUrl={currentSong?.coverUrl}
          isPlaying={playState === PlayState.PLAYING}
          isMobileLayout={isMobileLayout}
          theme={theme}
        />
      )}
      {backgroundType === 'shader1' && (
        <ShaderBackground
          isPlaying={playState === PlayState.PLAYING}
          colors={currentSong?.colors || []}
        />
      )}

      <audio
        ref={audioRef}
        src={resolvedAudioSrc ?? currentSong?.fileUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        crossOrigin="anonymous"
      />

      <KeyboardShortcuts
        isPlaying={playState === PlayState.PLAYING}
        onPlayPause={togglePlay}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={handleSeek}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onVolumeChange={setVolume}
        onToggleMode={toggleMode}
        onTogglePlaylist={handleTogglePlaylist}
        speed={player.speed}
        onSpeedChange={handleSpeedChange}
        onToggleVolumeDialog={() => setShowVolumePopup((prev) => !prev)}
        onToggleSpeedDialog={() => setShowSettingsPopup((prev) => !prev)}
      />

      <SpeedIndicator speed={player.speed} show={showSpeedIndicator} />

      {/* Update Notification */}
      {updateAvailable && (
        <Suspense fallback={null}>
          <LazyUpdateNotification
            version={updateVersion}
            onClose={() => setUpdateAvailable(false)}
            onUpdate={() => { }}
          />
        </Suspense>
      )}

      <MediaSessionController
        currentSong={currentSong ?? null}
        playState={playState}
        currentTime={currentTime}
        duration={duration}
        playbackRate={player.speed}
        onPlay={play}
        onPause={pause}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={handleSeek}
      />

      {/* Top Bar - Hidden in lyrics mode and fullscreen */}
      {viewMode !== 'lyrics' && !isFullscreen && (
        <TopBar
          lyricsFontSize={lyricsFontSize}
          onLyricsFontSizeChange={setLyricsFontSize}
          onImportUrl={handleImportUrl}
          onSearchClick={handleOpenSearch}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          currentSong={currentSong ? {
            title: currentSong.title,
            artist: currentSong.artist,
            coverUrl: currentSong.coverUrl,
          } : null}
          backgroundType={backgroundType}
          onBackgroundTypeChange={setBackgroundType}
          isPlaying={playState === PlayState.PLAYING}
        />
      )}

      {/* Exit Lyrics Mode Button - Only shown in lyrics mode */}
      {viewMode === 'lyrics' && (
        <button
          onClick={() => setViewMode('default')}
          className={`fixed top-6 left-6 z-50 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-all duration-500 group ${showExitButton ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          aria-label="Exit lyrics mode"
        >
          <svg
            className="w-6 h-6 transition-transform duration-200 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Search Modal - Always rendered to preserve state, visibility handled internally */}
      {(hasOpenedSearch || showSearch) && (
        <Suspense fallback={null}>
          <LazySearchModal
            isOpen={showSearch}
            onClose={() => setShowSearch(false)}
            queue={playlist.queue}
            onPlayQueueIndex={playIndex}
            onImportAndPlay={handleImportAndPlay}
            onAddToQueue={handleAddToQueue}
            currentSong={currentSong}
            isPlaying={playState === PlayState.PLAYING}
            accentColor={accentColor}
          />
        </Suspense>
      )}

      {/* Main Content Split */}
      {viewMode === 'lyrics' ? (
        // Lyrics Mode - Full screen centered lyrics view
        <div className="flex-1 w-full h-full">
          {(hasEnteredLyricsMode || viewMode === "lyrics") && (
            <Suspense fallback={null}>
              <LazyAlbumMode
                coverUrl={currentSong?.coverUrl}
                title={currentSong?.title || t("player.welcomeTitle")}
                artist={currentSong?.artist || t("player.selectSong")}
                isPlaying={playState === PlayState.PLAYING}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
                accentColor={accentColor}
                lyrics={currentSong?.lyrics}
                showLyrics={true}
              />
            </Suspense>
          )}
        </div>
      ) : isMobileLayout ? (
        <div className="flex-1 relative w-full h-full">
          <div
            ref={mobileViewportRef}
            className="w-full h-full overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
          >
            <div
              className={`flex h-full ${isDragging ? "transition-none" : "transition-transform duration-300"}`}
              style={{
                width: `${effectivePaneWidth * 2}px`,
                transform: `translateX(${mobileTranslate}px)`,
              }}
            >
              <div
                className="flex-none h-full"
                style={{ width: effectivePaneWidth }}
              >
                {controlsSection}
              </div>
              <div
                className="flex-none h-full"
                style={{ width: effectivePaneWidth }}
              >
                {lyricsSection}
              </div>
            </div>
          </div>
          {hasLoadedSong && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <button
                type="button"
                onClick={toggleIndicator}
                className="relative flex h-4 w-28 items-center justify-center rounded-full bg-white/10 backdrop-blur-2xl border border-white/15 transition-transform duration-200 active:scale-105"
                style={{
                  transform: `translateX(${isDragging ? dragOffsetX * 0.04 : 0}px)`,
                }}
              >
                <span
                  className={`absolute inset-0 rounded-full bg-white/25 backdrop-blur-[30px] transition-opacity duration-200 ${activePanel === "controls" ? "opacity-90" : "opacity-60"
                    }`}
                />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Desktop Layout - Center when not playing, split when playing
        <div className="flex-1 relative w-full h-full overflow-hidden">
          {/* Controls Section - Centered or left side */}
          <div
            className={`absolute inset-0 flex items-center justify-center ${hasEverPlayed ? '' : 'transition-all duration-1000 ease-in-out'
              } ${hasEverPlayed
                ? 'lg:w-1/2 lg:justify-center'
                : 'w-full'
              }`}
            style={{
              willChange: hasEverPlayed ? 'auto' : 'width',
            }}
          >
            {controlsSection}
          </div>

          {/* Lyrics Section - Slides in from right */}
          <div
            className={`absolute inset-y-0 right-0 w-1/2 ${hasEverPlayed ? '' : 'transition-all duration-1000'
              } ${hasEverPlayed
                ? 'translate-x-0 opacity-100'
                : 'translate-x-full opacity-0 pointer-events-none'
              }`}
            style={{
              willChange: hasEverPlayed ? 'auto' : 'transform, opacity',
              transitionTimingFunction: hasEverPlayed ? 'auto' : 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {lyricsSection}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
