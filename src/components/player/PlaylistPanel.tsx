
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { Song } from '../../types';
import { CheckIcon, PlusIcon, QueueIcon, TrashIcon, SelectAllIcon, CloudDownloadIcon, SearchIcon, InfoIcon } from '../common/Icons';
import { useKeyboardScope } from '../../hooks/useKeyboardScope';
import ImportMusicDialog from '../modals/ImportMusicDialog';
import SmartImage from '../common/SmartImage';
import { useI18n } from '../../contexts/I18nContext';
import { buildSongIdIndexMap } from '../../utils/songLookup';

const IOS_SCROLLBAR_STYLES = `
  .playlist-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.65) rgba(255, 255, 255, 0.02);
  }
  .playlist-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .playlist-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(28px);
  }
  .playlist-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.5));
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    backdrop-filter: blur(24px);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
  }
  .playlist-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.72));
  }
`;

interface PlaylistPanelProps {
    isOpen: boolean;
    onClose: () => void;
    queue: Song[];
    currentSongId?: string;
    onPlay: (index: number) => void;
    onImport: (url: string) => Promise<boolean>;
    onRemove: (ids: string[]) => void;
    accentColor: string;
    onFilesSelected?: (files: FileList) => void;
    onSearchClick: () => void;
}

const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
    isOpen,
    onClose,
    queue,
    currentSongId,
    onPlay,
    onImport,
    onRemove,
    accentColor,
    onFilesSelected,
    onSearchClick
}) => {
    const { t } = useI18n();
    const [isAdding, setIsAdding] = useState(false);
    const [showInfoId, setShowInfoId] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Virtualization Constants
    const ITEM_HEIGHT = 74; // Approx height of each item (including margin)
    const OVERSCAN = 5;
    const queueIndexMap = useMemo(() => buildSongIdIndexMap(queue), [queue]);
    const currentSongIndex = currentSongId ? (queueIndexMap.get(currentSongId) ?? -1) : -1;

    // ESC key support using keyboard scope
    useKeyboardScope(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isAdding) {
                e.preventDefault();
                onClose();
                return true; // Claim the event
            }
            return false;
        },
        100, // High priority
        isOpen, // Only active when panel is open
    );

    // Handle animation visibility with react-spring
    const transitions = useTransition(isOpen, {
        from: { opacity: 0, transform: 'translateY(-20px) scale(0.95)' },
        enter: { opacity: 1, transform: 'translateY(0px) scale(1)' },
        leave: { opacity: 0, transform: 'translateY(-20px) scale(0.95)' },
        config: { tension: 280, friction: 24 }, // Rebound feel
        onRest: () => {
            if (!isOpen) {
                setIsEditing(false);
                setSelectedIds(new Set());
            }
        }
    });

    // Scroll to current song when opening
    useEffect(() => {
        if (isOpen && listRef.current) {
            const index = currentSongIndex;
            if (index !== -1) {
                const containerHeight = listRef.current.clientHeight;
                const targetScroll = (index * ITEM_HEIGHT) - (containerHeight / 2) + (ITEM_HEIGHT / 2);
                listRef.current.scrollTop = targetScroll;
                setScrollTop(targetScroll);
            } else {
                listRef.current.scrollTop = 0;
                setScrollTop(0);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentSongIndex]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && !isAdding && panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, isAdding]);

    // Close info popup when scrolling
    useEffect(() => {
        if (showInfoId && listRef.current) {
            const handleScroll = () => setShowInfoId(null);
            listRef.current.addEventListener('scroll', handleScroll);
            return () => {
                listRef.current?.removeEventListener('scroll', handleScroll);
            };
        }
    }, [showInfoId]);

    const handleImport = async (url: string) => {
        const success = await onImport(url);
        if (success) {
            setIsAdding(false);
        }
        return success;
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleDelete = () => {
        onRemove(Array.from(selectedIds));
        setSelectedIds(new Set());
        setIsEditing(false);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === queue.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(queue.map(song => song.id)));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0 && onFilesSelected) {
            onFilesSelected(files);
        }
        e.target.value = "";
    };

    // Virtual List Logic
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    const { virtualItems, totalHeight, startOffset } = useMemo(() => {
        const totalHeight = queue.length * ITEM_HEIGHT;
        const containerHeight = 600; // Approx max height

        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        let endIndex = Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT);

        startIndex = Math.max(0, startIndex - OVERSCAN);
        endIndex = Math.min(queue.length, endIndex + OVERSCAN);

        const virtualItems = [];
        for (let i = startIndex; i < endIndex; i++) {
            virtualItems.push({
                ...queue[i],
                index: i
            });
        }

        return {
            virtualItems,
            totalHeight,
            startOffset: startIndex * ITEM_HEIGHT
        };
    }, [queue, scrollTop]);

    return (
        <>
            <style>{IOS_SCROLLBAR_STYLES}</style>
            {transitions((style, item) => item && (
                <animated.div
                    ref={panelRef}
                    style={{ ...style, maxHeight: '60vh' }}
                    className={`
                        absolute top-20 -right-8 z-50
                        w-[340px] 
                        bg-black/10 backdrop-blur-[100px] saturate-150
                        rounded-[32px] 
                        shadow-[0_20px_50px_rgba(0,0,0,0.3)] 
                        border border-white/5
                        flex flex-col overflow-hidden
                        origin-top-right
                    `}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* iOS 18 Style Header */}
                    <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between bg-transparent border-b border-white/5">
                        <div className="flex flex-col">
                            <h3 className="text-white text-lg font-bold leading-none tracking-tight">{t("playlist.playingNext")}</h3>
                            <span className="text-white/40 text-xs font-medium mt-1">{queue.length} {t("playlist.songs")}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={handleSelectAll}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedIds.size === queue.length && queue.length > 0 ? 'text-white bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                                        title={t("playlist.selectAll")}
                                    >
                                        <SelectAllIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedIds.size > 0 ? 'text-red-400 hover:bg-red-500/10' : 'text-white/20 cursor-not-allowed'}`}
                                        title={t("playlist.deleteSelected")}
                                        disabled={selectedIds.size === 0}
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                                        style={{ color: accentColor }}
                                        title={t("playlist.done")}
                                    >
                                        <CheckIcon className="w-5 h-5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={onSearchClick}
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-white/50 hover:text-white hover:bg-white/10"
                                        title={`${t("topBar.search")} (Cmd+K)`}
                                    >
                                        <SearchIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-white/50 hover:text-white hover:bg-white/10"
                                        title={t("playlist.importLocal")}
                                    >
                                        <CloudDownloadIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setIsAdding(true)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-white/50 hover:text-white hover:bg-white/10"
                                        title={t("playlist.addFromUrl")}
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-white/50 hover:text-white hover:bg-white/10"
                                        title={t("playlist.editList")}
                                    >
                                        <QueueIcon className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Scrollable List with Virtualization */}
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto playlist-scrollbar px-2 py-2 relative"
                    >
                        {queue.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-white/30 space-y-2">
                                <p className="text-xs font-medium">{t("playlist.empty")}</p>
                            </div>
                        ) : (
                            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                                {virtualItems.map((song) => {
                                    const index = song.index;
                                    const isCurrent = song.id === currentSongId;
                                    const isSelected = selectedIds.has(song.id);

                                    return (
                                        <div
                                            key={`${song.id}-${index}`}
                                            className={`
                                    absolute left-0 right-0 h-[66px]
                                    group flex items-center gap-3 p-2 mx-2 rounded-2xl cursor-pointer transition-all duration-200
                                    ${isEditing ? 'hover:bg-white/10' : isCurrent ? 'bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]' : 'hover:bg-white/5'}
                                `}
                                            style={{
                                                top: `${index * ITEM_HEIGHT}px`,
                                                // Adjust height within the slot if needed, ITEM_HEIGHT includes gap
                                                height: '66px'
                                            }}
                                        >
                                            {/* Edit Mode Checkbox */}
                                            {isEditing && (
                                                <div className={`
                                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ml-1
                                        ${isSelected ? 'border-transparent' : 'border-white/20 group-hover:border-white/40'}
                                    `}
                                                    style={{ backgroundColor: isSelected ? accentColor : 'transparent' }}
                                                >
                                                    {isSelected && (
                                                        <CheckIcon className="w-3 h-3 text-white" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Cover & Indicator */}
                                            <div
                                                onClick={() => {
                                                    if (isEditing) toggleSelection(song.id);
                                                    else onPlay(index);
                                                }}
                                                className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-white/5 shadow-sm"
                                            >
                                                {song.coverUrl ? (
                                                    <SmartImage
                                                        src={song.coverUrl}
                                                        alt={song.title}
                                                        containerClassName="w-full h-full"
                                                        imgClassName={`w-full h-full object-cover transition-opacity duration-300 ${isCurrent && !isEditing ? 'opacity-40 blur-[1px]' : ''}`}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white/20 text-[10px]">♪</div>
                                                )}

                                                {/* Redesigned Now Playing Indicator (Equalizer) */}
                                                {isCurrent && !isEditing && (
                                                    <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
                                                        <div className="w-[3px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite]" style={{ height: '12px', color: accentColor }}></div>
                                                        <div className="w-[3px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.2s]" style={{ height: '20px', color: accentColor }}></div>
                                                        <div className="w-[3px] bg-current rounded-full animate-[eq-bounce_1s_ease-in-out_infinite_0.4s]" style={{ height: '15px', color: accentColor }}></div>
                                                        <style>{`
                                                @keyframes eq-bounce {
                                                    0%, 100% { transform: scaleY(0.4); opacity: 0.8; }
                                                    50% { transform: scaleY(1.0); opacity: 1; }
                                                }
                                            `}</style>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Text */}
                                            <div
                                                onClick={() => {
                                                    if (isEditing) toggleSelection(song.id);
                                                    else onPlay(index);
                                                }}
                                                className="flex-1 min-w-0 flex flex-col justify-center gap-0.5"
                                            >
                                                <div className={`text-[15px] font-semibold truncate leading-tight transition-colors duration-300`}
                                                    style={{ color: isCurrent ? accentColor : 'rgba(255,255,255,0.9)' }}>
                                                    {song.title}
                                                </div>
                                                <div className="text-[13px] text-white/50 truncate font-medium">
                                                    {song.artist}
                                                </div>
                                            </div>

                                            {/* Info Icon */}
                                            {!isEditing && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowInfoId(showInfoId === song.id ? null : song.id);
                                                    }}
                                                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-white/30 hover:text-white/70 hover:bg-white/10 opacity-0 group-hover:opacity-100 mr-1"
                                                    title={t("playlist.songInfo")}
                                                >
                                                    <InfoIcon className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Info Popup */}
                                            {showInfoId === song.id && !isEditing && (
                                                <div
                                                    className="absolute left-0 right-0 top-full mt-2 z-50 mx-2 bg-black/40 backdrop-blur-2xl saturate-150 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start gap-3">
                                                            {song.coverUrl && (
                                                                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-white/5">
                                                                    <SmartImage
                                                                        src={song.coverUrl}
                                                                        alt={song.title}
                                                                        containerClassName="w-full h-full"
                                                                        imgClassName="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-white text-sm font-semibold truncate">{song.title}</div>
                                                                <div className="text-white/60 text-xs truncate">{song.artist}</div>
                                                            </div>
                                                        </div>

                                                        <div className="h-px bg-white/10" />

                                                        <div className="space-y-2 text-xs">
                                                            {song.album && (
                                                                <div>
                                                                    <div className="text-white/40 mb-0.5">{t("playlist.album")}</div>
                                                                    <div className="text-white/80">{song.album}</div>
                                                                </div>
                                                            )}

                                                            {song.lyrics && song.lyrics.length > 0 && (
                                                                <div>
                                                                    <div className="text-white/40 mb-0.5">Lyrics</div>
                                                                    <div className="text-white/80">
                                                                        {song.lyrics.length} lines
                                                                        {song.localLyrics && song.localLyrics.length > 0 && (
                                                                            <span className="text-white/50"> • {t("playlist.lyricsFromEmbedded")}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {(!song.lyrics || song.lyrics.length === 0) && song.localLyrics && song.localLyrics.length > 0 && (
                                                                <div>
                                                                    <div className="text-white/40 mb-0.5">Lyrics</div>
                                                                    <div className="text-white/80">
                                                                        {song.localLyrics.length} lines • {t("playlist.lyricsFromLrc")}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {song.isNetease && (
                                                                <div>
                                                                    <div className="text-white/40 mb-0.5">Source</div>
                                                                    <div className="text-white/80">{t("playlist.sourceNetease")}</div>
                                                                </div>
                                                            )}

                                                            {song.fileUrl && song.fileUrl.startsWith('blob:') && (
                                                                <div>
                                                                    <div className="text-white/40 mb-0.5">Source</div>
                                                                    <div className="text-white/80">{t("playlist.sourceLocal")}</div>
                                                                </div>
                                                            )}

                                                            {song.duration && (
                                                                <div>
                                                                    <div className="text-white/40 mb-0.5">{t("playlist.duration")}</div>
                                                                    <div className="text-white/80">
                                                                        {Math.floor(song.duration / 60000)}:{String(Math.floor((song.duration % 60000) / 1000)).padStart(2, '0')}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </animated.div>
            ))}

            {/* Hidden File Input */}
            <input
                id="file-input"
                name="audioFiles"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.wma,.ape,.alac,.aiff,.webm,.lrc,.txt"
                multiple
                className="hidden"
            />

            {/* Import Music Dialog */}
            <ImportMusicDialog
                isOpen={isAdding}
                onClose={() => setIsAdding(false)}
                onImport={handleImport}
            />
        </>
    );
};

export default PlaylistPanel;
