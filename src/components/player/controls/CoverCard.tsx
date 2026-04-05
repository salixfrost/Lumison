import React, { useRef, useCallback, useEffect } from 'react';
import { useTransition, animated } from '@react-spring/web';
import SmartImage from '../../common/SmartImage';
import { useI18n } from '../../../contexts/I18nContext';
import { MoreVerticalIcon, QueueIcon } from '../../common/Icons';
import { useTheme } from '../../../contexts/ThemeContext';

interface CoverCardProps {
  coverUrl?: string;
  blurhash?: string | null;
  isPlaying: boolean;
  showSettingsPopup?: boolean;
  setShowSettingsPopup?: (show: boolean) => void;
  settingsPopupContent?: React.ReactNode;
  title?: string;
  artist?: string;
  album?: string;
  onTogglePlaylist?: () => void;
  showPlaylistPopup?: boolean;
}

const CoverCard: React.FC<CoverCardProps> = ({
  coverUrl,
  blurhash,
  isPlaying,
  showSettingsPopup = false,
  setShowSettingsPopup,
  settingsPopupContent,
  title = '',
  artist = '',
  album,
  onTogglePlaylist,
  showPlaylistPopup = false,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const settingsContainerRef = useRef<HTMLDivElement>(null);

  const displayCover = coverUrl;

  // Settings popup animation - same as playlist popup
  const settingsTransitions = useTransition(showSettingsPopup, {
    from: { opacity: 0, transform: 'translateY(-20px) scale(0.95)' },
    enter: { opacity: 1, transform: 'translateY(0px) scale(1)' },
    leave: { opacity: 0, transform: 'translateY(-20px) scale(0.95)' },
    config: { tension: 280, friction: 24 },
  });

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
        <div className="relative aspect-square w-72 md:w-80 lg:w-96 mx-auto rounded-[4px] bg-black overflow-hidden shadow-lg">
          <SmartImage
            src={displayCover}
            blurhash={blurhash}
            alt="Album Art"
            containerClassName="absolute inset-0"
            imgClassName="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      )}

      {/* Song Info and Actions Row - Below Cover */}
      <div className="w-72 md:w-80 lg:w-96 mx-auto mt-3 flex items-center justify-between gap-3">
        {/* Song Info - Center */}
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-lg font-bold tracking-tight truncate leading-tight theme-text-primary">
            {title || t("player.noMusicLoaded")}
          </h3>
          {artist && (
            <p 
              className="text-xs truncate leading-tight text-white/55 mt-0.5 cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => {
                window.open(`https://zh.wikipedia.org/wiki/${encodeURIComponent(artist)}`, '_blank');
              }}
              title={t("player.searchOnWikipedia")}
            >
              {album && artist ? `${album} / ${artist}` : (album || artist || '')}
            </p>
          )}
        </div>

        {/* More */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onTogglePlaylist && (
            <button
              onClick={onTogglePlaylist}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${showPlaylistPopup
                ? theme === 'light' ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                : theme === 'light' ? 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              title={t("playlist.title") || "Playlist"}
              aria-label={t("playlist.title") || "Playlist"}
            >
              <QueueIcon className="w-5 h-5" />
            </button>
          )}

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
              {settingsTransitions((style, item) =>
                item && settingsPopupContent ? (
                  <animated.div
                    style={style}
                    className="absolute right-0 top-full mt-2 z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {settingsPopupContent}
                  </animated.div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

CoverCard.displayName = 'CoverCard';

export default CoverCard;
