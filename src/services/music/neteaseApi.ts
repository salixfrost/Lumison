/**
 * Extended Netease Cloud Music API service.
 */

import {
  fetchNeteaseWithFallback,
  type NeteaseRequestConfig,
} from "./neteaseRequest";

const fetchWithFallback = fetchNeteaseWithFallback;

// ==================== 类型定义 ====================

export interface NeteaseTrack {
  id: number;
  name: string;
  artists: Array<{ id: number; name: string }>;
  album: {
    id: number;
    name: string;
    picUrl: string;
  };
  duration: number;
  fee?: number;
  mvid?: number;
}

// Raw shape returned by /cloudsearch and /song/detail
interface RawNeteaseTrack {
  id: number;
  name: string;
  ar?: Array<{ id: number; name: string }>;       // cloudsearch
  artists?: Array<{ id: number; name: string }>;  // song/detail
  al?: { id: number; name: string; picUrl: string }; // cloudsearch
  album?: { id: number; name: string; picUrl: string }; // song/detail
  dt?: number;   // cloudsearch
  duration?: number; // song/detail
  fee?: number;
  mvid?: number;
}

const normalizeTrack = (raw: RawNeteaseTrack): NeteaseTrack => ({
  id: raw.id,
  name: raw.name,
  artists: raw.ar ?? raw.artists ?? [],
  album: raw.al ?? raw.album ?? { id: 0, name: '', picUrl: '' },
  duration: raw.dt ?? raw.duration ?? 0,
  fee: raw.fee,
  mvid: raw.mvid,
});

// ==================== 搜索 API ====================

/**
 * 搜索歌曲
 */
export async function searchSongs(
  keyword: string,
  options: { limit?: number; offset?: number } = {},
  requestConfig: NeteaseRequestConfig = {}
): Promise<{ songs: NeteaseTrack[]; songCount: number }> {
  const { limit = 30, offset = 0 } = options;
  const endpoint = `/cloudsearch?keywords=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=${offset}`;
  const data = await fetchWithFallback(endpoint, {
    timeout: 5000,
    retries: 0,
    ...requestConfig,
  });
  const raw: RawNeteaseTrack[] = data.result?.songs || [];
  return {
    songs: raw.map(normalizeTrack),
    songCount: data.result?.songCount || 0,
  };
}



// ==================== 歌曲详情 API ====================

/**
 * 获取歌曲详情
 */
export async function getSongDetail(ids: number | number[]): Promise<NeteaseTrack[]> {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  const endpoint = `/song/detail?ids=${idStr}`;
  const data = await fetchWithFallback(endpoint);
  const raw: RawNeteaseTrack[] = data.songs || [];
  return raw.map(normalizeTrack);
}



// ==================== 歌단 API ====================

interface NeteasePlaylist {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  playCount: number;
  description: string;
  tags: string[];
}

/**
 * 获取歌单详情
 */
export async function getPlaylistDetail(id: number): Promise<{
  playlist: NeteasePlaylist;
  tracks: NeteaseTrack[];
}> {
  const endpoint = `/playlist/detail?id=${id}`;
  const data = await fetchWithFallback(endpoint);

  return {
    playlist: data.playlist,
    tracks: data.playlist?.tracks || []
  };
}


