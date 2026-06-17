import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";
import clsx from "clsx";

interface WaveformProps {
  onSeek?: (percent: number) => void;
}

export default function Waveform({ onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { waveformData, currentTime, duration, isPlaying } = usePlayerStore();

  const progressPercent = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();

    const draw = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      if (waveformData.length === 0) {
        const barCount = 60;
        const barWidth = width / barCount - 2;
        for (let i = 0; i < barCount; i++) {
          const barHeight = height * 0.15 + Math.sin(i * 0.3) * height * 0.1;
          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;
          ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
        return;
      }

      const barCount = waveformData.length;
      const barWidth = width / barCount - 2;
      const progressIndex = Math.floor(barCount * progressPercent);

      for (let i = 0; i < barCount; i++) {
        const amplitude = waveformData[i];
        const barHeight = Math.max(4, amplitude * height * 0.85);
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;
        const isPast = i <= progressIndex;

        if (isPast) {
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, "#22d3ee");
          gradient.addColorStop(1, "#06b6d4");
          ctx.fillStyle = gradient;
        } else {
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, "rgba(100, 116, 139, 0.6)");
          gradient.addColorStop(1, "rgba(71, 85, 105, 0.4)");
          ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      draw();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [waveformData, progressPercent]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || waveformData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    onSeek(Math.max(0, Math.min(1, percent)));
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={clsx(
        "relative w-full h-24 rounded-xl overflow-hidden select-none",
        waveformData.length > 0 && "cursor-pointer",
        isPlaying && waveformData.length > 0 && "animate-breathe",
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {waveformData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-surface-500">加载音频文件后显示波形预览</p>
        </div>
      )}
    </div>
  );
}
