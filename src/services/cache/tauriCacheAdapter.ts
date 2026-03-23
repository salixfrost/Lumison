import type { invoke } from '@tauri-apps/api/core';

/**
 * Adapter that implements the same interface as createSizeLimitedLRU
 * but uses Tauri SQLite backend for persistence.
 */
export const createTauriCacheAdapter = (maxSizeMB: number) => {
  const memoryCache = new Map<string, { blob: Blob; size: number }>();
  let totalSize = 0;
  const inTauri = typeof window !== 'undefined' && !!window.__TAURI__;

  // Helper to extract cache key components
  const parseCacheKey = (key: string) => {
    // Expected format: {src}|{ratio}|{width}x{height}@{dpr_scaled}
    const parts = key.split('|');
    if (parts.length !== 3) return null;

    const src = parts[0];
    const ratio = parseFloat(parts[1]);
    const [dimensions, dprPart] = parts[2].split('@');
    const [widthStr, heightStr] = dimensions.split('x');
    const dprScaled = parseInt(dprPart || '100', 10);

    return {
      src,
      ratio,
      width: parseInt(widthStr, 10),
      height: parseInt(heightStr, 10),
      dpr: dprScaled / 100,
    };
  };

  const evictIfNeeded = () => {
    // SQLite handles eviction internally based on max size
    // We just manage in-memory cache
    while (totalSize > maxSizeMB * 1024 * 1024 && memoryCache.size > 0) {
      const oldestKey = memoryCache.keys().next().value;
      if (!oldestKey) break;
      const entry = memoryCache.get(oldestKey);
      memoryCache.delete(oldestKey);
      if (entry) {
        totalSize -= entry.size;
      }
    }
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64: string, mimeType: string = 'image/jpeg'): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  let invokeFn: typeof invoke | null = null;

  const getInvoke = async () => {
    if (!invokeFn) {
      try {
        const tauriCore = await import('@tauri-apps/api/core');
        invokeFn = tauriCore.invoke;
      } catch {
        return null;
      }
    }
    return invokeFn;
  };

  const get = (key: string): Blob | null | Promise<Blob | null> => {
    const memoryEntry = memoryCache.get(key);
    if (memoryEntry) {
      memoryCache.delete(key);
      memoryCache.set(key, memoryEntry);
      return memoryEntry.blob;
    }

    if (!inTauri) {
      return null;
    }

    return (async () => {
      try {
        const parsed = parseCacheKey(key);
        if (!parsed) {
          console.warn('Invalid cache key format:', key);
          return null;
        }

        const invoke = await getInvoke();
        if (!invoke) {
          return null;
        }

        const base64Data = await invoke<string | null>('get_cached_image', { key });
        if (!base64Data) {
          return null;
        }

        const blob = base64ToBlob(base64Data, 'image/jpeg');

        // Store in memory cache
        const size = blob.size;
        memoryCache.set(key, { blob, size });
        totalSize += size;
        evictIfNeeded();

        return blob;
      } catch (error) {
        console.warn('Failed to get image from SQLite cache:', error);
        return null;
      }
    })();
  };

  const set = (key: string, blob: Blob): void => {
    const size = blob.size || 0;
    if (size <= 0 || size > maxSizeMB * 1024 * 1024) {
      return;
    }

    if (memoryCache.has(key)) {
      const existing = memoryCache.get(key)!;
      totalSize -= existing.size;
      memoryCache.delete(key);
    }

    memoryCache.set(key, { blob, size });
    totalSize += size;

    if (inTauri) {
      (async () => {
        try {
          const parsed = parseCacheKey(key);
          if (!parsed) {
            console.warn('Invalid cache key format, skipping SQLite storage:', key);
            return;
          }

          const invoke = await getInvoke();
          if (!invoke) {
            return;
          }

          const base64Data = await blobToBase64(blob);
          await invoke('put_cached_image', {
            key,
            dataBase64: base64Data,
            mimeType: 'image/jpeg',
            width: parsed.width,
            height: parsed.height,
            dprScale: Math.round(parsed.dpr * 100),
          });
        } catch (error) {
          console.warn('Failed to store image in SQLite cache:', error);
        }
      })();
    }

    evictIfNeeded();
  };

  const del = (key: string): void => {
    const entry = memoryCache.get(key);
    if (entry) {
      totalSize -= entry.size;
      memoryCache.delete(key);
    }

    if (inTauri) {
      (async () => {
        try {
          const invoke = await getInvoke();
          if (!invoke) {
            return;
          }
          await invoke('delete_cached_image', { key });
        } catch (error) {
          console.warn('Failed to delete image from SQLite cache:', error);
        }
      })();
    }
  };

  const clear = (): void => {
    memoryCache.clear();
    totalSize = 0;
  };

  const getLimit = (): number => maxSizeMB * 1024 * 1024;

  return {
    get,
    set,
    delete: del,
    clear,
    getLimit,
  };
};