import { NeteaseTrackInfo } from "../services/music/lyricsService";
import { StreamingTrack } from "../services/streaming/types";
import { KugouTrack } from "../services/music/kugouApi";
import { Song } from "../types";

export type SearchLookupItem = Song | NeteaseTrackInfo | StreamingTrack | KugouTrack;

const normalizeStreamSource = (value: string) => value.replaceAll("-", "_");

export const getSearchResultKey = (item: SearchLookupItem) => {
    if ("platform" in item) {
        return `stream:${normalizeStreamSource(item.platform)}:${item.id}`;
    }

    if ("isNetease" in item && item.isNetease) {
        return `netease:${item.neteaseId ?? item.id}`;
    }

    if ("isAudioStream" in item && item.isAudioStream) {
        return `stream:${normalizeStreamSource(item.audioStreamSource ?? "unknown")}:${item.id}`;
    }

    if ("hash" in item && item.hash) {
        return `kugou:${item.hash}`;
    }

    return `song:${item.id}`;
};

export const dedupeSearchResults = <T extends SearchLookupItem>(items: T[]) => {
    const seenKeys = new Set<string>();

    return items.filter((item) => {
        const key = getSearchResultKey(item);
        if (seenKeys.has(key)) {
            return false;
        }

        seenKeys.add(key);
        return true;
    });
};

export const buildSearchResultMap = <T extends SearchLookupItem>(items: T[]) => {
    const map = new Map<string, T>();

    items.forEach((item) => {
        map.set(getSearchResultKey(item), item);
    });

    return map;
};

export const buildSearchResultKeySet = <T extends SearchLookupItem>(items: T[]) => {
    const keys = new Set<string>();

    items.forEach((item) => {
        keys.add(getSearchResultKey(item));
    });

    return keys;
};