import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlowingLayer, createFlowingLayers, defaultColors as mobileDefaultColors } from "./Background/mobile";
import { UIBackgroundRender } from "./Background/renderer/UIBackgroundRender";

const desktopGradientDefaults = [
  "rgb(30, 30, 60)",
  "rgb(60, 30, 90)",
  "rgb(90, 30, 60)",
];

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

const calculateTransform = (layer: FlowingLayer, elapsed: number) => {
  const progress = ((elapsed + layer.startTime) % layer.duration) / layer.duration;
  const eased = easeInOutSine(progress);

  const x = layer.startX + Math.sin(progress * Math.PI * 2) * 0.15;
  const y = layer.startY + Math.cos(progress * Math.PI * 2) * 0.12;
  const scale = layer.startScale + Math.sin(progress * Math.PI * 2) * 0.08;
  const rotation = Math.sin(progress * Math.PI * 2) * 0.08;

  return { x, y, scale, rotation, eased };
};

interface FluidBackgroundProps {
  colors?: string[];
  isPlaying?: boolean;
  coverUrl?: string;
  isMobileLayout?: boolean;
  theme?: 'light' | 'dark';
}

const FluidBackground: React.FC<FluidBackgroundProps> = ({
  colors,
  isPlaying = true,
  coverUrl,
  isMobileLayout = false,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<UIBackgroundRender | null>(null);
  const layersRef = useRef<FlowingLayer[]>([]);
  const isPlayingRef = useRef(isPlaying);
  const startTimeOffsetRef = useRef(0);
  const lastPausedTimeRef = useRef(0);
  const colorsRef = useRef<string[] | undefined>(colors);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const previousModeRef = useRef(isMobileLayout);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (previousModeRef.current !== isMobileLayout) {
      setCanvasInstanceKey((prev) => prev + 1);
      previousModeRef.current = isMobileLayout;
    }
  }, [isMobileLayout]);

  const normalizedColors = useMemo(
    () => (colors && colors.length > 0 ? colors : mobileDefaultColors),
    [colors],
  );

  const colorKey = useMemo(() => normalizedColors.join("|"), [normalizedColors]);

  useEffect(() => {
    colorsRef.current = colors && colors.length > 0 ? colors : desktopGradientDefaults;
  }, [colors]);

  useEffect(() => {
    if (!isMobileLayout) {
      layersRef.current = [];
      return;
    }
    let cancelled = false;
    const generate = async () => {
      const newLayers = await createFlowingLayers(normalizedColors, coverUrl, 2);
      if (cancelled) return;
      layersRef.current = newLayers;
    };
    generate();
    return () => {
      cancelled = true;
    };
  }, [colorKey, coverUrl, normalizedColors, isMobileLayout]);

  const renderMobileFrame = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      let elapsed = currentTime;

      if (!isPlayingRef.current) {
        lastPausedTimeRef.current = currentTime;
        elapsed = startTimeOffsetRef.current;
      } else if (lastPausedTimeRef.current > 0) {
        startTimeOffsetRef.current = elapsed;
        lastPausedTimeRef.current = 0;
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      if (layersRef.current.length === 0) return;

      layersRef.current.forEach((layer, index) => {
        const transform = calculateTransform(layer, elapsed);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(transform.rotation);
        ctx.scale(transform.scale, transform.scale);
        ctx.translate(width * transform.x, height * transform.y);
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.4 + index * 0.05;
        ctx.filter = `blur(20px)`;
        const drawWidth = width * 1.5;
        const drawHeight = height * 1.5;
        ctx.drawImage(
          layer.image,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight,
        );
        ctx.restore();
      });
    },
    [],
  );

  const renderGradientFrame = useCallback((ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const palette = colorsRef.current && colorsRef.current.length > 0
      ? colorsRef.current
      : desktopGradientDefaults;

    const gradient = ctx.createLinearGradient(0, 0, width, height);

    // 让第一个颜色（最主要的）占更大比例
    if (palette.length >= 3) {
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(0.5, palette[0]); // 主色占到 50%
      gradient.addColorStop(0.75, palette[1]); // 第二色占 25%
      gradient.addColorStop(1, palette[2]); // 第三色占 25%
    } else {
      // 如果颜色少于3个，使用均匀分布
      palette.forEach((color, index) => {
        gradient.addColorStop(index / Math.max(1, palette.length - 1), color);
      });
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (rendererRef.current) {
      rendererRef.current.stop();
      rendererRef.current = null;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const renderCallback = isMobileLayout ? renderMobileFrame : renderGradientFrame;
    const uiRenderer = new UIBackgroundRender(canvas, renderCallback);
    uiRenderer.resize(window.innerWidth, window.innerHeight);
    uiRenderer.setPaused(false);
    uiRenderer.start();
    rendererRef.current = uiRenderer;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      uiRenderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      uiRenderer.stop();
      rendererRef.current = null;
    };
  }, [isMobileLayout, renderGradientFrame, renderMobileFrame, canvasInstanceKey]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer instanceof UIBackgroundRender) {
      // 对于移动端的动画图层，根据播放状态暂停/恢复
      // 对于桌面端的静态渐变，始终保持渲染
      if (isMobileLayout) {
        renderer.setPaused(!isPlaying);
      }
    }
  }, [isPlaying, isMobileLayout]);

  const canvasKey = `canvas-${isMobileLayout ? "mobile" : "desktop"}-${canvasInstanceKey}`;

  return (
    <canvas
      ref={canvasRef}
      key={canvasKey}
      className="fixed inset-0 w-full h-full bg-black"
      style={{ touchAction: "none" }}
    />
  );
};

export default FluidBackground;
