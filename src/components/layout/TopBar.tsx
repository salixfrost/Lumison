/// <reference types="vite/client" />
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { InfoIcon, FullscreenIcon, SettingsIcon, ThemeIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from "../common/Icons";
import AboutDialog from "../modals/AboutDialog";
import ImportMusicDialog from "../modals/ImportMusicDialog";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";
import { Window } from "@tauri-apps/api/window";
import { UpdateService } from "../../services/updateService";

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
  backgroundType: 'fluid' | 'shader1';
  onBackgroundTypeChange: (type: 'fluid' | 'shader1') => void;
  isPlaying: boolean;
}

// 常量提取到组件外部
const TOPBAR_HIDE_DELAY = 20000; // 延长到20秒，让TopBar显示更久
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
  backgroundType,
  onBackgroundTypeChange,
  isPlaying,
}) => {
  const { toggleTheme } = useTheme();
  const { t } = useI18n();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTopBarActive, setIsTopBarActive] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const [showBackgroundToast, setShowBackgroundToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setIsTopBarActive(true);

    // 在全屏模式或歌词模式下设置自动隐藏
    if (isFullscreen || viewMode === 'lyrics') {
      hideTimeoutRef.current = setTimeout(() => {
        setIsTopBarActive(false);
        hideTimeoutRef.current = null;
      }, TOPBAR_HIDE_DELAY);
    }
  }, [isFullscreen, viewMode]);

  const handleSearchClick = useCallback(() => {
    onSearchClick?.();
  }, [onSearchClick]);

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

  const handleMaximize = useCallback(async () => {
    try {
      const appWindow = Window.getCurrent();
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch (error) {
      // Silently handle errors in development (hot reload)
      if (import.meta.env.DEV) {
        console.debug('Window maximize failed (likely hot reload):', error);
      } else if (window.electronAPI?.maximize) {
        window.electronAPI.maximize();
        setIsMaximized(!isMaximized);
      } else {
        toggleFullscreen();
      }
    }
  }, [isMaximized, toggleFullscreen]);

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
    if (!isFullscreen && viewMode !== 'lyrics') return;

    const handleMouseMove = (e: MouseEvent) => {
      // 当鼠标在顶部100px区域时显示TopBar
      if (e.clientY < 100) {
        activateTopBar();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isFullscreen, viewMode, activateTopBar]);

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

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const updateInfo = await UpdateService.checkForUpdates();

      if (updateInfo.available) {
        // 显示更新通知
        alert(`发现新版本 ${updateInfo.latestVersion}\n\n${updateInfo.body || ''}`);
      } else {
        alert('当前已是最新版本');
      }
    } catch (error) {
      console.error('检查更新失败:', error);
      alert('检查更新失败，请稍后重试');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      // 进入全屏时，TopBar 默认显示
      // 退出全屏时，TopBar 常驻显示
      if (!isNowFullscreen) {
        setIsTopBarActive(true);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // View mode change listener - hide TopBar when entering lyrics mode
  useEffect(() => {
    if (viewMode === 'lyrics') {
      // 进入歌词模式时，立即隐藏TopBar
      setIsTopBarActive(false);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    } else {
      // 退出歌词模式时，显示TopBar
      setIsTopBarActive(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    }
  }, [viewMode]);

  // Check if window is maximized on mount (for Tauri)
  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const appWindow = Window.getCurrent();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        // Silently ignore in development (hot reload)
        if (!import.meta.env.DEV) {
          console.debug('Not in Tauri environment');
        }
      }
    };
    checkMaximized();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Handle background change with playing check
  const handleBackgroundChange = useCallback((type: 'fluid' | 'shader1') => {
    if (!isPlaying) {
      // Show toast notification
      setShowBackgroundToast(true);

      // Clear existing timer
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      // Hide after 2 seconds
      toastTimerRef.current = setTimeout(() => {
        setShowBackgroundToast(false);
      }, 2000);

      return;
    }

    onBackgroundTypeChange(type);
  }, [isPlaying, onBackgroundTypeChange]);

  // 使用 useMemo 缓存样式类
  const transitionClasses = useMemo(() => {
    // 非全屏且非歌词模式：始终显示
    // 全屏模式或歌词模式：根据 isTopBarActive 状态显示/隐藏
    const shouldShow = (!isFullscreen && viewMode !== 'lyrics') || isTopBarActive;

    return {
      base: "transition-all duration-500 ease-out",
      mobileActive: shouldShow
        ? "opacity-100 translate-y-0 pointer-events-auto"
        : "opacity-0 -translate-y-2 pointer-events-none",
      hoverSupport: "", // 移除 group-hover，完全依赖定时器控制
    };
  }, [isTopBarActive, isFullscreen, viewMode]);

  useEffect(() => {
    setIsTopBarActive(false);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 w-full h-14 z-[60] group"
      onPointerDownCapture={handlePointerDownCapture}
      onMouseEnter={activateTopBar}
    >
      {/* Blur Background Layer */}
      <div
        className={`absolute inset-0 bg-white/5 backdrop-blur-2xl transition-all duration-500 ${(!isFullscreen && viewMode !== 'lyrics') || isTopBarActive ? "opacity-100" : "opacity-0"
          }`}
        data-tauri-drag-region
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full px-6 flex justify-between items-center pointer-events-auto">
        {/* Search Bar */}
        <div
          className={`flex-1 max-w-xl mx-8 ${transitionClasses.base} ${transitionClasses.mobileActive} ${transitionClasses.hoverSupport}`}
          data-tauri-drag-region
        >
          <button
            onClick={handleSearchClick}
            className="topbar-btn topbar-btn-fill-x w-full h-9 px-4 rounded-full bg-white/10 backdrop-blur-xl flex items-center gap-3 text-white/80 transition-all duration-300 ease-out shadow-sm group/search pointer-events-auto hover:scale-[1.02] active:scale-[0.98]"
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
              className={`topbar-btn topbar-btn-fill-y w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center transition-all duration-300 ease-out shadow-sm hover:scale-110 active:scale-95 ${isSettingsOpen ? "text-white bg-white/20 scale-110" : "text-white/80"
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
                          className={`topbar-btn topbar-btn-fill-x flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${viewMode === 'default'
                            ? 'bg-white/20 text-white border border-white/20 shadow-lg'
                            : 'bg-white/5 text-white/80 border border-white/10'
                            }`}
                        >
                          {t("viewMode.default") || "默认"}
                        </button>
                        <button
                          onClick={() => onViewModeChange('lyrics')}
                          className={`topbar-btn topbar-btn-fill-y flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${viewMode === 'lyrics'
                            ? 'bg-white/20 text-white border border-white/20 shadow-lg'
                            : 'bg-white/5 text-white/80 border border-white/10'
                            }`}
                        >
                          {t("viewMode.lyrics") || "歌词"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Language Switcher */}
                  <LanguageSwitcher variant="settings" />

                  <div className="h-px bg-white/10 my-1" />

                  {/* Background Selector */}
                  <div className="space-y-2">
                    <label className="text-white/70 text-xs">{t("background.label") || "背景效果"}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleBackgroundChange('fluid')}
                        disabled={!isPlaying}
                        className={`topbar-btn topbar-btn-fill-x px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ease-out ${isPlaying ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'
                          } ${backgroundType === 'fluid'
                            ? 'bg-white/20 text-white border border-white/20 shadow-lg'
                            : 'bg-white/5 text-white/80 border border-white/10'
                          }`}
                        aria-pressed={backgroundType === 'fluid'}
                      >
                        {t("background.fluid") || "流体"}
                      </button>
                      <button
                        onClick={() => handleBackgroundChange('shader1')}
                        disabled={!isPlaying}
                        className={`topbar-btn topbar-btn-fill-y px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ease-out ${isPlaying ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'
                          } ${backgroundType === 'shader1'
                            ? 'bg-white/20 text-white border border-white/20 shadow-lg'
                            : 'bg-white/5 text-white/80 border border-white/10'
                          }`}
                        aria-pressed={backgroundType === 'shader1'}
                      >
                        {t("background.shader1") || "熔化"}
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-white/10 my-1" />

                  {/* Check Update Button */}
                  <button
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                    className="topbar-btn topbar-btn-fill-x w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-sm">{t("topBar.checkUpdate") || "检查更新"}</span>
                    {isCheckingUpdate ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>

                  {/* About Button */}
                  <button
                    onClick={handleAboutClick}
                    className="topbar-btn topbar-btn-fill-y w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span className="text-sm">{t("topBar.about")}</span>
                    <InfoIcon className="w-4 h-4 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            onPointerDown={(e) => e.stopPropagation()}
            className="topbar-btn topbar-btn-fill-x w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out shadow-sm hover:scale-110 active:scale-95"
            title={isFullscreen ? t("topBar.exitFullscreen") : t("topBar.enterFullscreen")}
            aria-label={isFullscreen ? t("topBar.exitFullscreen") : t("topBar.enterFullscreen")}
          >
            <FullscreenIcon className="w-5 h-5 transition-transform duration-300" isFullscreen={isFullscreen} />
          </button>

          {/* Window Controls */}
          <div className="flex gap-2 ml-2" onPointerDown={(e) => e.stopPropagation()}>
            {/* Minimize Button */}
            <button
              onClick={handleMinimize}
              className="topbar-btn topbar-btn-fill-y w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95"
              title={t('topBar.minimize')}
              aria-label={t('topBar.minimize')}
            >
              <MinimizeIcon className="w-4 h-4 transition-transform duration-200" />
            </button>

            {/* Maximize/Restore Button */}
            <button
              onClick={handleMaximize}
              className="topbar-btn topbar-btn-fill-x w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95"
              title={isMaximized ? t('topBar.restore') : t('topBar.maximize')}
              aria-label={isMaximized ? t('topBar.restore') : t('topBar.maximize')}
            >
              {isMaximized ? (
                <RestoreIcon className="w-4 h-4 transition-all duration-300" />
              ) : (
                <MaximizeIcon className="w-4 h-4 transition-all duration-300" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="topbar-btn topbar-btn-fill-y w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/80 transition-all duration-300 ease-out hover:scale-110 active:scale-95"
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

      {/* Background Change Toast */}
      {showBackgroundToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="px-6 py-3 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 shadow-2xl">
            <p className="text-white/90 text-sm font-medium">
              {t("background.playMusicToChange") || "播放音乐后才能切换背景效果"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
