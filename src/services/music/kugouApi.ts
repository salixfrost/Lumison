import { fetchJSON } from "../request";

const KUGOU_API_BASE = 'http://localhost:3000';

interface KugouSearchResult {
  info: Array<{
    hash: string;
    filename: string;
    singername: string;
    albumname: string;
    duration: number;
    filesize: number;
  }>;
  total: number;
}

interface KugouSongUrl {
  url: string;
  size: number;
  bitrate: number;
}

interface KugouLyric {
  gc: string;
  pc: string;
  ft: string;
  sgc: string;
  spc: string;
  sft: string;
}

interface KugouAlbum {
  info: {
    albumname: string;
    singername: string;
    publishdate: string;
    pic: string;
  };
  songs: Array<{
    hash: string;
    filename: string;
    duration: number;
  }>;
}

interface KugouPlaylist {
  info: {
    playlistname: string;
    username: string;
    createtime: string;
    pic: string;
  };
  tracks: Array<{
    hash: string;
    filename: string;
    duration: number;
  }>;
}

interface KugouArtist {
  info: {
    name: string;
    pic: string;
    alias: string;
  };
  songs: Array<{
    hash: string;
    filename: string;
    duration: number;
  }>;
  albums: Array<{
    albumname: string;
    publishdate: string;
    pic: string;
  }>;
}

export interface KugouTrack {
  id: string;
  hash: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  size: number;
  bitrate: number;
  coverUrl?: string;
  audioUrl?: string;
}

const mapSearchResultToTrack = (item: KugouSearchResult['info'][0]): KugouTrack => ({
  id: item.hash,
  hash: item.hash,
  title: item.filename.replace(`-${item.singername}`, '').trim() || item.filename,
  artist: item.singername,
  album: item.albumname || '',
  duration: item.duration,
  size: item.filesize,
  bitrate: 0,
});

export const searchKugou = async (
  keyword: string,
  limit: number = 30,
  offset: number = 0
): Promise<KugouTrack[]> => {
  try {
    const data = await fetchJSON<{ data: KugouSearchResult }>(
      `${KUGOU_API_BASE}/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(mapSearchResultToTrack);
    }
    return [];
  } catch (error) {
    console.error('KuGou search error:', error);
    return [];
  }
};

export const getKugouSongUrl = async (hash: string): Promise<string | null> => {
  try {
    const data = await fetchJSON<{ data: Array<KugouSongUrl> }>(
      `${KUGOU_API_BASE}/song/url?hash=${hash}`
    );
    
    if (data?.data?.[0]?.url) {
      return data.data[0].url;
    }
    return null;
  } catch (error) {
    console.error('KuGou song URL error:', error);
    return null;
  }
};

export const getKugouLyrics = async (hash: string): Promise<string | null> => {
  try {
    const data = await fetchJSON<{ data: KugouLyric }>(
      `${KUGOU_API_BASE}/lyric?hash=${hash}`
    );
    
    if (data?.data?.gc) {
      return data.data.gc;
    }
    return null;
  } catch (error) {
    console.error('KuGou lyrics error:', error);
    return null;
  }
};

export const getKugouAlbum = async (albumId: string): Promise<KugouAlbum | null> => {
  try {
    const data = await fetchJSON<{ data: KugouAlbum }>(
      `${KUGOU_API_BASE}/album?id=${albumId}`
    );
    return data?.data || null;
  } catch (error) {
    console.error('KuGou album error:', error);
    return null;
  }
};

export const getKugouPlaylist = async (playlistId: string): Promise<KugouPlaylist | null> => {
  try {
    const data = await fetchJSON<{ data: KugouPlaylist }>(
      `${KUGOU_API_BASE}/playlist?id=${playlistId}`
    );
    return data?.data || null;
  } catch (error) {
    console.error('KuGou playlist error:', error);
    return null;
  }
};

export const getKugouArtist = async (artistId: string): Promise<KugouArtist | null> => {
  try {
    const data = await fetchJSON<{ data: KugouArtist }>(
      `${KUGOU_API_BASE}/artist?id=${artistId}`
    );
    return data?.data || null;
  } catch (error) {
    console.error('KuGou artist error:', error);
    return null;
  }
};

export const getKugouHotSearch = async (): Promise<string[]> => {
  try {
    const data = await fetchJSON<{ data: { keyword: string }[] }>(
      `${KUGOU_API_BASE}/search/hot`
    );
    return data?.data?.map(item => item.keyword) || [];
  } catch (error) {
    console.error('KuGou hot search error:', error);
    return [];
  }
};

export const getKugouBanner = async (): Promise<Array<{ pic: string; title: string; hash: string }>> => {
  try {
    const data = await fetchJSON<{ data: Array<{ pic: string; title: string; hash: string }> }>(
      `${KUGOU_API_BASE}/banner`
    );
    return data?.data || [];
  } catch (error) {
    console.error('KuGou banner error:', error);
    return [];
  }
};

export const getKugouNewSongs = async (limit: number = 20): Promise<KugouTrack[]> => {
  try {
    const data = await fetchJSON<{ data: { info: KugouSearchResult['info'] } }>(
      `${KUGOU_API_BASE}/new/songs?limit=${limit}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(mapSearchResultToTrack);
    }
    return [];
  } catch (error) {
    console.error('KuGou new songs error:', error);
    return [];
  }
};

export const getKugouRankList = async (limit: number = 20): Promise<Array<{ id: string; name: string; pic: string }>> => {
  try {
    const data = await fetchJSON<{ data: Array<{ id: string; name: string; pic: string }> }>(
      `${KUGOU_API_BASE}/toplist?limit=${limit}`
    );
    return data?.data || [];
  } catch (error) {
    console.error('KuGou rank list error:', error);
    return [];
  }
};

export const getKugouRankDetail = async (rankId: string): Promise<KugouTrack[]> => {
  try {
    const data = await fetchJSON<{ data: { info: KugouSearchResult['info'] } }>(
      `${KUGOU_API_BASE}/toplist/detail?id=${rankId}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(mapSearchResultToTrack);
    }
    return [];
  } catch (error) {
    console.error('KuGou rank detail error:', error);
    return [];
  }
};

export const getKugouSongDetail = async (hash: string): Promise<KugouTrack | null> => {
  try {
    const data = await fetchJSON<{ data: { info: KugouSearchResult['info'][0] } }>(
      `${KUGOU_API_BASE}/song/detail?hash=${hash}`
    );
    
    if (data?.data?.info) {
      return mapSearchResultToTrack(data.data.info);
    }
    return null;
  } catch (error) {
    console.error('KuGou song detail error:', error);
    return null;
  }
};

export const getKugouMvUrl = async (hash: string): Promise<string | null> => {
  try {
    const data = await fetchJSON<{ data: { mp4: string } }>(
      `${KUGOU_API_BASE}/mv/url?hash=${hash}`
    );
    return data?.data?.mp4 || null;
  } catch (error) {
    console.error('KuGou MV URL error:', error);
    return null;
  }
};

export const getKugouRecommendSongs = async (limit: number = 20): Promise<KugouTrack[]> => {
  try {
    const data = await fetchJSON<{ data: { info: KugouSearchResult['info'] } }>(
      `${KUGOU_API_BASE}/recommend/songs?limit=${limit}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(mapSearchResultToTrack);
    }
    return [];
  } catch (error) {
    console.error('KuGou recommend songs error:', error);
    return [];
  }
};

export const getKugouPlaylists = async (
  limit: number = 20,
  offset: number = 0
): Promise<Array<{ id: string; name: string; cover: string; count: number }>> => {
  try {
    const data = await fetchJSON<{ data: { info: Array<{ id: string; specialname: string; imgurl: string; songcount: number }> } }>(
      `${KUGOU_API_BASE}/playlist?limit=${limit}&offset=${offset}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(item => ({
        id: item.id,
        name: item.specialname,
        cover: item.imgurl,
        count: item.songcount,
      }));
    }
    return [];
  } catch (error) {
    console.error('KuGou playlists error:', error);
    return [];
  }
};

export const getKugouSingerList = async (
  limit: number = 20,
  offset: number = 0
): Promise<Array<{ id: string; name: string; pic: string }>> => {
  try {
    const data = await fetchJSON<{ data: { info: Array<{ id: string; name: string; imgurl: string }> } }>(
      `${KUGOU_API_BASE}/artist/list?limit=${limit}&offset=${offset}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(item => ({
        id: item.id,
        name: item.name,
        pic: item.imgurl,
      }));
    }
    return [];
  } catch (error) {
    console.error('KuGou singer list error:', error);
    return [];
  }
};

export const getKugouAlbumList = async (
  limit: number = 20,
  offset: number = 0
): Promise<Array<{ id: string; name: string; artist: string; pic: string }>> => {
  try {
    const data = await fetchJSON<{ data: { info: Array<{ albumid: string; albumname: string; singername: string; imgurl: string }> } }>(
      `${KUGOU_API_BASE}/album/list?limit=${limit}&offset=${offset}`
    );
    
    if (data?.data?.info) {
      return data.data.info.map(item => ({
        id: item.albumid,
        name: item.albumname,
        artist: item.singername,
        pic: item.imgurl,
      }));
    }
    return [];
  } catch (error) {
    console.error('KuGou album list error:', error);
    return [];
  }
};

export const isKugouApiAvailable = async (): Promise<boolean> => {
  try {
    const data = await fetchJSON<{ code: number }>(
      `${KUGOU_API_BASE}/banner`
    );
    return data?.code === 200;
  } catch {
    return false;
  }
};