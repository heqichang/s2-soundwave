import { Play, Pause, Square, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, PlayCircle } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useEditorStore } from "@/store/editorStore";
import type { PlaybackMode } from "@/types/editor";
import clsx from "clsx";

interface PlayerControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlaySelection?: () => void;
  onPlayFromSelection?: () => void;
}

export default function PlayerControls({
  onPlay,
  onPause,
  onStop,
  onPrev,
  onNext,
  onPlaySelection,
  onPlayFromSelection,
}: PlayerControlsProps) {
  const { isPlaying, currentFile, playlist, currentIndex } = usePlayerStore();
  const { selection, playbackMode, setPlaybackMode } = useEditorStore();
  const hasFile = !!currentFile;
  const hasPlaylist = playlist.length > 1;
  const hasSelection = selection !== null;

  const handleMainClick = () => {
    if (!hasFile) return;
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const cyclePlaybackMode = () => {
    const modes: PlaybackMode[] = ["normal", "loop-selection", "play-selection"];
    const currentIdx = modes.indexOf(playbackMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    setPlaybackMode(modes[nextIdx]);
  };

  const getPlaybackModeLabel = () => {
    switch (playbackMode) {
      case "loop-selection":
        return "循环选区";
      case "play-selection":
        return "播放选区";
      default:
        return "正常播放";
    }
  };

  const IconButton = ({
    children,
    onClick,
    disabled,
    size = "md",
    className = "",
    ariaLabel,
    active = false,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    ariaLabel: string;
    active?: boolean;
  }) => {
    const sizeClasses = {
      sm: "w-8 h-8",
      md: "w-11 h-11",
      lg: "w-14 h-14",
      xl: "w-18 h-18",
    };

    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          "btn-icon btn-secondary",
          sizeClasses[size],
          disabled && "opacity-40 cursor-not-allowed hover:scale-100 hover:bg-surface-700/60",
          active && "!bg-brand-400/20 !text-brand-400",
          className,
        )}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <IconButton
          ariaLabel="随机播放"
          size="sm"
          disabled={!hasPlaylist}
          className="opacity-50"
        >
          <Shuffle size={16} />
        </IconButton>

        <IconButton
          ariaLabel="上一首"
          size="md"
          onClick={onPrev}
          disabled={!hasPlaylist || currentIndex <= 0}
        >
          <SkipBack size={20} />
        </IconButton>

        <button
          type="button"
          aria-label={isPlaying ? "暂停" : "播放"}
          onClick={handleMainClick}
          disabled={!hasFile}
          className={clsx(
            "btn-icon w-16 h-16 sm:w-[72px] sm:h-[72px] transition-all duration-300",
            hasFile
              ? isPlaying
                ? "btn-primary animate-glow"
                : "btn-primary hover:animate-glow"
              : "bg-surface-700/60 text-surface-400 cursor-not-allowed hover:scale-100",
          )}
        >
          {isPlaying ? (
            <Pause size={28} strokeWidth={2.5} />
          ) : (
            <Play size={28} strokeWidth={2.5} className="ml-1" />
          )}
        </button>

        <IconButton
          ariaLabel="下一首"
          size="md"
          onClick={onNext}
          disabled={!hasPlaylist || currentIndex >= playlist.length - 1}
        >
          <SkipForward size={20} />
        </IconButton>

        <IconButton
          ariaLabel="停止"
          size="md"
          onClick={onStop}
          disabled={!hasFile || (!isPlaying && currentFile === null)}
        >
          <Square size={18} fill="currentColor" />
        </IconButton>
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          ariaLabel={getPlaybackModeLabel()}
          size="sm"
          onClick={cyclePlaybackMode}
          disabled={!hasFile || !hasSelection}
          active={playbackMode !== "normal" && hasSelection}
          className="opacity-50"
        >
          {playbackMode === "loop-selection" ? (
            <Repeat1 size={16} />
          ) : playbackMode === "play-selection" ? (
            <Repeat size={16} />
          ) : (
            <Repeat size={16} />
          )}
        </IconButton>

        {hasSelection && onPlaySelection && (
          <IconButton
            ariaLabel="播放选区"
            size="sm"
            onClick={onPlaySelection}
            className="opacity-50"
          >
            <PlayCircle size={16} />
          </IconButton>
        )}

        {hasSelection && onPlayFromSelection && (
          <button
            type="button"
            onClick={onPlayFromSelection}
            className="text-[10px] text-surface-400 hover:text-brand-400 transition-colors px-2 py-0.5 rounded hover:bg-surface-700/40"
          >
            从选区播放
          </button>
        )}
      </div>
    </div>
  );
}
