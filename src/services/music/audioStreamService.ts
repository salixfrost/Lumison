/**
 * Audio Stream Service
 * Support for stable audio sources: Internet Archive and self-hosted audio
 */

import { fetchViaProxy } from "../utils";

interface AudioStreamTrackInfo {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  duration?: number;
  audioUrl: string;
  source: 'internet-archive' | 'self-hosted';
}

interface AudioStreamError {
  code: 'FETCH_FAILED' | 'INVALID_URL' | 'NETWORK_ERROR';
  message: string;
}

/**
 * Parse Internet Archive URL
 * Supports: https://archive.org/details/[identifier]
 */
const parseInternetArchiveUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('archive.org')) {
      const match = urlObj.pathname.match(/\/details\/([^\/]+)/);
      if (match) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Fetch Internet Archive audio metadata
 */
const fetchInternetArchiveAudio = async (
  identifier: string
): Promise<AudioStreamTrackInfo | null> => {
  try {
    const metadataUrl = `https://archive.org/metadata/${identifier}`;
    const data = await fetchViaProxy(metadataUrl);

    if (!data.files) {
      return null;
    }

    // Find audio file (prefer MP3, then OGG, then other formats)
    const audioFile = data.files.find((file: any) =>
      file.format === 'VBR MP3' ||
      file.format === 'MP3' ||
      file.format === 'Ogg Vorbis' ||
      file.format === '128Kbps MP3'
    );

    if (!audioFile) {
      return null;
    }

    const metadata = data.metadata || {};
    const title = metadata.title || identifier;
    const artist = metadata.creator || metadata.artist || 'Unknown Artist';

    // Get cover image
    let coverUrl: string | undefined;
    const imageFile = data.files.find((file: any) =>
      file.format === 'JPEG' ||
      file.format === 'PNG' ||
      file.name.includes('thumb')
    );
    if (imageFile) {
      coverUrl = `https://archive.org/download/${identifier}/${imageFile.name}`;
    }

    // Construct audio URL
    const audioUrl = `https://archive.org/download/${identifier}/${audioFile.name}`;

    return {
      id: identifier,
      title: Array.isArray(title) ? title[0] : title,
      artist: Array.isArray(artist) ? artist[0] : artist,
      coverUrl,
      duration: audioFile.length ? parseFloat(audioFile.length) * 1000 : undefined,
      audioUrl,
      source: 'internet-archive',
    };
  } catch (error) {
    console.error('Failed to fetch Internet Archive audio:', error);
    return null;
  }
};

/**
 * Validate self-hosted audio URL
 * Checks if URL is a direct audio file
 */
const validateSelfHostedAudio = async (
  url: string
): Promise<AudioStreamTrackInfo | null> => {
  try {
    // Validate URL format
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (error) {
      console.log('Invalid URL format:', url);
      return null;
    }

    const pathname = urlObj.pathname.toLowerCase();

    // Check if URL ends with audio extension
    const audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.aac', '.opus'];
    const hasAudioExtension = audioExtensions.some(ext => pathname.endsWith(ext));

    if (!hasAudioExtension) {
      return null;
    }

    // Try to fetch headers to verify it's accessible
    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('audio/')) {
      return null;
    }

    // Extract filename as title
    const filename = pathname.split('/').pop() || 'Unknown';
    const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

    return {
      id: url,
      title,
      artist: 'Self-hosted',
      audioUrl: url,
      source: 'self-hosted',
    };
  } catch (error) {
    console.error('Failed to validate self-hosted audio:', error);
    return null;
  }
};

/**
 * Parse and fetch audio from URL
 * Supports Internet Archive and self-hosted audio
 */
export const fetchAudioFromUrl = async (
  url: string
): Promise<{ track: AudioStreamTrackInfo | null; error?: AudioStreamError }> => {
  try {
    // Try Internet Archive
    const iaIdentifier = parseInternetArchiveUrl(url);
    if (iaIdentifier) {
      const track = await fetchInternetArchiveAudio(iaIdentifier);
      if (track) {
        return { track };
      }
      return {
        track: null,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch audio from Internet Archive',
        },
      };
    }

    // Try self-hosted audio
    const selfHosted = await validateSelfHostedAudio(url);
    if (selfHosted) {
      return { track: selfHosted };
    }

    return {
      track: null,
      error: {
        code: 'INVALID_URL',
        message: 'URL is not a valid Internet Archive or self-hosted audio link',
      },
    };
  } catch (error) {
    return {
      track: null,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
};
