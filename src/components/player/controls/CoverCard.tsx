import React, { useRef, useCallback, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import SmartImage from '../../common/SmartImage';
import { useI18n } from '../../../contexts/I18nContext';
import { MoreVerticalIcon } from '../../common/Icons';
import { useTheme } from '../../../contexts/ThemeContext';

interface CoverCardProps {
  coverUrl?: string;
  isPlaying: boolean;
  showSettingsPopup?: boolean;
  setShowSettingsPopup?: (show: boolean) => void;
  settingsPopupContent?: React.ReactNode;
  title?: string;
  artist?: string;
}

const CoverCard: React.FC<CoverCardProps> = ({
  coverUrl,
  isPlaying,
  showSettingsPopup = false,
  setShowSettingsPopup,
  settingsPopupContent,
  title = '',
  artist = '',
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const settingsContainerRef = useRef<HTMLDivElement>(null);

  const displayCover = coverUrl;

  // Close settings popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsContainerRef.current &&
        !settingsContainerRef.current.contains(event.target as Node)
      ) {
        setShowSettingsPopup?.(false);
      }
    };
    if (showSettingsPopup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettingsPopup, setShowSettingsPopup]);

  return (
    <div className="mb-6 w-full max-w-xl">
      {/* Only show cover when coverUrl exists */}
      {displayCover && (
        <div className="relative aspect-square w-64 md:w-72 lg:w-80 mx-auto rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 ring-1 ring-white/10 overflow-hidden shadow-lg">
          <SmartImage
            src={displayCover}
            alt="Album Art"
            containerClassName="absolute inset-0"
            imgClassName="w-full h-full object-cover"
            loading="eager"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
        </div>
      )}

      {/* Song Info and Actions Row - Below Cover */}
      <div className="w-64 md:w-72 lg:w-80 mx-auto mt-4 flex items-center justify-between gap-3">
        {/* Song Info - Center */}
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-base font-semibold tracking-tight truncate theme-text-primary">
            {title || t("player.noMusicLoaded")}
          </h3>
          <p className="text-sm font-medium truncate theme-text-secondary">
            {artist || ''}
          </p>
        </div>

        {/* Settings Menu Button */}
        {setShowSettingsPopup && (
          <div className="relative flex-shrink-0" ref={settingsContainerRef}>
            <button
              onClick={() => setShowSettingsPopup(!showSettingsPopup)}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${showSettingsPopup
                ? theme === 'light' ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                : theme === 'light' ? 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              title={t("player.settings")}
            >
              <MoreVerticalIcon className="w-5 h-5" />
            </button>

            {/* Settings Popup */}
            {showSettingsPopup && settingsPopupContent}
          </div>
        )}
      </div>
    </div>
  );
};

CoverCard.displayName = 'CoverCard';

export default CoverCard;
