/**
 * Internet Archive Service
 * Utility functions for searching and fetching audio from archive.org
 */

import { fetchViaProxy } from "../../../services/utils";

export interface ArchiveSearchOptions {
  query: string;
  collection?: string;
  format?: 'MP3' | 'FLAC' | 'Ogg Vorbis';
  limit?: number;
  page?: number;
}

export interface ArchiveItem {
  identifier: string;
  title: string;
  creator?: string;
  description?: string;
  date?: string;
  subject?: string[];
}

export interface ArchiveAudioFile {
  name: string;
  format: string;
  size: number;
  length?: number; // Duration in seconds
  url: string;
}

export interface ArchiveMetadata {
  identifier: string;
  title: string;
  creator?: string;
  description?: string;
  audioFiles: ArchiveAudioFile[];
  coverImage?: string;
  metadata: Record<string, any>;
}

/**
 * Search Internet Archive for audio content
 */
export async function searchArchive(options: ArchiveSearchOptions): Promise<ArchiveItem[]> {
  const {
    query,
    collection = 'opensource_audio',
    format = 'MP3',
    limit = 20,
    page = 1
  } = options;

  const searchUrl = new URL('https://archive.org/advancedsearch.php');

  // Build search query
  const searchQuery = `collection:(${collection}) AND format:(${format}) AND (title:(${query}) OR creator:(${query}))`;

  searchUrl.searchParams.set('q', searchQuery);
  searchUrl.searchParams.set('fl[]', 'identifier,title,creator,description,date,subject');
  searchUrl.searchParams.set('rows', limit.toString());
  searchUrl.searchParams.set('page', page.toString());
  searchUrl.searchParams.set('output', 'json');

  const data = await fetchViaProxy(searchUrl.toString());
  const docs = data.response?.docs || [];

  return docs.map((doc: any) => ({
    identifier: doc.identifier,
    title: Array.isArray(doc.title) ? doc.title[0] : doc.title,
    creator: Array.isArray(doc.creator) ? doc.creator[0] : doc.creator,
    description: Array.isArray(doc.description) ? doc.description[0] : doc.description,
    date: doc.date,
    subject: Array.isArray(doc.subject) ? doc.subject : (doc.subject ? [doc.subject] : [])
  }));
}

/**
 * Fetch detailed metadata for an Internet Archive item
 */
export async function fetchArchiveMetadata(identifier: string): Promise<ArchiveMetadata | null> {
  try {
    const metadataUrl = `https://archive.org/metadata/${identifier}`;
    const data = await fetchViaProxy(metadataUrl);

    if (!data.files) {
      return null;
    }

    // Extract audio files
    const audioFiles: ArchiveAudioFile[] = data.files
      .filter((file: any) =>
        file.format === 'VBR MP3' ||
        file.format === 'MP3' ||
        file.format === '128Kbps MP3' ||
        file.format === 'Ogg Vorbis' ||
        file.format === 'FLAC'
      )
      .map((file: any) => ({
        name: file.name,
        format: file.format,
        size: parseInt(file.size) || 0,
        length: file.length ? parseFloat(file.length) : undefined,
        url: `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`
      }));

    // Find cover image
    let coverImage: string | undefined;
    const imageFile = data.files.find((file: any) =>
      file.format === 'JPEG' ||
      file.format === 'PNG' ||
      file.name.includes('thumb') ||
      file.name.includes('cover')
    );

    if (imageFile) {
      coverImage = `https://archive.org/download/${identifier}/${encodeURIComponent(imageFile.name)}`;
    }

    const metadata = data.metadata || {};

    return {
      identifier,
      title: Array.isArray(metadata.title) ? metadata.title[0] : (metadata.title || identifier),
      creator: Array.isArray(metadata.creator) ? metadata.creator[0] : metadata.creator,
      description: Array.isArray(metadata.description) ? metadata.description[0] : metadata.description,
      audioFiles,
      coverImage,
      metadata
    };
  } catch (error) {
    console.error('Failed to fetch Archive metadata:', error);
    return null;
  }
}

/**
 * Get best audio file from metadata
 * Prefers: MP3 > Ogg Vorbis > FLAC
 */
export function getBestAudioFile(metadata: ArchiveMetadata): ArchiveAudioFile | null {
  const { audioFiles } = metadata;

  if (audioFiles.length === 0) {
    return null;
  }

  // Priority order
  const formatPriority = ['VBR MP3', 'MP3', '128Kbps MP3', 'Ogg Vorbis', 'FLAC'];

  for (const format of formatPriority) {
    const file = audioFiles.find(f => f.format === format);
    if (file) {
      return file;
    }
  }

  // Return first available if no preferred format found
  return audioFiles[0];
}

/**
 * Parse Internet Archive URL to extract identifier
 */
function parseArchiveUrl(url: string): string | null {
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
}

/**
 * Get popular audio collections on Internet Archive
 */
const POPULAR_COLLECTIONS = [
  { id: 'opensource_audio', name: 'Open Source Audio' },
  { id: 'audio_music', name: 'Music & Arts' },
  { id: 'etree', name: 'Live Music Archive' },
  { id: 'GratefulDead', name: 'Grateful Dead' },
  { id: 'audio_podcast', name: 'Podcasts' },
  { id: 'librivoxaudio', name: 'LibriVox Audiobooks' },
  { id: 'netlabels', name: 'Netlabels' },
  { id: 'audio_bookspoetry', name: 'Books & Poetry' }
] as const;
