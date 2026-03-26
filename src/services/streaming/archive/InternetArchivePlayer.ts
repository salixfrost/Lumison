/**
 * Internet Archive Player Implementation
 * Provides legal, DRM-free audio streaming from archive.org
 */

import { fetchViaProxy } from "../../../services/utils";
import {
  IStreamingPlayer,
  StreamingTrack,
  StreamingPlaybackState,
  StreamingPlayerConfig,
  StreamingPlayerEvent,
  StreamingPlatform
} from '../types';

export class InternetArchivePlayer implements IStreamingPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private currentTrack: StreamingTrack | null = null;
  private ready: boolean = false;
  private eventListeners: Map<StreamingPlayerEvent, Set<Function>> = new Map();
  private updateInterval: number | null = null;

  async initialize(config: StreamingPlayerConfig): Promise<void> {
    this.createAudioElement();
    this.ready = true;
    this.emit(StreamingPlayerEvent.READY, undefined);
  }

  isAuthorized(): boolean {
    // Internet Archive doesn't require authorization
    return true;
  }

  private createAudioElement(): void {
    if (this.audioElement) return;

    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    
    // Setup event listeners
    this.audioElement.addEventListener('playing', () => {
      this.startTimeUpdate();
      if (this.currentTrack) {
        this.emit(StreamingPlayerEvent.PLAYING, this.currentTrack);
      }
    });

    this.audioElement.addEventListener('pause', () => {
      this.stopTimeUpdate();
      this.emit(StreamingPlayerEvent.PAUSED, undefined);
    });

    this.audioElement.addEventListener('ended', () => {
      this.stopTimeUpdate();
      this.emit(StreamingPlayerEvent.ENDED, undefined);
    });

    this.audioElement.addEventListener('error', (e) => {
      const error = new Error(`Audio playback error: ${this.audioElement?.error?.message || 'Unknown'}`);
      this.emit(StreamingPlayerEvent.ERROR, error);
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.emit(StreamingPlayerEvent.STATE_CHANGE, this.getState());
    });
  }

  async play(track: StreamingTrack): Promise<void> {
    if (!this.audioElement) {
      throw new Error('Audio element not initialized');
    }

    this.currentTrack = track;

    // If track has direct URL, use it; otherwise fetch from metadata
    let audioUrl = track.url;
    
    if (!audioUrl) {
      // Fetch audio URL from Internet Archive metadata
      const metadata = await this.fetchMetadata(track.id);
      audioUrl = metadata?.audioUrl;
    }

    if (!audioUrl) {
      throw new Error('No audio URL available for track');
    }

    this.audioElement.src = audioUrl;
    await this.audioElement.play();
    
    this.emit(StreamingPlayerEvent.PLAYING, track);
  }

  async pause(): Promise<void> {
    this.audioElement?.pause();
  }

  async resume(): Promise<void> {
    await this.audioElement?.play();
  }

  async seek(position: number): Promise<void> {
    if (this.audioElement) {
      this.audioElement.currentTime = position;
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  getCurrentTime(): number {
    return this.audioElement?.currentTime || 0;
  }

  getDuration(): number {
    return this.audioElement?.duration || 0;
  }

  getState(): StreamingPlaybackState {
    return {
      isPlaying: !this.audioElement?.paused && !this.audioElement?.ended,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.audioElement?.volume || 1,
      track: this.currentTrack
    };
  }

  async search(query: string, limit: number = 20): Promise<StreamingTrack[]> {
    const searchUrl = new URL('https://archive.org/advancedsearch.php');
    
    // Search in audio collections with MP3 format
    searchUrl.searchParams.set('q', 
      `collection:(opensource_audio) AND format:(MP3) AND (title:(${query}) OR creator:(${query}))`
    );
    searchUrl.searchParams.set('fl[]', 'identifier,title,creator,description');
    searchUrl.searchParams.set('rows', limit.toString());
    searchUrl.searchParams.set('page', '1');
    searchUrl.searchParams.set('output', 'json');

    const data = await fetchViaProxy(searchUrl.toString());
    const docs = data.response?.docs || [];

    // Fetch metadata for each result to get audio URLs and cover images
    const tracks = await Promise.all(
      docs.map(async (doc: any) => {
        const metadata = await this.fetchMetadata(doc.identifier);
        
        return {
          id: doc.identifier,
          platform: StreamingPlatform.INTERNET_ARCHIVE,
          title: Array.isArray(doc.title) ? doc.title[0] : (doc.title || doc.identifier),
          artist: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Unknown Artist'),
          coverUrl: metadata?.coverUrl || `https://archive.org/services/img/${doc.identifier}`,
          duration: metadata?.duration || 0,
          url: metadata?.audioUrl,
          uri: `https://archive.org/details/${doc.identifier}`
        };
      })
    );

    return tracks.filter(track => track.url); // Only return tracks with valid audio URLs
  }

  /**
   * Fetch metadata for an Internet Archive item
   */
  private async fetchMetadata(identifier: string): Promise<{
    audioUrl: string;
    coverUrl?: string;
    duration?: number;
  } | null> {
    try {
      const metadataUrl = `https://archive.org/metadata/${identifier}`;
      const data = await fetchViaProxy(metadataUrl);
      
      if (!data.files) {
        return null;
      }

      // Find best audio file (prefer MP3, then OGG, then FLAC)
      const audioFile = data.files.find((file: any) => 
        file.format === 'VBR MP3' || 
        file.format === 'MP3' ||
        file.format === '128Kbps MP3' ||
        file.format === 'Ogg Vorbis' ||
        file.format === 'FLAC'
      );

      if (!audioFile) {
        return null;
      }

      // Get cover image
      let coverUrl: string | undefined;
      const imageFile = data.files.find((file: any) => 
        file.format === 'JPEG' || 
        file.format === 'PNG' ||
        file.name.includes('thumb') ||
        file.name.includes('cover')
      );
      
      if (imageFile) {
        coverUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(imageFile.name)}`;
      }

      // Construct audio URL
      const audioUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(audioFile.name)}`;

      return {
        audioUrl,
        coverUrl,
        duration: audioFile.length ? parseFloat(audioFile.length) : undefined
      };
    } catch (error) {
      console.error('Failed to fetch Internet Archive metadata:', error);
      return null;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy(): void {
    this.stopTimeUpdate();
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    this.currentTrack = null;
    this.ready = false;
    this.eventListeners.clear();
  }

  on(event: StreamingPlayerEvent, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: StreamingPlayerEvent, callback: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: StreamingPlayerEvent, data: any): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  private startTimeUpdate(): void {
    if (this.updateInterval) return;

    this.updateInterval = window.setInterval(() => {
      this.emit(StreamingPlayerEvent.TIME_UPDATE, {
        currentTime: this.getCurrentTime(),
        duration: this.getDuration()
      });
    }, 100);
  }

  private stopTimeUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
