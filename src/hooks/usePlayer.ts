import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Song, PlayState, PlayMode } from "../types";
import { extractColors, shuffleArray } from "../services/utils";
import { parseLyrics } from "../services/lyrics";
import {
  fetchLyricsById,
  searchAndMatchLyrics,
} from "../services/music/lyricsService";
import { audioResourceCache } from "../services/cache";
import { buildSongIdIndexMap, buildSongIdMap } from "../utils/songLookup";
import {
  createNeteaseLyricsCacheKey,
  createSearchLyricsCacheKey,
  getCachedMatchedLyrics,
  seedCachedMatchedLyrics,
} from "../services/lyrics/matchCache";

type MatchStatus = "idle" | "matching" | "success" | "failed";
type LyricsMatchPayload = {
  lrc: string;
  yrc?: string;
  tLrc?: string;
  metadata: string[];
};

interface UsePlayerParams {
  queue: Song[];
  originalQueue: Song[];
  updateSongInQueue: (id: string, updates: Partial<Song>) => void;
  setQueue: Dispatch<SetStateAction<Song[]>>;
  setOriginalQueue: Dispatch<SetStateAction<Song[]>>;
}

const MATCH_TIMEOUT_MS = 15000; // 15s total — enough for 2-3 endpoint attempts at 5s each

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Lyrics request timed out"));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export const usePlayer = ({
  queue,
  originalQueue,
  updateSongInQueue,
  setQueue,
  setOriginalQueue,
}: UsePlayerParams) => {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playState, setPlayState] = useState<PlayState>(PlayState.PAUSED);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>(PlayMode.LOOP_ALL);
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("idle");
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);
  
  // 缓存索引映射 - O(1) 查找
  const indexMapRef = useRef<Map<string, number>>(new Map());
  const originalIndexMapRef = useRef<Map<string, number>>(new Map());
  
  // 维护 shuffle 顺序的索引数组，而非重建队列
  const shuffleOrderRef = useRef<number[]>([]);
  const currentShufflePositionRef = useRef(-1);

  // 构建索引映射 - 依赖 queue 和 originalQueue 变化时重建
  useEffect(() => {
    const map = new Map<string, number>();
    queue.forEach((song, index) => {
      map.set(song.id, index);
    });
    indexMapRef.current = map;
  }, [queue]);

  useEffect(() => {
    const map = new Map<string, number>();
    originalQueue.forEach((song, index) => {
      map.set(song.id, index);
    });
    originalIndexMapRef.current = map;
  }, [originalQueue]);

  const pauseAndResetCurrentAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }, []);

  const tryPlayAudio = useCallback((errorPrefix: string = "Play failed") => {
    if (!audioRef.current) return;
    audioRef.current
      .play()
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error(errorPrefix, err);
      });
  }, []);

  const switchToIndexAndPlay = useCallback(
    (index: number) => {
      pauseAndResetCurrentAudio();
      setCurrentIndex(index);
      setPlayState(PlayState.PLAYING);
      setMatchStatus("idle");
    },
    [pauseAndResetCurrentAudio],
  );

  const currentSong = queue[currentIndex] ?? null;
  const accentColor = currentSong?.colors?.[0] || "#a855f7";

  const reorderForShuffle = useCallback(() => {
    if (originalQueue.length === 0) return;
    
    // 生成 shuffle 顺序索引数组
    const indices = originalQueue.map((_, i) => i);
    const shuffled = shuffleArray(indices);
    
    shuffleOrderRef.current = shuffled;
    
    // 找到当前歌曲在 originalQueue 中的位置
    if (currentSong) {
      const currentOriginalIndex = originalIndexMapRef.current.get(currentSong.id);
      if (currentOriginalIndex !== undefined) {
        const shufflePos = shuffled.indexOf(currentOriginalIndex);
        currentShufflePositionRef.current = shufflePos;
      }
    } else {
      currentShufflePositionRef.current = 0;
    }
  }, [originalQueue, currentSong]);

  const toggleMode = useCallback((mode?: PlayMode) => {
    let nextMode: PlayMode;
    
    if (mode !== undefined) {
      nextMode = mode;
    } else {
      if (playMode === PlayMode.LOOP_ALL) nextMode = PlayMode.LOOP_ONE;
      else if (playMode === PlayMode.LOOP_ONE) nextMode = PlayMode.SHUFFLE;
      else nextMode = PlayMode.LOOP_ALL;
    }

    setPlayMode(nextMode);
    setMatchStatus("idle");

    if (nextMode === PlayMode.SHUFFLE) {
      reorderForShuffle();
    } else {
      // 退出 shuffle 模式时，通过索引映射恢复位置
      if (currentSong) {
        const idx = originalIndexMapRef.current.get(currentSong.id) ?? 0;
        setCurrentIndex(idx);
      } else {
        setCurrentIndex(originalQueue.length > 0 ? 0 : -1);
      }
    }
  }, [playMode, reorderForShuffle, originalQueue, currentSong]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playState === PlayState.PLAYING) {
      audioRef.current.pause();
      setPlayState(PlayState.PAUSED);
    } else {
      const duration = audioRef.current.duration || 0;
      const isAtEnd =
        duration > 0 && audioRef.current.currentTime >= duration - 0.01;
      if (isAtEnd) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      tryPlayAudio();
      setPlayState(PlayState.PLAYING);
    }
  }, [playState, tryPlayAudio]);

  const play = useCallback(() => {
    tryPlayAudio();
    setPlayState(PlayState.PLAYING);
  }, [tryPlayAudio]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setPlayState(PlayState.PAUSED);
  }, []);

  const handleSeek = useCallback(
    (
      time: number,
      playImmediately: boolean = false,
      defer: boolean = false,
    ) => {
      if (!audioRef.current) return;

      if (defer) {
        // Only update visual state during drag, don't actually seek
        isSeekingRef.current = true;
        setCurrentTime(time);
      } else {
        // Actually perform the seek
        audioRef.current.currentTime = time;
        setCurrentTime(time);
        isSeekingRef.current = false;
        if (playImmediately) {
          tryPlayAudio();
          setPlayState(PlayState.PLAYING);
        }
      }
    },
    [tryPlayAudio],
  );

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || isSeekingRef.current) return;
    const value = audioRef.current.currentTime;
    setCurrentTime(Number.isFinite(value) ? value : 0);
  }, []);

  // 60fps time update loop via requestAnimationFrame (replaces ~4Hz timeupdate event)
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      if (!audio.paused && !isSeekingRef.current) {
        const value = audio.currentTime;
        if (value !== lastTimeRef.current) {
          lastTimeRef.current = value;
          setCurrentTime(Number.isFinite(value) ? value : 0);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    const value = audioRef.current.duration;
    setDuration(Number.isFinite(value) ? value : 0);
    if (playState === PlayState.PLAYING) {
      tryPlayAudio("Auto-play failed");
    }
  }, [playState, tryPlayAudio]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;

    if (playMode === PlayMode.LOOP_ONE) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        tryPlayAudio();
      }
      return;
    }

    // SHUFFLE 模式：使用 shuffle 顺序数组
    if (playMode === PlayMode.SHUFFLE && shuffleOrderRef.current.length > 0) {
      const nextPos = (currentShufflePositionRef.current + 1) % shuffleOrderRef.current.length;
      const nextOriginalIndex = shuffleOrderRef.current[nextPos];
      currentShufflePositionRef.current = nextPos;
      switchToIndexAndPlay(nextOriginalIndex);
      return;
    }

    // NORMAL/LOOP_ALL 模式：顺序播放
    const next = (currentIndex + 1) % queue.length;
    switchToIndexAndPlay(next);
  }, [queue.length, playMode, currentIndex, switchToIndexAndPlay, tryPlayAudio]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;

    // SHUFFLE 模式：使用 shuffle 顺序数组
    if (playMode === PlayMode.SHUFFLE && shuffleOrderRef.current.length > 0) {
      const prevPos = (currentShufflePositionRef.current - 1 + shuffleOrderRef.current.length) % shuffleOrderRef.current.length;
      const prevOriginalIndex = shuffleOrderRef.current[prevPos];
      currentShufflePositionRef.current = prevPos;
      switchToIndexAndPlay(prevOriginalIndex);
      return;
    }

    // NORMAL/LOOP_ALL 模式：顺序播放
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    switchToIndexAndPlay(prev);
  }, [queue.length, playMode, currentIndex, switchToIndexAndPlay]);

  const playIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return;
      switchToIndexAndPlay(index);
    },
    [queue.length, switchToIndexAndPlay],
  );

  const handleAudioEnded = useCallback(() => {
    if (playMode === PlayMode.LOOP_ONE) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        tryPlayAudio();
      }
      setPlayState(PlayState.PLAYING);
      return;
    }

    if (queue.length === 1) {
      setPlayState(PlayState.PAUSED);
      return;
    }

    playNext();
  }, [playMode, queue.length, playNext, tryPlayAudio]);

  const addSongAndPlay = useCallback(
    (song: Song) => {
      const newOriginalIndex = originalQueue.length;
      
      // Update both queues atomically
      setQueue((prev) => {
        const newQueue = [...prev, song];
        const newIndex = newQueue.length - 1;

        // Set index and play state immediately in the same update cycle
        setCurrentIndex(newIndex);
        setPlayState(PlayState.PLAYING);
        setMatchStatus("idle");

        return newQueue;
      });

      setOriginalQueue((prev) => [...prev, song]);
      
      // 如果在 shuffle 模式，将新歌曲的索引加入 shuffle 顺序
      if (playMode === PlayMode.SHUFFLE) {
        shuffleOrderRef.current.push(newOriginalIndex);
      }
    },
    [setQueue, setOriginalQueue, playMode, originalQueue.length],
  );

  const handlePlaylistAddition = useCallback(
    (added: Song[], wasEmpty: boolean) => {
      if (added.length === 0) return;
      setMatchStatus("idle");
      
      const addedCount = added.length;
      const newStartIndex = originalQueue.length; // 原有队列长度作为起始索引
      
      if (wasEmpty || currentIndex === -1) {
        setCurrentIndex(0);
        setPlayState(PlayState.PLAYING);
      }
      
      // 如果在 shuffle 模式，为新添加的歌曲生成 shuffle 索引
      if (playMode === PlayMode.SHUFFLE) {
        const newIndices = Array.from({ length: addedCount }, (_, i) => newStartIndex + i);
        const shuffledNewIndices = shuffleArray(newIndices);
        shuffleOrderRef.current = [...shuffleOrderRef.current, ...shuffledNewIndices];
      }
    },
    [currentIndex, playMode, originalQueue.length],
  );

  const setCurrentIndexExported = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      switchToIndexAndPlay(index);
    }
  }, [queue.length, switchToIndexAndPlay]);

  const setPlayModeExported = useCallback((mode: PlayMode) => {
    setPlayMode(mode);
  }, [setPlayMode]);

  const mergeLyricsWithMetadata = useCallback(
    (result: { lrc: string; yrc?: string; tLrc?: string; metadata: string[] }) => {
      const parsed = parseLyrics(result.lrc);
      const metadataCount = result.metadata.length;
      const metadataLines = result.metadata.map((text, idx) => ({
        time: -0.1 * (metadataCount - idx),
        text,
        isMetadata: true,
      }));
      return [...metadataLines, ...parsed].sort((a, b) => a.time - b.time);
    },
    [],
  );

  const loadLyricsFile = useCallback(
    (file?: File) => {
      if (!file || !currentSong) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsedLyrics = parseLyrics(text);
          updateSongInQueue(currentSong.id, { lyrics: parsedLyrics });
          setMatchStatus("success");
        }
      };
      reader.readAsText(file);
    },
    [currentSong, updateSongInQueue],
  );

  const resolveMatchedLyrics = useCallback(
    (cacheKey: string, loader: () => Promise<LyricsMatchPayload | null>) =>
      getCachedMatchedLyrics(cacheKey, loader, mergeLyricsWithMetadata),
    [mergeLyricsWithMetadata],
  );

  // 统一的 enrichment 函数 - 避免代码重复
  const enrichLyricsInBackground = useCallback(
    async (
      songId: string,
      lyricsCacheKey: string,
      isNetease: boolean,
      neteaseId?: string,
      title?: string,
      artist?: string,
    ) => {
      try {
        const matchedLyrics = await resolveMatchedLyrics(
          lyricsCacheKey,
          () =>
            withTimeout(
              isNetease && neteaseId
                ? fetchLyricsById(neteaseId)
                : title && artist
                  ? searchAndMatchLyrics(title, artist)
                  : Promise.resolve(null),
              MATCH_TIMEOUT_MS,
            ),
        );
        if (!matchedLyrics) return;
        const hasWordTiming = matchedLyrics.some((l) => l.words && l.words.length > 0);
        if (hasWordTiming) {
          updateSongInQueue(songId, { lyrics: matchedLyrics, needsLyricsMatch: false });
        } else {
          updateSongInQueue(songId, { needsLyricsMatch: false });
        }
      } catch {
        updateSongInQueue(songId, { needsLyricsMatch: false });
      }
    },
    [resolveMatchedLyrics, updateSongInQueue],
  );

  useEffect(() => {
    if (!currentSong) {
      if (matchStatus !== "idle") {
        setMatchStatus("idle");
      }
      return;
    }

    const songId = currentSong.id;
    const songTitle = currentSong.title;
    const songArtist = currentSong.artist;
    const needsLyricsMatch = currentSong.needsLyricsMatch;
    const existingLyrics = currentSong.lyrics ?? [];
    const isNeteaseSong = currentSong.isNetease;
    const songNeteaseId = currentSong.neteaseId;
    const localLyrics = currentSong.localLyrics ?? [];
    const lyricsCacheKey = isNeteaseSong && songNeteaseId
      ? createNeteaseLyricsCacheKey(songNeteaseId)
      : createSearchLyricsCacheKey(songTitle, songArtist);

    let cancelled = false;

    const markMatchFailed = () => {
      if (cancelled) return;
      updateSongInQueue(songId, {
        needsLyricsMatch: false,
      });
      setMatchStatus("failed");
    };

    const markMatchSuccess = () => {
      if (cancelled) return;
      setMatchStatus("success");
    };

    if (existingLyrics.length > 0) {
      seedCachedMatchedLyrics(lyricsCacheKey, existingLyrics);
      markMatchSuccess();

      // If we have local lyrics but online enrichment is still desired, try silently in background
      if (!needsLyricsMatch) return;

      // Background enrichment — don't block or change matchStatus
      enrichLyricsInBackground(songId, lyricsCacheKey, isNeteaseSong, songNeteaseId, songTitle, songArtist);
      return;
    }

    // If no existing lyrics but we have localLyrics (from ID3 or sidecar), use them immediately
    if (localLyrics.length > 0) {
      updateSongInQueue(songId, { lyrics: localLyrics });
      seedCachedMatchedLyrics(lyricsCacheKey, localLyrics);
      markMatchSuccess();

      // Still try enrichment in background if needed
      if (needsLyricsMatch) {
        enrichLyricsInBackground(songId, lyricsCacheKey, isNeteaseSong, songNeteaseId, songTitle, songArtist);
      }
      return;
    }

    if (!needsLyricsMatch) {
      markMatchFailed();
      return;
    }

    const fetchLyrics = async () => {
      setMatchStatus("matching");
      try {
        const matchedLyrics = await resolveMatchedLyrics(
          lyricsCacheKey,
          () =>
            withTimeout(
              isNeteaseSong && songNeteaseId
                ? fetchLyricsById(songNeteaseId)
                : searchAndMatchLyrics(songTitle, songArtist),
              MATCH_TIMEOUT_MS,
            ),
        );

        if (cancelled) return;

        if (matchedLyrics) {
          updateSongInQueue(songId, {
            lyrics: matchedLyrics,
            needsLyricsMatch: false,
          });
          markMatchSuccess();
        } else {
          if (localLyrics.length > 0) {
            updateSongInQueue(songId, {
              lyrics: localLyrics,
              needsLyricsMatch: false,
            });
            markMatchSuccess();
          } else {
            markMatchFailed();
          }
        }
      } catch (error) {
        if (localLyrics.length > 0) {
          updateSongInQueue(songId, {
            lyrics: localLyrics,
            needsLyricsMatch: false,
          });
          markMatchSuccess();
        } else {
          markMatchFailed();
        }
      }
    };

    fetchLyrics();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, resolveMatchedLyrics, updateSongInQueue]);

  // 预加载接下来最多5首歌的歌词
  useEffect(() => {
    if (queue.length === 0) {
      return;
    }

    const startIdx = currentIndex >= 0 ? currentIndex + 1 : 0;
    if (startIdx >= queue.length) {
      return;
    }

    const preloadWindowSize = 5;
    const endIdx = Math.min(queue.length - 1, startIdx + preloadWindowSize - 1);

    const timers: number[] = [];

    for (let i = startIdx; i <= endIdx; i++) {
      const song = queue[i];
      
      if (!song || !song.needsLyricsMatch || (song.lyrics && song.lyrics.length > 0)) {
        continue;
      }

      const lyricsCacheKey = song.isNetease && song.neteaseId
        ? createNeteaseLyricsCacheKey(song.neteaseId)
        : createSearchLyricsCacheKey(song.title, song.artist);

      // 延迟逐渐增加，避免瞬时过多请求
      const delay = 2000 + (i - startIdx) * 500;
      const timer = window.setTimeout(async () => {
        try {
          const matchedLyrics = await resolveMatchedLyrics(
            lyricsCacheKey,
            () =>
              withTimeout(
                song.isNetease && song.neteaseId
                  ? fetchLyricsById(song.neteaseId)
                  : searchAndMatchLyrics(song.title, song.artist),
                MATCH_TIMEOUT_MS,
              ),
          );

          if (matchedLyrics) {
            updateSongInQueue(song.id, {
              lyrics: matchedLyrics,
              needsLyricsMatch: false,
            });
          }
        } catch {
          // Silent failure for preloading
        }
      }, delay);

      timers.push(timer);
    }

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [currentIndex, queue, queue.length, updateSongInQueue, resolveMatchedLyrics]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioError = (event: Event) => {
      const audioElement = event.target as HTMLAudioElement;
      const error = audioElement.error;

      if (error && currentSong) {
        let errorMessage = "Unknown audio error";
        let toastMessage = "";

        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "Audio loading aborted";
            // Don't show toast for user-initiated aborts
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error while loading audio";
            toastMessage = "Network error - check your connection";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Audio decode error - unsupported codec or corrupted file";
            toastMessage = "Cannot play this file - try converting to MP3";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Audio format not supported";
            toastMessage = "Unsupported format - convert to MP3 or FLAC";
            break;
          default:
            errorMessage = "Audio playback error";
            toastMessage = "Cannot play this file";
        }

        // Compact console logging
        const fileUrl = currentSong.fileUrl;
        const extension = fileUrl?.split('.').pop()?.toLowerCase() || 'unknown';
        console.error(`🔴 Audio Error: ${errorMessage} | File: ${currentSong.title} | Format: ${extension}`);

        // Show user-friendly toast notification
        if (toastMessage && error.code !== MediaError.MEDIA_ERR_ABORTED) {
          console.warn(`Audio playback warning: ${toastMessage}`);
        }
      }

      audio.pause();
      audio.currentTime = 0;
      setPlayState(PlayState.PAUSED);
      setCurrentTime(0);
    };

    audio.addEventListener("error", handleAudioError);
    return () => {
      audio.removeEventListener("error", handleAudioError);
    };
  }, [audioRef, currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleDurationChange = () => {
      const value = audio.duration;
      setDuration(Number.isFinite(value) ? value : 0);
    };

    audio.addEventListener("durationchange", handleDurationChange);
    return () => {
      audio.removeEventListener("durationchange", handleDurationChange);
    };
  }, [audioRef]);

  useEffect(() => {
    if (!currentSong || !currentSong.coverUrl) {
      return;
    }

    // 强制重新提取颜色以应用新的3色方案
    // 检查是否已经是4色方案
    const hasOldColorScheme = currentSong.colors && currentSong.colors.length !== 4;
    const needsExtraction = !currentSong.colors || hasOldColorScheme;

    if (needsExtraction) {
      extractColors(currentSong.coverUrl)
        .then((colors) => {
          if (colors.length > 0) {
            updateSongInQueue(currentSong.id, { colors });
          }
        })
        .catch(() => {});
    }
  }, [currentSong, updateSongInQueue]);

  useEffect(() => {
    if (queue.length === 0) {
      if (currentIndex === -1) return;
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setPlayState(PlayState.PAUSED);
      setCurrentIndex(-1);
      setCurrentTime(0);
      setDuration(0);
      setMatchStatus("idle");
      return;
    }

    if (currentIndex >= queue.length || !queue[currentIndex]) {
      const nextIndex = Math.max(0, Math.min(queue.length - 1, currentIndex));
      setCurrentIndex(nextIndex);
      setMatchStatus("idle");
    }
  }, [queue, currentIndex]);

  const [speed, setSpeed] = useState(1);
  const [preservesPitch, setPreservesPitch] = useState(true);
  const [resolvedAudioSrc, setResolvedAudioSrc] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

  const handleSetSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  const handleTogglePreservesPitch = useCallback(() => {
    setPreservesPitch((prev) => !prev);
  }, []);

  // Ensure playback rate is applied when song changes or play state changes
  // Performance optimization: use requestAnimationFrame for smooth rate changes
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const targetSpeed = speed;
    const targetPreservesPitch = preservesPitch;

    // For high speed changes (>0.3 difference), apply immediately for better responsiveness
    if (Math.abs(targetSpeed - audio.playbackRate) > 0.3) {
      audio.preservesPitch = targetPreservesPitch;
      audio.playbackRate = targetSpeed;
      return;
    }

    // For small changes, smooth transition
    let animationId: number;
    const smoothTransition = () => {
      if (!audio) return;

      const currentRate = audio.playbackRate;
      const diff = targetSpeed - currentRate;

      if (Math.abs(diff) < 0.001) {
        audio.playbackRate = targetSpeed;
        audio.preservesPitch = targetPreservesPitch;
        return;
      }

      // Smooth interpolation with faster convergence
      audio.playbackRate = currentRate + diff * 0.25;
      audio.preservesPitch = targetPreservesPitch;
      animationId = requestAnimationFrame(smoothTransition);
    };

    animationId = requestAnimationFrame(smoothTransition);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [currentSong, playState, speed, preservesPitch]);

  useEffect(() => {
    let canceled = false;
    let currentObjectUrl: string | null = null;
    let controller: AbortController | null = null;

    const releaseObjectUrl = () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
    };

    if (!currentSong?.fileUrl) {
      releaseObjectUrl();
      setResolvedAudioSrc(null);
      setIsBuffering(false);
      setBufferProgress(0);
      return () => {
        canceled = true;
        controller?.abort();
        releaseObjectUrl();
      };
    }

    const fileUrl = currentSong.fileUrl;

    // Already a blob or data URL - use directly
    if (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")) {
      releaseObjectUrl();
      setResolvedAudioSrc(fileUrl);
      setIsBuffering(false);
      setBufferProgress(1);
      return () => {
        canceled = true;
      };
    }

    // Check cache first
    const cachedBlob = audioResourceCache.get(fileUrl);
    if (cachedBlob) {
      releaseObjectUrl();
      currentObjectUrl = URL.createObjectURL(cachedBlob);
      setResolvedAudioSrc(currentObjectUrl);
      setIsBuffering(false);
      setBufferProgress(1);
      return () => {
        canceled = true;
        releaseObjectUrl();
      };
    }

    // Use the original URL directly - let browser handle native buffering
    // This is the most reliable approach and works for any file size
    releaseObjectUrl();
    setResolvedAudioSrc(null); // Use original fileUrl via fallback in audio element
    setIsBuffering(true);
    setBufferProgress(0);

    // Download in background for caching (does not affect playback)
    const cacheInBackground = async () => {
      if (typeof fetch !== "function") return;

      controller = new AbortController();
      try {
        const response = await fetch(fileUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to load audio: " + response.status);
        }

        const totalBytes = Number(response.headers.get("content-length")) || 0;

        if (!response.body) {
          const fallbackBlob = await response.blob();
          if (canceled) return;
          audioResourceCache.set(fileUrl, fallbackBlob);
          setBufferProgress(1);
          // Don't switch - will be used next time
          return;
        }

        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let loaded = 0;

        while (!canceled) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.byteLength;
            if (totalBytes > 0) {
              setBufferProgress(Math.min(loaded / totalBytes, 0.99));
            } else {
              setBufferProgress((prev) => {
                const increment = value.byteLength / (5 * 1024 * 1024);
                return Math.min(0.95, prev + increment);
              });
            }
          }
        }

        if (canceled) return;

        const blob = new Blob(chunks, {
          type: response.headers.get("content-type") || "audio/mpeg",
        });
        audioResourceCache.set(fileUrl, blob);
        setBufferProgress(1);
        // Don't switch to blob URL during playback - it would restart the audio
        // The cached blob will be used automatically next time this song is played
      } catch (error) {
        if (!canceled) {
          // Not critical - browser is still playing via native buffering
          console.warn("Background audio caching failed:", error);
        }
      } finally {
        if (!canceled) {
          setIsBuffering(false);
        }
      }
    };

    cacheInBackground();

    return () => {
      canceled = true;
      controller?.abort();
      releaseObjectUrl();
    };
  }, [currentSong?.fileUrl]);

  return {
    audioRef,
    currentSong,
    currentIndex,
    playState,
    currentTime,
    duration,
    playMode,
    matchStatus,
    accentColor,
    speed,
    preservesPitch,
    togglePlay,
    toggleMode,
    handleSeek,
    playNext,
    playPrev,
    playIndex,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlaylistAddition,
    loadLyricsFile,
    addSongAndPlay,
    handleAudioEnded,
    setSpeed: handleSetSpeed,
    togglePreservesPitch: handleTogglePreservesPitch,
    pitch: 0,
    setPitch: (_pitch: number) => { },
    play,
    pause,
    resolvedAudioSrc,
    isBuffering,
    bufferProgress,
    setCurrentIndex: setCurrentIndexExported,
    setPlayMode: setPlayModeExported,
  };
};
