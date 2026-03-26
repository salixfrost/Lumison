/// <reference types="vite/client" />
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { InfoIcon, FullscreenIcon, SettingsIcon, MinimizeIcon, CloseIcon } from "../common/Icons";
import AboutDialog from "../modals/AboutDialog";
import ImportMusicDialog from "../modals/ImportMusicDialog";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import FocusSessionModal from "../modals/FocusSessionModal";
import { useI18n } from "../../contexts/I18nContext";
import { Window } from "@tauri-apps/api/window";

interface TopBarProps {
  disabled?: boolean;
  lyricsFontSize: number;
  onLyricsFontSizeChange: (size: number) => void;
  onImportUrl: (url: string) => Promise<boolean>;
  onSearchClick?: () => void;
  viewMode?: 'default' | 'lyrics';
  onViewModeChange?: (mode: 'default' | 'lyrics') => void;
  currentSong?: {
    title: string;
    artist: string;
    coverUrl?: string;
  } | null;
  isPlaying: boolean;
  audioElement?: HTMLAudioElement | null;
  focusSession?: {
    isActive: boolean;
    remainingTime: number;
    isPaused: boolean;
  } | null;
  onToggleFocusSession?: () => void;
}

// 常量提取到组件外部
const TOPBAR_HIDE_DELAY = 10000; // 10秒后自动收起
const SLIDER_CONFIG = {
  min: 24,
  max: 80,
  step: 2,
} as const;

const TopBar: React.FC<TopBarProps> = ({
  disabled,
  lyricsFontSize,
  onLyricsFontSizeChange,
  onImportUrl,
  onSearchClick,
  viewMode = 'default',
  onViewModeChange,
  currentSong,
  isPlaying,
  audioElement,
  focusSession,
  onToggleFocusSession,
}) => {
  const { t } = useI18n();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFocusSessionModal, setShowFocusSessionModal] = useState(false);
  const [isTopBarActive, setIsTopBarActive] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsContainerRef = useRef<HTMLDivElement>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearHideTimer();

    if (isSettingsOpen) {
      return;
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsTopBarActive(false);
      hideTimeoutRef.current = null;
    }, TOPBAR_HIDE_DELAY);
  }, [clearHideTimer, isSettingsOpen]);

  // 使用 useCallback 优化函数
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
        });
    } else {
      document.exitFullscreen?.()
        .then(() => setIsFullscreen(false));
    }
  }, []);

  const activateTopBar = useCallback(() => {
    setIsTopBarActive(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  const handleSearchClick = useCallback(() => {
    onSearchClick?.();
  }, [onSearchClick]);

  const handleImportUrlClick = useCallback(() => {
    setIsImportDialogOpen(true);
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      const appWindow = Window.getCurrent();
      await appWindow.minimize();
    } catch (error) {
      // Silently handle errors in development (hot reload)
      if (import.meta.env.DEV) {
        console.debug('Window minimize failed (likely hot reload):', error);
      } else if (window.electronAPI?.minimize) {
        window.electronAPI.minimize();
      }
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      const appWindow = Window.getCurrent();
      await appWindow.close();
    } catch (error) {
      // Silently handle errors in development (hot reload)
      if (import.meta.env.DEV) {
        console.debug('Window close failed (likely hot reload):', error);
      } else if (window.electronAPI?.close) {
        window.electronAPI.close();
      } else {
        window.close();
      }
    }
  }, []);

  // 监听鼠标移动，当鼠标在顶部区域时显示TopBar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 当鼠标在顶部100px区域时显示TopBar
      if (e.clientY < 100) {
        activateTopBar();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [activateTopBar]);

  const handlePointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const wasActive = isTopBarActive;

    if (!wasActive) {
      event.preventDefault();
      event.stopPropagation();
    }

    activateTopBar();
  }, [isTopBarActive, activateTopBar]);

  const handleAboutClick = useCallback(() => {
    setIsAboutOpen(true);
    setIsSettingsOpen(false);
  }, []);

  const handleToggleFocusSession = useCallback(() => {
    setShowFocusSessionModal(true);
  }, []);

  const formatFocusTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      setIsTopBarActive(true);
      scheduleAutoHide();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [scheduleAutoHide]);

  // View mode change listener - keep behavior consistent with global auto-hide
  useEffect(() => {
    setIsTopBarActive(true);
    scheduleAutoHide();
  }, [viewMode, scheduleAutoHide]);

  // Keep top bar visible while settings popup is open
  useEffect(() => {
    if (isSettingsOpen) {
      setIsTopBarActive(true);
      clearHideTimer();
      return;
    }

    if (isTopBarActive) {
      scheduleAutoHide();
    }
  }, [isSettingsOpen, isTopBarActive, clearHideTimer, scheduleAutoHide]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // 使用 useMemo 缓存样式类
  const transitionClasses = useMemo(() => {
    const shouldShow = isTopBarActive || isSettingsOpen;

    return {
      base: "transition-all duration-500 ease-out",
      mobileActive: shouldShow
        ? "opacity-100 translate-y-0 pointer-events-auto"
        : "opacity-0 -translate-y-2 pointer-events-none",
      hoverSupport: "", // 移除 group-hover，完全依赖定时器控制
    };
  }, [isTopBarActive, isSettingsOpen]);

  useEffect(() => {
    setIsTopBarActive(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  return (
    <div
      className="fixed top-0 left-0 w-full h-14 z-[60] group"
      onPointerDownCapture={handlePointerDownCapture}
      onMouseEnter={activateTopBar}
    >
      {/* Blur Background Layer */}
      <div
        className={`absolute inset-0 bg-white/5 backdrop-blur-2xl transition-all duration-500 ${(isTopBarActive || isSettingsOpen) ? "opacity-100" : "opacity-0"
          }`}
        data-tauri-drag-region
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full px-6 flex justify-between items-center pointer-events-auto">
        {/* Logo */}
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <span className="text-white/90 font-bold text-lg tracking-wider">Lumison</span>
        </div>

        {/* Search Bar */}
        <div
          className={`flex-1 max-w-xl mx-8 ${transitionClasses.base} ${transitionClasses.mobileActive} ${transitionClasses.hoverSupport}`}
          data-tauri-drag-region
        >
          <button
            onClick={handleSearchClick}
            className="w-full h-9 px-4 rounded-full bg-white/10 backdrop-blur-xl flex items-center gap-3 text-white/80 transition-all duration-300 ease-out shadow-sm group/search pointer-events-auto hover:scale-[1.02] active:scale-[0.98]"
            aria-label={t("search.placeholder")}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm truncate">{t("search.placeholder")}</span>
            <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-xs text-white/50 font-mono group-hover/search:bg-white/15 group-hover/search:text-white/60 transition-all">
              <span>⌘</span>
              <span>K</span>
            </kbd>
          </button>
        </div>

        {/* Actions */}
        <div className={`flex gap-2 ${transitionClasses.base} delay-75 ${transitionClasses.mobileActive} ${transitionClasses.hoverSupport}`}>
          {/* Settings Button */}
          <div className="relative" ref={settingsContainerRef} onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center transition-all duration-300 ease-out shadow-sm hover:scale-110 active:scale-95 ${isSettingsOpen ? "text-white bg-white/20 scale-110" : "text-white/80"
                }`}
              title={t("topBar.settings")}
              aria-label={t("topBar.settings")}
            >
              <SettingsIcon className={`w-5 h-5 transition-transform duration-500 ease-out ${isSettingsOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* Settings Popup */}
            {isSettingsOpen && (
              <div className="absolute top-full right-0 mt-3 w-72 rounded-2xl bg-black/40 backdrop-blur-2xl saturate-150 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-4 space-y-6">
                  <h3 className="text-white font-semibold mb-4 text-sm">{t("topBar.settings")}</h3>

                  {/* Lyrics Font Size */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="lyrics-font-size" className="text-white/70 text-xs">
                        {t("lyrics.fontSize")}
                      </label>
                      <span className="text-white/90 text-xs font-mono">{lyricsFontSize}px</span>
                    </div>
                    <input
                      id="lyrics-font-size"
                      type="range"
                      min={SLIDER_CONFIG.min}
                      max={SLIDER_CONFIG.max}
                      step={SLIDER_CONFIG.step}
                      value={lyricsFontSize}
                      onChange={(e) => onLyricsFontSizeChange(Number(e.target.value))}
                      className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* View Mode Toggle */}
                  {onViewModeChange && (
                    <div className="space-y-2">
                      <label className="text-white/70 text-xs">{t("viewMode.label") || "视图模式"}</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onViewModeChange('default')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${viewMode === 'default'
                            ? 'bg-white/20 text-white shadow-lg'
                            : 'bg-white/5 text-white/80'
                            }`}
                        >
                          {t("viewMode.default") || "默认"}
                        </button>
                        <button
                          onClick={() => onViewModeChange('lyrics')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${viewMode === 'lyrics'
                            ? 'bg-white/20 text-white shadow-lg'
                            : 'bg-white/5 text-white/80'
                            }`}
                        >
                          {t("viewMode.lyrics") || "歌词"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Focus Session Button */}
                  <div className="space-y-2">
                    <label className="text-white/70 text-xs">{t("focus.session") || "专注模式"}</label>
                    <button
                      onClick={handleToggleFocusSession}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] ${
                        focusSession?.isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">
                          {focusSession?.isActive
                            ? `${formatFocusTime(focusSession.remainingTime)}`
                            : t("focus.start") || "开始专注"}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Language Switcher */}
                  <LanguageSwitcher variant="settings" />

                  <div className="h-px bg-white/10 my-1" />

                  {/* About Button */}
                  <button
                    onClick={handleAboutClick}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 text-white/80 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span className="text-sm">{t("topBar.about")}</span>
                    <InfoIcon className="w-4 h-4 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Window Controls */}
          <div className="flex gap-4 ml-2" onPointerDown={(e) => e.stopPropagation()}>
            {/* Minimize Button */}
            <button
              onClick={handleMinimize}
              className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95"
              title={t('topBar.minimize')}
              aria-label={t('topBar.minimize')}
            >
              <MinimizeIcon className="w-4 h-4 transition-transform duration-200" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95"
              title={isFullscreen ? t("topBar.exitFullscreen") : t("topBar.enterFullscreen")}
              aria-label={isFullscreen ? t("topBar.exitFullscreen") : t("topBar.enterFullscreen")}
            >
              <FullscreenIcon className="w-4 h-4 transition-transform duration-300" isFullscreen={isFullscreen} />
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95"
              title={t('topBar.close')}
              aria-label={t('topBar.close')}
            >
              <CloseIcon className="w-4 h-4 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>

      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ImportMusicDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={onImportUrl}
      />
      <FocusSessionModal
        isOpen={showFocusSessionModal}
        onClose={() => setShowFocusSessionModal(false)}
        onSessionComplete={() => setShowFocusSessionModal(false)}
        isActive={focusSession?.isActive}
        remainingTime={focusSession?.remainingTime || 1500}
        initialDuration={focusSession?.remainingTime || 1500}
      />
    </div>
  );
};

export default TopBar;
