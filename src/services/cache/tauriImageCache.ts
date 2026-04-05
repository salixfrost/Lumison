import { invoke } from '@tauri-apps/api/core';

/**
 * Tauri SQLite-based image cache for desktop builds.
 * Falls back to in-memory LRU if not in Tauri environment.
 */
export class TauriImageCache {
  private inTauri: boolean = false;
  private memoryCache: Map<string, string> = new Map(); // key -> base64 data

  constructor() {
    this.inTauri = typeof window !== 'undefined' && !!window.__TAURI__;
  }

  async get(key: string): Promise<string | null> {
    if (!this.inTauri) {
      // Not in Tauri, fallback to memory cache (for web dev)
      return this.memoryCache.get(key) || null;
    }

    try {
      const result = await invoke<string | null>('get_cached_image', { key });
      if (result) {
        // Store in memory cache for faster subsequent access
        this.memoryCache.set(key, result);
      }
      return result;
    } catch (error) {
      console.warn('Failed to get image from SQLite cache:', error);
      // Fallback to memory cache
      return this.memoryCache.get(key) || null;
    }
  }

  async put(key: string, data: Blob, mimeType: string = 'image/jpeg', width: number, height: number, dprScale: number = 1): Promise<void> {
    // Convert blob to base64 for transmission
    const base64Data = await this.blobToBase64(data);

    if (!this.inTauri) {
      // Not in Tauri, store in memory cache only
      this.memoryCache.set(key, base64Data);
      return;
    }

    try {
      await invoke('put_cached_image', {
        key,
        dataBase64: base64Data,
        mimeType,
        width,
        height,
        dprScale: Math.round(dprScale * 100), // Store as integer percentage
      });

      // Also keep in memory cache
      this.memoryCache.set(key, base64Data);
    } catch (error) {
      console.warn('Failed to store image in SQLite cache:', error);
      // Still keep in memory cache as fallback
      this.memoryCache.set(key, base64Data);
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (!this.inTauri) {
      return;
    }

    try {
      await invoke('delete_cached_image', { key });
    } catch (error) {
      console.warn('Failed to delete image from SQLite cache:', error);
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (!this.inTauri) {
      return;
    }

    try {
      await invoke('clear_cached_images');
    } catch (error) {
      console.warn('Failed to clear SQLite cache:', error);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data:image/jpeg;base64, prefix
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

// Singleton instance
export const tauriImageCache = new TauriImageCache();