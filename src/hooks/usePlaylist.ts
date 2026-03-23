import { useCallback, useState } from "react";
import { Song } from "../types";
import { LyricLine } from "../services/lyrics/types";
import {
  extractColors,
  parseNeteaseLink,
} from "../services/utils";
import {
  fetchNeteasePlaylist,
  fetchNeteaseSong,
  getNeteaseAudioUrl,
} from "../services/music/lyricsService";
import {
  fetchAudioFromUrl,
} from "../services/music/audioStreamService";
import { audioResourceCache } from "../services/cache";
import { extractAudioTagData, findMatchingLRCFile, loadLRCFile } from "../services/lyrics/id3Parser";

interface ImportResult {
  success: boolean;
  message?: string;
  songs: Song[];
}

export const usePlaylist = () => {
  const [queue, setQueue] = useState<Song[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Song[]>([]);

  const updateSongInQueue = useCallback(
    (id: string, updates: Partial<Song>) => {
      setQueue((prev) =>
        prev.map((song) => (song.id === id ? { ...song, ...updates } : song)),
      );
      setOriginalQueue((prev) =>
        prev.map((song) => (song.id === id ? { ...song, ...updates } : song)),
      );
    },
    [],
  );

  const appendSongs = useCallback((songs: Song[]) => {
    if (songs.length === 0) return;
    setOriginalQueue((prev) => [...prev, ...songs]);
    setQueue((prev) => [...prev, ...songs]);
  }, []);

  const removeSongs = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    setQueue((prev) => {
      prev.forEach((song) => {
        if (idSet.has(song.id) && song.fileUrl && !song.fileUrl.startsWith("blob:")) {
          audioResourceCache.delete(song.fileUrl);
        }
      });
      return prev.filter((song) => !idSet.has(song.id));
    });
    setOriginalQueue((prev) => prev.filter((song) => !idSet.has(song.id)));
  }, []);

  const addLocalFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList =
        files instanceof FileList ? Array.from(files) : Array.from(files);

      // Separate audio and lyrics files
      const audioFiles: File[] = [];
      const lyricsFiles: File[] = [];

      fileList.forEach((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "lrc" || ext === "txt") {
          lyricsFiles.push(file);
        } else {
          audioFiles.push(file);
        }
      });

      const newSongs: Song[] = [];

      // 并行处理所有音频文件（优化性能）
      const processingPromises = audioFiles.map(async (file, i) => {
        const url = URL.createObjectURL(file);
        const basename = file.name.replace(/\.[^/.]+$/, "");
        let title = basename;
        let artist = "Unknown Artist";
        let coverUrl: string | undefined;
        let colors: string[] | undefined;
        let lrcFileLyrics: { time: number; text: string }[] = [];
        let embeddedLyrics: { time: number; text: string }[] = [];

        const nameParts = title.split("-");
        if (nameParts.length > 1) {
          artist = nameParts[0].trim();
          title = nameParts[1].trim();
        }

        try {
          // 并行执行：音频标签提取（封面/标题/艺术家/歌词）和 LRC 文件查找
          const [tagData, matchedLRCFile] = await Promise.all([
            extractAudioTagData(file),
            Promise.resolve(findMatchingLRCFile(file, lyricsFiles)),
          ]);

          // 处理元数据
          if (tagData.title) title = tagData.title;
          if (tagData.artist) artist = tagData.artist;
          if (tagData.picture) {
            coverUrl = tagData.picture;
            colors = await extractColors(coverUrl);
          }

          // 处理 LRC 文件
          if (matchedLRCFile) {
            lrcFileLyrics = await loadLRCFile(matchedLRCFile);
            if (lrcFileLyrics.length > 0) {
              console.log(`✓ Found matching LRC file: ${matchedLRCFile.name}`);
            }
          }

          // 处理内嵌歌词
          if (tagData.lyrics.length > 0) {
            embeddedLyrics = tagData.lyrics;
            console.log(`✓ Found ${tagData.source} embedded lyrics for: ${title}`);
          }

          // Determine initial lyrics — priority: embedded > LRC file > online search
          let initialLyrics: LyricLine[] = [];
          let needsOnlineSearch = false;

          if (embeddedLyrics.length > 0) {
            // Embedded lyrics are highest priority — use immediately, no online search needed
            initialLyrics = embeddedLyrics;
            needsOnlineSearch = false;
            console.log(`📝 Using embedded lyrics for: ${title}`);
          } else if (lrcFileLyrics.length > 0) {
            // LRC file found — use it immediately, still try online for better sync/translation
            initialLyrics = lrcFileLyrics;
            needsOnlineSearch = true;
            console.log(`📄 Using LRC file lyrics for: ${title} (will try online for enrichment)`);
          } else {
            initialLyrics = [];
            needsOnlineSearch = true;
            console.log(`🔍 Will search online for: ${title}`);
          }

          // Determine localLyrics fallback: embedded > LRC file
          const localLyrics = embeddedLyrics.length > 0
            ? embeddedLyrics
            : (lrcFileLyrics.length > 0 ? lrcFileLyrics : undefined);

          return {
            id: `local-${file.name}-${file.size}-${file.lastModified}`,
            title,
            artist,
            fileUrl: url,
            coverUrl,
            lyrics: initialLyrics,
            colors: colors && colors.length > 0 ? colors : undefined,
            needsLyricsMatch: needsOnlineSearch,
            localLyrics,
          };
        } catch (err) {
          console.warn(`Failed to process: ${file.name}`, err);

          return {
            id: `local-${file.name}-${file.size}-${file.lastModified}`,
            title,
            artist,
            fileUrl: url,
            coverUrl,
            lyrics: [],
            colors: colors && colors.length > 0 ? colors : undefined,
            needsLyricsMatch: true,
          };
        }
      });

      // 等待所有文件处理完成
      const processedSongs = await Promise.all(processingPromises);
      newSongs.push(...processedSongs);

      appendSongs(newSongs);
      return newSongs;
    },
    [appendSongs],
  );

  const importFromUrl = useCallback(
    async (input: string): Promise<ImportResult> => {
      // Try Netease first
      const neteaseLink = parseNeteaseLink(input);
      if (neteaseLink) {
        const newSongs: Song[] = [];
        try {
          if (neteaseLink.type === "playlist") {
            const songs = await fetchNeteasePlaylist(neteaseLink.id);
            songs.forEach((song) => {
              newSongs.push({
                ...song,
                fileUrl: getNeteaseAudioUrl(song.id),
                lyrics: [],
                colors: [],
                needsLyricsMatch: true,
              });
            });
          } else {
            const song = await fetchNeteaseSong(neteaseLink.id);
            if (song) {
              newSongs.push({
                ...song,
                fileUrl: getNeteaseAudioUrl(song.id),
                lyrics: [],
                colors: [],
                needsLyricsMatch: true,
              });
            }
          }
        } catch (err) {
          console.error("Failed to fetch Netease music", err);
          return {
            success: false,
            message: "Failed to load songs from Netease URL",
            songs: [],
          };
        }

        appendSongs(newSongs);
        if (newSongs.length === 0) {
          return {
            success: false,
            message: "Failed to load songs from Netease URL",
            songs: [],
          };
        }

        return { success: true, songs: newSongs };
      }

      // Try Audio Stream (Internet Archive or Self-hosted)
      try {
        const { track, error } = await fetchAudioFromUrl(input);

        if (track) {
          const colors = track.coverUrl ? await extractColors(track.coverUrl) : [];

          const newSong: Song = {
            id: track.id,
            title: track.title,
            artist: track.artist || 'Unknown Artist',
            fileUrl: track.audioUrl,
            coverUrl: track.coverUrl,
            lyrics: [],
            colors,
            needsLyricsMatch: true,
            isAudioStream: true,
            audioStreamSource: track.source,
          };

          appendSongs([newSong]);
          return { success: true, songs: [newSong] };
        }

        if (error) {
          return {
            success: false,
            message: error.message,
            songs: [],
          };
        }
      } catch (err) {
        console.error("Failed to fetch audio stream", err);
      }

      // No valid link found
      return {
        success: false,
        message:
          "Invalid URL. Supported: Netease Cloud Music, Internet Archive, or direct audio file URLs",
        songs: [],
      };
    },
    [appendSongs],
  );

  return {
    queue,
    originalQueue,
    updateSongInQueue,
    removeSongs,
    addLocalFiles,
    importFromUrl,
    setQueue,
    setOriginalQueue,
  };
};
