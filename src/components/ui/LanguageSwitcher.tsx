import React, { useState, useRef, useEffect } from "react";
import { useSpring, animated, useTransition } from "@react-spring/web";
import { useI18n } from "../../contexts/I18nContext";
import { Locale, localeNames } from "../../i18n";
import { useTheme } from "../../contexts/ThemeContext";

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'default' | 'settings' | 'topbar'; // 新增 topbar 变体
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = "",
  variant = 'default'
}) => {
  const { locale, setLocale, t } = useI18n();
  const { theme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const locales: Locale[] = ["en", "zh"];

  const menuTransitions = useTransition(showMenu, {
    from: { opacity: 0, transform: "translateY(-10px) scale(0.95)" },
    enter: { opacity: 1, transform: "translateY(0px) scale(1)" },
    leave: { opacity: 0, transform: "translateY(-10px) scale(0.95)" },
    config: { tension: 300, friction: 25 },
  });

  // 滚轮切换语言
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const currentIndex = locales.indexOf(locale);
    let nextIndex: number;

    if (e.deltaY > 0) {
      // 向下滚动，切换到下一个语言
      nextIndex = (currentIndex + 1) % locales.length;
    } else {
      // 向上滚动，切换到上一个语言
      nextIndex = (currentIndex - 1 + locales.length) % locales.length;
    }

    setLocale(locales[nextIndex]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setShowMenu(false);
  };

  // TopBar 样式（紧凑圆形按钮）
  if (variant === 'topbar') {
    return (
      <div ref={containerRef} className={`relative ${className}`} onWheel={handleWheel}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center transition-all duration-300 ease-out shadow-sm hover:scale-110 active:scale-95 ${showMenu ? "text-white bg-white/20 scale-110" : "text-white/80 hover:bg-white/20 hover:text-white"
            }`}
          title={t("topBar.language")}
          aria-label={t("topBar.language")}
        >
          <span className="text-sm font-bold">{locale.toUpperCase()}</span>
        </button>

        {menuTransitions((style, item) =>
          item ? (
            <animated.div
              style={style}
              className="absolute top-full right-0 mt-3 min-w-[120px] rounded-2xl bg-black/40 backdrop-blur-2xl saturate-150 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden z-50"
            >
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleLocaleChange(loc)}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm font-medium
                    transition-colors duration-150
                    flex items-center justify-between
                    ${locale === loc
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  <span>{localeNames[loc]}</span>
                  {locale === loc && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </animated.div>
          ) : null
        )}
      </div>
    );
  }

  // Settings 样式（在设置弹窗中使用）
  if (variant === 'settings') {
    return (
      <div ref={containerRef} className={`relative ${className}`} onWheel={handleWheel}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all"
          title="Scroll to change language"
        >
          <span className="text-sm">{t("topBar.language")}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/90">{localeNames[locale]}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {menuTransitions((style, item) =>
          item ? (
            <animated.div
              style={style}
              className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl bg-black/60 backdrop-blur-2xl saturate-150 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
            >
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleLocaleChange(loc)}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm font-medium
                    transition-colors duration-150
                    flex items-center justify-between
                    ${locale === loc
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  <span>{localeNames[loc]}</span>
                  {locale === loc && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </animated.div>
          ) : null
        )}
      </div>
    );
  }

  // Default 样式（原有样式）
  return (
    <div ref={containerRef} className={`relative ${className}`} onWheel={handleWheel}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`
          px-3 py-2 rounded-xl
          transition-all duration-200
          flex items-center gap-2
          ${theme === "light"
            ? "bg-black/5 hover:bg-black/10 text-black/70 hover:text-black"
            : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
          }
        `}
        title="Click to open menu, scroll to change language"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="text-sm font-medium">{localeNames[locale]}</span>
      </button>

      {menuTransitions((style, item) =>
        item ? (
          <animated.div
            style={style}
            className={`
              absolute top-full right-0 mt-2 z-50
              min-w-[140px] rounded-2xl
              backdrop-blur-[100px] saturate-150
              shadow-[0_20px_50px_rgba(0,0,0,0.3)]
              border overflow-hidden
              ${theme === "light"
                ? "bg-white/90 border-black/10"
                : "bg-black/40 border-white/10"
              }
            `}
          >
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className={`
                  w-full px-4 py-2.5 text-left text-sm font-medium
                  transition-colors duration-150
                  flex items-center justify-between
                  ${locale === loc
                    ? theme === "light"
                      ? "bg-black/10 text-black"
                      : "bg-white/20 text-white"
                    : theme === "light"
                      ? "text-black/70 hover:bg-black/5 hover:text-black"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <span>{localeNames[loc]}</span>
                {locale === loc && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </animated.div>
        ) : null
      )}
    </div>
  );
};

export default LanguageSwitcher;
