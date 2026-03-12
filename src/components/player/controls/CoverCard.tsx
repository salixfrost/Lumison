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
  album?: string;
}

const CoverCard: React.FC<CoverCardProps> = ({
  coverUrl,
  isPlaying,
  showSettingsPopup = false,
  setShowSettingsPopup,
  settingsPopupContent,
  title = '',
  artist = '',
  album,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const [isFavorite, setIsFavorite] = React.useState(false);

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
    <div className="mb-3 w-full max-w-xl">
      {/* Only show cover when coverUrl exists */}
      {displayCover && (
        <div className="relative aspect-square w-52 md:w-56 lg:w-60 mx-auto rounded-[4px] bg-black overflow-hidden shadow-lg">
          <SmartImage
            src={displayCover}
            alt="Album Art"
            containerClassName="absolute inset-0"
            imgClassName="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      )}

      {/* Song Info and Actions Row - Below Cover */}
      <div className="w-52 md:w-56 lg:w-60 mx-auto mt-3 flex items-center justify-between gap-3">
        {/* Song Info - Center */}
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-lg font-bold tracking-tight truncate leading-tight theme-text-primary">
            {title || t("player.noMusicLoaded")}
          </h3>
          <p className="text-xs truncate leading-tight text-white/55 mt-0.5">
            {album && artist ? `${album} / ${artist}` : (album || artist || '')}
          </p>
        </div>

        {/* Favorite + More */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsFavorite((prev) => !prev)}
            className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${isFavorite
              ? 'bg-white/20 text-white'
              : theme === 'light'
                ? 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            title="Favorite"
            aria-label="Favorite"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>

          {setShowSettingsPopup && (
            <div className="relative" ref={settingsContainerRef}>
              <button
                onClick={() => setShowSettingsPopup(!showSettingsPopup)}
                className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${showSettingsPopup
                  ? theme === 'light' ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                  : theme === 'light' ? 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                title={t("player.settings")}
                aria-label={t("player.settings")}
              >
                <MoreVerticalIcon className="w-5 h-5" />
              </button>

              {/* Settings Popup */}
              {showSettingsPopup && settingsPopupContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

CoverCard.displayName = 'CoverCard';

export default CoverCard;
