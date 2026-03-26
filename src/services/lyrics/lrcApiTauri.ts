/**
 * LrcApi Tauri Integration
 * Desktop-only: Writes metadata and lyrics to audio files via LrcApi
 * 
 * Note: This requires LrcApi server to be running on localhost:28883
 * Download from: https://github.com/HisAtri/LrcApi
 */

import { invoke } from '@tauri-apps/api/core';

export interface LrcApiTagOptions {
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  lyrics?: string;
}

export interface LrcApiResponse {
  success: boolean;
  statusCode: number;
  error?: string;
}

/**
 * Write audio tags via Tauri command (calls LrcApi)
 * This is the desktop-specific version that uses file system paths
 */
export const writeAudioTagsDesktop = async (
  options: LrcApiTagOptions
): Promise<LrcApiResponse> => {
  try {
    const result = await invoke<string>('write_audio_tags', { 
      options: JSON.stringify(options) 
    });
    return { success: true, statusCode: 200 };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      error: String(error),
    };
  }
};

/**
 * Write lyrics to audio file
 * @param filePath - Absolute file path on the file system
 * @param lyrics - LRC format lyrics
 */
export const writeLyricsToFileDesktop = async (
  filePath: string,
  lyrics: string
): Promise<LrcApiResponse> => {
  return writeAudioTagsDesktop({
    path: filePath,
    lyrics,
  });
};

/**
 * Write full metadata to audio file
 */
export const writeFullMetadataDesktop = async (
  filePath: string,
  title: string,
  artist: string,
  album: string,
  lyrics: string
): Promise<LrcApiResponse> => {
  return writeAudioTagsDesktop({
    path: filePath,
    title,
    artist,
    album,
    lyrics,
  });
};

/**
 * Check if running in Tauri environment
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Write audio tags - cross-platform handler
 * Falls back to HTTP API in web, uses Tauri in desktop
 */
export const writeAudioTagsCrossPlatform = async (
  options: LrcApiTagOptions
): Promise<LrcApiResponse> => {
  if (isTauri()) {
    return writeAudioTagsDesktop(options);
  }
  
  // Fallback to HTTP API (for web/testing)
  const { writeAudioTags } = await import('./lrcApiWriter');
  return writeAudioTags(options);
};