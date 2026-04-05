import React, { Suspense, lazy, useCallback, useState, useMemo } from "react";
import { Song } from "../../types";

interface UseModalRootReturn {
  showSearch: boolean;
  showPlaylist: boolean;
  showImportDialog: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPlaylist: React.Dispatch<React.SetStateAction<boolean>>;
  setShowImportDialog: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenSearch: () => void;
  handleOpenPlaylist: () => void;
  handleOpenImportDialog: () => void;
  ModalRenderer: React.FC;
}

export function useModalRoot(
  queue: Song[],
  currentSong: Song | null | undefined,
  isPlaying: boolean,
  accentColor: string,
  onPlayQueueIndex: (index: number) => void,
  onImportAndPlay: (song: Song) => void,
  onAddToQueue: (song: Song) => void,
  onImportUrl: (url: string) => Promise<boolean>,
  onFilesSelected: (files: FileList) => void,
  onSearchClick?: () => void,
): UseModalRootReturn {
  const [showSearch, setShowSearch] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const LazySearchModal = useMemo(
    () => lazy(() => import("../modals/SearchModal")),
    [],
  );
  const LazyPlaylistPanel = useMemo(
    () => lazy(() => import("../player/PlaylistPanel")),
    [],
  );
  const LazyImportMusicDialog = useMemo(
    () => lazy(() => import("../modals/ImportMusicDialog")),
    [],
  );

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
    onSearchClick?.();
  }, [onSearchClick]);

  const handleOpenPlaylist = useCallback(() => {
    setShowPlaylist(true);
  }, []);

  const handleOpenImportDialog = useCallback(() => {
    setShowImportDialog(true);
  }, []);

  const ModalRenderer: React.FC = useCallback(
    () => (
      <>
        {showSearch && (
          <Suspense fallback={null}>
            <LazySearchModal
              isOpen={showSearch}
              onClose={() => setShowSearch(false)}
              queue={queue}
              onPlayQueueIndex={onPlayQueueIndex}
              onImportAndPlay={onImportAndPlay}
              onAddToQueue={onAddToQueue}
              currentSong={currentSong ?? null}
              isPlaying={isPlaying}
              accentColor={accentColor}
            />
          </Suspense>
        )}

        {showPlaylist && (
          <Suspense fallback={null}>
            <LazyPlaylistPanel
              isOpen={showPlaylist}
              onClose={() => setShowPlaylist(false)}
              queue={queue}
              currentSongId={currentSong?.id}
              onPlay={onPlayQueueIndex}
              onImport={onImportUrl}
              onRemove={() => {}}
              accentColor={accentColor}
              onFilesSelected={onFilesSelected}
              onSearchClick={handleOpenSearch}
            />
          </Suspense>
        )}

        {showImportDialog && (
          <Suspense fallback={null}>
            <LazyImportMusicDialog
              isOpen={showImportDialog}
              onClose={() => setShowImportDialog(false)}
              onImport={onImportUrl}
            />
          </Suspense>
        )}
      </>
    ),
    [
      showSearch,
      showPlaylist,
      showImportDialog,
      LazySearchModal,
      LazyPlaylistPanel,
      LazyImportMusicDialog,
      queue,
      currentSong,
      isPlaying,
      accentColor,
      onPlayQueueIndex,
      onImportAndPlay,
      onAddToQueue,
      onImportUrl,
      onFilesSelected,
      handleOpenSearch,
    ],
  );

  return {
    showSearch,
    showPlaylist,
    showImportDialog,
    setShowSearch,
    setShowPlaylist,
    setShowImportDialog,
    handleOpenSearch,
    handleOpenPlaylist,
    handleOpenImportDialog,
    ModalRenderer,
  };
}
