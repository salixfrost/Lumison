/**
 * Streaming Proxy Service
 * Enables progressive playback without downloading entire file
 * Supports range requests for audio streaming
 */

interface StreamingConfig {
  chunkSize: number;
  maxCacheSize: number;
  prefetchSize: number;
}

const DEFAULT_CONFIG: StreamingConfig = {
  chunkSize: 256 * 1024,
  maxCacheSize: 10 * 1024 * 1024,
  prefetchSize: 1024 * 1024,
};

export class StreamingAudioProxy {
  private sourceUrl: string;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private objectUrl: string | null = null;
  private chunks: Map<number, ArrayBuffer> = new Map();
  private totalSize: number = 0;
  private mimeType: string = 'audio/mpeg';
  private isInitialized: boolean = false;
  private fetchController: AbortController | null = null;

  constructor(sourceUrl: string) {
    this.sourceUrl = sourceUrl;
  }

  async initialize(): Promise<string> {
    if (this.objectUrl) {
      return this.objectUrl;
    }

    if (!window.MediaSource) {
      throw new Error('MediaSource API not supported');
    }

    this.mediaSource = new MediaSource();
    this.objectUrl = URL.createObjectURL(this.mediaSource);

    await new Promise<void>((resolve, reject) => {
      if (!this.mediaSource) {
        reject(new Error('MediaSource not initialized'));
        return;
      }

      this.mediaSource.addEventListener('sourceopen', () => {
        resolve();
      }, { once: true });

      this.mediaSource.addEventListener('error', (e) => {
        reject(new Error('MediaSource error: ' + e));
      }, { once: true });
    });

    try {
      const response = await fetch(this.sourceUrl, {
        method: 'HEAD',
      });

      this.mimeType = response.headers.get('content-type') || 'audio/mpeg';
      this.totalSize = parseInt(response.headers.get('content-length') || '0', 10);
    } catch (error) {
      console.warn('Failed to get content info, using defaults:', error);
    }

    if (this.mediaSource && MediaSource.isTypeSupported(this.mimeType)) {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
      this.isInitialized = true;
    } else {
      throw new Error(`Unsupported MIME type: ${this.mimeType}`);
    }

    return this.objectUrl;
  }

  private async fetchChunk(start: number, end: number): Promise<ArrayBuffer> {
    const response = await fetch(this.sourceUrl, {
      headers: {
        'Range': `bytes=${start}-${end}`,
      },
      signal: this.fetchController?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chunk: ${response.status}`);
    }

    return await response.arrayBuffer();
  }

  async startStreaming(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (!this.isInitialized || !this.sourceBuffer || !this.mediaSource) {
      throw new Error('StreamingAudioProxy not initialized');
    }

    this.fetchController = new AbortController();
    const chunkSize = DEFAULT_CONFIG.chunkSize;
    let offset = 0;

    try {
      while (offset < this.totalSize) {
        const end = Math.min(offset + chunkSize - 1, this.totalSize - 1);
        const chunk = await this.fetchChunk(offset, end);

        if (this.sourceBuffer.updating) {
          await new Promise<void>((resolve) => {
            this.sourceBuffer!.addEventListener('updateend', () => resolve(), { once: true });
          });
        }

        this.sourceBuffer.appendBuffer(chunk);
        this.chunks.set(offset, chunk);

        offset = end + 1;

        if (onProgress) {
          onProgress(offset, this.totalSize);
        }

        if (this.chunks.size * chunkSize > DEFAULT_CONFIG.maxCacheSize) {
          const oldestKey = this.chunks.keys().next().value;
          this.chunks.delete(oldestKey);
        }
      }

      if (this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Streaming aborted');
      } else {
        console.error('Streaming error:', error);
        throw error;
      }
    }
  }

  stop(): void {
    if (this.fetchController) {
      this.fetchController.abort();
      this.fetchController = null;
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    this.chunks.clear();
    this.sourceBuffer = null;
    this.mediaSource = null;
    this.isInitialized = false;
  }

  getUrl(): string | null {
    return this.objectUrl;
  }

  getProgress(): { loaded: number; total: number } {
    const loaded = this.chunks.size * DEFAULT_CONFIG.chunkSize;
    return { loaded, total: this.totalSize };
  }
}

export async function createProgressiveBlob(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    if (value) {
      chunks.push(value);
      loaded += value.length;

      if (onProgress && total > 0) {
        onProgress(loaded, total);
      }
    }
  }

  const blob = new Blob(chunks as BlobPart[], {
    type: response.headers.get('content-type') || 'audio/mpeg',
  });

  return URL.createObjectURL(blob);
}

export function isStreamingSupported(): boolean {
  return !!(window.MediaSource && MediaSource.isTypeSupported('audio/mpeg'));
}

export async function getBestStreamingMethod(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  if (isStreamingSupported()) {
    try {
      const proxy = new StreamingAudioProxy(url);
      const objectUrl = await proxy.initialize();
      
      proxy.startStreaming(onProgress).catch((error) => {
        console.warn('Streaming failed, audio may not play completely:', error);
      });

      return objectUrl;
    } catch (error) {
      console.warn('MediaSource streaming failed, falling back to progressive blob:', error);
    }
  }

  return createProgressiveBlob(url, onProgress);
}

export const COVER_QUALITY_LEVELS = {
  thumb: { suffix: '120', name: 'thumb' },
  small: { suffix: '200', name: 'small' },
  medium: { suffix: '300', name: 'medium' },
  large: { suffix: '500', name: 'large' },
} as const;

export type CoverQuality = keyof typeof COVER_QUALITY_LEVELS;

export function getCoverUrl(
  baseUrl: string | undefined,
  quality: CoverQuality = 'medium'
): string | undefined {
  if (!baseUrl) return undefined;
  
  const suffix = COVER_QUALITY_LEVELS[quality].suffix;
  
  return baseUrl.replace(/\/\d+\//, `/${suffix}/`).replace(/\?param=\d+x\d+/, `?param=${suffix}x${suffix}`);
}

export function getCoverUrlWithFallback(
  baseUrl: string | undefined,
  quality: CoverQuality = 'medium'
): string | undefined {
  const url = getCoverUrl(baseUrl, quality);
  if (url) return url;
  
  return getCoverUrl(baseUrl, 'large') || baseUrl;
}