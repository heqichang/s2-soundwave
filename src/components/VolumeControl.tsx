import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import clsx from "clsx";

interface VolumeControlProps {
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
}

export default function VolumeControl({
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const { volume, isMuted, setVolume, toggleMute } = usePlayerStore();

  const effectiveVolume = isMuted ? 0 : volume;

  const VolumeIcon = () => {
    if (isMuted || effectiveVolume === 0) {
      return <VolumeX size={20} />;
    }
    if (effectiveVolume < 0.5) {
      return <Volume1 size={20} />;
    }
    return <Volume2 size={20} />;
  };

  const handleVolumeSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    } else {
      setVolume(newVolume);
    }
  };

  const handleMuteClick = () => {
    if (onToggleMute) {
      onToggleMute();
    } else {
      toggleMute();
    }
  };

  const displayVolume = Math.round(effectiveVolume * 100);

  return (
    <div className="flex items-center gap-3 w-full max-w-xs">
      <button
        type="button"
        onClick={handleMuteClick}
        aria-label={isMuted ? "取消静音" : "静音"}
        className={clsx(
          "btn-icon w-10 h-10 transition-all duration-200",
          isMuted
            ? "text-brand-400 bg-brand-400/10"
            : "text-surface-200 hover:text-brand-400 hover:bg-surface-700/60",
        )}
      >
        <VolumeIcon />
      </button>

      <div className="flex-1 relative">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effectiveVolume}
          onChange={handleVolumeSlider}
          className="custom-slider w-full relative z-10"
          style={{
            background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${displayVolume}%, rgba(51, 65, 85, 0.8) ${displayVolume}%, rgba(51, 65, 85, 0.8) 100%)`,
            borderRadius: "9999px",
            height: "6px",
          }}
        />
      </div>

      <span className="text-xs font-mono text-surface-400 min-w-[36px] text-right">
        {displayVolume}%
      </span>
    </div>
  );
}
