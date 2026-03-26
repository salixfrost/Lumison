import { searchAndFetchLyrics as multiPlatformSearch } from "./multiPlatformLyrics";
import {
  getPlaylistDetail,
  getSongDetail,
  searchSongs as searchNeteaseSongs,
  type NeteaseTrack,
} from "./neteaseApi";
import { fetchNeteaseWithFallback } from "./neteaseRequest";
import { METADATA_KEYWORDS } from "../lyrics/types";

const METING_API = "https://api.qijieya.cn/meting/";
const fetchWithFallback = fetchNeteaseWithFallback;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const metadataKeywordRegex = new RegExp(
  `^(${METADATA_KEYWORDS.map(escapeRegex).join("|")})\\s*[:：]`,
  "iu",
);

const TIMESTAMP_REGEX = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

interface NeteaseApiArtist {
  name?: string;
}

interface NeteaseApiAlbum {
  name?: string;
  picUrl?: string;
}

interface NeteaseApiSong {
  id: number;
  name?: string;
  ar?: NeteaseApiArtist[];
  al?: NeteaseApiAlbum;
  dt?: number;
}

export interface NeteaseTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
  duration?: number;
  isNetease: true;
  neteaseId: string;
}

type SearchOptions = {
  limit?: number;
  offset?: number;
};

const formatArtists = (artists?: NeteaseApiArtist[]) =>
  (artists ?? [])
    .map((artist) => artist.name?.trim())
    .filter(Boolean)
    .join("/") || "";

const mapNeteaseSongToTrack = (song: NeteaseApiSong): NeteaseTrackInfo => ({
  id: song.id.toString(),
  title: song.name?.trim() ?? "",
  artist: formatArtists(song.ar),
  album: song.al?.name?.trim() ?? "",
  coverUrl: song.al?.picUrl?.replaceAll("http:", "https:")?.replace(/\?param=\d+y\d+$/, "") + "?param=500y500",
  duration: song.dt,
  isNetease: true,
  neteaseId: song.id.toString(),
});

const mapNeteaseApiTrackToSong = (track: NeteaseTrack): NeteaseApiSong => ({
  id: track.id,
  name: track.name,
  ar: track.artists,
  al: {
    name: track.album?.name,
    picUrl: track.album?.picUrl,
  },
  dt: track.duration,
});

const isMetadataTimestampLine = (line: string): boolean => {
  const trimmed = line.trim();
  const match = trimmed.match(TIMESTAMP_REGEX);
  if (!match) return false;
  const content = match[4].trim();
  return metadataKeywordRegex.test(content);
};

const parseTimestampMetadata = (line: string) => {
  const match = line.trim().match(TIMESTAMP_REGEX);
  return match ? match[4].trim() : line.trim();
};

const isMetadataJsonLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const json = JSON.parse(trimmed);
    if (json.c && Array.isArray(json.c)) {
      const content = json.c.map((item: any) => item.tx || "").join("");
      return metadataKeywordRegex.test(content);
    }
  } catch {
    // ignore invalid json
  }
  return false;
};

const parseJsonMetadata = (line: string) => {
  try {
    const json = JSON.parse(line.trim());
    if (json.c && Array.isArray(json.c)) {
      return json.c
        .map((item: any) => item.tx || "")
        .join("")
        .trim();
    }
  } catch {
    // ignore
  }
  return line.trim();
};

const extractMetadataLines = (content: string) => {
  const metadataSet = new Set<string>();
  const bodyLines: string[] = [];

  content.split("\n").forEach((line) => {
    if (!line.trim()) return;
    if (isMetadataTimestampLine(line)) {
      metadataSet.add(parseTimestampMetadata(line));
    } else if (isMetadataJsonLine(line)) {
      metadataSet.add(parseJsonMetadata(line));
    } else {
      bodyLines.push(line);
    }
  });

  return {
    clean: bodyLines.join("\n").trim(),
    metadata: Array.from(metadataSet),
  };
};

export const getNeteaseAudioUrl = (id: string) => {
  return `${METING_API}?type=url&id=${id}`;
};

// Implements the search logic from the user provided code snippet
export const searchNetEase = async (
  keyword: string,
  options: SearchOptions = {},
): Promise<NeteaseTrackInfo[]> => {
  const { limit = 20, offset = 0 } = options;

  try {
    const { songs } = await searchNeteaseSongs(
      keyword,
      { limit, offset },
      { timeout: 5000, retries: 0 },
    );

    if (songs.length === 0) {
      console.warn(`No search results for: ${keyword}`);
      return [];
    }

    const tracks = songs.map((song) => mapNeteaseSongToTrack(mapNeteaseApiTrackToSong(song)));

    // Enrich missing cover URLs via /song/detail in the background
    const missingCoverIds = tracks
      .filter((t) => !t.coverUrl)
      .map((t) => Number(t.neteaseId));

    if (missingCoverIds.length > 0) {
      getSongDetail(missingCoverIds)
        .then((details) => {
          const coverMap = new Map(
            details.map((d) => [d.id, d.album?.picUrl?.replaceAll("http:", "https:")])
          );
          tracks.forEach((t) => {
            const url = coverMap.get(Number(t.neteaseId));
            if (url) t.coverUrl = url;
          });
        })
        .catch(() => { /* non-critical */ });
    }

    return tracks;
  } catch (error) {
    console.error("NetEase search error", error);
    return [];
  }
};

export const fetchNeteasePlaylist = async (
  playlistId: string,
): Promise<NeteaseTrackInfo[]> => {
  try {
    const { tracks } = await getPlaylistDetail(Number(playlistId));
    return tracks.map((song) => mapNeteaseSongToTrack(mapNeteaseApiTrackToSong(song)));
  } catch (e) {
    console.error("Playlist fetch error", e);
    return [];
  }
};

export const fetchNeteaseSong = async (
  songId: string,
): Promise<NeteaseTrackInfo | null> => {
  try {
    const tracks = await getSongDetail(Number(songId));
    const track = tracks[0];
    if (track) {
      return mapNeteaseSongToTrack(mapNeteaseApiTrackToSong(track));
    }
    return null;
  } catch (e) {
    console.error("Song fetch error", e);
    return null;
  }
};

// Keeps the old search for lyric matching fallbacks
export const searchAndMatchLyrics = async (
  title: string,
  artist: string,
): Promise<{ lrc: string; yrc?: string; tLrc?: string; metadata: string[] } | null> => {
  try {
    const multiPlatformResult = await multiPlatformSearch(title, artist);

    if (multiPlatformResult) {
      const sourceMap: Record<string, string> = {
        'qq': 'QQ音乐',
        'kugou': '酷狗音乐',
        'netease': '网易云音乐',
        'lrclib': 'LrcLib',
        'lrcapi': 'LRCAPI',
        'lyrics.ovh': 'Lyrics.ovh',
        'syair.info': 'Syair.info',
        'chartlyrics': 'ChartLyrics',
        'musixmatch': 'Musixmatch',
        'genius': 'Genius',
        'openlyrics': 'OpenLyrics',
        'lyricwiki': 'LyricWiki',
        'github-lrc': 'GitHub LRC',
      };
      return {
        lrc: multiPlatformResult.lrc,
        yrc: multiPlatformResult.yrc,
        tLrc: multiPlatformResult.tLrc,
        metadata: [
          ...multiPlatformResult.metadata,
          `来源: ${sourceMap[multiPlatformResult.source] || multiPlatformResult.source}`,
        ],
      };
    }

    return null;
  } catch (error) {
    console.error("All lyrics search methods failed:", error);
    return null;
  }
};

export const fetchLyricsById = async (
  songId: string,
): Promise<{ lrc: string; yrc?: string; tLrc?: string; metadata: string[] } | null> => {
  try {
    // Try fast Meting API first (~300ms)
    const metingUrl = `https://music.3e0.cn/?server=netease&type=lrc&id=${songId}`;
    const metingRes = await fetch(metingUrl, { signal: AbortSignal.timeout(6000) });
    if (metingRes.ok) {
      const lrc = await metingRes.text();
      if (lrc?.trim() && !lrc.includes('"error"')) {
        const { clean, metadata } = extractMetadataLines(lrc);
        if (clean) return { lrc: clean, metadata };
      }
    }
  } catch {
    // fall through to standard endpoint
  }

  try {
    // Fallback: standard Netease endpoint
    const lyricUrl = `/lyric/new?id=${songId}`;
    const lyricData = await fetchWithFallback(lyricUrl);

    const rawYrc = lyricData.yrc?.lyric;
    const rawLrc = lyricData.lrc?.lyric;
    const tLrc = lyricData.tlyric?.lyric;

    if (!rawYrc && !rawLrc) {
      console.warn(`No lyrics found for song ${songId}`);
      return null;
    }

    const {
      clean: cleanLrc,
      metadata: lrcMetadata,
    } = rawLrc
        ? extractMetadataLines(rawLrc)
        : { clean: undefined, metadata: [] };

    const {
      clean: cleanYrc,
      metadata: yrcMetadata,
    } = rawYrc
        ? extractMetadataLines(rawYrc)
        : { clean: undefined, metadata: [] };

    // Extract metadata from translation if available
    let cleanTranslation: string | undefined;
    let translationMetadata: string[] = [];
    if (tLrc) {
      const result = extractMetadataLines(tLrc);
      cleanTranslation = result.clean;
      translationMetadata = result.metadata;
    }

    const metadataSet = Array.from(
      new Set([...lrcMetadata, ...yrcMetadata, ...translationMetadata]),
    );

    if (lyricData.transUser?.nickname) {
      metadataSet.unshift(`翻译贡献者: ${lyricData.transUser.nickname}`);
    }

    if (lyricData.lyricUser?.nickname) {
      metadataSet.unshift(`歌词贡献者: ${lyricData.lyricUser.nickname}`);
    }

    const baseLyrics = cleanLrc || cleanYrc || rawLrc || rawYrc;
    if (!baseLyrics) return null;

    const yrcForEnrichment = cleanYrc && cleanLrc ? cleanYrc : undefined;
    return {
      lrc: baseLyrics,
      yrc: yrcForEnrichment,
      tLrc: cleanTranslation,
      metadata: Array.from(metadataSet),
    };
  } catch (e) {
    console.error("Lyric fetch error for song", songId, e);
    return null;
  }
};
