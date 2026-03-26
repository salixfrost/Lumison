import React, { useRef, useEffect, useMemo } from "react";
import { LyricLine as LyricLineType } from "../../types";
import {
  findActiveLyricLineIndex,
  findActiveLyricWordIndex,
} from "../../utils/lyricsLookup";

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

const LyricsView: React.FC<LyricsViewProps> = ({
  lyrics,
  currentTime,
  onSeekRequest,
  matchStatus,
  fontSize = 48,
  accentColor = "#ffffff",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = useMemo(() => {
    if (!lyrics.length) {
      return -1;
    }

    return findActiveLyricLineIndex(lyrics, currentTime);
  }, [currentTime, lyrics]);

  const activeWordIndex = useMemo(() => {
    if (activeIndex < 0) {
      return -1;
    }

    const activeWords = lyrics[activeIndex]?.words;
    if (!activeWords?.length) {
      return -1;
    }

    return findActiveLyricWordIndex(activeWords, currentTime);
  }, [activeIndex, currentTime, lyrics]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return;

    const activeElement = containerRef.current.querySelector(
      `[data-index="${activeIndex}"]`,
    );
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  // Calculate opacity based on distance from active line
  const getOpacity = (index: number) => {
    if (activeIndex < 0) return 0.4;
    const distance = Math.abs(index - activeIndex);
    if (distance === 0) return 1;
    if (distance === 1) return 0.7;
    if (distance === 2) return 0.5;
    return 0.3;
  };

  // Calculate scale based on active state
  const getScale = (index: number) => {
    return index === activeIndex ? 1.05 : 1;
  };

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
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style>{`
        .lyrics-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="flex flex-col items-start gap-6 min-h-full pl-0 lg:pl-4">
        {lyrics.map((line, index) => {
          if (line.isMetadata) return null;

          const isActive = index === activeIndex;
          const opacity = getOpacity(index);
          const scale = getScale(index);

          return (
            <div
              key={index}
              data-index={index}
              onClick={() => onSeekRequest(line.time, true)}
              className="cursor-pointer transition-all duration-500 ease-out text-left w-full max-w-4xl"
              style={{
                opacity,
                transform: `scale(${scale})`,
                fontSize: `${fontSize - 2}px`,
                lineHeight: 1.5,
              }}
            >
              {line.isInterlude || line.text === "..." ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                  <span
                    className="w-2 h-2 rounded-full bg-white/40 animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-white/40 animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              ) : (
                <>
                  {line.words && line.words.length > 0 ? (
                    // Word-by-word rendering
                    <div className="font-bold transition-all duration-300 flex flex-wrap gap-x-2">
                      {line.words.map((word, wordIndex) => {
                        const isWordActive = isActive && wordIndex <= activeWordIndex;

                        return (
                          <span
                            key={wordIndex}
                            className="transition-colors duration-200"
                            style={{
                              color: isWordActive ? accentColor : "rgba(255, 255, 255, 0.5)",
                            }}
                          >
                            {word.text}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    // Fallback: whole line rendering
                    <div
                      className="font-bold transition-all duration-300"
                      style={{
                        color: isActive ? accentColor : "rgba(255, 255, 255, 0.5)",
                      }}
                    >
                      {line.text}
                    </div>
                  )}
                  {line.translation && (
                    <div
                      className="text-white/50 mt-2 transition-all duration-300"
                      style={{ fontSize: `${fontSize * 0.5}px` }}
                    >
                      {line.translation}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsView;
