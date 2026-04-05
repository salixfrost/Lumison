import { useState, useEffect, useCallback } from "react";

interface UseResponsiveLayoutOptions {
  mobileBreakpoint?: number;
  initialIsMobile?: boolean;
}

interface UseResponsiveLayoutReturn {
  isMobileLayout: boolean;
  isDesktopLayout: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

export function useResponsiveLayout(
  options: UseResponsiveLayoutOptions = {},
): UseResponsiveLayoutReturn {
  const { mobileBreakpoint = 1024, initialIsMobile = false } = options;

  const [isMobileLayout, setIsMobileLayout] = useState(initialIsMobile);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0,
  );
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
    const updateLayout = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileLayout(event.matches);
    };

    updateLayout(query);
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, [mobileBreakpoint]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateWidth = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    window.visualViewport?.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
      window.visualViewport?.removeEventListener("resize", updateWidth);
    };
  }, []);

  return {
    isMobileLayout,
    isDesktopLayout: !isMobileLayout,
    viewportWidth,
    viewportHeight,
  };
}