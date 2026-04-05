import { useState, useCallback } from "react";

interface UseMobilePanelSwipeOptions {
  enabled: boolean;
  swipeThreshold?: number;
  smallSwipeThreshold?: number;
}

interface UseMobilePanelSwipeReturn {
  activePanel: "controls" | "lyrics";
  setActivePanel: (panel: "controls" | "lyrics") => void;
  dragOffsetX: number;
  isDragging: boolean;
  handlers: {
    onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTouchCancel: (event: React.TouchEvent<HTMLDivElement>) => void;
  };
}

export function useMobilePanelSwipe(
  options: UseMobilePanelSwipeOptions = { enabled: true },
): UseMobilePanelSwipeReturn {
  const { enabled, swipeThreshold = 60, smallSwipeThreshold = 10 } = options;

  const [activePanel, setActivePanel] = useState<"controls" | "lyrics">("controls");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!enabled) return;
      setTouchStartX(event.touches[0]?.clientX ?? null);
      setDragOffsetX(0);
      setIsDragging(true);
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!enabled || touchStartX === null) return;
      const currentX = event.touches[0]?.clientX;
      if (currentX === undefined) return;
      const deltaX = currentX - touchStartX;
      const containerWidth = event.currentTarget.getBoundingClientRect().width;
      const limitedDelta = Math.max(
        Math.min(deltaX, containerWidth),
        -containerWidth,
      );
      setDragOffsetX(limitedDelta);
    },
    [enabled, touchStartX],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!enabled || touchStartX === null) return;
      const endX = event.changedTouches[0]?.clientX;
      if (endX === undefined) {
        setTouchStartX(null);
        setDragOffsetX(0);
        setIsDragging(false);
        return;
      }
      const deltaX = endX - touchStartX;

      if (deltaX > swipeThreshold) {
        setActivePanel("controls");
      } else if (deltaX < -swipeThreshold) {
        setActivePanel("lyrics");
      } else if (Math.abs(deltaX) > smallSwipeThreshold) {
        if (activePanel === "lyrics" && deltaX > 0) {
          setActivePanel("controls");
        } else if (activePanel === "controls" && deltaX < 0) {
          setActivePanel("lyrics");
        }
      }

      setTouchStartX(null);
      setDragOffsetX(0);
      setIsDragging(false);
    },
    [enabled, touchStartX, swipeThreshold, smallSwipeThreshold, activePanel],
  );

  const handleTouchCancel = useCallback(() => {
    setTouchStartX(null);
    setDragOffsetX(0);
    setIsDragging(false);
  }, []);

  return {
    activePanel,
    setActivePanel,
    dragOffsetX,
    isDragging,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}