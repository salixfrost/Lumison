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

const normalizePicUrl = (url: string | undefined): string => {
  if (!url) return "";
  return url.replace("http:", "https:").replace(/\?param=\d+y\d+$/, "") + "?param=500y500";
};

const normalizeTrack = (raw: RawNeteaseTrack): NeteaseTrack => ({
  id: raw.id,
  name: raw.name,
  artists: raw.ar ?? raw.artists ?? [],
  album: raw.al 
    ? { ...raw.al, picUrl: normalizePicUrl(raw.al.picUrl) }
    : raw.album 
      ? { ...raw.album, picUrl: normalizePicUrl(raw.album.picUrl) }
      : { id: 0, name: '', picUrl: '' },
  duration: raw.dt ?? raw.duration ?? 0,
  fee: raw.fee,
  mvid: raw.mvid,
});

// ==================== 搜索 API ====================

/**
 * 搜索歌曲 (type=1)
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

// ==================== 专辑搜索 API ====================

export interface NeteaseAlbum {
  id: number;
  name: string;
  artist: {
    id: number;
    name: string;
    picUrl?: string;
  };
  picUrl: string;
  publishTime: number;
  size: number;
}

/**
 * 搜索专辑 (type=10)
 */
export async function searchAlbums(
  keyword: string,
  options: { limit?: number; offset?: number } = {},
  requestConfig: NeteaseRequestConfig = {}
): Promise<{ albums: NeteaseAlbum[]; albumCount: number }> {
  const { limit = 30, offset = 0 } = options;
  const endpoint = `/cloudsearch?keywords=${encodeURIComponent(keyword)}&type=10&limit=${limit}&offset=${offset}`;
  const data = await fetchWithFallback(endpoint, {
    timeout: 5000,
    retries: 0,
    ...requestConfig,
  });
  
  const raw = data.result?.albums || [];
  return {
    albums: raw.map((album: Record<string, unknown>) => ({
      id: album.id as number,
      name: album.name as string,
      artist: {
        id: (album.artists as Array<{ id: number; name: string }>)?.[0]?.id ?? 0,
        name: (album.artists as Array<{ id: number; name: string }>)?.[0]?.name ?? "",
        picUrl: normalizePicUrl((album.artists as Array<{ id: number; name: string; picUrl?: string }>)?.[0]?.picUrl),
      },
      picUrl: normalizePicUrl(album.picUrl as string || ""),
      publishTime: album.publishTime as number || 0,
      size: album.size as number || 0,
    })),
    albumCount: data.result?.albumCount || 0,
  };
}

/**
 * 获取专辑详情
 */
export async function getAlbumDetail(id: number): Promise<{
  album: NeteaseAlbum;
  songs: NeteaseTrack[];
}> {
  const endpoint = `/album?id=${id}`;
  const data = await fetchWithFallback(endpoint);
  
  return {
    album: {
      id: data.album.id,
      name: data.album.name,
      artist: data.album.artist || { id: 0, name: "" },
      picUrl: normalizePicUrl(data.album.picUrl || ""),
      publishTime: data.album.publishTime || 0,
      size: data.album.size || 0,
    },
    songs: (data.songs || []).map(normalizeTrack),
  };
}

// ==================== 语言/风格搜索 API ====================

/**
 * 搜索风格/语言 (type=1000: 风格/语言, type=2000: 语种)
 * 可以搜索 "欧美", "日语", "韩语", "华语" 等
 */
export async function searchByLanguage(
  language: string,
  options: { limit?: number; offset?: number } = {},
  requestConfig: NeteaseRequestConfig = {}
): Promise<{ songs: NeteaseTrack[]; songCount: number }> {
  const { limit = 30, offset = 0 } = options;
  // 使用 type=1000 (风格/语言) + 关键词搜索
  const endpoint = `/cloudsearch?keywords=${encodeURIComponent(language)}&type=1000&limit=${limit}&offset=${offset}`;
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
    playlist: {
      ...data.playlist,
      coverImgUrl: normalizePicUrl(data.playlist?.coverImgUrl),
    },
    tracks: data.playlist?.tracks || []
  };
}


