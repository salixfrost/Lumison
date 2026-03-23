import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { CheckIcon, CloseIcon, ClockIcon, PauseIcon, PlayIcon } from '../common/Icons';
import { useI18n } from '../../contexts/I18nContext';

interface FocusSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete: (shouldPause?: boolean) => void;
  isActive?: boolean;
  remainingTime?: number; // in seconds
  initialDuration?: number; // in seconds
}

const PRESETS: { minutes: number; label: string }[] = [
  { minutes: 25, label: '25' },
  { minutes: 45, label: '45' },
  { minutes: 60, label: '60' },
];

const FocusSessionModal: React.FC<FocusSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionComplete,
  isActive = false,
  remainingTime = 1500, // default 25 minutes
  initialDuration = 1500,
}) => {
  const { t } = useI18n();
  const [selectedDuration, setSelectedDuration] = useState(1500);
  const [timeRemaining, setTimeRemaining] = useState(1500);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoPause, setAutoPause] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [customSeconds, setCustomSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDuration(initialDuration);
      setTimeRemaining(initialDuration);
      setIsRunning(isActive);
      setIsPaused(false);
      setShowCustomInput(false);
    }
  }, [isOpen, initialDuration, isActive]);

  const handleCancel = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    onClose();
  }, [onClose]);

  const handleComplete = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onSessionComplete(autoPause);
    onClose();
  }, [onSessionComplete, autoPause, onClose]);

  // Keep handleComplete in a ref so the interval callback always has the latest version
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !isRunning || isPaused) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleCompleteRef.current();
          return 0;        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, isRunning, isPaused]);

  const handleStart = useCallback(() => {
    setTimeRemaining(selectedDuration);
    setIsRunning(true);
    setIsPaused(false);
  }, [selectedDuration]);

  const handlePause = useCallback(() => {
    setIsPaused(!isPaused);
  }, [isPaused]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatTimeDisplay = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  }, []);

  // Play gentle notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5); // Drop to A4
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, []);

  // Play sound when session completes
  useEffect(() => {
    if (isOpen && timeRemaining === 0 && isRunning) {
      playNotificationSound();
    }
  }, [isOpen, timeRemaining, isRunning, playNotificationSound]);

  const handlePresetClick = (minutes: number) => {
    setSelectedDuration(minutes * 60);
    setShowCustomInput(false);
    if (!isRunning) {
      setTimeRemaining(minutes * 60);
    }
  };

  const handleCustomMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(parseInt(e.target.value) || 0, 1), 180);
    setCustomMinutes(value);
    setSelectedDuration(value * 60 + customSeconds);
    if (!isRunning && timeRemaining === initialDuration) {
      setTimeRemaining(value * 60 + customSeconds);
    }
  };

  const handleCustomSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 59);
    setCustomSeconds(value);
    setSelectedDuration(customMinutes * 60 + value);
    if (!isRunning && timeRemaining === initialDuration) {
      setTimeRemaining(customMinutes * 60 + value);
    }
  };

  const progress = ((selectedDuration - timeRemaining) / selectedDuration) * 100;

  const overlayTransition = useTransition(isOpen, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
  });

  const modalTransition = useTransition(isOpen, {
    from: { opacity: 0, transform: 'scale(0.95)' },
    enter: { opacity: 1, transform: 'scale(1)' },
    leave: { opacity: 0, transform: 'scale(0.95)' },
  });

  if (!isOpen) return null;

  return (
    <>
      {overlayTransition((style, item) =>
        item ? (
          <animated.div
            style={style}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
            onClick={handleCancel}
          />
        ) : null
      )}

      {modalTransition((style, item) =>
        item ? (
          <animated.div
            style={style}
            className="fixed inset-0 flex items-center justify-center z-[90]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-sm p-5 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
              {/* Header with accent glow */}
              <div className="text-center mb-5">
                <div className="relative inline-flex">
                  <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full" />
                  <div className="relative w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-3">
                    <ClockIcon className="w-6 h-6 text-white/80" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {t('focus.session') || '专注模式'}
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  {isRunning 
                    ? (isPaused ? t('focus.paused') || '已暂停' : t('focus.active') || '进行中')
                    : t('focus.hint') || '选择时长开始专注'
                  }
                </p>
              </div>

              {/* Timer Display with glow */}
              <div className="text-center mb-5">
                <div className="relative inline-block">
                  {/* Ambient glow */}
                  <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-150" />
                  <animated.div className="relative text-5xl font-mono font-light text-white tracking-wider">
                    {formatTime(timeRemaining)}
                  </animated.div>
                </div>
                <div className="text-sm text-white/50 mt-2">
                  {formatTimeDisplay(timeRemaining)}
                </div>

                {/* Progress Bar with glow */}
                <div className="relative mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-white/5 rounded-full" />
                  <animated.div
                    ref={progressBarRef}
                    className="absolute inset-y-0 left-0 rounded-full bg-white/60 transition-all duration-1000 ease-linear"
                    style={{ 
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              {/* Timer Presets - Pill style */}
              {!isRunning && (
                <div className="mb-5">
                  <p className="text-xs text-white/40 text-center mb-3">
                    {t('focus.duration') || '选择时长'}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.minutes}
                        onClick={() => handlePresetClick(preset.minutes)}
                        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
                          selectedDuration === preset.minutes * 60
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        {preset.label} {t('focus.minutes') || '分钟'}
                      </button>
                    ))}

                    {/* Custom Time Button */}
                    <button
                      onClick={() => setShowCustomInput(!showCustomInput)}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
                        showCustomInput || selectedDuration > 3600
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {t('focus.custom') || '自定义'}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Time Input */}
              {showCustomInput && (
                <div className="mb-5 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={customMinutes}
                        onChange={handleCustomMinutesChange}
                        className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-center text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:bg-white/15 transition-all"
                      />
                      <p className="text-xs text-white/40 text-center mt-1.5">
                        {t('focus.minutes') || '分钟'}
                      </p>
                    </div>
                    <span className="text-white/30 text-lg font-medium">:</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customSeconds}
                        onChange={handleCustomSecondsChange}
                        className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-center text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:bg-white/15 transition-all"
                      />
                      <p className="text-xs text-white/40 text-center mt-1.5">
                        {t('focus.seconds') || '秒'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              {isRunning ? (
                <div className="flex gap-3">
                  <button
                    onClick={handlePause}
                    className={`flex-1 py-3 rounded-2xl font-medium transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] ${
                      isPaused
                        ? 'bg-white/20 text-white hover:bg-white/30 shadow-lg'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {isPaused ? (
                      <div className="flex items-center justify-center gap-2">
                        <PlayIcon className="w-4 h-4" />
                        {t('focus.resume') || '继续'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <PauseIcon className="w-4 h-4" />
                        {t('focus.pause') || '暂停'}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 py-3 rounded-2xl bg-white/20 text-white font-medium hover:bg-white/30 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <CheckIcon className="w-4 h-4" />
                      {t('focus.finish') || '完成'}
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 rounded-2xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <CloseIcon className="w-4 h-4" />
                      {t('common.cancel') || '取消'}
                    </div>
                  </button>
                  <button
                    onClick={handleStart}
                    className="flex-1 py-3 rounded-2xl bg-white/20 text-white font-medium hover:bg-white/30 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <PlayIcon className="w-4 h-4" />
                      {t('focus.start') || '开始'}
                    </div>
                  </button>
                </div>
              )}

              {/* Auto Pause Toggle */}
              {isRunning && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className="text-sm text-white/50">
                    {t('focus.autoPause') || '完成后自动暂停'}
                  </span>
                  <button
                    onClick={() => setAutoPause(!autoPause)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                      autoPause 
                        ? 'bg-white/30' 
                        : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                        autoPause ? 'left-6' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </animated.div>
        ) : null
      )}
    </>
  );
};

export default FocusSessionModal;
