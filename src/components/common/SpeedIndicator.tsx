import React, { useEffect, useState } from "react";
import { useSpring, animated } from "@react-spring/web";
import { useI18n } from "../../contexts/I18nContext";
import { FastForwardIcon } from "./Icons";

interface SpeedIndicatorProps {
  speed: number;
  show: boolean;
}

const SpeedIndicator: React.FC<SpeedIndicatorProps> = ({ speed, show }) => {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const springProps = useSpring({
    opacity: show ? 1 : 0,
    transform: show ? "translate(-50%, 0px) scale(1)" : "translate(-50%, 20px) scale(0.9)",
    config: { tension: 300, friction: 25 },
  });

  if (!isVisible) return null;

  const getSpeedLabel = () => {
    if (speed < 1) return t("speed.slow");
    if (speed === 1) return t("speed.normal");
    if (speed <= 1.5) return t("speed.fast");
    if (speed <= 2) return t("speed.veryFast");
    return t("speed.ultraFast");
  };

  return (
    <animated.div
      style={springProps}
      className="fixed bottom-32 left-1/2 z-[9998] pointer-events-none select-none"
    >
      <div
        className="
          px-6 py-3 rounded-2xl
          bg-black/10 backdrop-blur-2xl saturate-150
          shadow-[0_20px_50px_rgba(0,0,0,0.3)]
          border border-white/10
          flex items-center gap-3
        "
      >
        <FastForwardIcon className="w-5 h-5 text-white" />

        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-white tracking-tight">
            {speed.toFixed(2)}x
          </div>
          <div className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
            {getSpeedLabel()}
          </div>
        </div>

        {/* Speed Bar */}
        <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-200"
            style={{ width: `${Math.min(((speed - 0.5) / 2.5) * 100, 100)}%` }}
          />
        </div>
      </div>
    </animated.div>
  );
};

export default SpeedIndicator;
