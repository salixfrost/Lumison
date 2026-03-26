import { Song, PlayMode } from "../../types";

const DB_NAME = "lumison_queue_v1";
const STORE_NAME = "queue";
const DB_VERSION = 1;

interface QueueState {
  queue: Song[];
  originalQueue: Song[];
  currentIndex: number;
  playMode: PlayMode;
  currentTime: number;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDB = (): Promise<IDBDatabase | null> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn("Failed to open IndexedDB for queue persistence");
      resolve(null);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
};

export const saveQueueToPersistence = async (
  queue: Song[],
  originalQueue: Song[],
  currentIndex: number,
  playMode: PlayMode,
  currentTime: number
): Promise<void> => {
  try {
    const db = await openDB();
    if (!db) return;

    const state: QueueState = {
      queue,
      originalQueue,
      currentIndex,
      playMode,
      currentTime,
      timestamp: Date.now(),
    };

    const jsonState = JSON.stringify(state);
    sessionStorage.setItem("lumison_queue", jsonState);
  } catch (error) {
    console.warn("Failed to save queue to persistence", error);
  }
};

export const loadQueueFromPersistence = async (): Promise<QueueState | null> => {
  try {
    const stored = sessionStorage.getItem("lumison_queue");
    if (!stored) return null;
    
    const state = JSON.parse(stored);
    return {
      queue: state.queue || [],
      originalQueue: state.originalQueue || [],
      currentIndex: state.currentIndex ?? -1,
      playMode: state.playMode ?? PlayMode.LOOP_ALL,
      currentTime: state.currentTime ?? 0,
      timestamp: state.timestamp ?? 0,
    };
  } catch (error) {
    console.warn("Failed to load queue from persistence", error);
    return null;
  }
};

export const clearQueuePersistence = async (): Promise<void> => {
  try {
    sessionStorage.removeItem("lumison_queue");
  } catch (error) {
    console.warn("Failed to clear queue persistence", error);
  }
};

export const isLocalFileSong = (song: Song): boolean => {
  return song.fileUrl?.startsWith("blob:") === true;
};

export const filterRestorableSongs = (
  songs: Song[]
): { restorable: Song[]; localOnly: Song[] } => {
  const restorable: Song[] = [];
  const localOnly: Song[] = [];

  for (const song of songs) {
    if (isLocalFileSong(song)) {
      localOnly.push(song);
    } else {
      restorable.push(song);
    }
  }

  return { restorable, localOnly };
};
