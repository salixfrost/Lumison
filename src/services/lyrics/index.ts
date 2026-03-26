/**
 * Lyrics Services Index
 */

import { LyricLine } from "../../types";
import { parseLrc, parsePlainTextLyrics } from "./lrc";

/**
 * Parse lyrics content, auto-detecting format.
 * - LRC format (has timestamps): uses parseLrc
 * - Plain text (no timestamps): uses parsePlainTextLyrics
 */
export const parseLyrics = (content: string): LyricLine[] => {
  if (!content?.trim()) return [];

  // Check if content has LRC timestamps (e.g., [00:00.00] or <00:00.00>)
  const hasLrcTimestamps = /\[(\d{2}):(\d{2})[\\.,:](\d{2,3})\]/.test(content) ||
    /<(\d{2}):(\d{2})[\\.,:](\d{2,3})>/.test(content);

  if (hasLrcTimestamps) {
    return parseLrc(content);
  }

  return parsePlainTextLyrics(content);
};

export * from './id3Parser';
export * from './lrc';
export * from './netease';
export * from './parser';
export * from './translation';
export * from './types';
export * from './matchCache';
export * from './lrcApiWriter';