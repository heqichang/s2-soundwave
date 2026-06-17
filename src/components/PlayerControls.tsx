import { Play, Pause, Square, SkipBack, SkipForward, Shuffle, Repeat } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import clsx from "clsx";

interface PlayerControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function PlayerControls({
  onPlay,
  onPause,
  onStop,
  onPrev,
  onNext,
}: PlayerControlsProps) {
  const { isPlaying, currentFile, playlist, currentIndex } = usePlayerStore();
  const hasFile = !!currentFile;
  const hasPlaylist = playlist.length > 1;

  const handleMainClick = () => {
    if (!hasFile) return;
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const IconButton = ({
    children,
    onClick,
    disabled,
    size = "md",
    className = "",
    ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    ariaLabel: string;
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
          className,
        )}
      >
        {children}
      </button>
    );
  };

  return (
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

      <IconButton
        ariaLabel="循环播放"
        size="sm"
        disabled={!hasFile}
        className="opacity-50"
      >
        <Repeat size={16} />
      </IconButton>
    </div>
  );
}
