import { ListMusic, X, Play, Pause, Music } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { formatTime, formatFileSize } from "@/utils/format";
import clsx from "clsx";

interface PlaylistProps {
  onSelectTrack?: (index: number) => void;
}

export default function Playlist({ onSelectTrack }: PlaylistProps) {
  const {
    playlist,
    currentIndex,
    isPlaying,
    removeFromPlaylist,
    setCurrentIndex,
  } = usePlayerStore();

  if (playlist.length === 0) {
    return null;
  }

  const handleSelect = (index: number) => {
    if (index === currentIndex) {
      return;
    }
    setCurrentIndex(index);
    onSelectTrack?.(index);
  };

  return (
    <div className="glass-card rounded-2xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListMusic size={18} className="text-accent-400" />
          <h3 className="font-display font-semibold text-surface-100">播放列表</h3>
          <span className="text-xs text-surface-500 bg-surface-700/60 px-2 py-0.5 rounded-full">
            {playlist.length}
          </span>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1 -mx-2 px-2">
        {playlist.map((file, index) => {
          const isCurrent = index === currentIndex;
          return (
            <div
              key={file.id}
              onClick={() => handleSelect(index)}
              className={clsx(
                "group relative flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer",
                isCurrent
                  ? "bg-accent-500/10 border border-accent-500/20"
                  : "hover:bg-surface-700/40 border border-transparent",
              )}
            >
              <div
                className={clsx(
                  "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-mono font-semibold transition-all",
                  isCurrent
                    ? "bg-accent-500/20 text-accent-400"
                    : "bg-surface-700/50 text-surface-500 group-hover:text-surface-300",
                )}
              >
                {isCurrent && isPlaying ? (
                  <Pause size={14} fill="currentColor" />
                ) : isCurrent ? (
                  <Play size={14} className="fill-current" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={clsx(
                    "text-sm font-medium truncate",
                    isCurrent ? "text-accent-400" : "text-surface-200",
                  )}
                  title={file.name}
                >
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-surface-500">
                    {formatFileSize(file.size)}
                  </span>
                  {file.duration !== undefined && file.duration > 0 && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span className="text-xs text-surface-500 font-mono">
                        {formatTime(file.duration)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromPlaylist(file.id);
                }}
                className={clsx(
                  "opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all",
                  "text-surface-500 hover:text-red-400 hover:bg-red-400/10",
                )}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
