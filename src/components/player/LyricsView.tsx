import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { LyricLine as LyricLineType } from "../../types";
import {
  findActiveLyricLineIndex,
  findActiveLyricWordIndex,
} from "../../utils/lyricsLookup";

const getLineOpacity = (index: number, activeIndex: number): number => {
  if (activeIndex < 0) return 0.35;
  const distance = Math.abs(index - activeIndex);
  if (distance === 0) return 1;
  if (distance === 1) return 0.4;
  if (distance === 2) return 0.25;
  return 0.2;
};

interface LyricLineItemProps {
  line: LyricLineType;
  index: number;
  isActive: boolean;
  activeWordIndex: number;
  opacity: number;
  fontSize: number;
  accentColor: string;
  lineRef: (el: HTMLDivElement | null) => void;
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
  lineRef,
  onLineClick,
}: LyricLineItemProps) => {
  if (line.isMetadata) return null;

  return (
    <div
      ref={lineRef}
      data-index={index}
      onClick={() => onLineClick(line.time)}
      className="cursor-pointer text-left w-full max-w-5xl rounded-lg transition-all duration-300"
      style={{
        opacity: isActive ? 1 : Math.max(opacity, 0.2),
        fontSize: isActive ? `${fontSize}px` : `${fontSize - 4}px`,
        lineHeight: 1.4,
        fontWeight: isActive ? 850 : 500,
        filter: isActive ? 'none' : 'blur(1px)',
        textShadow: isActive 
          ? `0 0 40px ${accentColor}80, 0 0 80px ${accentColor}40, 0 2px 20px rgba(0,0,0,0.5)` 
          : "0 1px 4px rgba(0,0,0,0.3)",
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
            <div className="flex flex-wrap gap-x-2">
              {line.words.map((word, wordIndex) => {
                const isWordActive = isActive && wordIndex <= activeWordIndex;
                return (
                  <span
                    key={wordIndex}
                    style={{
                      fontWeight: isWordActive ? 850 : 500,
                      fontSize: isWordActive ? undefined : '0.9em',
                      color: isWordActive ? accentColor : "rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    {word.text}
                  </span>
                );
              })}
            </div>
          ) : (
            <div style={{ fontWeight: isActive ? 850 : 500, fontSize: isActive ? undefined : '0.9em' }}>
              {line.text}
            </div>
          )}
          {line.translation && (
            <div
              style={{
                fontSize: `${fontSize * 0.5}px`,
                color: "rgba(255, 255, 255, 0.35)",
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
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastActiveIndexRef = useRef(-1);
  const lastActiveWordIndexRef = useRef(-1);
  const prevActiveIndexRef = useRef(-1);

  const filteredLyrics = useMemo(() => 
    lyrics.filter(line => !line.isMetadata),
    [lyrics]
  );

  const activeIndex = useMemo(() => {
    if (!filteredLyrics.length) return -1;
    const lastIndex = lastActiveIndexRef.current;
    if (lastIndex >= 0 && lastIndex < filteredLyrics.length) {
      const prevLineTime = filteredLyrics[lastIndex]?.time ?? 0;
      const nextLineTime = filteredLyrics[lastIndex + 1]?.time ?? Infinity;
      if (currentTime >= prevLineTime && currentTime < nextLineTime) {
        return lastIndex;
      }
    }
    const result = findActiveLyricLineIndex(filteredLyrics, currentTime);
    lastActiveIndexRef.current = result;
    return result;
  }, [currentTime, filteredLyrics]);

  const opacities = useMemo(() => 
    filteredLyrics.map((_, idx) => getLineOpacity(idx, activeIndex)),
    [filteredLyrics, activeIndex]
  );

  const activeWordIndex = useMemo(() => {
    if (activeIndex < 0) return -1;
    const activeWords = filteredLyrics[activeIndex]?.words;
    if (!activeWords?.length) return -1;
    const lastWordIndex = lastActiveWordIndexRef.current;
    if (lastWordIndex >= 0 && lastWordIndex < activeWords.length) {
      const prevWordTime = activeWords[lastWordIndex]?.startTime ?? 0;
      const nextWordTime = activeWords[lastWordIndex + 1]?.startTime ?? Infinity;
      if (currentTime >= prevWordTime && currentTime < nextWordTime) {
        return lastWordIndex;
      }
    }
    const result = findActiveLyricWordIndex(activeWords, currentTime);
    lastActiveWordIndexRef.current = result;
    return result;
  }, [activeIndex, currentTime, filteredLyrics]);

  useEffect(() => {
    if (activeIndex < 0 || activeIndex === prevActiveIndexRef.current || !lineRefs.current[activeIndex]) {
      prevActiveIndexRef.current = activeIndex;
      return;
    }
    prevActiveIndexRef.current = activeIndex;
    lineRefs.current[activeIndex]?.scrollIntoView({ behavior: "auto", block: "center" });
  }, [activeIndex]);

  useEffect(() => {
    lineRefs.current = [];
    lastActiveIndexRef.current = -1;
    prevActiveIndexRef.current = -1;
    containerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [lyrics]);

  const handleLineClick = useCallback((time: number) => {
    onSeekRequest(time, true);
  }, [onSeekRequest]);

  if (!filteredLyrics.length) {
    return (
      <div className="h-[80vh] lg:h-[70vh] flex flex-col items-center justify-center text-white/50 select-none">
        {matchStatus === "matching" && (
          <div className="animate-pulse">Syncing Lyrics...</div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[80vh] lg:h-[75vh] w-full overflow-y-auto overflow-x-hidden px-6 lg:pl-4 py-8 scroll-smooth"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="flex flex-col items-start gap-6 min-h-full pl-0 lg:pl-4">
        {filteredLyrics.map((line, index) => {
          const isActive = index === activeIndex;
          const opacity = opacities[index] ?? 1;

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
              lineRef={(el) => { lineRefs.current[index] = el; }}
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
