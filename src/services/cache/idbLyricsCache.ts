import { LyricLine } from '../../types';

const DB_NAME = 'lumison_lyrics_v1';
const STORE_NAME = 'lyrics';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDB = (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('Failed to open IndexedDB for lyrics cache');
      resolve(null);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
};

export const getLyricsFromPersistentCache = async (
  cacheKey: string,
): Promise<LyricLine[] | null> => {
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise<LyricLine[] | null>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) {
          resolve(null);
          return;
        }
        // Validate timestamp (optional TTL)
        const now = Date.now();
        // Keep entries indefinitely for now
        resolve(entry.lyrics as LyricLine[]);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (error) {
    console.warn('Failed to read lyrics from persistent cache', error);
    return null;
  }
};

export const storeLyricsInPersistentCache = async (
  cacheKey: string,
  lyrics: LyricLine[] | null,
): Promise<void> => {
  try {
    const db = await openDB();
    if (!db) return;

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      if (lyrics === null) {
        // Store a null placeholder to remember "miss"
        const entry = {
          cacheKey,
          lyrics: null,
          timestamp: Date.now(),
        };
        store.put(entry);
      } else {
        const entry = {
          cacheKey,
          lyrics,
          timestamp: Date.now(),
        };
        store.put(entry);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('Failed to store lyrics in persistent cache', error);
  }
};

export const clearPersistentLyricsCache = async (): Promise<void> => {
  try {
    const db = await openDB();
    if (!db) return;

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Failed to clear lyrics cache', error);
  }
};