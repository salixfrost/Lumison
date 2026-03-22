import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { CheckIcon, CloseIcon, ClockIcon, PauseIcon } from '../common/Icons';
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
            <div className="relative w-full max-w-md p-6 rounded-3xl bg-black/40 backdrop-blur-2xl saturate-150 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
              {/* Header */}
              <div className="text-center mb-6">
                <ClockIcon className="w-8 h-8 mx-auto text-white/70 mb-2" />
                <h2 className="text-xl font-semibold text-white">
                  {t('focus.session') || '专注模式'}
                </h2>
              </div>

              {/* Timer Display */}
              <div className="text-center mb-6">
                <animated.div className="text-6xl font-mono font-light text-white mb-2">
                  {formatTime(timeRemaining)}
                </animated.div>
                <div className="text-sm text-white/60 mb-4">
                  {formatTimeDisplay(timeRemaining)}
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <animated.div
                    ref={progressBarRef}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Timer Presets */}
              {!isRunning && (
                <div className="mb-6">
                  <p className="text-xs text-white/50 text-center mb-3">
                    {t('focus.duration') || '选择时长'}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.minutes}
                        onClick={() => handlePresetClick(preset.minutes)}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                          selectedDuration === preset.minutes * 60
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {preset.label} {t('focus.minutes') || '分钟'}
                      </button>
                    ))}

                    {/* Custom Time Button */}
                    <button
                      onClick={() => setShowCustomInput(!showCustomInput)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        showCustomInput || selectedDuration > 3600
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {t('focus.custom') || '自定义'}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Time Input */}
              {showCustomInput && (
                <div className="mb-6 p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-white/50 block mb-1">
                        {t('focus.minutes') || '分钟'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={customMinutes}
                        onChange={handleCustomMinutesChange}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-white/40"
                      />
                    </div>
                    <span className="text-white/50">:</span>
                    <div className="flex-1">
                      <label className="text-xs text-white/50 block mb-1">
                        {t('focus.seconds') || '秒'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customSeconds}
                        onChange={handleCustomSecondsChange}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-white/40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              {isRunning ? (
                <div className="flex gap-3">
                  <button
                    onClick={handlePause}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all duration-200 ${
                      isPaused
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {isPaused ? (
                      <>
                        <PauseIcon className="w-4 h-4 mx-auto mb-1" />
                        {t('focus.resume') || '继续'}
                      </>
                    ) : (
                      <>
                        <PauseIcon className="w-4 h-4 mx-auto mb-1" />
                        {t('focus.pause') || '暂停'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all duration-200"
                  >
                    <CheckIcon className="w-4 h-4 mx-auto mb-1" />
                    {t('focus.finish') || '完成'}
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 transition-all duration-200"
                  >
                    <CloseIcon className="w-4 h-4 mx-auto mb-1" />
                    {t('common.cancel') || '取消'}
                  </button>
                  <button
                    onClick={handleStart}
                    className="flex-1 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all duration-200"
                  >
                    {t('focus.start') || '开始'}
                  </button>
                </div>
              )}

              {/* Auto Pause Toggle */}
              {isRunning && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-sm text-white/60">
                    {t('focus.autoPause') || '完成后自动暂停'}
                  </span>
                  <button
                    onClick={() => setAutoPause(!autoPause)}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                      autoPause ? 'bg-white' : 'bg-white/30'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        autoPause ? 'translate-x-5' : 'translate-x-0'
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
