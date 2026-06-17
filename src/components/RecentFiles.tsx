import { Clock, Trash2, Play, X, Music2 } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import type { AudioFile } from "@/types/audio";
import { formatFileSize, formatTime } from "@/utils/format";
import clsx from "clsx";

interface RecentFilesProps {
  onSelectFile?: (file: AudioFile) => void;
}

export default function RecentFiles({ onSelectFile }: RecentFilesProps) {
  const { recentFiles, removeRecentFile, clearRecentFiles, currentFile } = usePlayerStore();

  if (recentFiles.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center gap-3 opacity-60">
        <Clock size={36} className="text-surface-500" />
        <div>
          <p className="text-surface-300 text-sm font-medium">暂无最近文件</p>
          <p className="text-surface-500 text-xs mt-1">打开音频文件后将自动保存到此处</p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `今天 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    if (diffDays === 1) {
      return "昨天";
    }
    if (diffDays < 7) {
      return `${diffDays} 天前`;
    }
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-brand-400" />
          <h3 className="font-display font-semibold text-surface-100">最近播放</h3>
          <span className="text-xs text-surface-500 bg-surface-700/60 px-2 py-0.5 rounded-full">
            {recentFiles.length}
          </span>
        </div>
        <button
          type="button"
          onClick={clearRecentFiles}
          className="text-xs text-surface-500 hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <Trash2 size={12} />
          <span>清空</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 -mx-2 px-2">
        {recentFiles.map((file, index) => {
          const isCurrent = currentFile?.name === file.name;
          return (
            <div
              key={file.id}
              className={clsx(
                "group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer",
                isCurrent
                  ? "bg-brand-400/10 border border-brand-400/20"
                  : "hover:bg-surface-700/40 border border-transparent",
              )}
              style={{ animation: `slideUp 0.4s ease-out ${index * 30}ms both` }}
              onClick={() => onSelectFile?.(file)}
            >
              <div
                className={clsx(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                  isCurrent
                    ? "bg-brand-400/20 text-brand-400"
                    : "bg-surface-700/50 text-surface-400 group-hover:bg-surface-600/50",
                )}
              >
                {isCurrent ? (
                  <Play size={16} className="fill-current" />
                ) : (
                  <Music2 size={16} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={clsx(
                    "text-sm font-medium truncate",
                    isCurrent ? "text-brand-300" : "text-surface-200",
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
                      <span className="text-xs text-surface-500">
                        {formatTime(file.duration)}
                      </span>
                    </>
                  )}
                  <span className="text-surface-600">·</span>
                  <span className="text-xs text-surface-500">
                    {formatDate(file.openedAt)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRecentFile(file.id);
                }}
                className={clsx(
                  "opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all",
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
