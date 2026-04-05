import React from "react";
import { animated } from "@react-spring/web";
import { PlayMode } from "../../../types";
import { useI18n } from "../../../contexts/I18nContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { FastForwardIcon, ShuffleIcon } from "../../common/Icons";
import { VISUAL_MODE_LABELS, onVisualModeChange } from "../../layout/ShaderBackground";

interface SettingsPopupProps {
  style: any;
  speed: number;
  onSpeedChange: (speed: number) => void;
  playMode: PlayMode;
  onToggleMode: (mode: PlayMode) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  getVolumeButtonIcon: () => React.ReactNode;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({
  style,
  speed,
  onSpeedChange,
  playMode,
  onToggleMode,
  volume,
  onVolumeChange,
  getVolumeButtonIcon,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();

  const speedPresets = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const [showPresets, setShowPresets] = React.useState(false);

  const getCurrentMode = () => {
    if (typeof window === 'undefined') return 'gradient';
    const stored = localStorage.getItem('lumison-visual-mode');
    if (stored === 'melt' || stored === 'fluid' || stored === 'gradient') return stored;
    return 'gradient';
  };
  const [modeRefresh, setModeRefresh] = React.useState(0);
  const currentMode = React.useMemo(() => getCurrentMode(), [modeRefresh]);

  React.useEffect(() => {
    const handleChange = () => setModeRefresh(n => n + 1);
    window.addEventListener('visual-mode-changed', handleChange);
    return () => window.removeEventListener('visual-mode-changed', handleChange);
  }, []);

  return (
    <animated.div
      style={style}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 z-50 p-3 min-w-[260px] rounded-[20px] bg-black/10 backdrop-blur-optimized saturate-150 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/5 flex flex-col gap-3 cursor-auto hw-accelerate"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <FastForwardIcon className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">
              {speed === 1 ? '1x' : `${speed.toFixed(2)}x`}
            </span>
          </button>

          {showPresets && (
            <div className="absolute bottom-full mb-2 left-0 p-2 rounded-2xl bg-black/10 backdrop-blur-optimized saturate-150 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/5 flex flex-col gap-1 hw-accelerate">
              {speedPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    onSpeedChange(preset);
                    setShowPresets(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${Math.abs(speed - preset) < 0.01
                    ? "bg-white text-black"
                    : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                >
                  {preset}x
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleMode(PlayMode.LOOP_ALL)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${playMode === PlayMode.LOOP_ALL
              ? "bg-white text-black"
              : "bg-white/20 text-white hover:bg-white/30"
              }`}
            title={t("player.loopAll") || "顺序播放"}
            aria-label={t("player.loopAll") || "顺序播放"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>

          <button
            onClick={() => onToggleMode(PlayMode.LOOP_ONE)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${playMode === PlayMode.LOOP_ONE
              ? "bg-white text-black"
              : "bg-white/20 text-white hover:bg-white/30"
              }`}
            title={t("player.loopOne") || "单曲循环"}
            aria-label={t("player.loopOne") || "单曲循环"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              <text x="12" y="14" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">1</text>
            </svg>
          </button>

          <button
            onClick={() => onToggleMode(PlayMode.SHUFFLE)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${playMode === PlayMode.SHUFFLE
              ? "bg-white text-black"
              : "bg-white/20 text-white hover:bg-white/30"
              }`}
            title={t("player.shuffle")}
            aria-label={t("player.shuffle")}
          >
            <ShuffleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full flex items-center gap-3">
        <button
          onClick={() => onVolumeChange(volume === 0 ? 0.5 : 0)}
          className={`p-2 rounded-full transition-all duration-150 ease-out active:scale-90 hover:bg-white/10 active:bg-white/20 ${theme === 'light' ? 'text-black/70 hover:text-black' : 'text-white/70 hover:text-white'}`}
          title={t("player.volume")}
          aria-label={t("player.volume")}
        >
          {getVolumeButtonIcon()}
        </button>

        <div className="relative flex-1 h-8 flex items-center cursor-pointer group">
          <div className="absolute inset-x-0 h-1 theme-bg-overlay rounded-full group-hover:h-1.5 transition-[height] duration-200 ease-out"></div>

          <div
            className="absolute left-0 h-1 rounded-full group-hover:h-1.5 transition-[height] duration-200 ease-out"
            style={{
              width: `${volume * 100}%`,
              backgroundColor: theme === 'light' ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)",
              transition: 'background-color 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), height 0.2s ease-out',
            }}
          ></div>

          <input
            id="volume-range-settings"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">{t('settings.visual')}</span>
        <div className="flex gap-1">
          {(Object.keys(VISUAL_MODE_LABELS) as Array<keyof typeof VISUAL_MODE_LABELS>).map((mode) => (
            <button
              key={mode}
              onClick={() => onVisualModeChange(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentMode === mode
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {t(`visualMode.${mode}`)}
            </button>
          ))}
        </div>
      </div>
    </animated.div>
  );
};

export { onVisualModeChange };
export default SettingsPopup;
