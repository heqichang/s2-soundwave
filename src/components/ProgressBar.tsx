import { useState, useRef, useEffect } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { formatTime } from "@/utils/format";

interface ProgressBarProps {
  onSeek?: (time: number) => void;
}

export default function ProgressBar({ onSeek }: ProgressBarProps) {
  const { currentTime, duration, currentFile } = usePlayerStore();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTime, setTooltipTime] = useState(0);
  const [tooltipX, setTooltipX] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const updateProgress = (clientX: number) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    if (onSeek) {
      onSeek(pct * duration);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentFile) return;
    isDragging.current = true;
    updateProgress(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setTooltipX(x);
    setTooltipTime((x / rect.width) * duration);

    if (isDragging.current) {
      updateProgress(e.clientX);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateProgress(e.clientX);
      }
    };

    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [duration]);

  return (
    <div className="w-full">
      <div
        ref={progressRef}
        className="relative h-2 rounded-full cursor-pointer group"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="absolute inset-0 rounded-full bg-surface-700/80" />

        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-75 ease-linear group-hover:h-full"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, #06b6d4 0%, #22d3ee 50%, #a78bfa 100%)",
          }}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 border-2 border-brand-400"
          style={{ left: `${percent}%` }}
        />

        {showTooltip && duration > 0 && (
          <div
            className="absolute -top-8 px-2 py-1 rounded-md bg-surface-700 text-xs font-mono text-surface-100 -translate-x-1/2 opacity-100 transition-opacity shadow-lg whitespace-nowrap z-10"
            style={{ left: tooltipX }}
          >
            {formatTime(tooltipTime)}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-2 text-xs font-mono text-surface-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
