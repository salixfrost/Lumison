const MOBILE_BREAKPOINT = 1024;

const isMobileViewport = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
};

const isTauri = typeof window !== 'undefined' && !!window.__TAURI__;

// Helper to list cached keys from Tauri SQLite (used during cache initialization)
const listCachedKeysFromTauri = async (): Promise<string[]> => {
  if (!isTauri) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string[]>('list_cached_keys');
};

const createSizeLimitedLRU = (limitBytes: number) => {
  const map = new Map<string, { blob: Blob; size: number }>();
  let totalSize = 0;

  const evictIfNeeded = () => {
    while (totalSize > limitBytes && map.size > 0) {
      const oldestKey = map.keys().next().value;
      if (!oldestKey) break;
      const entry = map.get(oldestKey);
      map.delete(oldestKey);
      if (entry) {
        totalSize -= entry.size;
      }
    }
  };

  return {
    get(key: string): Blob | null {
      const entry = map.get(key);
      if (!entry) return null;
      map.delete(key);
      map.set(key, entry);
      return entry.blob;
    },
    set(key: string, blob: Blob) {
      const size = blob.size || 0;
      if (size <= 0 || size > limitBytes) {
        return;
      }
      if (map.has(key)) {
        const existing = map.get(key);
        if (existing) {
          totalSize -= existing.size;
        }
        map.delete(key);
      }
      map.set(key, { blob, size });
      totalSize += size;
      evictIfNeeded();
    },
    delete(key: string) {
      const entry = map.get(key);
      if (!entry) return;
      totalSize -= entry.size;
      map.delete(key);
    },
    clear() {
      map.clear();
      totalSize = 0;
    },
    getLimit() {
      return limitBytes;
    },
  };
};

interface CacheLimitsInMB {
  image: number;
  audio: number;
  rawImage: number;
}

// Return cache limits in MB to keep units consistent.
const getOptimalCacheLimits = () => {
  const deviceMemory = (navigator as any).deviceMemory || 4;
  const isMobile = isMobileViewport();
  
  if (deviceMemory < 4) {
    return {
      image: 15,      // 15MB for low-end
      audio: 50,      // 50MB for low-end
      rawImage: 10,   // 10MB for low-end
    } satisfies CacheLimitsInMB;
  } else if (deviceMemory < 8) {
    return {
      image: isMobile ? 30 : 50,    // 30-50MB for mid-range
      audio: isMobile ? 80 : 120,   // 80-120MB for mid-range
      rawImage: 20,                  // 20MB for mid-range
    } satisfies CacheLimitsInMB;
  } else {
    return {
      image: isMobile ? 50 : 80,    // 50-80MB for high-end
      audio: isMobile ? 120 : 180,  // 120-180MB for high-end
      rawImage: 30,                  // 30MB for high-end
    } satisfies CacheLimitsInMB;
  }
};

const cacheLimits = getOptimalCacheLimits();
const IMAGE_CACHE_LIMIT = cacheLimits.image * 1024 * 1024;
const AUDIO_CACHE_LIMIT = cacheLimits.audio * 1024 * 1024;
const RAW_IMAGE_CACHE_LIMIT = cacheLimits.rawImage * 1024 * 1024;

const rawImageCache = createSizeLimitedLRU(RAW_IMAGE_CACHE_LIMIT);

// Create image cache - use SQLite for Tauri, memory LRU for web
type CacheInterface = ReturnType<typeof createSizeLimitedLRU>;

const createCacheProxy = (): CacheInterface => {
  let delegate: CacheInterface = createSizeLimitedLRU(IMAGE_CACHE_LIMIT);

  // If in Tauri, asynchronously load SQLite adapter and preload keys
  if (isTauri) {
    import('./cache/tauriCacheAdapter').then(async ({ createTauriCacheAdapter }) => {
      try {
        const tauriAdapter = await createTauriCacheAdapter(cacheLimits.image);

        // Preload keys from SQLite
        try {
          const keys = await listCachedKeysFromTauri();
          console.log(`Preloaded ${keys.length} cached images from SQLite`);
          // For now, we just have the adapter, keys will be loaded lazily
        } catch (preloadError) {
          console.warn('Failed to preload cache keys:', preloadError);
        }

        // Swap delegate
        delegate = tauriAdapter;
      } catch (error) {
        console.warn('Failed to load Tauri cache adapter, staying with memory LRU:', error);
      }
    }).catch((error) => {
      console.warn('Failed to import Tauri cache adapter:', error);
    });
  }

  return {
    get: (key: string) => delegate.get(key),
    set: (key: string, blob: Blob) => delegate.set(key, blob),
    delete: (key: string) => delegate.delete(key),
    clear: () => delegate.clear(),
    getLimit: () => delegate.getLimit(),
  };
};

const imageResourceCache = createCacheProxy();

export { imageResourceCache };
export const audioResourceCache = createSizeLimitedLRU(AUDIO_CACHE_LIMIT);

export const fetchImageBlobWithCache = async (url: string): Promise<Blob> => {
  const cached = rawImageCache.get(url);
  if (cached) {
    return cached;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  rawImageCache.set(url, blob);
  return blob;
};

export const loadImageElementWithCache = async (
  url: string,
): Promise<HTMLImageElement> => {
  const blob = await fetchImageBlobWithCache(url);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    img.src = objectUrl;
  });
};
