import { fetchJSON, fetchViaProxy } from "../request";
import { fetchNeteaseWithFallback } from "./neteaseRequest";

/**
 * Multi-platform lyrics service.
 * Strategy: prioritize Netease (word-level + translated lyrics support),
 * then fallback to third-party providers when Netease has no result.
 */

// Provider enablement flags
const PLATFORM_CONFIG = {
  netease: true,      // Most stable; supports word-level lyrics.
  thirdParty: true,   // Third-party lyric providers.
};

// Temporary blacklist for failing third-party sources.
const failedSources = new Set<string>();
const BLACKLIST_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Add a source to the temporary blacklist.
 */
const markSourceFailed = (source: string) => {
  if (!failedSources.has(source)) {
    console.warn(`⚠️ Blacklisting source: ${source} for ${BLACKLIST_DURATION / 1000}s`);
    failedSources.add(source);
    // Automatically unblacklist after the cooldown window.
    setTimeout(() => {
      failedSources.delete(source);
      console.log(`✓ Removed ${source} from blacklist`);
    }, BLACKLIST_DURATION);
  }
};

/**
 * Check whether a source is currently blacklisted.
 */
const isSourceBlacklisted = (source: string): boolean => {
  return failedSources.has(source);
};

// API endpoint configuration is centralized in neteaseRequest.ts

interface LyricsResult {
  lrc: string;
  yrc?: string;
  tLrc?: string;
  metadata: string[];
  source: "netease" | string;
  coverUrl?: string; // Cover image URL.
  responseTime?: number; // Response time in milliseconds.
}

interface MusixmatchSubtitleLine {
  time?: { total?: number };
  text?: string;
}

const toSimpleTimedLrc = (plainLyrics: string): string => {
  const lines = plainLyrics.split('\n').filter((line: string) => line.trim());
  return lines.map((line: string, index: number) => {
    const time = index * 3;
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.00]${line}`;
  }).join('\n');
};

const toCentisecondLrcTime = (secondsValue: number): string => {
  const minutes = Math.floor(secondsValue / 60);
  const seconds = Math.floor(secondsValue % 60);
  const ms = Math.floor((secondsValue % 1) * 100);
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;
};

const parseMusixmatchSubtitleBody = (subtitleBody: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(subtitleBody);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const lrc = (parsed as MusixmatchSubtitleLine[])
      .map((line) => `${toCentisecondLrcTime(line.time?.total || 0)}${line.text || ''}`)
      .join('\n');

    return lrc || null;
  } catch (error) {
    console.warn("Musixmatch subtitle parse failed:", error);
    return null;
  }
};

/**
 * Fast lyrics fetch via music.3e0.cn (Meting-style API).
 * ~300ms vs ~3500ms for the standard Netease endpoint.
 */
const fetchLyricsViaMeting = async (songId: string): Promise<LyricsResult | null> => {
  const startTime = Date.now();
  try {
    const lrcUrl = `https://music.3e0.cn/?server=netease&type=lrc&id=${songId}`;
    const response = await fetch(lrcUrl, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const lrc = await response.text();
    if (!lrc?.trim() || lrc.includes('"error"')) return null;
    return {
      lrc,
      metadata: [],
      source: "netease",
      responseTime: Date.now() - startTime,
    };
  } catch {
    return null;
  }
};

/**
 * Search Netease using the centralized request handler.
 */
const searchNeteaseMusic = async (keyword: string): Promise<any> => {
  try {
    const response = await fetchNeteaseWithFallback(
      `/cloudsearch?keywords=${encodeURIComponent(keyword)}&limit=5`
    );
    return response?.result?.songs?.[0];
  } catch (error) {
    console.warn("Netease Music search failed:", error);
    return null;
  }
};

/**
 * Fetch lyrics and cover from Netease — tries fast Meting API first, falls back to standard endpoint.
 */
const fetchNeteaseMusicLyrics = async (songId: string, coverUrl?: string): Promise<LyricsResult | null> => {
  const startTime = Date.now();

  // Try fast Meting API first (~300ms)
  const metingResult = await fetchLyricsViaMeting(songId);
  if (metingResult) {
    return { ...metingResult, coverUrl, responseTime: Date.now() - startTime };
  }

  // Fallback to standard Netease endpoint
  try {
    const response = await fetchNeteaseWithFallback(`/lyric/new?id=${songId}`);
    if (!response?.lrc?.lyric) return null;
    return {
      lrc: response.lrc.lyric,
      yrc: response.yrc?.lyric,
      tLrc: response.tlyric?.lyric,
      metadata: [],
      source: "netease",
      coverUrl,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    console.warn("Netease Music lyrics fetch failed:", error);
    return null;
  }
};

/**
 * Search third-party lyric providers.
 */
const searchThirdPartyLyricsAPIs = async (title: string, artist: string): Promise<LyricsResult | null> => {
  const startTime = Date.now();

  // LrcLib API - 最大的开源歌词库
  const tryLrcLib = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('lrclib')) return null;
    try {
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
      const response = await fetchViaProxy(url);
      if (Array.isArray(response) && response.length > 0) {
        const result = response[0];
        const lrc = result.syncedLyrics || result.plainLyrics;
        if (lrc) {
          return {
            lrc,
            metadata: [],
            source: "lrclib",
            responseTime: Date.now() - startTime,
          };
        }
      }
    } catch (error) {
      console.warn("LrcLib failed:", error);
      markSourceFailed('lrclib');
    }
    return null;
  };

  // LRCAPI - 支持多语言歌词
  const tryLRCAPI = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('lrcapi')) return null;
    try {
      const url = `https://lrc.xms.mx/search?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
      const response = await fetchViaProxy(url);
      if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
        const result = response.data[0];
        if (result.lrc) {
          return {
            lrc: result.lrc,
            metadata: [],
            source: "lrcapi",
            responseTime: Date.now() - startTime,
          };
        }
      }
    } catch (error) {
      console.warn("LRCAPI failed:", error);
      markSourceFailed('lrcapi');
    }
    return null;
  };

  // Lyrics.ovh - 简单但覆盖广
  const tryLyricsOvh = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('lyrics.ovh')) return null;
    try {
      // 修复：正确的参数顺序是 artist/title
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const response = await fetchViaProxy(url);
      if (response && response.lyrics) {
        const lrc = toSimpleTimedLrc(response.lyrics);
        return {
          lrc,
          metadata: [],
          source: "lyrics.ovh",
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.warn("Lyrics.ovh failed:", error);
      markSourceFailed('lyrics.ovh');
    }
    return null;
  };

  // Syair.info - 亚洲音乐覆盖好
  const trySyairInfo = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('syair.info')) return null;
    try {
      const url = `https://api.syair.info/lyrics/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const response = await fetchViaProxy(url);
      if (response && response.lyrics) {
        const lrc = toSimpleTimedLrc(response.lyrics);
        return {
          lrc,
          metadata: [],
          source: "syair.info",
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.warn("Syair.info failed:", error);
      markSourceFailed('syair.info');
    }
    return null;
  };

  // ChartLyrics - 免费，支持部分同步歌词（使用 HTTPS）
  const tryChartLyrics = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('chartlyrics')) return null;
    try {
      const url = `https://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}`;
      const response = await fetchViaProxy(url);
      if (response && typeof response === 'string' && response.includes('<Lyric>')) {
        const lyricMatch = response.match(/<Lyric>([\s\S]*?)<\/Lyric>/);
        if (lyricMatch && lyricMatch[1]) {
          const lyrics = lyricMatch[1].trim();
          if (lyrics && lyrics !== 'null') {
            const lrc = toSimpleTimedLrc(lyrics);
            return {
              lrc,
              metadata: [],
              source: "chartlyrics",
              responseTime: Date.now() - startTime,
            };
          }
        }
      }
    } catch (error) {
      console.warn("ChartLyrics failed:", error);
      markSourceFailed('chartlyrics');
    }
    return null;
  };

  // Musixmatch - 全球最大歌词库
  const tryMusixmatch = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('musixmatch')) return null;
    try {
      const url = `https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}&format=json&namespace=lyrics_synched`;
      const response = await fetchViaProxy(url);

      const subtitles = response?.message?.body?.macro_calls?.['track.subtitles.get']?.message?.body?.subtitle_list;
      if (!Array.isArray(subtitles) || subtitles.length === 0) {
        return null;
      }

      const subtitleBody = subtitles[0]?.subtitle?.subtitle_body;
      if (typeof subtitleBody !== 'string' || !subtitleBody.trim()) {
        return null;
      }

      const lrc = parseMusixmatchSubtitleBody(subtitleBody);
      if (!lrc) {
        return null;
      }

      return {
        lrc,
        metadata: [],
        source: "musixmatch",
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      console.warn("Musixmatch failed:", error);
      markSourceFailed('musixmatch');
    }
    return null;
  };

  // OpenLyrics - 开源 LRC 歌词数据库
  const tryOpenLyrics = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('openlyrics')) return null;
    try {
      const searchQuery = `${artist} - ${title}`;
      const mirrors = [
        'https://openlyrics.io/api/search',
        'https://api.openlyrics.org/search',
      ];

      for (const mirror of mirrors) {
        try {
          const url = `${mirror}?q=${encodeURIComponent(searchQuery)}`;
          const response = await fetchViaProxy(url);

          if (response?.results && Array.isArray(response.results) && response.results.length > 0) {
            const result = response.results[0];
            if (result.lrc || result.lyrics) {
              return {
                lrc: result.lrc || result.lyrics,
                metadata: result.metadata || [],
                source: "openlyrics",
                responseTime: Date.now() - startTime,
              };
            }
          }
        } catch (err) {
          console.warn(`OpenLyrics mirror ${mirror} failed:`, err);
          continue;
        }
      }
    } catch (error) {
      console.warn("OpenLyrics failed:", error);
      markSourceFailed('openlyrics');
    }
    return null;
  };

  // LrcApi - 聚合多平台（网易云、酷狗、咪咕、QQ音乐）
  const tryLrcApi = async (): Promise<LyricsResult | null> => {
    if (isSourceBlacklisted('lrcapi.cx')) return null;
    try {
      const url = `https://api.lrc.cx/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;

      const data = await response.json();
      if (data?.lyrics) {
        return {
          lrc: data.lyrics,
          metadata: [],
          source: "lrcapi.cx",
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.warn("LrcApi failed:", error);
      markSourceFailed('lrcapi.cx');
    }
    return null;
  };

  // Run all third-party providers concurrently.
  // LyricWiki/Genius/GitHub LRC were removed previously due to reliability constraints.
  const promises = [
    tryLrcLib(),
    tryLRCAPI(),
    tryLyricsOvh(),
    trySyairInfo(),
    tryChartLyrics(),
    tryMusixmatch(),
    tryOpenLyrics(),
    tryLrcApi(),
  ];

  // Promise.any returns the first successful provider result,
  // while ignoring early failures from other providers.
  const fastestResult = await Promise.any(
    promises.map(async (promise) => {
      const result = await promise;
      if (result) return result;
      throw new Error('No result');
    })
  ).catch(() => null);

  if (fastestResult) {
    return fastestResult;
  }

  return null;
};

/**
 * Search and fetch lyrics using the multi-platform strategy.
 */
export const searchAndFetchLyrics = async (
  title: string,
  artist: string
): Promise<LyricsResult | null> => {
  const keyword = `${title} ${artist}`;
  console.log(`Searching lyrics for: ${keyword}`);

  // First priority: Netease (word-level + translated lyrics support).
  if (PLATFORM_CONFIG.netease) {
    try {
      console.log("🎵 Trying Netease Music (Priority)...");
      const neteaseSong = await searchNeteaseMusic(keyword);
      if (neteaseSong?.id) {
        const coverUrl = neteaseSong.al?.picUrl;
        const lyrics = await fetchNeteaseMusicLyrics(neteaseSong.id.toString(), coverUrl);
        if (lyrics) {
          console.log(`✓ Found lyrics on Netease Music (${lyrics.responseTime}ms)`);
          return lyrics;
        }
      }
      console.log("⚠️ Netease Music: No lyrics found, trying fallback sources...");
    } catch (error) {
      console.warn("⚠️ Netease Music failed, trying fallback sources:", error);
    }
  }

  // Second priority: third-party providers (parallel search).
  if (PLATFORM_CONFIG.thirdParty) {
    try {
      console.log("🔍 Trying third-party lyrics APIs...");
      const thirdPartyResult = await searchThirdPartyLyricsAPIs(title, artist);
      if (thirdPartyResult) {
        console.log(`✓ Found lyrics on ${thirdPartyResult.source} (${thirdPartyResult.responseTime}ms)`);
        return thirdPartyResult;
      }
    } catch (error) {
      console.warn("Third-party APIs failed:", error);
    }
  }


  console.warn("No lyrics found on any platform");
  return null;
};

/**
 * Return provider configuration flags.
 */
export const getPlatformConfig = () => {
  return { ...PLATFORM_CONFIG };
};
