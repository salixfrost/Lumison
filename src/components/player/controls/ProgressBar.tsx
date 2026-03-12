import React, { useState, useRef, useEffect, memo } from 'react';
import { formatTime } from '../../../services/utils';
import { useTheme } from '../../../contexts/ThemeContext';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  bufferedEnd: number;
  onSeek: (time: number, playImmediately?: boolean, defer?: boolean) => void;
}

const ProgressBar: React.FC<ProgressBarProps> = memo(({
  currentTime,
  duration,
  isPlaying,
  speed,
  bufferedEnd,
  onSeek,
}) => {
  const { theme } = useTheme();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [isWaitingForSeek, setIsWaitingForSeek] = useState(false);
  const seekTargetRef = useRef(0);

  // Interpolated time for smooth progress bar
  const [interpolatedTime, setInterpolatedTime] = useState(currentTime);
  const progressLastTimeRef = useRef(Date.now());

  useEffect(() => {
    if (isSeeking) return;

    if (isWaitingForSeek) {
      const diff = Math.abs(currentTime - seekTargetRef.current);
      if (diff < 0.5) {
        setIsWaitingForSeek(false);
        setInterpolatedTime(currentTime);
      }
    } else {
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
          const next = prev + dt * speed;
          return Math.min(next, duration);
        });
      } else if (isPlaying && isWaitingForSeek) {
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

  const displayTime = isSeeking ? seekTime : interpolatedTime;
  const bufferedWidthPercent = duration > 0
    ? Math.min(100, Math.max(0, (bufferedEnd / duration) * 100))
    : 0;

  const handleSeekStart = () => setIsSeeking(true);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setSeekTime(time);
    onSeek(time, false, true);
  };

  const handleSeekEnd = (time: number) => {
    onSeek(time, false, false);
    setIsSeeking(false);
    setInterpolatedTime(time);
    seekTargetRef.current = time;
    setIsWaitingForSeek(true);
    setTimeout(() => setIsWaitingForSeek(false), 1000);
  };

  return (
    <div className="w-full max-w-xl flex items-center gap-3 text-sm font-medium theme-text-secondary group/bar relative">
      <span className="w-12 text-right font-mono tracking-wide">
        {formatTime(displayTime)}
      </span>

      <div className="relative flex-1 h-10 flex items-center cursor-pointer group">
        {/* Background Track */}
        <div className="absolute inset-x-0 h-1 theme-bg-overlay rounded-full group-hover:h-1.5 transition-[height] duration-200 ease-out"></div>

        {/* Buffer Progress */}
        <div
          className="absolute left-0 h-1 rounded-full group-hover:h-1.5 transition-[height] duration-200 ease-out"
          style={{
            width: bufferedWidthPercent + '%',
            backgroundColor:
              theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
            transition:
              'background-color 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), height 0.2s ease-out',
          }}
        ></div>

        {/* Active Progress */}
        <div
          className="absolute left-0 h-1 rounded-full group-hover:h-1.5 transition-[height] duration-200 ease-out"
          style={{
            width: `${(displayTime / (duration || 1)) * 100}%`,
            backgroundColor:
              theme === 'light' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)',
            transition:
              'background-color 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), height 0.2s ease-out',
          }}
        ></div>

        {/* Input Range */}
        <input
          id="progress-bar-range"
          type="range"
          min={0}
          max={duration || 0}
          value={displayTime}
          onMouseDown={handleSeekStart}
          onTouchStart={handleSeekStart}
          onChange={handleSeekChange}
          onMouseUp={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
      </div>

      <span className="w-12 font-mono tracking-wide">
        {duration > 0 ? `-${formatTime(Math.max(0, duration - displayTime))}` : '0:00'}
      </span>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
