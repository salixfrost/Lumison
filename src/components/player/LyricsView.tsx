import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { LyricLine as LyricLineType } from "../../types";
import {
  findActiveLyricLineIndex,
  findActiveLyricWordIndex,
} from "../../utils/lyricsLookup";

const getLineOpacity = (index: number, activeIndex: number): number => {
  if (activeIndex < 0) return 0.4;
  const distance = Math.abs(index - activeIndex);
  if (distance === 0) return 1;
  if (distance === 1) return 0.75;
  if (distance === 2) return 0.55;
  if (distance === 3) return 0.4;
  return 0.3;
};

interface LyricLineItemProps {
  line: LyricLineType;
  index: number;
  isActive: boolean;
  activeWordIndex: number;
  opacity: number;
  fontSize: number;
  accentColor: string;
  onLineClick: (time: number) => void;
}

const LyricLineItem = React.memo(({
  line,
  index,
  isActive,
  activeWordIndex,
  opacity,
  fontSize,
  accentColor,
  onLineClick,
}: LyricLineItemProps) => {
  if (line.isMetadata) return null;

  return (
    <div
      data-index={index}
      onClick={() => onLineClick(line.time)}
      className="cursor-pointer text-left w-full max-w-4xl rounded-lg"
      style={{
        opacity,
        fontSize: `${fontSize - 2}px`,
        lineHeight: 1.5,
        paddingLeft: isActive ? "12px" : "14px",
        borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
        transition: "opacity 0.25s ease-out, padding-left 0.2s ease-out, border-left-color 0.2s ease-out",
      }}
    >
      {line.isInterlude || line.text === "..." ? (
        <div className="flex items-center justify-center gap-3 py-5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor, opacity: 0.5, animationDelay: "0s", animationDuration: "1.5s" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor, opacity: 0.5, animationDelay: "0.3s", animationDuration: "1.5s" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor, opacity: 0.5, animationDelay: "0.6s", animationDuration: "1.5s" }}
          />
        </div>
      ) : (
        <>
          {line.words && line.words.length > 0 ? (
            <div className="font-bold flex flex-wrap gap-x-2">
              {line.words.map((word, wordIndex) => {
                const isWordActive = isActive && wordIndex <= activeWordIndex;
                return (
                  <span
                    key={wordIndex}
                    className="transition-all duration-200"
                    style={{
                      color: isWordActive ? accentColor : "rgba(255, 255, 255, 0.5)",
                      textShadow: isWordActive ? `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}20` : "none",
                      transform: isWordActive ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    {word.text}
                  </span>
                );
              })}
            </div>
          ) : (
            <div
              className="font-bold transition-all duration-200"
              style={{
                color: isActive ? accentColor : "rgba(255, 255, 255, 0.5)",
                textShadow: isActive ? `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}20` : "none",
              }}
            >
              {line.text}
            </div>
          )}
          {line.translation && (
            <div
              className="mt-2 transition-all duration-200"
              style={{
                fontSize: `${fontSize * 0.5}px`,
                color: isActive ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.35)",
              }}
            >
              {line.translation}
            </div>
          )}
        </>
      )}
    </div>
  );
});

LyricLineItem.displayName = "LyricLineItem";

interface LyricsViewProps {
  lyrics: LyricLineType[];
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTime: number;
  onSeekRequest: (time: number, immediate?: boolean) => void;
  matchStatus: "idle" | "matching" | "success" | "failed";
  fontSize?: number;
  accentColor?: string;
}

const LyricsView: React.FC<LyricsViewProps> = React.memo(({
  lyrics,
  currentTime,
  onSeekRequest,
  matchStatus,
  fontSize = 48,
  accentColor = "#ffffff",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    return findActiveLyricLineIndex(lyrics, currentTime);
  }, [currentTime, lyrics]);

  const activeWordIndex = useMemo(() => {
    if (activeIndex < 0) return -1;
    const activeWords = lyrics[activeIndex]?.words;
    if (!activeWords?.length) return -1;
    return findActiveLyricWordIndex(activeWords, currentTime);
  }, [activeIndex, currentTime, lyrics]);

  // Auto-scroll to active line
  const prevActiveIndexRef = useRef(-1);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return;
    const activeElement = containerRef.current.querySelector(
      `[data-index="${activeIndex}"]`,
    );
    if (activeElement) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
    prevActiveIndexRef.current = activeIndex;
  }, [activeIndex]);

  const handleLineClick = useCallback((time: number) => {
    onSeekRequest(time, true);
  }, [onSeekRequest]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (!lyrics.length) {
    return (
      <div className="h-[85vh] lg:h-[65vh] flex flex-col items-center justify-center text-white/50 select-none">
        {matchStatus === "matching" && (
          <div className="animate-pulse">Syncing Lyrics...</div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[85vh] lg:h-[65vh] w-full overflow-y-auto overflow-x-hidden px-6 lg:px-12 py-8 scroll-smooth"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="flex flex-col items-start gap-6 min-h-full pl-0 lg:pl-4">
        {lyrics.map((line, index) => {
          if (line.isMetadata) return null;

          const isActive = index === activeIndex;
          const opacity = getLineOpacity(index, activeIndex);

          return (
            <LyricLineItem
              key={`lyric-${line.time}-${index}`}
              line={line}
              index={index}
              isActive={isActive}
              activeWordIndex={activeWordIndex}
              opacity={opacity}
              fontSize={fontSize}
              accentColor={accentColor}
              onLineClick={handleLineClick}
            />
          );
        })}
      </div>
    </div>
  );
});

LyricsView.displayName = "LyricsView";

export default LyricsView;
