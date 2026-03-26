import { loadImageElementWithCache } from "./cache";
import { generateBlurhash } from "../utils/blurhash";
import { fetchJSON } from "./request";

declare const ColorThief: any;

const colorCache = new Map<string, string[]>();
const COLOR_CACHE_MAX_SIZE = 50;

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Track which base URLs have confirmed CORS support to skip the proxy on subsequent calls
const corsWorkingCache = new Set<string>();

export const fetchViaProxy = async (
  targetUrl: string,
  options?: { signal?: AbortSignal }
): Promise<unknown> => {
  const result = await fetchJSON(targetUrl, {
    signal: options?.signal,
    timeout: 10000,
  });
  return result;
};

export const parseNeteaseLink = (
  input: string,
): { type: "song" | "playlist"; id: string } | null => {
  try {
    const url = new URL(input);
    const params = new URLSearchParams(url.search);
    // Handle music.163.com/#/song?id=... (Hash router)
    if (url.hash.includes("/song") || url.hash.includes("/playlist")) {
      const hashParts = url.hash.split("?");
      if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1]);
        const id = hashParams.get("id");
        if (id) {
          if (url.hash.includes("/song")) return { type: "song", id };
          if (url.hash.includes("/playlist")) return { type: "playlist", id };
        }
      }
    }
    // Handle standard params
    const id = params.get("id");
    if (id) {
      if (url.pathname.includes("song")) return { type: "song", id };
      if (url.pathname.includes("playlist")) return { type: "playlist", id };
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const extractColors = async (imageSrc: string): Promise<string[]> => {
  if (!imageSrc) return [];

  // 检查缓存
  const cachedColors = colorCache.get(imageSrc);
  if (cachedColors) {
    return cachedColors;
  }

  if (typeof ColorThief === "undefined") {
    return ["#4f46e5", "#db2777", "#1f2937"];
  }

  try {
    const img = await loadImageElementWithCache(imageSrc);
    const colorThief = new ColorThief();

    // 获取调色板
    const palette = colorThief.getPalette(img, 10);

    if (!palette || palette.length === 0) {
      return [];
    }

    // 计算颜色的"权重"分数，综合考虑多个因素
    const scoredColors = palette.map((rgb: number[]) => {
      const [r, g, b] = rgb;

      // 1. 亮度 (0-255)
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // 2. 饱和度 (0-255)
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      // 3. 色彩丰富度（避免灰色）
      const colorfulness = saturation / (luminance + 1);

      // 综合评分：
      // - 亮度适中（不要太暗或太亮）
      // - 有一定饱和度（但不过分）
      // - 避免纯灰色
      const luminanceScore = luminance > 40 && luminance < 200 ? 1 : 0.5;
      const saturationScore = saturation > 20 ? Math.min(saturation / 100, 1) : 0.3;
      const colorfulnessScore = colorfulness > 0.1 ? 1 : 0.5;

      const totalScore = luminanceScore * saturationScore * colorfulnessScore;

      return { rgb, score: totalScore, luminance, saturation };
    });

    // 按分数排序
    scoredColors.sort((a, b) => b.score - a.score);

    // 选择前4个颜色，但确保它们有一定的差异性
    const selectedColors: number[][] = [];

    for (const color of scoredColors) {
      if (selectedColors.length >= 4) break;

      // 检查与已选颜色的差异
      const isDifferent = selectedColors.every(selected => {
        const diff = Math.abs(color.rgb[0] - selected[0]) +
          Math.abs(color.rgb[1] - selected[1]) +
          Math.abs(color.rgb[2] - selected[2]);
        return diff > 60; // 确保颜色有足够差异
      });

      if (isDifferent || selectedColors.length === 0) {
        selectedColors.push(color.rgb);
      }
    }

    // 如果没有足够的颜色，用评分最高的填充
    while (selectedColors.length < 4 && scoredColors.length > 0) {
      const nextColor = scoredColors[selectedColors.length];
      if (nextColor) {
        selectedColors.push(nextColor.rgb);
      } else {
        break;
      }
    }

    // 转换为 RGB 字符串
    const colors = selectedColors.map((c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
    
    // 存入缓存
    if (colors.length > 0) {
      if (colorCache.size >= COLOR_CACHE_MAX_SIZE) {
        const firstKey = colorCache.keys().next().value;
        colorCache.delete(firstKey);
      }
      colorCache.set(imageSrc, colors);
    }
    
    return colors;
  } catch {
    return [];
  }
};

export interface ExtractedCoverData {
  colors: string[];
  blurhash: string | null;
}

export const extractCoverData = async (imageSrc: string): Promise<ExtractedCoverData> => {
  const [colors, blurhash] = await Promise.all([
    extractColors(imageSrc),
    generateBlurhash(imageSrc),
  ]);
  return { colors, blurhash };
};

/**
 * Get supported audio formats for the current browser
 */
export const getSupportedAudioFormats = (): Record<string, boolean> => {
  const audio = document.createElement('audio');
  const canPlay = (mimeType: string) => {
    const result = audio.canPlayType(mimeType);
    return result === 'probably' || result === 'maybe';
  };

  return {
    mp3: canPlay('audio/mpeg'),
    wav: canPlay('audio/wav') || canPlay('audio/wave'),
    flac: canPlay('audio/flac'),
    m4a: canPlay('audio/mp4') || canPlay('audio/x-m4a'),
    aac: canPlay('audio/aac') || canPlay('audio/aacp'),
    ogg: canPlay('audio/ogg') || canPlay('audio/ogg; codecs="vorbis"'),
    opus: canPlay('audio/ogg; codecs="opus"') ||
      canPlay('audio/webm; codecs="opus"') ||
      canPlay('audio/opus'),
    webm: canPlay('audio/webm') || canPlay('audio/webm; codecs="opus"'),
    aiff: canPlay('audio/aiff') ||
      canPlay('audio/x-aiff') ||
      canPlay('audio/aif'),
  };
};
