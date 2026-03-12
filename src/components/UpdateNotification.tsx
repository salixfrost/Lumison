import React, { useState, useEffect } from 'react';
import { UpdateService } from '../services/updateService';
import { useI18n } from '../contexts/I18nContext';

interface UpdateNotificationProps {
  version: string;
  onClose: () => void;
  onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  version,
  onClose,
  onUpdate,
}) => {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Example: Replace this with your actual logic to detect if a song is playing
    const checkIfPlaying = () => {
      // Simulate a function that checks if a song is playing
      const playing = false; // Replace with actual logic
      setIsPlaying(playing);
    };

    checkIfPlaying();

    // Optionally, set up an interval or event listener to update the state
    // Example: setInterval(checkIfPlaying, 1000);

    return () => {
      // Cleanup if using intervals or event listeners
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    const success = await UpdateService.downloadAndInstall((p) => {
      setProgress(Math.round(p));
    });

    if (!success) {
      setIsUpdating(false);
      // Update failed, show error
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Main card */}
        <div className="relative bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Animated gradient border */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 opacity-50" />

          <div className="relative p-6 w-96">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Animated icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-md opacity-50 animate-pulse" />
                  <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                    <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold text-base mb-0.5">
                    {t('update.available') || 'New Update Available'}
                  </h3>
                  <p className="text-white/50 text-sm">
                    {t('update.version') || 'Version'} {version}
                  </p>
                </div>
              </div>

              {/* Close button */}
              {!isUpdating && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all duration-200 backdrop-blur-xl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Progress bar */}
            {isUpdating && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-white/60 mb-2">
                  <span>{t('update.downloading') || 'Downloading...'}</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden backdrop-blur-xl border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${progress}%` }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                      style={{
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2s infinite'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {!isUpdating && (
              <p className="text-white/40 text-sm mb-4 leading-relaxed">
                {t('update.description') || 'A new version is available with performance improvements and bug fixes.'}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={isUpdating ? undefined : handleUpdate}
                disabled={isUpdating}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl border border-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/20"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('update.updating') || 'Updating...'}
                  </span>
                ) : (
                  t('update.updateNow') || 'Update Now'
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isUpdating}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl border border-white/10 hover:border-white/20"
              >
                {t('update.later') || 'Later'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
