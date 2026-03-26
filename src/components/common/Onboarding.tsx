import React, { useEffect, useState } from "react";
import { useI18n } from "../../contexts/I18nContext";

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { t, locale } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = locale === "zh"
    ? [
        { title: "搜索音乐", desc: "Ctrl+K 快速搜索网易云音乐", icon: "🔍" },
        { title: "歌词模式", desc: "按 L 键进入全屏歌词", icon: "🎵" },
        { title: "快捷键", desc: "使用键盘控制播放", icon: "⌨️" },
      ]
    : [
        { title: "Search Music", desc: "Ctrl+K to search Netease", icon: "🔍" },
        { title: "Lyrics Mode", desc: "Press L for fullscreen lyrics", icon: "🎵" },
        { title: "Keyboard", desc: "Use keyboard controls", icon: "⌨️" },
      ];

  useEffect(() => {
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const current = steps[currentStep];

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/90 backdrop-blur-md"
      onClick={goNext}
    >
      <div className="flex flex-col items-center gap-6 max-w-sm mx-6 text-center">
        <div className="text-5xl">{current.icon}</div>
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            {current.title}
          </h2>
          <p className="text-white/60">{current.desc}</p>
        </div>

        <div className="flex gap-2 mt-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentStep ? "bg-white w-4" : "bg-white/30"
              }`}
            />
          ))}
        </div>

        <p className="text-white/30 text-sm mt-4">
          {locale === "zh" ? "点击继续" : "Click to continue"}
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
