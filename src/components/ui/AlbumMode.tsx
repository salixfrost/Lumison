import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import SmartImage from '../common/SmartImage';
import { useI18n } from '../../contexts/I18nContext';
import { formatTime } from '../../services/utils';
import { LyricLine as LyricLineType } from '../../types';
import './AlbumMode.css';

interface AlbumModeProps {
  coverUrl?: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  accentColor?: string;
  lyrics?: LyricLineType[];
  showLyrics?: boolean;
}

const AlbumMode: React.FC<AlbumModeProps> = ({
  coverUrl,
  title,
  artist,
  isPlaying,
  currentTime,
  duration,
  onSeek,
  accentColor = '#ff6b6b',
  lyrics = [],
  showLyrics = false,
}) => {
  const { t } = useI18n();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const displayCover = coverUrl;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Find current lyric line
  const currentLyricIndex = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;

    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        return i;
      }
    }
    return -1;
  }, [lyrics, currentTime]);

  // Find current word in active line
  const getCurrentWordIndex = useCallback((lineIndex: number) => {
    if (lineIndex < 0 || !lyrics[lineIndex]?.words) return -1;

    const line = lyrics[lineIndex];
    const words = line.words || [];

    for (let i = words.length - 1; i >= 0; i--) {
      if (currentTime >= words[i].startTime) {
        return i;
      }
    }
    return -1;
  }, [lyrics, currentTime]);

  // Auto-scroll lyrics
  useEffect(() => {
    if (!showLyrics || !lyricsContainerRef.current || currentLyricIndex < 0) return;

    const container = lyricsContainerRef.current;
    const currentLine = container.querySelector(`[data-index="${currentLyricIndex}"]`);

    if (currentLine) {
      currentLine.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLyricIndex, showLyrics]);

  // Calculate border progress (0-400% for 4 sides)
  const getBorderProgress = () => {
    const totalProgress = progress * 4; // 0-400%
    return {
      top: Math.min(100, Math.max(0, totalProgress)),
      right: Math.min(100, Math.max(0, totalProgress - 100)),
      bottom: Math.min(100, Math.max(0, totalProgress - 200)),
      left: Math.min(100, Math.max(0, totalProgress - 300)),
    };
  };

  // Calculate thumb position
  const getThumbPosition = () => {
    const totalProgress = progress * 4;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (totalProgress <= 100) {
      // Top edge
      return {
        left: `${totalProgress}%`,
        top: '0px',
      };
    } else if (totalProgress <= 200) {
      // Right edge
      const rightProgress = totalProgress - 100;
      return {
        left: `${windowWidth}px`,
        top: `${rightProgress}%`,
      };
    } else if (totalProgress <= 300) {
      // Bottom edge
      const bottomProgress = totalProgress - 200;
      return {
        left: `${100 - bottomProgress}%`,
        top: `${windowHeight}px`,
      };
    } else {
      // Left edge
      const leftProgress = totalProgress - 300;
      return {
        left: '0px',
        top: `${100 - leftProgress}%`,
      };
    }
  };

  const borderProgress = getBorderProgress();
  const thumbPosition = getThumbPosition();

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration === 0) return;

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const x = e.clientX;
      const y = e.clientY;

      // Determine which edge was clicked and calculate progress
      const edgeThreshold = 30; // pixels from edge - increased for better UX
      let percentage = -1; // -1 means not on any edge

      if (y <= edgeThreshold) {
        // Top edge
        percentage = (x / windowWidth) * 0.25;
      } else if (x >= windowWidth - edgeThreshold) {
        // Right edge
        percentage = 0.25 + (y / windowHeight) * 0.25;
      } else if (y >= windowHeight - edgeThreshold) {
        // Bottom edge
        percentage = 0.5 + ((windowWidth - x) / windowWidth) * 0.25;
      } else if (x <= edgeThreshold) {
        // Left edge
        percentage = 0.75 + ((windowHeight - y) / windowHeight) * 0.25;
      }

      // Only seek if we clicked on an edge
      if (percentage >= 0) {
        onSeek(Math.max(0, Math.min(1, percentage)) * duration);
      }
    },
    [duration, onSeek]
  );

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const x = e.clientX;
    const y = e.clientY;

    // Check if click is on an edge
    const edgeThreshold = 30;
    const isOnEdge =
      y <= edgeThreshold ||
      x >= windowWidth - edgeThreshold ||
      y >= windowHeight - edgeThreshold ||
      x <= edgeThreshold;

    if (isOnEdge) {
      setIsDragging(true);
      // Immediately seek on mouse down
      handleProgressClick(e);
    }
  }, [duration, handleProgressClick]);

  const handleProgressMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only handle move if we're dragging
      if (!isDragging || duration === 0) return;
      handleProgressClick(e);
    },
    [isDragging, duration, handleProgressClick]
  );

  const handleProgressMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  return (
    <div className="album-mode-container">
      {showLyrics ? (
        /* Lyrics Display with word-by-word highlighting */
        <div className="lyrics-mode-wrapper">
          <div
            ref={lyricsContainerRef}
            className="lyrics-mode-container"
          >
            {lyrics && lyrics.length > 0 ? (
              lyrics.map((line, index) => {
                const isActive = index === currentLyricIndex;
                const isPassed = index < currentLyricIndex;
                const currentWordIndex = isActive ? getCurrentWordIndex(index) : -1;
                const hasWords = line.words && line.words.length > 0;

                return (
                  <div
                    key={index}
                    data-index={index}
                    className={`lyrics-mode-line ${isActive ? 'active' : ''
                      } ${isPassed ? 'passed' : ''}`}
                    onClick={() => onSeek(line.time)}
                  >
                    {hasWords ? (
                      <div className="lyrics-mode-text lyrics-mode-words">
                        {line.words!.map((word, wordIndex) => (
                          <span
                            key={wordIndex}
                            className={`lyrics-mode-word ${isActive && wordIndex <= currentWordIndex ? 'active' : ''
                              }`}
                            style={{
                              color: isActive && wordIndex <= currentWordIndex ? accentColor : undefined,
                            }}
                          >
                            {word.text}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="lyrics-mode-text"
                        style={{
                          color: isActive ? accentColor : undefined,
                        }}
                      >
                        {line.text}
                      </div>
                    )}
                    {line.translation && (
                      <div className="lyrics-mode-translation">{line.translation}</div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="lyrics-mode-empty">
                <p>{t('lyrics.noLyrics')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Album Cover Display */
        <>
          <div className="album-cover-wrapper-large">
            <div className="album-cover-card-large">
              <SmartImage
                src={displayCover}
                alt="Album Cover"
                containerClassName="album-cover-image-container"
                imgClassName="album-cover-image"
                loading="eager"
              />
            </div>
          </div>

          {/* Song Info - Below Cover */}
          <div className="song-info-section-large">
            <div className="song-info-text">
              <h2 className="song-title-large">{title || t('player.noMusicLoaded')}</h2>
              <p className="song-artist-large">{artist || t('player.selectSong')}</p>
            </div>
          </div>
        </>
      )}

      {/* Border Progress Bar - Only show in album mode */}
      {!showLyrics && (
        <div className="progress-section">
          <div className="time-display">
            <span className="current-time">{formatTime(currentTime)}</span>
            <span className="total-time">{formatTime(duration)}</span>
          </div>
          <div
            ref={progressBarRef}
            className="border-progress-container"
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseUp={handleProgressMouseUp}
          >
            {/* Background borders */}
            <div className="border-progress-bg top" />
            <div className="border-progress-bg right" />
            <div className="border-progress-bg bottom" />
            <div className="border-progress-bg left" />

            {/* Active progress borders */}
            <div
              className="border-progress-fill top"
              style={{
                width: `${borderProgress.top}%`,
                backgroundColor: accentColor,
              }}
            />
            <div
              className="border-progress-fill right"
              style={{
                height: `${borderProgress.right}%`,
                backgroundColor: accentColor,
              }}
            />
            <div
              className="border-progress-fill bottom"
              style={{
                width: `${borderProgress.bottom}%`,
                backgroundColor: accentColor,
              }}
            />
            <div
              className="border-progress-fill left"
              style={{
                height: `${borderProgress.left}%`,
                backgroundColor: accentColor,
              }}
            />

            {/* Progress thumb */}
            <div
              className="border-progress-thumb"
              style={{
                left: thumbPosition.left,
                top: thumbPosition.top,
                backgroundColor: accentColor,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumMode;
