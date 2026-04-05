import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSpring, animated, useTransition, to } from "@react-spring/web";
import { formatTime } from "../../services/utils";
import { SpatialAudioEngine } from "../../services/audio/SpatialAudioEngine";
import CoverCard from "./controls/CoverCard";
import SettingsPopup from "./controls/SettingsPopup";
import {
  ShuffleIcon,
  VolumeHighFilledIcon,
  VolumeHighIcon,
  VolumeLowFilledIcon,
  VolumeLowIcon,
  VolumeMuteFilledIcon,
  VolumeMuteIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  NextIcon,
  SettingsIcon,
  FastForwardIcon,
  WaveformIcon,
  ReverbIcon,
  SpatialAudioIcon,
  QueueIcon,
} from "../common/Icons";
import { PlayMode } from "../../types";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/I18nContext";

// Cache one spatial engine per audio element to avoid duplicate MediaElementSource creation.
const spatialEngineCache = new WeakMap<HTMLAudioElement, SpatialAudioEngine>();

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number, playImmediately?: boolean, defer?: boolean) => void;
  title: string;
  artist: string;
  album?: string;
  audioRef: React.RefObject<HTMLAudioElement>;
  onNext: () => void;
  onPrev: () => void;
  playMode: PlayMode;
  onToggleMode: () => void;
  onTogglePlaylist: () => void;
  accentColor: string;
  volume: number;
  onVolumeChange: (volume: number) => void;
  speed: number;
  preservesPitch: boolean;
  onSpeedChange: (speed: number) => void;
  onTogglePreservesPitch: () => void;
  coverUrl?: string;
  coverBlurhash?: string | null;
  showVolumePopup: boolean;
  setShowVolumePopup: (show: boolean) => void;
  showSettingsPopup: boolean;
  setShowSettingsPopup: (show: boolean) => void;
  isBuffering: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  title,
  artist,
  album,
  audioRef,
  onNext,
  onPrev,
  playMode,
  onToggleMode,
  onTogglePlaylist,
  accentColor,
  volume,
  onVolumeChange,
  speed,
  preservesPitch,
  onSpeedChange,
  onTogglePreservesPitch,
  coverUrl,
  coverBlurhash,
  showVolumePopup,
  setShowVolumePopup,
  showSettingsPopup,
  setShowSettingsPopup,
  isBuffering,
}) => {
  const { theme } = useTheme();
  const { t } = useI18n();
  const settingsContainerRef = useRef<HTMLDivElement>(null);

  // Spatial Audio Engine
  const spatialEngineRef = useRef<SpatialAudioEngine | null>(null);
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(false);
  const isInitializingRef = useRef(false); // Guard against duplicate init.

  // Initialize Spatial Audio Engine
  useEffect(() => {
    console.log('[Controls] Spatial audio init effect - audioRef:', !!audioRef.current);

    const audioElement = audioRef.current;
    if (!audioElement) return;

    // Prevent double initialization in React Strict Mode
    if (spatialEngineRef.current || isInitializingRef.current) {
      console.log('[Controls] Skipping spatial audio initialization - already initialized');
      return;
    }

    isInitializingRef.current = true;

    const cachedEngine = spatialEngineCache.get(audioElement);
    if (cachedEngine) {
      console.log('[Controls] Reusing cached SpatialAudioEngine for this audio element');
      spatialEngineRef.current = cachedEngine;
      cachedEngine.setEnabled(spatialAudioEnabled);
      isInitializingRef.current = false;
      return;
    }

    let resumeContext: (() => void) | null = null;

    try {
      console.log('[Controls] Creating SpatialAudioEngine...');
      const engine = new SpatialAudioEngine();
      engine.attachToAudioElement(audioElement);
      engine.applyPreset('music');
      engine.setEnabled(false); // Start with spatial audio disabled
      spatialEngineRef.current = engine;
      spatialEngineCache.set(audioElement, engine);
      console.log('[Controls] ✓ Spatial audio engine initialized');

      // Resume audio context on user interaction
      resumeContext = () => {
        console.log('[Controls] Resuming audio context');
        engine.resume();
      };
      document.addEventListener('click', resumeContext, { once: true });
    } catch (error) {
      console.error('[Controls] Failed to initialize spatial audio:', error);
      isInitializingRef.current = false;
    }

    return () => {
      // Don't destroy on unmount in Strict Mode - just disconnect
      // The engine will be reused on remount
      if (resumeContext) {
        document.removeEventListener('click', resumeContext);
      }
      isInitializingRef.current = false;
      console.log('[Controls] Spatial audio cleanup (keeping engine for remount)');
    };
  }, [audioRef, spatialAudioEnabled]);

  // Toggle Spatial Audio
  const handleToggleSpatialAudio = () => {
    if (!spatialEngineRef.current) return;
    const newEnabled = !spatialAudioEnabled;
    setSpatialAudioEnabled(newEnabled);
    spatialEngineRef.current.setEnabled(newEnabled);
  };

  const settingsTransitions = useTransition(showSettingsPopup, {
    from: { opacity: 0, transform: "translate(-50%, 10px) scale(0.9)" },
    enter: { opacity: 1, transform: "translate(-50%, 0px) scale(1)" },
    leave: { opacity: 0, transform: "translate(-50%, 10px) scale(0.9)" },
    config: { tension: 300, friction: 20 },
  });

  // Progress bar seeking state
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  // Optimistic seek state
  const [isWaitingForSeek, setIsWaitingForSeek] = useState(false);
  const seekTargetRef = useRef(0);

  // Interpolated time for smooth progress bar
  const [interpolatedTime, setInterpolatedTime] = useState(currentTime);
  const progressLastTimeRef = useRef(Date.now());

  // Buffered time range from audio element
  const [bufferedEnd, setBufferedEnd] = useState(0);

  useEffect(() => {
    if (isSeeking) return;

    // If we are waiting for a seek to complete, check if we've reached the target
    if (isWaitingForSeek) {
      const diff = Math.abs(currentTime - seekTargetRef.current);
      // If we are close enough (within 0.5s), or if enough time has passed (handled by timeout elsewhere),
      // we consider the seek 'done' and resume normal syncing.
      // But for now, we ONLY sync if close, otherwise we keep the optimistic value.
      if (diff < 0.5) {
        setIsWaitingForSeek(false);
        setInterpolatedTime(currentTime);
      }
      // Else: do nothing, keep interpolatedTime as is (the seek target)
    } else {
      // Normal operation: sync with prop
      setInterpolatedTime(currentTime);
    }

    if (!isPlaying) return;

    let animationFrameId: number;

    const animate = () => {
      const now = Date.now();
      const dt = (now - progressLastTimeRef.current) / 1000;
      progressLastTimeRef.current = now;

      if (isPlaying && !isSeeking && !isWaitingForSeek) {
        setInterpolatedTime((prev) => {
          // Simple linear extrapolation
          const next = prev + dt * speed;
          // Clamp to duration
          return Math.min(next, duration);
        });
      } else if (isPlaying && isWaitingForSeek) {
        // If waiting for seek, we can still extrapolate from the target
        // to make it feel responsive immediately
        setInterpolatedTime((prev) => {
          const next = prev + dt * speed;
          return Math.min(next, duration);
        });
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    progressLastTimeRef.current = Date.now();
    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [currentTime, isPlaying, isSeeking, speed, duration, isWaitingForSeek]);

  // Update buffered time range from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateBuffered = () => {
      // Get the audio's actual duration (may differ from prop during loading)
      const audioDuration = audio.duration;

      if (audio.buffered.length > 0 && Number.isFinite(audioDuration) && audioDuration > 0) {
        // Find the maximum buffered end time
        let maxEnd = 0;
        for (let i = 0; i < audio.buffered.length; i++) {
          const end = audio.buffered.end(i);
          if (end > maxEnd) {
            maxEnd = end;
          }
        }
        // Clamp to duration to prevent exceeding 100%
        setBufferedEnd(Math.min(maxEnd, audioDuration));
      } else {
        setBufferedEnd(0);
      }
    };

    // Reset buffered state when audio source changes
    const handleEmptied = () => {
      setBufferedEnd(0);
    };

    // Initial update
    updateBuffered();

    // Listen to various events for buffer updates
    audio.addEventListener("progress", updateBuffered);
    audio.addEventListener("loadeddata", updateBuffered);
    audio.addEventListener("canplaythrough", updateBuffered);
    audio.addEventListener("durationchange", updateBuffered);
    audio.addEventListener("emptied", handleEmptied);
    audio.addEventListener("loadstart", handleEmptied);

    return () => {
      audio.removeEventListener("progress", updateBuffered);
      audio.removeEventListener("loadeddata", updateBuffered);
      audio.removeEventListener("canplaythrough", updateBuffered);
      audio.removeEventListener("durationchange", updateBuffered);
      audio.removeEventListener("emptied", handleEmptied);
      audio.removeEventListener("loadstart", handleEmptied);
    };
  }, [audioRef]);

  const displayTime = isSeeking ? seekTime : interpolatedTime;

  const [coverSpring, coverApi] = useSpring(() => ({
    scale: isPlaying ? 1.04 : 0.94,
    config: { tension: 300, friction: 28 },
  }));

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsContainerRef.current &&
        !settingsContainerRef.current.contains(event.target as Node)
      ) {
        setShowSettingsPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowSettingsPopup]);

  // Scroll to adjust speed
  useEffect(() => {
    if (!showSettingsPopup) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;

      const step = 0.01;
      const newSpeed = Math.min(Math.max(speed + delta * step, 0.5), 3);
      onSpeedChange(Number(newSpeed.toFixed(2)));
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [showSettingsPopup, speed, onSpeedChange]);

  const getVolumeButtonIcon = () => {
    if (volume === 0) {
      return <VolumeMuteIcon className="w-4 h-4" />;
    }
    if (volume < 0.5) {
      return <VolumeLowIcon className="w-4 h-4" />;
    }
    return <VolumeHighIcon className="w-4 h-4" />;
  };

  // Calculate buffered percentage from actual audio buffered time
  const bufferedWidthPercent = duration > 0
    ? Math.min(100, Math.max(0, (bufferedEnd / duration) * 100))
    : 0;
  const progressPercent = duration > 0
    ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
    : 0;

  return (
    <div className="w-full flex flex-col items-center justify-center gap-1 pt-3 theme-text-primary select-none relative">

      {/* Cover Section with 3D Effect */}
      <CoverCard
        coverUrl={coverUrl}
        blurhash={coverBlurhash}
        isPlaying={isPlaying}
        showSettingsPopup={showSettingsPopup}
        setShowSettingsPopup={setShowSettingsPopup}
        title={title}
        artist={artist}
        album={album}
        onTogglePlaylist={onTogglePlaylist}
        settingsPopupContent={
          settingsTransitions((style, item) =>
            item ? (
              <SettingsPopup
                style={style}
                speed={speed}
                onSpeedChange={onSpeedChange}
                playMode={playMode}
                onToggleMode={onToggleMode}
                volume={volume}
                onVolumeChange={onVolumeChange}
                getVolumeButtonIcon={getVolumeButtonIcon}
              />
            ) : null
          )
        }
      />

      {/* Progress Bar */}
      <div className="w-full max-w-[520px] flex items-center gap-3 text-sm font-medium theme-text-secondary group/bar relative">
        <span className="w-12 text-right font-mono tracking-wide">
          {formatTime(displayTime)}
        </span>

        <div className="relative flex-1 h-10 flex items-center cursor-pointer group">
          {/* Background Track */}
          <div className="absolute inset-x-0 h-1.5 theme-bg-overlay rounded-full group-hover:h-2 transition-[height] duration-200 ease-out"></div>

          {/* Buffer Progress */}
          <div
            className="absolute left-0 h-1.5 rounded-full group-hover:h-2 transition-[height] duration-200 ease-out"
            style={{
              width: bufferedWidthPercent + "%",
              backgroundColor: theme === 'light' ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)",
              transition: 'background-color 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), height 0.2s ease-out',
            }}
          ></div>

          {/* Active Progress */}
          <div
            className="absolute left-0 h-1.5 rounded-full group-hover:h-2 transition-[height] duration-200 ease-out"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: theme === 'light' ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)",
              transition: 'background-color 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), height 0.2s ease-out',
            }}
          ></div>

          {/* Input Range */}
          <input
            id="progress-range"
            type="range"
            min={0}
            max={duration || 0}
            value={displayTime}
            onMouseDown={() => setIsSeeking(true)}
            onTouchStart={() => setIsSeeking(true)}
            onChange={(e) => {
              const time = parseFloat(e.target.value);
              setSeekTime(time);
              onSeek(time, false, true); // Deferred seek
            }}
            onMouseUp={(e) => {
              const time = parseFloat((e.target as HTMLInputElement).value);
              onSeek(time, false, false); // Actual seek
              setIsSeeking(false);

              // Optimistic update
              setInterpolatedTime(time);
              seekTargetRef.current = time;
              setIsWaitingForSeek(true);

              // Safety timeout: if seek doesn't happen within 1s, give up waiting
              setTimeout(() => setIsWaitingForSeek(false), 1000);
            }}
            onTouchEnd={(e) => {
              const time = parseFloat((e.target as HTMLInputElement).value);
              onSeek(time, false, false); // Actual seek
              setIsSeeking(false);

              // Optimistic update
              setInterpolatedTime(time);
              seekTargetRef.current = time;
              setIsWaitingForSeek(true);

              // Safety timeout
              setTimeout(() => setIsWaitingForSeek(false), 1000);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>

        <span className="w-12 font-mono tracking-wide">
          {duration > 0 ? `-${formatTime(Math.max(0, duration - displayTime))}` : '0:00'}
        </span>
      </div>

      {/* Controls Row */}
      {/* Layout: [Prev] [Play] [Next] */}
      <div className="w-full max-w-[300px] mt-5 px-1">
        <div className="flex items-center justify-center w-full gap-5">
          {/* 1. Previous */}
          <button
            onClick={onPrev}
            className={`w-14 h-14 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition-all duration-150 ease-out active:scale-90 hw-accelerate`}
            style={{
              willChange: 'transform, background-color',
            }}
            aria-label={t("player.previous")}
          >
            <PrevIcon className="w-7 h-7" />
          </button>

          {/* 2. Play/Pause (Center) - Optimized Animation */}
          <button
            onClick={onPlayPause}
            className={`w-16 h-16 flex items-center justify-center rounded-full hover:scale-105 active:scale-95 transition-all duration-150 ease-out hw-accelerate ${theme === 'light'
              ? 'text-black hover:bg-white/5 active:bg-white/10'
              : 'text-white hover:bg-white/5 active:bg-white/10'
              }`}
            style={{
              willChange: 'transform, background-color',
            }}
            aria-label={isPlaying ? t("player.pause") : t("player.play")}
          >
            <div className="relative w-12 h-12 hw-accelerate">
              {/* Pause Icon */}
              <div
                className={`absolute inset-0 w-full h-full hw-accelerate ${isPlaying
                  ? "opacity-100 scale-100 rotate-0"
                  : "opacity-0 scale-50 -rotate-90"
                  }`}
                style={{
                  transition: 'opacity 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  willChange: 'opacity, transform',
                }}
              >
                <PauseIcon className="w-full h-full" />
              </div>

              <div
                className={`absolute inset-0 w-full h-full hw-accelerate ${!isPlaying
                  ? "opacity-100 scale-100 rotate-0"
                  : "opacity-0 scale-50 rotate-90"
                  }`}
                style={{
                  transition: 'opacity 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  willChange: 'opacity, transform',
                }}
              >
                <PlayIcon className="w-full h-full" />
              </div>
            </div>
          </button>

          {/* 3. Next */}
          <button
            onClick={onNext}
            className={`w-14 h-14 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition-all duration-150 ease-out active:scale-90 hw-accelerate`}
            style={{
              willChange: 'transform, background-color',
            }}
            aria-label={t("player.next")}
          >
            <NextIcon className="w-7 h-7" />
          </button>

        </div>
      </div>

    </div>
  );
};

export default React.memo(Controls);

