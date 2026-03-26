/**
 * LrcApi Tag Writer Service
 * Writes metadata and lyrics to audio files using LrcApi
 * https://github.com/HisAtri/LrcApi
 */

const LRC_API_URL = 'http://127.0.0.1:28883/tag';

export interface WriteTagOptions {
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  lyrics?: string;
}

export interface WriteTagResult {
  success: boolean;
  statusCode: number;
  error?: string;
}

export const writeAudioTags = async (
  options: WriteTagOptions
): Promise<WriteTagResult> => {
  try {
    const response = await fetch(LRC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const result: WriteTagResult = {
      success: response.ok,
      statusCode: response.status,
    };

    if (!response.ok) {
      const errorText = await response.text();
      result.error = errorText || `HTTP ${response.status}`;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      statusCode: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

export const writeLyricsToFile = async (
  filePath: string,
  lyrics: string
): Promise<WriteTagResult> => {
  return writeAudioTags({
    path: filePath,
    lyrics,
  });
};

export const writeSongMetadata = async (
  filePath: string,
  title?: string,
  artist?: string,
  album?: string
): Promise<WriteTagResult> => {
  return writeAudioTags({
    path: filePath,
    title,
    artist,
    album,
  });
};

export const writeFullMetadata = async (
  filePath: string,
  title: string,
  artist: string,
  album: string,
  lyrics: string
): Promise<WriteTagResult> => {
  return writeAudioTags({
    path: filePath,
    title,
    artist,
    album,
    lyrics,
  });
};

export const isLrcApiAvailable = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(LRC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
};