import { LyricLine, LyricWord } from "../../types";

// Re-export types for convenience
export type { LyricLine, LyricWord };

/**
 * Metadata indicators for filtering out non-lyric content.
 */
const METADATA_INDICATORS = [
  "by:", // Common LRC metadata
  "offset:",
];

/**
 * Chinese metadata indicators (NetEase style).
 */
const CHINESE_METADATA_INDICATORS = [
  "歌词贡献者",
  "翻译贡献者",
  "作词",
  "作曲",
  "编曲",
  "制作",
  "词曲",
];

/**
 * Combined metadata keywords for lyricsService.ts
 */
export const METADATA_KEYWORDS = [
  ...METADATA_INDICATORS,
  ...CHINESE_METADATA_INDICATORS,
  "lyricist",
  "composer",
  "arrange",
  "translation",
  "translator",
  "producer",
];

/**
 * Check if the given text is a metadata line.
 */
export const isMetadataLine = (text: string): boolean => {
  if (!text) return false;

  // Check for NetEase JSON metadata lines
  if (text.trim().startsWith("{") && text.trim().endsWith("}")) return true;

  const normalized = text.replace(/\s+/g, "").toLowerCase();

  // Check English metadata
  if (
    METADATA_INDICATORS.some((indicator) =>
      normalized.includes(indicator.toLowerCase()),
    )
  ) {
    return true;
  }

  // Check Chinese metadata
  return CHINESE_METADATA_INDICATORS.some((indicator) =>
    normalized.includes(indicator),
  );
};
